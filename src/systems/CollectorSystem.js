import * as THREE from 'three';
import { ObjectPool } from '../utils/ObjectPool.js';
import EventBus from '../core/EventBus.js';
import ResourceRegistry from '../core/ResourceRegistry.js';

/**
 * CollectorSystem — ECS-driven replacement for HarvestSystem.
 *
 * Queries entities with ['Transform', 'Collector', 'InventoryStack'].
 * Listens: 'entity:died' → spawns resource disks near death position.
 * Each frame: checks distance from disks to collectors.
 *   If disk within collector.radius AND collector has room → arc disk to entity.
 * Emits: 'item:collected' { collectorId, itemType, mesh } when disk arrives.
 */
export class CollectorSystem {
    constructor(scene) {
        this.scene = scene;
        this._disks = [];
        this._pool = new ObjectPool(() => ResourceRegistry.createMesh('meat'), 60, 'CollectorDiskPool');

        EventBus.on('entity:died', ({ position, drops }) => {
            if (drops && drops.includes('meat')) {
                this._spawnDisks(position);
            }
        });
    }

    /** Called by ECS every frame. */
    update(entities, deltaTime, ecs) {
        for (const disk of this._disks) {
            if (disk.isFlying) {
                this._animateDisk(disk, deltaTime, ecs);
                continue;
            }

            // Check each collector entity for magnetic pull
            for (const entityId of entities) {
                const transform = ecs.getComponent(entityId, 'Transform');
                const collector = ecs.getComponent(entityId, 'Collector');
                const inventory = ecs.getComponent(entityId, 'InventoryStack');
                if (!transform || !collector || !inventory) continue;

                const dist = disk.position.distanceTo(transform.mesh.position);
                const hasRoom = (inventory.stack.getCount() + collector.inFlightCount) < inventory.maxCapacity;

                if (dist < collector.radius && hasRoom) {
                    this._startFlight(disk, entityId, transform.mesh.position, collector);
                    break;
                }
            }
        }

        // Clean up landed disks
        this._disks = this._disks.filter(d => !d.collected);
    }

    _spawnDisks(pos) {
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const disk = this._pool.get();
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
            this.scene.add(disk);
            this._disks.push(disk);
        }
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

        // Update arc end to follow moving entity
        if (disk.targetEntityId !== null) {
            const transform = ecs.getComponent(disk.targetEntityId, 'Transform');
            if (transform) {
                disk.curve.v2.copy(transform.mesh.position).add(new THREE.Vector3(0, 1.2, 0));
            }
        }

        disk.position.copy(disk.curve.getPoint(t));

        if (t >= 1) {
            // Arrived — decrement in-flight count
            const collector = ecs && disk.targetEntityId !== null
                ? ecs.getComponent(disk.targetEntityId, 'Collector')
                : null;
            if (collector) collector.inFlightCount = Math.max(0, collector.inFlightCount - 1);

            // Clone mesh so the pool copy can be released
            const clone = disk.clone();
            EventBus.emit('item:collected', {
                collectorId: disk.targetEntityId,
                itemType: 'meat',
                mesh: clone
            });

            this.scene.remove(disk);
            this._pool.release(disk);
            disk.collected = true;
        }
    }

}
