import EventBus from '../core/EventBus.js';

/**
 * ContactDamageSystem — Entities with ContactDamage hurt nearby targets.
 *
 * Queries: ['Transform', 'ContactDamage']
 * Checks all entities with Health + Transform for faction matching.
 * Emits: 'entity:damaged' { entityId, damage }
 */
export class ContactDamageSystem {
    constructor() {
        this._grid = null;
        this._zone = null; // Component_SafeZone reference, set via setSafeZone()
    }

    /** Called from main.js after the safe zone entity is created. */
    setSafeZone(grid, zone) {
        this._grid = grid;
        this._zone = zone;
    }

    update(entities, deltaTime, ecs) {
        const targets = ecs.queryEntities(['Transform', 'Health']);

        for (const attackerId of entities) {
            const attackerTransform = ecs.getComponent(attackerId, 'Transform');
            const contact = ecs.getComponent(attackerId, 'ContactDamage');
            if (!attackerTransform || !contact) continue;

            contact.timeSinceLastHit += deltaTime;
            if (contact.timeSinceLastHit < contact.cooldown) continue;

            const attackerPos = attackerTransform.mesh.position;

            for (const targetId of targets) {
                if (targetId === attackerId) continue;

                const targetTransform = ecs.getComponent(targetId, 'Transform');
                if (!targetTransform) continue;

                // Check faction match via Movement.faction or Tag.tags
                const targetTag = ecs.getComponent(targetId, 'Tag');
                const targetMovement = ecs.getComponent(targetId, 'Movement');
                const faction = targetMovement ? targetMovement.faction : null;

                const isTarget = contact.targetFactions.some(f =>
                    f === faction || (targetTag && targetTag.has(f))
                );
                if (!isTarget) continue;

                // Skip damage if attacker and target are on opposite sides of an active zone wall
                if (this._zone?.active) {
                    const attackerInside = this._isInsideZone(attackerPos);
                    const targetInside   = this._isInsideZone(targetTransform.mesh.position);
                    if (attackerInside !== targetInside) continue;
                }

                const dist = attackerPos.distanceTo(targetTransform.mesh.position);
                if (dist > contact.range) continue;

                contact.timeSinceLastHit = 0;
                EventBus.emit('entity:damaged', {
                    entityId: targetId,
                    damage: contact.damage
                });
                break; // one target per cooldown cycle
            }
        }
    }

    _isInsideZone(pos) {
        const b = this._zone.bounds;
        const col = Math.floor((pos.x - this._grid.origin.x) / this._grid.cellSize);
        const row = Math.floor((pos.z - this._grid.origin.z) / this._grid.cellSize);
        return row >= b.minRow && row <= b.maxRow && col >= b.minCol && col <= b.maxCol;
    }
}
