import * as THREE from 'three';
import { ObjectPool } from '../utils/ObjectPool.js';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import EventBus from '../core/EventBus.js';
import ResourceRegistry from '../core/ResourceRegistry.js';
import { FEATURE_FLAGS } from '../config/gameConfig.js';

/**
 * CollectorSystem — ECS-driven resource collection.
 *
 * Two collection modes:
 * 1. Ground pickup: loose resource disks on the ground (from entity:died drops)
 * 2. Stack pickup: items from nearby tagged entities (e.g. coins from coin tray)
 *
 * Queries: ['Transform', 'Collector', 'InventoryStack']
 * Listens: 'entity:died' → spawns resource disks
 * Emits:   'item:collected' { collectorId, itemType, mesh }
 */
export class CollectorSystem {
    constructor(scene) {
        this.scene = scene;
        this._disks = [];       // loose ground disks
        this._pools = {};       // per-type object pools
        this._transfer = new ResourceTransfer();

        EventBus.on('entity:died', ({ position, drops }) => {
            if (drops) {
                for (const type of drops) {
                    this._spawnDisks(position, type);
                }
            }
        });

        // Generic resource spawn — used by ResourceWells and other non-combat sources.
        EventBus.on('resource:spawn', ({ position, type }) => {
            this._spawnDisks(position, type);
        });

        // Pre-positioned collectible — mesh already in scene at its final position.
        // Used by machine output to register items for magnet collection.
        EventBus.on('resource:place', ({ mesh, type }) => {
            mesh._resourceType = type;
            mesh.isFlying = false;
            mesh.collected = false;
            mesh.targetEntityId = null;
            mesh.curve = null;
            mesh.flightElapsed = 0;
            this._disks.push(mesh);
        });
    }

