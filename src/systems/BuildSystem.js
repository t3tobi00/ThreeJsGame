import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import ResourceRegistry from '../core/ResourceRegistry.js';
import EventBus from '../core/EventBus.js';

/**
 * BuildSystem — Listens to zone:funded events and spawns buildings or units.
 *
 * Build type: spawns the building, removes the zone entity.
 * Spawner type: spawns units, resets the zone progress, zone stays.
 * Convert type: outputs resources to a target (by tag, carrier, or position).
 */
export class BuildSystem {
    constructor(scene, factory, particleSystem) {
        this.scene = scene;
        this.factory = factory;
        this.particleSystem = particleSystem;
        this._ecs = null;
        this._resourceTransfer = new ResourceTransfer();

        EventBus.on('zone:funded', (data) => {
            this._handleFunded(data);
        });
    }

    setECS(ecs) { this._ecs = ecs; }

    update(entities, deltaTime, ecs) {
        this._ecs = ecs;
        this._resourceTransfer.update(deltaTime);
    }

    _handleFunded({ zoneId, carrierId, type, builds, spawns, spawnCount }) {
        if (!this._ecs) return;

        const transform = this._ecs.getComponent(zoneId, 'Transform');
        const pos = transform ? transform.mesh.position.clone() : null;
        if (!pos) return;

        const zone = this._ecs.getComponent(zoneId, 'UnlockZone');

        if (this.particleSystem) {
            this.particleSystem.createBurst(pos);
        }

        if (type === 'build') {
            const buildPos = (zone && zone.buildsAt) ? zone.buildsAt.clone() : pos;
            if (builds) {
                this.factory.create(builds, buildPos);
            }
            if (transform.mesh) this.scene.remove(transform.mesh);
            this._ecs.destroyEntity(zoneId);

            EventBus.emit('zone:built', { zoneId, archetype: builds, position: buildPos });

        } else if (type === 'spawner') {
            const spawnPos = (zone && zone.spawnsAt) ? zone.spawnsAt.clone() : pos;
            const count = spawnCount || 1;
            for (let i = 0; i < count; i++) {
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    0,
                    (Math.random() - 0.5) * 2
                );
                if (spawns) {
                    this.factory.create(spawns, spawnPos.clone().add(offset));
                }
            }

            if (zone) {
                for (const key of Object.keys(zone.progress)) {
                    zone.progress[key] = 0;
                }
            }

            EventBus.emit('zone:spawned', { zoneId, archetype: spawns, count });

        } else if (type === 'convert') {
            if (!zone) return;

            const resourceType = zone.output || 'coin';

            // Resolve output target
            const targetId = this._resolveOutputTarget(zone, pos, carrierId);
            if (!targetId) return;

            const targetTransform = this._ecs.getComponent(targetId, 'Transform');
            const targetInv = this._ecs.getComponent(targetId, 'InventoryStack');
            if (!targetTransform || !targetInv) return;

            const count = zone.outputCount || 1;
            for (let i = 0; i < count; i++) {
                const mesh = ResourceRegistry.createMesh(resourceType);
                const startPos = pos.clone();
                startPos.x += (Math.random() - 0.5) * 0.5;
                startPos.y += 0.5 + i * 0.1;
                startPos.z += (Math.random() - 0.5) * 0.5;

                mesh.position.copy(startPos);
                this.scene.add(mesh);

                const toPos = targetTransform.mesh.position.clone();
                toPos.y += 0.4;

                this._resourceTransfer.send(mesh, startPos.clone(), toPos, {
                    arcHeight: 2.0 + i * 0.3,
                    duration: 0.35 + i * 0.08,
                    spin: false,
                    onArrive: (m) => {
                        targetInv.addToSlot(resourceType, m, { animate: true });
                        EventBus.emit('stack:changed', {
                            entityId: targetId,
                            type: resourceType,
                            count: targetInv.getCountByType(resourceType),
                            totalCount: targetInv.getTotalCount()
                        });
                    }
                });
            }

            // Reset zone progress so it's reusable
            for (const key of Object.keys(zone.progress)) {
                zone.progress[key] = 0;
            }
        }
    }

    /**
     * Resolve where convert output goes based on outputTarget config.
     * Returns entity ID or null.
     */
    _resolveOutputTarget(zone, zonePos, carrierId) {
        const target = zone.outputTarget;

        if (target) {
            if (target.tag) {
                return this._findNearestByTag(target.tag, zonePos);
            }
            if (target.carrier && carrierId != null) {
                return carrierId;
            }
            if (target.worldPos) {
                return this._findNearestWithInventory(target.worldPos);
            }
        }

        // Legacy fallback
        if (zone.outputTag) {
            return this._findNearestByTag(zone.outputTag, zonePos);
        }

        return null;
    }

    _findNearestByTag(tagName, position) {
        const candidates = this._ecs.queryEntities(['Transform', 'Tag', 'InventoryStack']);
        let bestId = null;
        let bestDist = Infinity;
        for (const id of candidates) {
            const tag = this._ecs.getComponent(id, 'Tag');
            if (!tag || !tag.has(tagName)) continue;
            const t = this._ecs.getComponent(id, 'Transform');
            if (!t) continue;
            const dist = t.mesh.position.distanceTo(position);
            if (dist < bestDist) {
                bestDist = dist;
                bestId = id;
            }
        }
        return bestId;
    }

    _findNearestWithInventory(worldPos) {
        const candidates = this._ecs.queryEntities(['Transform', 'InventoryStack']);
        let bestId = null;
        let bestDist = Infinity;
        for (const id of candidates) {
            const t = this._ecs.getComponent(id, 'Transform');
            if (!t) continue;
            const dist = t.mesh.position.distanceTo(worldPos);
            if (dist < bestDist) {
                bestDist = dist;
                bestId = id;
            }
        }
        return bestId;
    }
}
