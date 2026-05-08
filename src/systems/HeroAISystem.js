import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

const COMBAT_PRIORITY = 10;
const COMBAT_TAG = 'combat';

/**
 * HeroAISystem — Utility-scoring AI for soldiers (scout / bruiser /
 * sharpshooter, plus any future ally with a HeroAI component).
 *
 * Queries: ['Transform', 'Movement', 'HeroAI']
 *
 * Each frame, for every soldier:
 *   1. Hard-veto poison: if the soldier is standing inside any active
 *      poison cloud, run the AVOID_POISON behavior (no scoring — flee
 *      until clear). This is a fail-safe so a soldier never tanks DoT
 *      to chase an aggro target.
 *   2. Score weighted behaviors:
 *        - DEFEND_WORKER  (score base 80, scales with proximity + recency)
 *        - DEFEND_WALL    (score base 60)
 *        - DEFEND_KING    (stubbed — always 0 this PR; no King in prototype)
 *        - AGGRO_NEAREST  (score base 50, fallback)
 *      Highest score wins. Hysteresis on AGGRO is preserved (a new
 *      candidate must be 1.5u closer than the current target before
 *      switching) so two equidistant zombies don't thrash.
 *   3. Apply the picked behavior — claim COMBAT priority on the
 *      shared BehaviorState, set target, walk toward it.
 *
 * Stubs noted in code: GROUP_COHESION wedge formation, DEFEND_KING.
 *
 * Inputs (event-driven, decoupled from other systems):
 *   - 'entity:damaged'      → records damage to anything tagged worker/wall/king
 *   - 'poison:cloud:spawn'  → tracks active poison clouds locally
 *
 * Both records auto-decay (4s damage TTL; cloud lifeMax matches the
 * source). PoisonCloudSystem stays untouched — we mirror its lifetime.
 *
 * Intentionally does NOT perform attacks. ContactDamageSystem owns hit
 * detection (cone / line-pierce / single-target); HeroAISystem only
 * orients the soldier and brings it into range.
 */

const LEASH_MULT = 1.5;
const ARRIVE_EPSILON = 0.4;
// Hysteresis (preserved): a new aggro candidate must be at least this
// much closer than the current target before we switch — prevents
// thrash between two zombies at near-identical distance.
const RETARGET_HYSTERESIS = 1.5;

// How long a damage record stays "fresh" enough to trigger a defend
// behavior. After this many seconds without a re-damage, the soldier
// goes back to aggro/idle.
const DAMAGE_RECORD_TTL = 4.0;

// When scoring a defend behavior, we look for an enemy near the
// damaged victim (since entity:damaged doesn't carry attackerId).
// 8u matches HeroAI.guardRadius for scout/bruiser, comfortably
// includes spitter zombies (range 5u) plus a buffer.
const DEFEND_SEARCH_RADIUS = 8.0;

const NEVER_TARGET_FACTIONS = new Set(['player', 'ally', 'neutral']);
const NEVER_TARGET_TAGS     = ['player', 'hero', 'ally'];

// Tags that flag an entity as worth defending. The first tag in this
// list a damaged entity matches becomes the record's 'kind'.
// 'soldier' covers other allied soldiers (scout / bruiser / sharpshooter)
// — when one is being attacked, nearby soldiers should converge to help.
// Self is excluded from each soldier's own defend-ally score so they
// don't redundantly try to "defend" themselves (aggro covers that).
const DEFEND_TAGS = ['worker', 'wall', 'king', 'soldier'];

function tagHas(tag, name) {
    if (!tag) return false;
    if (tag.has && tag.has(name)) return true;
    if (Array.isArray(tag.tags) && tag.tags.includes(name)) return true;
    return false;
}

function isValidEnemy(id, ecs) {
    const m = ecs.getComponent(id, 'Movement');
    if (!m) return false;
    if (m.faction !== 'enemy') return false;
    if (NEVER_TARGET_FACTIONS.has(m.faction)) return false;
    const tag = ecs.getComponent(id, 'Tag');
    if (tag) {
        for (const t of NEVER_TARGET_TAGS) {
            if (tagHas(tag, t)) return false;
        }
    }
    return true;
}

export class HeroAISystem {
    constructor() {
        // Map<entityId, { time, kind }>  kind ∈ DEFEND_TAGS.
        this._damageRegistry = new Map();
        // Active clouds mirror PoisonCloudSystem's lifetimes (we don't
        // mutate that system; we subscribe to its spawn event and decay
        // locally). { position:Vector3, radius, dps, expiresAt }.
        this._activeClouds = [];
        // Monotonic seconds counter incremented from update(deltaTime).
        // Used as a stable timestamp for both registries.
        this._now = 0;
        // Lazily set on first update() — we subscribe to events in the
        // constructor but ECS isn't available until the first frame.
        this._ecs = null;

        EventBus.on('entity:damaged', (e) => this._onDamaged(e));
        EventBus.on('poison:cloud:spawn', (e) => this._onCloudSpawn(e));
    }

