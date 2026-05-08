import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

const COMBAT_PRIORITY = 10;
const COMBAT_TAG = 'combat';

/**
 * HeroAISystem — Guard + pursuit steering for hero entities.
 *
 * Queries: ['Transform', 'Movement', 'HeroAI']
 *
 * Responsibilities:
 *   - Find the nearest enemy (Movement.faction === 'enemy') within
 *     `guardRadius` of the hero's homePosition.
 *   - Pursue that target at Movement.speed; stop at `attackRange`
 *     so the SkillSystem's auto-swing can land.
 *   - Drop the target when it dies, wanders past guardRadius × LEASH,
 *     or becomes invalid — then drift back to homePosition at
 *     `returnSpeed`.
 *
 * Intentionally does NOT perform attacks. Combat is owned by
 * SkillSystem via the hero's SkillLoadout (same path the player uses).
 */
const LEASH_MULT = 1.5;
// Wider than a single collision nudge so that being bumped by a passing
// player/villager doesn't re-trigger the "return home" drift every frame.
const ARRIVE_EPSILON = 0.4;
// Re-target hysteresis: a new candidate must be at least this much closer
// (in units, measured from the hero) than the current target before we
// switch. Prevents thrash when two enemies are at near-identical distance.
const RETARGET_HYSTERESIS = 1.5;

// Defensive list — any entity whose Movement.faction is in this set or
// whose Tag includes any of these names is NEVER a valid hero target, no
// matter what. Belt-and-suspenders over `faction === 'enemy'`.
const NEVER_TARGET_FACTIONS = new Set(['player', 'ally', 'neutral']);
const NEVER_TARGET_TAGS     = ['player', 'hero', 'ally'];

function isValidEnemy(id, ecs) {
    const m = ecs.getComponent(id, 'Movement');
    if (!m) return false;
    if (m.faction !== 'enemy') return false;
    if (NEVER_TARGET_FACTIONS.has(m.faction)) return false;
    const tag = ecs.getComponent(id, 'Tag');
    if (tag) {
        for (const t of NEVER_TARGET_TAGS) {
            if (tag.has && tag.has(t)) return false;
            if (Array.isArray(tag.tags) && tag.tags.includes(t)) return false;
        }
    }
    return true;
}

export class HeroAISystem {
    update(entities, deltaTime, ecs) {
        const enemies = this._collectEnemies(ecs);

        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const movement  = ecs.getComponent(id, 'Movement');
            const ai        = ecs.getComponent(id, 'HeroAI');
            if (!transform || !movement || !ai) continue;

            const pos = transform.mesh.position;

            // Tick down the post-spawn grace timer. While > 0, the hero
            // refuses to acquire or hold targets — it just stands put.
            if (ai.graceTimer > 0) {
                ai.graceTimer -= deltaTime;
                ai.target = null;
            }

            // Re-validate current target every frame — faction AND existence.
            // A previously-valid target whose faction changed (or which
            // somehow wasn't a real enemy to begin with) gets dropped here.
            if (ai.target != null) {
                if (!ecs.hasComponents(ai.target, ['Transform', 'Movement', 'Health'])) {
                    ai.target = null;
                } else if (!isValidEnemy(ai.target, ecs)) {
                    ai.target = null;
                } else {
                    const tTransform = ecs.getComponent(ai.target, 'Transform');
                    const distFromHome = tTransform.mesh.position.distanceTo(ai.homePosition);
                    if (distFromHome > ai.guardRadius * LEASH_MULT) {
                        ai.target = null;
                    }
                }
            }

            // Acquire a new target — only while grace is over.
            if (ai.target == null && ai.graceTimer <= 0) {
                let bestId = null;
                let bestDist = ai.guardRadius;
                for (const eId of enemies) {
                    if (!isValidEnemy(eId, ecs)) continue;   // defensive re-check
                    const eTransform = ecs.getComponent(eId, 'Transform');
                    if (!eTransform) continue;
                    const dist = eTransform.mesh.position.distanceTo(ai.homePosition);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestId = eId;
                    }
                }
                if (bestId != null) ai.target = bestId;
            }

            // Re-evaluate target every frame: if a closer enemy appeared,
            // switch (with hysteresis to prevent thrash). Distance-from-hero
            // is what matters here — a zombie 2u from the hero's face should
            // win over a sticky target far across the leash. Leash is still
            // enforced via guardRadius * LEASH_MULT so we don't pull onto an
            // enemy that's about to wander out of range anyway.
            if (ai.target != null && ai.graceTimer <= 0) {
                const curT = ecs.getComponent(ai.target, 'Transform');
                let bestId = ai.target;
                let bestDist = curT.mesh.position.distanceTo(pos);
                for (const eId of enemies) {
                    if (eId === ai.target) continue;
                    if (!isValidEnemy(eId, ecs)) continue;
                    const eTransform = ecs.getComponent(eId, 'Transform');
                    if (!eTransform) continue;
                    const distFromHome = eTransform.mesh.position.distanceTo(ai.homePosition);
                    if (distFromHome > ai.guardRadius * LEASH_MULT) continue;
                    const distFromHero = eTransform.mesh.position.distanceTo(pos);
                    if (distFromHero + RETARGET_HYSTERESIS < bestDist) {
                        bestDist = distFromHero;
                        bestId = eId;
                    }
                }
                if (bestId !== ai.target) ai.target = bestId;
            }

            const bs = ecs.getComponent(id, 'BehaviorState');

            if (ai.target != null) {
                // Cooperate with BehaviorState: claim combat priority so
                // walk-path (drag-to-waypoint) and other lower-priority
                // behaviors yield. Skip if something stronger owns control.
                if (bs && bs.priority > COMBAT_PRIORITY) continue;
                if (bs && bs.tag !== COMBAT_TAG) {
                    bs.priority = COMBAT_PRIORITY;
                    bs.tag = COMBAT_TAG;
                    EventBus.emit('behavior:changed', { entityId: id, tag: COMBAT_TAG, priority: COMBAT_PRIORITY });
                }

                ai.state = 'pursue';
                const tTransform = ecs.getComponent(ai.target, 'Transform');
                const targetPos = tTransform.mesh.position;
                const dx = targetPos.x - pos.x;
                const dz = targetPos.z - pos.z;
                const dist = Math.hypot(dx, dz);
                if (dist > ai.attackRange && dist > 0) {
                    pos.x += (dx / dist) * movement.speed * deltaTime;
                    pos.z += (dz / dist) * movement.speed * deltaTime;
                }
                transform.mesh.rotation.y = Math.atan2(dx, dz);
            } else {
                // No target → release combat claim so walk-path can resume.
                // Deliberately NO return-home drift: the hero guards wherever
                // it currently stands. Prevents the "follows the player"
                // behavior when home happens to coincide with the player's
                // typical standing spot.
                if (bs && bs.tag === COMBAT_TAG) {
                    bs.priority = 0;
                    bs.tag = 'idle';
                    EventBus.emit('behavior:changed', { entityId: id, tag: 'idle', priority: 0 });
                }
                ai.state = 'idle';
            }
        }
    }

    _collectEnemies(ecs) {
        const out = [];
        const all = ecs.queryEntities(['Transform', 'Movement', 'Health']);
        for (const id of all) {
            if (isValidEnemy(id, ecs)) out.push(id);
        }
        return out;
    }
}