    _getPool(resourceType) {
        if (!this._pools[resourceType]) {
            this._pools[resourceType] = new ObjectPool(
                () => ResourceRegistry.createMesh(resourceType),
                40,
                `CollectorPool_${resourceType}`
            );
        }
        return this._pools[resourceType];
    }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);

        // --- Decay tick (essence drops only — disk.userData.decayLeft set in _spawnDisks) ---
        for (const disk of this._disks) {
            if (disk.collected || disk.isFlying) continue;
            if (disk.userData?.decayLeft == null) continue;
            disk.userData.decayLeft -= deltaTime;
            if (disk.userData.decayLeft <= 0) {
                this.scene.remove(disk);
                if (disk._pool) disk._pool.release(disk);
                disk.collected = true;
                continue;
            }
            // Shrink: scale 1.0 → 0.4 across the full 10s window
            const t = disk.userData.decayLeft / disk.userData.decayTotal;
            const s = 0.4 + 0.6 * t;
            disk.scale.set(s, s, s);
            // Opacity fade: 1.0 → 0.0 across the last 3 seconds
            if (disk.userData.decayLeft < 3.0) {
                this._setDiskOpacity(disk, disk.userData.decayLeft / 3.0);
                if (!disk.userData.decayWarned) {
                    disk.userData.decayWarned = true;
                    EventBus.emit('essence:fading', { resourceType: disk._resourceType });
                }
            }
        }
        this._disks = this._disks.filter(d => !d.collected);

        // --- Ground disk collection ---
        for (const disk of this._disks) {
            if (disk.isFlying) {
                this._animateDisk(disk, deltaTime, ecs);
                continue;
            }

            for (const entityId of entities) {
                const transform = ecs.getComponent(entityId, 'Transform');
                const collector = ecs.getComponent(entityId, 'Collector');
                const inventory = ecs.getComponent(entityId, 'InventoryStack');
                if (!transform || !collector || !inventory) continue;

                const diskType = (disk.userData && disk.userData.resourceType) || 'meat';

                // Check if collector accepts this type
                if (!collector.resourceTypes.includes(diskType)
                    && !collector.resourceTypes.includes('any')) continue;

                // Check if inventory has room for this type
                if (!inventory.canAccept(diskType)) continue;

                const dist = disk.position.distanceTo(transform.mesh.position);
                const hasRoom = (inventory.getCountByType(diskType) + collector.inFlightCount)
                    < inventory.slotCapacity;

                if (dist < collector.radius && hasRoom) {
                    this._startFlight(disk, entityId, transform.mesh.position, collector);
                    break;
                }
            }
        }
        this._disks = this._disks.filter(d => !d.collected);

        // --- Stack pickup from tagged entities ---
        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const collector = ecs.getComponent(entityId, 'Collector');
            const inventory = ecs.getComponent(entityId, 'InventoryStack');
            if (!transform || !collector || !inventory) continue;
            if (!collector.collectFromTags || collector.collectFromTags.length === 0) continue;

            collector.pickupTimer += deltaTime;
            if (collector.pickupTimer < collector.pickupRate) continue;

            const sources = ecs.queryEntities(['Transform', 'Tag', 'InventoryStack']);
            for (const sourceId of sources) {
                if (sourceId === entityId) continue;
                const sourceTag = ecs.getComponent(sourceId, 'Tag');
                if (!sourceTag) continue;

                const hasTag = collector.collectFromTags.some(t => sourceTag.has(t));
                if (!hasTag) continue;

                const sourceTransform = ecs.getComponent(sourceId, 'Transform');
                const sourceInv = ecs.getComponent(sourceId, 'InventoryStack');
                if (!sourceTransform || !sourceInv) continue;

                const dist = transform.mesh.position.distanceTo(sourceTransform.mesh.position);
                if (dist > collector.radius) continue;
                if (sourceInv.getTotalCount() === 0) continue;

                // Find a resource type in the source that we can accept
                for (const slot of sourceInv.slots) {
                    if (slot.stack.getCount() === 0) continue;
                    if (!inventory.canAccept(slot.type)) continue;
                    if (!collector.resourceTypes.includes(slot.type)
                        && !collector.resourceTypes.includes('any')) continue;

                    const mesh = sourceInv.popFromSlot(slot.type);
                    if (!mesh) continue;

                    collector.pickupTimer = 0;

                    // Arc from source to collector
                    const fromPos = mesh.position.clone();
                    const toPos = transform.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));

                    this._transfer.send(mesh, fromPos, toPos, {
                        arcHeight: 2.5,
                        duration: 0.45,
                        spin: true,
                        onArrive: (m) => {
                            const clone = m;
                            EventBus.emit('item:collected', {
                                collectorId: entityId,
                                itemType: slot.type,
                                mesh: clone
                            });
                        }
                    });

                    // Emit stack change on source
                    EventBus.emit('stack:changed', {
                        entityId: sourceId,
                        type: slot.type,
                        count: sourceInv.getCountByType(slot.type),
                        totalCount: sourceInv.getTotalCount()
                    });

                    break; // one item per tick per source
                }
            }
        }
    }

    _spawnDisks(pos, resourceType) {
        // Feature flag: replace meat drops with essence (reversible toggle).
        if (FEATURE_FLAGS.USE_ESSENCE_DROPS && resourceType === 'meat') {
            resourceType = 'essence';
        }
        const count = 1;
        const pool = this._getPool(resourceType);
        for (let i = 0; i < count; i++) {
            const disk = pool.get();
            const angle = Math.random() * Math.PI * 2;
            const r = 1.5 * Math.sqrt(Math.random());
            disk.position.set(
                pos.x + Math.cos(angle) * r,
                0.05,
                pos.z + Math.sin(angle) * r
            );
            disk.isFlying = false;
            disk.collected = false;
            disk.targetEntityId = null;
            disk.curve = null;
            disk.flightElapsed = 0;
            disk._resourceType = resourceType;
            disk._pool = pool;

            // Reset visual state in case this disk was previously decayed
            // before pool release (otherwise we'd reuse a shrunken/faded mesh).
            disk.scale.set(1, 1, 1);
            this._setDiskOpacity(disk, 1.0);

            // Prototype: 10s decay timer on uncollected essence drops.
            // Magnet pickup removes the disk from this._disks, naturally
            // canceling the decay. Other resource types ignore decay.
            disk.userData = disk.userData || {};
            if (resourceType === 'essence') {
                disk.userData.decayLeft = 10.0;
                disk.userData.decayTotal = 10.0;
                disk.userData.decayWarned = false;
            } else {
                disk.userData.decayLeft = null;
            }

            this.scene.add(disk);
            this._disks.push(disk);
        }
    }

    /** Set opacity on disk + all child meshes (some presets are groups). */
    _setDiskOpacity(disk, opacity) {
        const apply = (mesh) => {
            if (!mesh.material) return;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
                if (opacity < 1.0) m.transparent = true;
                m.opacity = opacity;
            }
        };
        apply(disk);
        disk.traverse((child) => apply(child));
    }

    _startFlight(disk, entityId, targetPos, collector) {
        disk.isFlying = true;
        disk.targetEntityId = entityId;
        disk.flightElapsed = 0;
        collector.inFlightCount++;

        const start = disk.position.clone();
        const end = targetPos.clone().add(new THREE.Vector3(0, 1.2, 0));
        const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 4.5, 0));
        disk.curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    }

    _animateDisk(disk, deltaTime, ecs) {
        const FLIGHT_DURATION = 0.5;
        disk.flightElapsed += deltaTime;
        const t = Math.min(disk.flightElapsed / FLIGHT_DURATION, 1);

        if (disk.targetEntityId !== null) {
            const transform = ecs.getComponent(disk.targetEntityId, 'Transform');
            if (transform) {
                disk.curve.v2.copy(transform.mesh.position).add(new THREE.Vector3(0, 1.2, 0));
            }
        }

        disk.position.copy(disk.curve.getPoint(t));

        if (t >= 1) {
            const collector = ecs && disk.targetEntityId !== null
                ? ecs.getComponent(disk.targetEntityId, 'Collector')
                : null;
            if (collector) collector.inFlightCount = Math.max(0, collector.inFlightCount - 1);

            const resourceType = disk._resourceType
                || (disk.userData && disk.userData.resourceType)
                || 'meat';

            // Multi-state resources (e.g. essence) get a fresh "stacked" mesh
            // so the carried form can differ from the ground form. For
            // single-mesh resources (meat, coin, ...) ResourceRegistry returns
            // the same shape as before.
            const clone = ResourceRegistry.createMesh(resourceType, 'stacked');
            clone.position.copy(disk.position);
            clone.userData = { ...clone.userData, resourceType };
            EventBus.emit('item:collected', {
                collectorId: disk.targetEntityId,
                itemType: resourceType,
                mesh: clone
            });

            this.scene.remove(disk);
            if (disk._pool) disk._pool.release(disk);
            disk.collected = true;
        }
    }
}
