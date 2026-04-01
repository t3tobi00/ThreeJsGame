import * as THREE from 'three';
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

        EventBus.on('zone:funded', (data) => {
            this._handleFunded(data);
        });
    }

    setECS(ecs) { this._ecs = ecs; }

    update(entities, deltaTime, ecs) {
        this._ecs = ecs;
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
        }
    }
}