    _onDamaged({ entityId } = {}) {
        if (!this._ecs || entityId == null) return;
        // Future-proof: only allies/neutral can be defended. When zombie-side
        // AI is mirrored later, an enemy 'King' or 'wall' archetype must not
        // poison this registry.
        const m = this._ecs.getComponent(entityId, 'Movement');
        if (m && m.faction === 'enemy') return;
        const tag = this._ecs.getComponent(entityId, 'Tag');
        if (!tag) return;
        for (const dt of DEFEND_TAGS) {
            if (tagHas(tag, dt)) {
                this._damageRegistry.set(entityId, { time: this._now, kind: dt });
                return;
            }
        }
    }

    _onCloudSpawn({ position, radius = 1.6, dps = 2.0, lifeMax = 10.0 } = {}) {
        if (!position) return;
        this._activeClouds.push({
            position: new THREE.Vector3(position.x, position.y, position.z),
            radius,
            dps,
            expiresAt: this._now + lifeMax
        });
    }

    update(entities, deltaTime, ecs) {
        if (!this._ecs) this._ecs = ecs;
        this._now += deltaTime;

        // Decay damage registry — drop stale records and dead victims.
        for (const [id, rec] of this._damageRegistry) {
            if (this._now - rec.time > DAMAGE_RECORD_TTL) {
                this._damageRegistry.delete(id);
            } else if (!ecs.hasComponents(id, ['Transform'])) {
                this._damageRegistry.delete(id);
            }
        }

        // Decay clouds.
        for (let i = this._activeClouds.length - 1; i >= 0; i--) {
            if (this._activeClouds[i].expiresAt <= this._now) {
                this._activeClouds.splice(i, 1);
            }
        }

        const enemies = this._collectEnemies(ecs);

        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const movement  = ecs.getComponent(id, 'Movement');
            const ai        = ecs.getComponent(id, 'HeroAI');
            if (!transform || !movement || !ai) continue;

            const pos = transform.mesh.position;

            if (ai.graceTimer > 0) {
                ai.graceTimer -= deltaTime;
                ai.target = null;
            }

            const bs = ecs.getComponent(id, 'BehaviorState');

            // Yield to anything stronger than combat (cinematic, scripted).
            if (bs && bs.priority > COMBAT_PRIORITY) {
                ai.target = null;
                ai.behavior = 'yield';
                ai.state = 'idle';
                continue;
            }

            // === HARD-VETO: AVOID_POISON ===
            // Standing in any active cloud forces flee, regardless of
            // any aggro/defend opportunity. dps doesn't matter for the
            // gate — even a low-tick cloud should be evacuated.
            const flee = this._computePoisonFleeVector(pos, id);
            if (flee) {
                this._applyAvoidPoison(id, deltaTime, transform, movement, ai, bs, flee);
                continue;
            }

            // While grace is active, stay idle (release any old claim).
            if (ai.graceTimer > 0) {
                this._releaseClaim(id, bs, ai);
                continue;
            }

            // Re-validate any sticky target (faction/existence/leash).
            if (ai.target != null) {
                if (!ecs.hasComponents(ai.target, ['Transform', 'Movement', 'Health'])) {
                    ai.target = null;
                } else if (!isValidEnemy(ai.target, ecs)) {
                    ai.target = null;
                } else {
                    const tt = ecs.getComponent(ai.target, 'Transform');
                    const distFromHome = tt.mesh.position.distanceTo(ai.homePosition);
                    if (distFromHome > ai.guardRadius * LEASH_MULT) {
                        ai.target = null;
                    }
                }
            }

            // === SCORING LOOP ===
            let bestScore = 0;
            let bestBehavior = null;
            let bestTarget = null;

            const dw = this._scoreDefendByKind(pos, enemies, ecs, 'worker', 80, 1.5, 5.0, id);
            if (dw && dw.score > bestScore) {
                bestScore = dw.score;
                bestBehavior = 'defend-worker';
                bestTarget = dw.targetId;
            }

            // DEFEND_ALLY — soldier converges when another ally soldier
            // is taking damage. Lower distMul (1.0) than the others so
            // soldiers will sprint a long way to help (the user's
            // explicit request: "two scouts dying at wall, others stand
            // still 8u away — they should help"). Self is excluded via
            // `id` selfId; aggro covers the soldier's own attacker.
            const da = this._scoreDefendByKind(pos, enemies, ecs, 'soldier', 70, 1.0, 4.0, id);
            if (da && da.score > bestScore) {
                bestScore = da.score;
                bestBehavior = 'defend-ally';
                bestTarget = da.targetId;
            }

            const dl = this._scoreDefendByKind(pos, enemies, ecs, 'wall', 60, 2.0, 4.0, id);
            if (dl && dl.score > bestScore) {
                bestScore = dl.score;
                bestBehavior = 'defend-wall';
                bestTarget = dl.targetId;
            }

            // STUB: DEFEND_KING — base 100 (game-over stakes), but scored
            // 0 here because no entity has a 'king' tag in the prototype
            // yet. When V1 King ships, replace the next 1 line with a
            // call to _scoreDefendByKind(pos, enemies, ecs, 'king',
            // 100, 2.0, 6.0, id); the rest of the loop already handles it.
            // const dk = ...

            const ag = this._scoreAggro(pos, enemies, ecs, ai);
            if (ag && ag.score > bestScore) {
                bestScore = ag.score;
                bestBehavior = 'aggro';
                bestTarget = ag.targetId;
            }

            // STUB: GROUP_COHESION — wedge formation. When 2+ allies aggro
            // the same target, the 'point' soldier (highest HP / heaviest
            // class) should pursue directly while flanks offset by ±45°
            // at 1.5u behind the point. Implemented as a position
            // adjustment in _applyPursue rather than a separate behavior.
            // Hook it in by computing a per-soldier offset when bestTarget
            // is shared with allies, and adding it to the pursue heading.
            // Deferred to a follow-up PR (see project_backlog memory).

            if (bestBehavior && bestTarget != null) {
                this._applyPursue(id, ecs, deltaTime, transform, movement, ai, bs, bestTarget, bestBehavior);
            } else {
                this._releaseClaim(id, bs, ai);
            }
        }
    }

    // === BEHAVIOR HELPERS ===

    _computePoisonFleeVector(pos, id) {
        if (this._activeClouds.length === 0) return null;
        let fx = 0, fz = 0;
        let any = false;
        for (const c of this._activeClouds) {
            const dx = pos.x - c.position.x;
            const dz = pos.z - c.position.z;
            const d2 = dx * dx + dz * dz;
            if (d2 > c.radius * c.radius) continue;
            any = true;
            const d = Math.sqrt(d2);
            // Bug fix: when the soldier is essentially at the cloud
            // center (spit aimed at them landed exactly on their feet),
            // dx=dz=0 and the away-vector collapses to (0,0). Pick a
            // deterministic fallback angle from entityId — different
            // soldiers in the same cloud pick different escape headings.
            // Golden-ratio multiplier scrambles consecutive ids well.
            if (d < 0.05) {
                const angle = (id * 1.6180339887) % (Math.PI * 2);
                const w = c.dps * 1.4;  // strong push from the heart
                fx += Math.cos(angle) * w;
                fz += Math.sin(angle) * w;
                continue;
            }
            // Weight away-vector by overlap depth × dps so deeper /
            // hotter clouds dominate the flee direction.
            const overlap = (c.radius - d) / c.radius;
            const w = c.dps * (overlap + 0.2);
            fx += (dx / d) * w;
            fz += (dz / d) * w;
        }
        if (!any) return null;
        const m = Math.hypot(fx, fz) + 1e-6;
        return { x: fx / m, z: fz / m };
    }

    _applyAvoidPoison(id, deltaTime, transform, movement, ai, bs, flee) {
        if (bs && bs.tag !== COMBAT_TAG) {
            bs.priority = COMBAT_PRIORITY;
            bs.tag = COMBAT_TAG;
            EventBus.emit('behavior:changed', { entityId: id, tag: COMBAT_TAG, priority: COMBAT_PRIORITY });
        }
        const pos = transform.mesh.position;
        pos.x += flee.x * movement.speed * deltaTime;
        pos.z += flee.z * movement.speed * deltaTime;
        transform.mesh.rotation.y = Math.atan2(flee.x, flee.z);
        ai.target = null;
        ai.behavior = 'avoid-poison';
        ai.state = 'flee';
    }

    _scoreDefendByKind(pos, enemies, ecs, kind, base, distMul, agePenalty, selfId = null) {
        if (this._damageRegistry.size === 0) return null;
        let bestScore = -Infinity;
        let bestEnemy = null;
        const sr2 = DEFEND_SEARCH_RADIUS * DEFEND_SEARCH_RADIUS;

        for (const [vId, rec] of this._damageRegistry) {
            if (rec.kind !== kind) continue;
            // For defend-ally, never have a soldier try to defend itself —
            // aggro already handles "an enemy is hitting me." Without this,
            // a damaged soldier would always score itself highest and pick
            // a redundant target.
            if (vId === selfId) continue;
            const vt = ecs.getComponent(vId, 'Transform');
            if (!vt) continue;
            const vpos = vt.mesh.position;

            // Find the enemy nearest to the victim — that's the threat.
            let closestEId = null;
            let closestED2 = sr2;
            for (const eId of enemies) {
                const et = ecs.getComponent(eId, 'Transform');
                if (!et) continue;
                const ddx = et.mesh.position.x - vpos.x;
                const ddz = et.mesh.position.z - vpos.z;
                const d2 = ddx * ddx + ddz * ddz;
                if (d2 < closestED2) { closestED2 = d2; closestEId = eId; }
            }
            if (closestEId == null) continue;

            const et = ecs.getComponent(closestEId, 'Transform');
            const dx = et.mesh.position.x - pos.x;
            const dz = et.mesh.position.z - pos.z;
            const distFromSoldier = Math.hypot(dx, dz);
            const age = this._now - rec.time;

            const score = base - distFromSoldier * distMul - age * agePenalty;
            if (score > bestScore) { bestScore = score; bestEnemy = closestEId; }
        }
        if (bestEnemy == null || bestScore <= 0) return null;
        return { score: bestScore, targetId: bestEnemy };
    }

    _scoreAggro(pos, enemies, ecs, ai) {
        // Pick nearest valid enemy within leash range from home.
        let bestId = null;
        let bestDistFromHero = Infinity;
        for (const eId of enemies) {
            const et = ecs.getComponent(eId, 'Transform');
            if (!et) continue;
            const distFromHome = et.mesh.position.distanceTo(ai.homePosition);
            if (distFromHome > ai.guardRadius * LEASH_MULT) continue;
            // First acquisition still uses guardRadius (tighter); a
            // sticky target may roam out to LEASH_MULT × guardRadius.
            if (ai.target == null && distFromHome > ai.guardRadius) continue;
            const distFromHero = Math.hypot(
                et.mesh.position.x - pos.x,
                et.mesh.position.z - pos.z
            );
            if (distFromHero < bestDistFromHero) {
                bestDistFromHero = distFromHero;
                bestId = eId;
            }
        }
        if (bestId == null) return null;

        // Hysteresis: stick with current target unless the new one is
        // ≥ RETARGET_HYSTERESIS units closer.
        if (ai.target != null && ai.target !== bestId && isValidEnemy(ai.target, ecs)) {
            const ct = ecs.getComponent(ai.target, 'Transform');
            if (ct) {
                const cDist = Math.hypot(
                    ct.mesh.position.x - pos.x,
                    ct.mesh.position.z - pos.z
                );
                if (bestDistFromHero + RETARGET_HYSTERESIS >= cDist) {
                    bestId = ai.target;
                    bestDistFromHero = cDist;
                }
            }
        }

        // Score: closer = higher. 50 base, falls 1.5/u, floor 1 so any
        // valid target beats no target.
        const score = Math.max(1, 50 - bestDistFromHero * 1.5);
        return { score, targetId: bestId };
    }

    _applyPursue(id, ecs, deltaTime, transform, movement, ai, bs, targetId, behavior) {
        if (bs && bs.tag !== COMBAT_TAG) {
            bs.priority = COMBAT_PRIORITY;
            bs.tag = COMBAT_TAG;
            EventBus.emit('behavior:changed', { entityId: id, tag: COMBAT_TAG, priority: COMBAT_PRIORITY });
        }
        ai.target = targetId;
        ai.behavior = behavior;
        ai.state = 'pursue';

        const pos = transform.mesh.position;
        const tt = ecs.getComponent(targetId, 'Transform');
        if (!tt) return;
        const tpos = tt.mesh.position;
        const dx = tpos.x - pos.x;
        const dz = tpos.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > ai.attackRange && dist > 0) {
            pos.x += (dx / dist) * movement.speed * deltaTime;
            pos.z += (dz / dist) * movement.speed * deltaTime;
        }
        transform.mesh.rotation.y = Math.atan2(dx, dz);
    }

    _releaseClaim(id, bs, ai) {
        if (bs && bs.tag === COMBAT_TAG) {
            bs.priority = 0;
            bs.tag = 'idle';
            EventBus.emit('behavior:changed', { entityId: id, tag: 'idle', priority: 0 });
        }
        ai.target = null;
        ai.behavior = 'idle';
        ai.state = 'idle';
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
