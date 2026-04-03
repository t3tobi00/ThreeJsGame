import EventBus from '../core/EventBus.js';
import { SpatialHash } from '../utils/SpatialHash.js';

/**
 * ContactDamageSystem — Entities with ContactDamage hurt nearby targets.
 *
 * Queries: ['Transform', 'ContactDamage']
 *
 * Uses a SpatialHash to avoid O(N*M) brute-force distance checks.
 * Each frame: inserts all Health targets into the hash, then for each
 * attacker queries only nearby cells.
 *
 * Zone-wall awareness: reads ZoneStatus.insideZone from both attacker and target.
 * If they are on opposite sides of an active zone boundary, damage is skipped.
 * This system has no knowledge of zones, grids, or bounds — it only reads a flag.
 */
export class ContactDamageSystem {
    constructor() {
        this._hash = new SpatialHash(3);
    }

    update(entities, deltaTime, ecs) {
        const targets = ecs.queryEntities(['Transform', 'Health']);

        // Build spatial hash of all damageable targets
        this._hash.clear();
        for (const targetId of targets) {
            const t = ecs.getComponent(targetId, 'Transform');
            if (t) this._hash.insert(targetId, t.mesh.position.x, t.mesh.position.z);
        }

        for (const attackerId of entities) {
            const attackerTransform = ecs.getComponent(attackerId, 'Transform');
            const contact           = ecs.getComponent(attackerId, 'ContactDamage');
            if (!attackerTransform || !contact) continue;

            contact.timeSinceLastHit += deltaTime;
            if (contact.timeSinceLastHit < contact.cooldown) continue;

            const attackerPos    = attackerTransform.mesh.position;
            const attackerStatus = ecs.getComponent(attackerId, 'ZoneStatus');

            // Query only nearby targets from the spatial hash
            const nearby = this._hash.query(attackerPos.x, attackerPos.z, contact.range);

            for (const targetId of nearby) {
                if (targetId === attackerId) continue;

                const targetTransform = ecs.getComponent(targetId, 'Transform');
                if (!targetTransform) continue;

                // Faction check
                const targetTag      = ecs.getComponent(targetId, 'Tag');
                const targetMovement = ecs.getComponent(targetId, 'Movement');
                const faction        = targetMovement ? targetMovement.faction : null;
                const isTarget = contact.targetFactions.some(f =>
                    f === faction || (targetTag && targetTag.has(f))
                );
                if (!isTarget) continue;

                // Zone-wall check: skip damage if attacker and target are on opposite sides
                const targetStatus = ecs.getComponent(targetId, 'ZoneStatus');
                if (attackerStatus && targetStatus
                    && attackerStatus.insideZone !== targetStatus.insideZone) continue;

                const dist = attackerPos.distanceTo(targetTransform.mesh.position);
                if (dist > contact.range) continue;

                contact.timeSinceLastHit = 0;
                EventBus.emit('entity:damaged', { entityId: targetId, damage: contact.damage });
                break; // one target per cooldown cycle
            }
        }
    }
}
