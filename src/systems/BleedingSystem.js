import EventBus from '../core/EventBus.js';
import { Component_Bleeding } from '../ecs/components/Component_Bleeding.js';

/**
 * BleedingSystem — Handles entities tagged with the Bleeding status effect.
 *
 * Mirrors BurningSystem but with a crimson emissive tint (no body embers).
 * Triggered by Sharpshooter's piercing arrow via 'entity:bled' event.
 *
 * Queries: ['Transform', 'Bleeding']
 */
export class BleedingSystem {
    constructor(ecs) {
        this.ecs = ecs;

        EventBus.on('entity:bled', ({ entityId, duration, dotPerSec }) => {
            const existing = ecs.getComponent(entityId, 'Bleeding');
            if (existing) {
                existing.duration = Math.max(existing.duration, duration);
                existing.dotPerSec = Math.max(existing.dotPerSec, dotPerSec);
            } else {
                ecs.addComponent(entityId, 'Bleeding', new Component_Bleeding({ duration, dotPerSec }));
            }
        });

        EventBus.on('entity:died', ({ entityId }) => {
            const b = ecs.getComponent(entityId, 'Bleeding');
            if (b) this._restoreMaterials(b);
        });
    }

    update(entities, deltaTime, ecs) {
        for (const id of entities) {
            const b  = ecs.getComponent(id, 'Bleeding');
            const tr = ecs.getComponent(id, 'Transform');
            if (!b || !tr?.mesh) continue;

            if (!b._origMaterials) {
                b._origMaterials = [];
                tr.mesh.traverse(obj => {
                    if (!obj.isMesh || !obj.material || !obj.material.emissive) return;
                    const mat = obj.material;
                    b._origMaterials.push({
                        mat,
                        origHex: mat.emissive.getHex(),
                        origIntensity: mat.emissiveIntensity ?? 1.0
                    });
                    mat.emissive.setHex(0xaa0000);
                    mat.emissiveIntensity = 0.55;
                });
            }

            b.duration -= deltaTime;
            if (b.duration <= 0) {
                this._restoreMaterials(b);
                ecs.removeComponent(id, 'Bleeding');
                continue;
            }

            b.dotAccumulator += b.dotPerSec * deltaTime;
            if (b.dotAccumulator >= 1) {
                const damage = Math.floor(b.dotAccumulator);
                b.dotAccumulator -= damage;
                EventBus.emit('entity:damaged', { entityId: id, damage });
            }
        }
    }

    _restoreMaterials(b) {
        if (!b._origMaterials) return;
        for (const r of b._origMaterials) {
            if (r.mat?.emissive) {
                r.mat.emissive.setHex(r.origHex);
                r.mat.emissiveIntensity = r.origIntensity;
            }
        }
        b._origMaterials = null;
    }
}
