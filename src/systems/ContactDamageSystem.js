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

            // Wall-damage gate (V1 Shambler design): a wandering zombie
            // (EnemyAI present, currentTargetId == null) does NOT damage
            // structures it bumps into. Zombies don't *want* walls — they
            // only break through them when chasing a sensed living being
            // on the other side. Once aggroed, the same zombie can hammer
            // any wall in its path normally.
            const attackerAI = ecs.getComponent(attackerId, 'EnemyAI');
            const attackerIsIdleZombie = !!attackerAI && attackerAI.currentTargetId == null;

            // Query only nearby targets from the spatial hash
            const nearby = this._hash.query(attackerPos.x, attackerPos.z, contact.range);

            // Cone-AOE setup (used by Bruiser magma breath). When coneAngle
            // is set, the attack damages every enemy whose direction-from-
            // attacker is within (coneAngle/2) of the attacker's forward.
            let coneCos = -1;
            let coneFx = 0;
            let coneFz = 0;
            if (contact.coneAngle) {
                coneCos = Math.cos((contact.coneAngle / 2) * Math.PI / 180);
                const yaw = attackerTransform.mesh.rotation.y;
                coneFx = Math.sin(yaw);
                coneFz = Math.cos(yaw);
            }

            // Line-pierce setup (used by Sharpshooter piercing arrow). When
            // lineWidth + pierce are set, the attack damages every enemy
            // whose perpendicular distance to a forward ray is ≤ lineWidth
            // and whose forward projection is within [0, range].
            let lineFx = 0;
            let lineFz = 0;
            const isLinePierce = contact.lineWidth != null && contact.pierce;
            if (isLinePierce) {
                const yaw = attackerTransform.mesh.rotation.y;
                lineFx = Math.sin(yaw);
                lineFz = Math.cos(yaw);
            }

            let firstConeHit = null;
            let firstLineHit = null;

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

                // Idle-zombie guard: wandering zombies skip structures
                // (walls, gates, turrets, stalls). They keep ignoring the
                // wall until they sense a living being and aggro.
                if (attackerIsIdleZombie) {
                    const targetIsStructure = faction === 'structure'
                        || (targetTag && targetTag.has('structure'));
                    if (targetIsStructure) continue;
                }

                // Zone-wall check: skip damage if attacker and target are on opposite sides
                const targetStatus = ecs.getComponent(targetId, 'ZoneStatus');
                if (attackerStatus && targetStatus
                    && attackerStatus.insideZone !== targetStatus.insideZone) continue;

                const targetPos = targetTransform.mesh.position;
                const dx   = targetPos.x - attackerPos.x;
                const dz   = targetPos.z - attackerPos.z;
                const dist = Math.hypot(dx, dz);
                if (dist > contact.range) continue;

                if (isLinePierce) {
                    // Line-pierce: project onto forward; require positive
                    // projection ≤ range and perpendicular distance ≤
                    // lineWidth. Damages every enemy on the line.
                    const proj = dx * lineFx + dz * lineFz;
                    if (proj <= 0 || proj > contact.range) continue;
                    const perpX = dx - lineFx * proj;
                    const perpZ = dz - lineFz * proj;
                    const perp  = Math.hypot(perpX, perpZ);
                    if (perp > contact.lineWidth) continue;
                    EventBus.emit('entity:damaged', { entityId: targetId, damage: contact.damage });
                    if (contact.applyBleeding) {
                        EventBus.emit('entity:bled', {
                            entityId: targetId,
                            duration:  contact.applyBleeding.duration,
                            dotPerSec: contact.applyBleeding.dotPerSec
                        });
                    }
                    if (firstLineHit == null) firstLineHit = targetId;
                    // do NOT break — keep damaging along the line
                } else if (contact.coneAngle) {
                    // Cone-AOE: damage every target whose direction is
                    // within the half-angle of the attacker's forward.
                    if (dist < 1e-3) continue;
                    const dot = (dx * coneFx + dz * coneFz) / dist;
                    if (dot < coneCos) continue;
                    EventBus.emit('entity:damaged', { entityId: targetId, damage: contact.damage });
                    if (contact.applyBurning) {
                        EventBus.emit('entity:ignited', {
                            entityId: targetId,
                            duration:  contact.applyBurning.duration,
                            dotPerSec: contact.applyBurning.dotPerSec
                        });
                    }
                    if (firstConeHit == null) firstConeHit = targetId;
                    // do NOT break — keep damaging
                } else {
                    // Default: first nearby target only
                    contact.timeSinceLastHit = 0;
                    EventBus.emit('entity:damaged',  { entityId: targetId, damage: contact.damage });
                    if (contact.applyBurning) {
                        EventBus.emit('entity:ignited', {
                            entityId: targetId,
                            duration:  contact.applyBurning.duration,
                            dotPerSec: contact.applyBurning.dotPerSec
                        });
                    }
                    EventBus.emit('entity:attacked', { attackerId, targetId });
                    break;
                }
            }

            // Cone-AOE: fire ONE entity:attacked per cycle (with first hit
            // for VFX dispatch). Reset cooldown only if at least one target
            // was found in the cone.
            if (contact.coneAngle && firstConeHit != null) {
                contact.timeSinceLastHit = 0;
                EventBus.emit('entity:attacked', { attackerId, targetId: firstConeHit });
            }
            // Line-pierce: same pattern — one entity:attacked per cycle for
            // the VFX dispatcher (which spawns the gold arrow + decal). The
            // first hit is a representative "aim point" so the arrow flies
            // toward an actual target rather than into empty space, even
            // though damage already touched every enemy in the line.
            if (isLinePierce && firstLineHit != null) {
                contact.timeSinceLastHit = 0;
                EventBus.emit('entity:attacked', { attackerId, targetId: firstLineHit });
            }
        }
    }
}
