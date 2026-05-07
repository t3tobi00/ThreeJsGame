import EventBus from '../core/EventBus.js';
import { Component_Burning } from '../ecs/components/Component_Burning.js';

/**
 * BurningSystem — Handles entities tagged with the Burning status effect.
 *
 * Lifecycle:
 *   1. ContactDamageSystem fires 'entity:ignited' when a fire-type attack
 *      (e.g. Bruiser magma breath) hits a target with applyBurning set.
 *   2. This system catches the event and attaches Component_Burning to
 *      the target (or refreshes its duration if already burning).
 *   3. Each frame, for every burning entity:
 *        - Apply orange emissive tint to all materials (lazy-cached on
 *          first tick so we can restore them on expiry).
 *        - Accumulate DoT and fire entity:damaged events whenever ≥1 HP
 *          has accrued.
 *        - Spawn body-rising fire embers via CombatVFX (~10 Hz).
 *   4. When duration ≤ 0: restore original emissive state, remove component.
 *
 * Queries: ['Transform', 'Burning']
 */
export class BurningSystem {
    constructor(ecs, combatVFX) {
        this.ecs = ecs;
        this.combatVFX = combatVFX;

        EventBus.on('entity:ignited', ({ entityId, duration, dotPerSec }) => {
            const existing = ecs.getComponent(entityId, 'Burning');
            if (existing) {
                // Refresh — extend duration if new is longer, take max DoT
                existing.duration = Math.max(existing.duration, duration);
                existing.dotPerSec = Math.max(existing.dotPerSec, dotPerSec);
            } else {
                ecs.addComponent(entityId, 'Burning', new Component_Burning({ duration, dotPerSec }));
            }
        });

        // Cleanup: if a burning entity dies, restore its materials before
        // the entity is destroyed.
        EventBus.on('entity:died', ({ entityId }) => {
            const b = ecs.getComponent(entityId, 'Burning');
            if (b) this._restoreMaterials(b);
        });
    }

    update(entities, deltaTime, ecs) {
        for (const id of entities) {
            const b  = ecs.getComponent(id, 'Burning');
            const tr = ecs.getComponent(id, 'Transform');
            if (!b || !tr?.mesh) continue;

            // Lazy-cache emissive state + apply orange tint on first tick.
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
                    mat.emissive.setHex(0xff5500);
                    mat.emissiveIntensity = 0.7;
                });
            }

            // Tick duration. When expired, restore + remove component.
            b.duration -= deltaTime;
            if (b.duration <= 0) {
                this._restoreMaterials(b);
                ecs.removeComponent(id, 'Burning');
                continue;
            }

            // Accumulate fractional damage; emit damage events whenever a
            // whole HP has accrued. Smooths out per-frame DoT.
            b.dotAccumulator += b.dotPerSec * deltaTime;
            if (b.dotAccumulator >= 1) {
                const damage = Math.floor(b.dotAccumulator);
                b.dotAccumulator -= damage;
                EventBus.emit('entity:damaged', { entityId: id, damage });
            }

            // Body-rising fire embers — ~10 Hz per burning entity.
            b._particleTimer -= deltaTime;
            if (b._particleTimer <= 0 && this.combatVFX) {
                b._particleTimer = 0.10;
                const pos = tr.mesh.position.clone();
                pos.x += (Math.random() - 0.5) * 0.40;
                pos.z += (Math.random() - 0.5) * 0.40;
                pos.y += 0.5 + Math.random() * 0.7;
                this.combatVFX.spawnFireEmber(pos);
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
