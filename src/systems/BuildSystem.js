import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import ResourceRegistry from '../core/ResourceRegistry.js';
import EventBus from '../core/EventBus.js';

/**
 * BuildSystem — Listens to zone:funded events and spawns buildings or units.
 *
 * Build type: spawns the building, removes the zone entity.
 * Spawner type: spawns units, resets the zone progress, zone stays.
 */
export class BuildSystem {
    constructor(scene, factory, particleSystem) {
        this.scene = scene;
        this.factory = factory;
        this.particleSystem = particleSystem;
        this._ecs = null;
        this._coinTransfer = new ResourceTransfer();

        EventBus.on('zone:funded', (data) => {
            this._handleFunded(data);
        });
    }

    setECS(ecs) { this._ecs = ecs; }

    update(entities, deltaTime, ecs) {
        this._ecs = ecs;
        this._coinTransfer.update(deltaTime);
    }

    _handleFunded({ zoneId, type, builds, spawns, spawnCount }) {
        if (!this._ecs) return;

        const transform = this._ecs.getComponent(zoneId, 'Transform');
        const pos = transform ? transform.mesh.position.clone() : null;
        if (!pos) return;

        if (this.particleSystem) {
            this.particleSystem.createBurst(pos);
        }

        if (type === 'build') {
            if (builds) {
                this.factory.create(builds, pos);
            }
            if (transform.mesh) this.scene.remove(transform.mesh);
            this._ecs.destroyEntity(zoneId);

            EventBus.emit('zone:built', { zoneId, archetype: builds, position: pos });

        } else if (type === 'spawner') {
            const count = spawnCount || 1;
            for (let i = 0; i < count; i++) {
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    0,
                    (Math.random() - 0.5) * 2
                );
                if (spawns) {
                    this.factory.create(spawns, pos.clone().add(offset));
                }
            }

            const zone = this._ecs.getComponent(zoneId, 'UnlockZone');
            if (zone) {
                for (const key of Object.keys(zone.progress)) {
                    zone.progress[key] = 0;
                }
            }

            EventBus.emit('zone:spawned', { zoneId, archetype: spawns, count });

        } else if (type === 'convert') {
            const zone = this._ecs.getComponent(zoneId, 'UnlockZone');
            if (!zone || !zone.outputTag) return;

            const trayId = this._findNearestByTag(zone.outputTag, pos);
            if (!trayId) return;

            const trayTransform = this._ecs.getComponent(trayId, 'Transform');
            const trayInv = this._ecs.getComponent(trayId, 'InventoryStack');
            if (!trayTransform || !trayInv) return;

            const count = zone.outputCount || 1;
            for (let i = 0; i < count; i++) {
                const coinMesh = ResourceRegistry.createMesh('coin');
                const startPos = pos.clone();
                startPos.x += (Math.random() - 0.5) * 0.5;
                startPos.y += 0.5 + i * 0.1;
                startPos.z += (Math.random() - 0.5) * 0.5;

                coinMesh.position.copy(startPos);
                this.scene.add(coinMesh);

                const toPos = trayTransform.mesh.position.clone();
                toPos.y += 0.4;

                this._coinTransfer.send(coinMesh, startPos.clone(), toPos, {
                    arcHeight: 2.0 + i * 0.3,
                    duration: 0.35 + i * 0.08,
                    spin: false,
                    onArrive: (m) => {
                        trayInv.addToSlot('coin', m, { animate: true });
                        EventBus.emit('stack:changed', {
                            entityId: trayId,
                            type: 'coin',
                            count: trayInv.getCountByType('coin'),
                            totalCount: trayInv.getTotalCount()
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
}
