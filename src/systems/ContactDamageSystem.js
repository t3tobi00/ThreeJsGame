import EventBus from '../core/EventBus.js';

/**
 * ContactDamageSystem — Entities with ContactDamage hurt nearby targets.
 *
 * Queries: ['Transform', 'ContactDamage']
 * Checks all entities with Health + Transform for faction matching.
 * Emits: 'entity:damaged' { entityId, damage }
 */
export class ContactDamageSystem {
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
}
