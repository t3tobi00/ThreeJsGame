import EventBus from '../core/EventBus.js';

/**
 * RegenSystem — Out-of-combat HP regen for entities with a `Regen` component.
 *
 * Runs after HealthSystem so its tick sees post-damage HP. Listens to
 * `entity:damaged` to refresh the per-entity damage stamp. While the time
 * since last damage exceeds `oocThreshold`, the system accumulates fractional
 * HP at `ratePerSec` and emits a single-frame +1 HP heal whenever the
 * accumulator crosses 1.
 *
 * Heal events go through HealthSystem's `entity:damaged` channel with
 * negative damage (avoids duplicating clamping logic). Regen is no-op when
 * already at maxHp.
 */
export class RegenSystem {
    constructor() {
        this._elapsed = 0;
        EventBus.on('entity:damaged', ({ entityId, damage }) => {
            if (!damage || damage <= 0) return; // ignore self-emitted heals
            this._lastDamage.set(entityId, this._elapsed);
        });
        this._lastDamage = new Map();
    }

    update(entities, deltaTime, ecs) {
        this._elapsed += deltaTime;

        for (const entityId of entities) {
            const regen = ecs.getComponent(entityId, 'Regen');
            const health = ecs.getComponent(entityId, 'Health');
            if (!regen || !health) continue;
            if (health.hp >= health.maxHp) {
                regen._accumulator = 0;
                continue;
            }

            const lastDmg = this._lastDamage.get(entityId);
            if (lastDmg != null && (this._elapsed - lastDmg) < regen.oocThreshold) {
                // Still in combat — pause regen, reset partial accumulator
                // so the first tick after OOC starts clean (no instant heal
                // from a long pre-combat lull).
                regen._accumulator = 0;
                continue;
            }

            regen._accumulator += regen.ratePerSec * deltaTime;
            while (regen._accumulator >= 1) {
                regen._accumulator -= 1;
                const heal = Math.min(1, health.maxHp - health.hp);
                if (heal <= 0) break;
                health.hp += heal;
                EventBus.emit('entity:hp_changed', {
                    entityId,
                    hp: health.hp,
                    maxHp: health.maxHp
                });
            }
        }
    }
}
