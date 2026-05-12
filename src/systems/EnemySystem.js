import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import BalanceLoader from '../core/BalanceLoader.js';

// Fallback spawn config if setConfig() is never called. Normally populated
// from the 'spawn' block of src/config/archetypes/enemy.json. Used by
// legacy/diorama modes that have no cemetery spawn-point entities.
const DEFAULT_SPAWN = {
    mode: 'batch',        // 'batch' = burst-refill up to cap | 'trickle' = 1 per interval
    interval: 1.5,
    point: { x: -45, z: 0 },
    jitter: 2,
    maxAlive: 10,
    despawnDistance: 50,
    countMin: 4,
    countMax: 5,
};

// All wave/spawn tunables come from src/config/balance.json (waves block).
// Values are read at boot via _loadProtoConfig(); BalanceLoader.load() must
// have already run by then. Master inputs at top of balance.json drive
// every constant — change Z_init / Z_max / T_ramp_full there to retune the
// whole curve.
let PROTO_INITIAL_CAP   = 8;
let PROTO_CAP_RAMP      = 3;
let PROTO_RAMP_INTERVAL = 60;
let PROTO_MAX_CAP       = 25;
let PROTO_SPAWN_MIN_S   = 5;
let PROTO_SPAWN_MAX_S   = 10;
let PROTO_PACK_RADIUS   = 4;
let PROTO_PACK_COOLDOWN = 1.0;
let PROTO_STACK_CAP     = 4;
let PROTO_ANCHOR_DRIFT_MIN  = 30;
let PROTO_ANCHOR_DRIFT_MAX  = 60;
let PROTO_DRIFT_HOME_RADIUS = 8;

function _loadProtoConfig() {
    try {
        const w = BalanceLoader.get('waves');
        if (!w) return;
        PROTO_INITIAL_CAP       = w._master.Z_init;
        PROTO_MAX_CAP           = w._master.Z_max;
        PROTO_CAP_RAMP          = w.ramp_per_60s_int;
        PROTO_RAMP_INTERVAL     = 60;
        PROTO_SPAWN_MIN_S       = w._master.spawn_interval_min;
        PROTO_SPAWN_MAX_S       = w._master.spawn_interval_max;
        PROTO_PACK_RADIUS       = w.pack_radius;
        PROTO_PACK_COOLDOWN     = w.pack_cooldown;
        PROTO_STACK_CAP         = w.stack_cap;
        PROTO_ANCHOR_DRIFT_MIN  = w.anchor_drift_min;
        PROTO_ANCHOR_DRIFT_MAX  = w.anchor_drift_max;
        PROTO_DRIFT_HOME_RADIUS = w.drift_home_radius;
    } catch (_) { /* BalanceLoader not yet loaded — keep defaults */ }
}
_loadProtoConfig();

/**
 * EnemySystem — ECS-driven enemy spawning + per-zombie sense / chase / wander.
 *
 * Two regimes share this system:
 *   • Legacy / diorama (no spawn-point entities registered) — single fixed
 *     spawn point, batch-refill cadence, wander anchored at zombie's birth
 *     position. Behavior unchanged from PR #2.7.
 *   • Prototype Shambler (≥1 entity tagged 'zombie-spawn') — 4 cardinal
 *     cemeteries register via addSpawnPoint(); each zombie senses living
 *     beings within `senseRadius` (worker/ally/rival/player), wanders
 *     within `wanderLeash` of its OWN spawn point, and respects a
 *     4-attacker stacking cap per target. A pack-aggro broadcast within
 *     PROTO_PACK_RADIUS makes nearby idlers wake up together.
 *
 * State machine integration:
 *   • setFrozen(bool)          — pause autonomous AI + spawning (BOOT grace).
 *   • setConfig(spawnBlock)    — inherits the legacy 'spawn' block from
 *                                enemy.json + state-machine overrides.
 *   • addSpawnPoint(id, pos)   — main.js calls this once per cemetery.
 *   • sendWave({ count, ... }) — state-machine action; spawns N at random
 *                                spawn points (cemeteries) or the legacy
 *                                spawn point if none are registered.
 *
 * Performance:
 *   • Target list is built once per frame, not per-zombie.
 *   • Stacking-cap counts are accumulated incrementally as zombies pick.
 *   • Pack-aggro is O(N²) over chasers x wanderers, but bounded by
 *     PROTO_MAX_CAP (≤25) so it's negligible.
 */
export class EnemySystem {
    constructor(scene, factory, playerTransform) {
        // Refresh balance-derived constants (in case BalanceLoader.load()
        // completed after this module first ran).
        _loadProtoConfig();
        this.scene = scene;
        this._factory = factory;
        this._playerTransform = playerTransform;
        this._spawnTimer = 0;
        this._nextSpawnAt = PROTO_SPAWN_MIN_S + Math.random() * (PROTO_SPAWN_MAX_S - PROTO_SPAWN_MIN_S);
        this._elapsed = 0;
        this._ecs = null;
        this._aiState = new Map();
        this._spawn = { ...DEFAULT_SPAWN, point: { ...DEFAULT_SPAWN.point } };
        this._playerId = null;
        this._frozen = false;
        // Cemetery registry — keyed by entity id. Empty => legacy regime.
        this._spawnPoints = new Map();
    }

    setECS(ecs) { this._ecs = ecs; }
    setPlayerEntityId(id) { this._playerId = id; }
    setFrozen(frozen) { this._frozen = !!frozen; }
    setConfig(spawn = {}) {
        this._spawn = {
            ...DEFAULT_SPAWN,
            ...spawn,
            point: { ...DEFAULT_SPAWN.point, ...(spawn.point || {}) },
        };
    }

    /**
     * Register a cemetery spawn-point entity. main.js calls this once per
     * `zombie-spawn` tagged entity after level load. Switches the system
     * into multi-spawn regime (cap ramp + leashed wander + pack aggro).
     */
    addSpawnPoint(entityId, pos) {
        this._spawnPoints.set(entityId, { entityId, pos: pos.clone() });
    }
    removeSpawnPoint(entityId) {
        this._spawnPoints.delete(entityId);
    }

    /** True iff at least one cemetery is registered (i.e. prototype regime). */
    _multiSpawn() { return this._spawnPoints.size > 0; }

    update(entities, deltaTime, ecs) {
        if (this._frozen) return;
        this._ecs = ecs;
        this._elapsed += deltaTime;
        this._spawnTimer += deltaTime;

        // ── 1. Spawning ─────────────────────────────────────────────────
        if (this._multiSpawn()) {
            this._tickMultiSpawn();
        } else {
            // Legacy burst-refill — preserved for legacy/diorama.
            if (this._spawnTimer >= this._spawn.interval) {
                this._spawnTimer = 0;
                if (this._aiState.size < this._spawn.maxAlive) {
                    this._spawnEnemyLegacy();
                }
            }
        }

        // ── 2. Build shared target list ─────────────────────────────────
        const targets = this._buildTargets(ecs);

        // Clean up AI state for dead/removed entities.
        for (const [id] of this._aiState) {
            if (!entities.includes(id)) this._aiState.delete(id);
        }

        // ── 3. AI state init + alive list ───────────────────────────────
        const alive = [];
        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const movement = ecs.getComponent(entityId, 'Movement');
            const health = ecs.getComponent(entityId, 'Health');

            if (!transform || !movement || !health) continue;
            if (movement.faction !== 'enemy') continue;
            if (health.hp <= 0) continue;

            const pos = transform.mesh.position;
            const aiComp = ecs.getComponent(entityId, 'EnemyAI');
            if (!aiComp) continue;

            // Lazy-init runtime state on first sight.
            if (!this._aiState.has(entityId)) {
                const anchor = this._resolveSpawnAnchor(pos, aiComp);
                // homePos = the cemetery (never moves). spawnAnchor = the
                // current wander pivot (drifts every 30-60s within 8u of
                // home). Initial drift is staggered per-zombie so a fresh
                // pack doesn't all snap anchors at the same moment.
                const driftAt = this._multiSpawn()
                    ? this._elapsed + PROTO_ANCHOR_DRIFT_MIN
                        + Math.random() * (PROTO_ANCHOR_DRIFT_MAX - PROTO_ANCHOR_DRIFT_MIN)
                    : Infinity;
                this._aiState.set(entityId, {
                    state: aiComp.permanentChase ? 'chase' : 'wander',
                    spawnAnchor: anchor.clone(),
                    homePos: anchor.clone(),
                    nextAnchorDriftAt: driftAt,
                    wanderTarget: null,
                    pauseTimer: Math.random() * aiComp.wanderPauseMax
                });
            }

            // Legacy despawn — only in legacy regime; multi-spawn relies on
            // the cap to control density and never despawns from distance.
            if (!this._multiSpawn()) {
                const aiState = this._aiState.get(entityId);
                if (aiState.state === 'wander'
                    && pos.distanceTo(this._playerTransform.mesh.position) > this._spawn.despawnDistance) {
                    this._destroyEnemy(entityId, ecs, transform);
                    continue;
                }
            }

            alive.push({ entityId, transform, movement, pos, ai: this._aiState.get(entityId), aiComp });
        }

        // ── 4. Pre-frame attacker counts (existing commitments). ────────
        // attackerCount[targetId] = how many zombies are currently chasing
        // that target. Used to enforce the 4-attacker stacking cap.
        const attackerCount = new Map();
        for (const a of alive) {
            const tid = a.aiComp.currentTargetId;
            if (tid != null) attackerCount.set(tid, (attackerCount.get(tid) || 0) + 1);
        }

        // ── 5. Per-zombie sense + transition ────────────────────────────
        const transitionedToChase = []; // for pack-aggro broadcast
        for (const a of alive) {
            const { aiComp, ai, pos } = a;

            if (aiComp.permanentChase) {
                // Marchers: sense everything in the world, ignore stack cap.
                const nearest = this._pickNearestTarget(pos, targets, Infinity, attackerCount, false);
                a.target = nearest;
                aiComp.currentTargetId = nearest ? nearest.id : null;
                ai.state = 'chase';
                continue;
            }

            const senseR = aiComp.senseRadius;
            const nearest = this._pickNearestTarget(pos, targets, senseR, attackerCount, this._multiSpawn());

            if (ai.state === 'wander') {
                if (nearest) {
                    ai.state = 'chase';
                    aiComp.currentTargetId = nearest.id;
                    attackerCount.set(nearest.id, (attackerCount.get(nearest.id) || 0) + 1);
                    a.target = nearest;
                    transitionedToChase.push({ a, target: nearest });
                }
            } else { // chase
                if (!nearest) {
                    // Per V1 §2.5.4: target left sense radius → resume wander
                    // at current location (NOT back at spawn anchor).
                    ai.state = 'wander';
                    ai.spawnAnchor.copy(pos);
                    ai.wanderTarget = null;
                    ai.pauseTimer = aiComp.wanderPauseMin;
                    aiComp.currentTargetId = null;
                    a.target = null;
                } else {
                    if (aiComp.currentTargetId !== nearest.id) {
                        // Target swap — adjust counts so the cap stays accurate.
                        if (aiComp.currentTargetId != null) {
                            const prev = attackerCount.get(aiComp.currentTargetId) || 0;
                            if (prev > 0) attackerCount.set(aiComp.currentTargetId, prev - 1);
                        }
                        aiComp.currentTargetId = nearest.id;
                        attackerCount.set(nearest.id, (attackerCount.get(nearest.id) || 0) + 1);
                    }
                    a.target = nearest;
                }
            }
        }

        // ── 6. Pack-aggro broadcast ─────────────────────────────────────
        // When a zombie transitions wander→chase, it shouts to all wandering
        // zombies within PROTO_PACK_RADIUS. If the receiver also has the
        // shouter's target within its own sense, it joins (subject to cap).
        if (this._multiSpawn() && transitionedToChase.length > 0) {
            const now = this._elapsed;
            for (const { a, target } of transitionedToChase) {
                if (now - a.aiComp.lastPackBroadcast < PROTO_PACK_COOLDOWN) continue;
                a.aiComp.lastPackBroadcast = now;
                for (const b of alive) {
                    if (b === a) continue;
                    if (b.ai.state !== 'wander') continue;
                    if (b.aiComp.permanentChase) continue;
                    if (b.pos.distanceTo(a.pos) > PROTO_PACK_RADIUS) continue;
                    if (b.pos.distanceTo(target.pos) > b.aiComp.senseRadius) continue;
                    const cnt = attackerCount.get(target.id) || 0;
                    if (cnt >= PROTO_STACK_CAP) continue;
                    b.ai.state = 'chase';
                    b.aiComp.currentTargetId = target.id;
                    attackerCount.set(target.id, cnt + 1);
                    b.target = target;
                }
            }
        }

        // ── 7. Movement ─────────────────────────────────────────────────
        const playerZoneStatus = this._playerId != null
            ? ecs.getComponent(this._playerId, 'ZoneStatus') : null;

        const STOP_BUFFER = 0.4;
        for (const a of alive) {
            const { entityId, transform, movement, pos, ai, aiComp } = a;
            if (ai.state === 'chase') {
                let targetPos = a.target?.pos;
                if (!targetPos) {
                    ai.state = 'wander';
                    aiComp.currentTargetId = null;
                    continue;
                }
                // Player-in-zone redirect (gate exploit guard) — only when
                // we're actually targeting the player.
                if (a.target.isPlayer && playerZoneStatus?.insideZone && playerZoneStatus.zoneBoundsWorld) {
                    targetPos = this._nearestBoundaryPoint(pos, playerZoneStatus.zoneBoundsWorld);
                }

                const dir = new THREE.Vector3().subVectors(targetPos, pos);
                const dist = dir.length();
                const contact = ecs.getComponent(entityId, 'ContactDamage');
                const stopDist = contact ? Math.max(0.5, contact.range - STOP_BUFFER) : 0.5;

                // TODO: when walls become ECS entities, hammer-through logic
                // (3 DMG/hit per V1 §2.5.4) goes here. For now zombies steer
                // straight-line and follow the player through auto-sink gate
                // openings in the palisade.

                if (dist > stopDist) {
                    dir.normalize();
                    pos.addScaledVector(dir, movement.speed * deltaTime);
                    transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                } else if (dist > 0.001) {
                    transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                }
            } else {
                this._updateWander(ai, aiComp, pos, transform, movement, deltaTime);
            }
        }
    }

    /**
     * Resolve a zombie's wander anchor. Multi-spawn: nearest cemetery (or
     * the explicit spawnPointId if it was already stamped at spawn-time).
     * Legacy: anchor at the zombie's birth position.
     */
    _resolveSpawnAnchor(pos, aiComp) {
        if (this._spawnPoints.size === 0) return pos.clone();
        if (aiComp.spawnPointId != null) {
            const sp = this._spawnPoints.get(aiComp.spawnPointId);
            if (sp) return sp.pos;
        }
        let nearest = null;
        let nd = Infinity;
        for (const sp of this._spawnPoints.values()) {
            const d = pos.distanceTo(sp.pos);
            if (d < nd) { nd = d; nearest = sp; }
        }
        if (nearest) {
            aiComp.spawnPointId = nearest.entityId;
            return nearest.pos;
        }
        return pos.clone();
    }

    /**
     * Build the per-frame list of valid aggro targets:
     *   • Player (always — ZoneStatus redirect handled at movement time).
     *   • All entities with [Transform, Movement, Health], hp > 0,
     *     faction in {'ally', 'rival'}.
     * Each entry carries an `isWorker` flag (from Tag) for the worker
     * tie-break preference.
     */
    _buildTargets(ecs) {
        const list = [];
        if (this._playerTransform?.mesh) {
            list.push({
                id: this._playerId != null ? this._playerId : '__player__',
                pos: this._playerTransform.mesh.position,
                isPlayer: true,
                isWorker: false
            });
        }
        const ids = ecs.queryEntities(['Transform', 'Movement', 'Health']);
        for (const id of ids) {
            if (id === this._playerId) continue;
            const m = ecs.getComponent(id, 'Movement');
            if (!m) continue;
            if (m.faction !== 'ally' && m.faction !== 'rival') continue;
            const h = ecs.getComponent(id, 'Health');
            if (!h || h.hp <= 0) continue;
            const t = ecs.getComponent(id, 'Transform');
            if (!t?.mesh) continue;
            const tag = ecs.getComponent(id, 'Tag');
            const isWorker = tag?.tags?.includes('worker') === true;
            list.push({ id, pos: t.mesh.position, isPlayer: false, isWorker });
        }
        return list;
    }

    /**
     * Pick the closest target within `radius`. Stacking-cap aware: when
     * `applyCap` is true, prefers any unsaturated target over the closest
     * saturated one (per the user's "spread aggro" answer to the design
     * fork). On distance ties (within 0.1u), prefer entries tagged 'worker'
     * — workers have the lowest HP, so the swarm chews through them first.
     * If the only options are saturated, the closest saturated one is
     * returned so the zombie shuffles toward the swarm rather than stalling.
     */
    _pickNearestTarget(pos, targets, radius, attackerCount, applyCap) {
        let bestUnsat = null;
        let bestUnsatDist = Infinity;
        let bestSat = null;
        let bestSatDist = Infinity;

        for (const t of targets) {
            const d = pos.distanceTo(t.pos);
            if (d > radius) continue;
            const saturated = applyCap && (attackerCount.get(t.id) || 0) >= PROTO_STACK_CAP;
            if (saturated) {
                if (d < bestSatDist - 0.1
                    || (Math.abs(d - bestSatDist) < 0.1 && t.isWorker && !bestSat?.isWorker)) {
                    bestSat = t; bestSatDist = d;
                }
            } else {
                if (d < bestUnsatDist - 0.1
                    || (Math.abs(d - bestUnsatDist) < 0.1 && t.isWorker && !bestUnsat?.isWorker)) {
                    bestUnsat = t; bestUnsatDist = d;
                }
            }
        }
        return bestUnsat || bestSat;
    }

    _updateWander(ai, aiComp, pos, transform, movement, deltaTime) {
        // Drifting anchor — every PROTO_ANCHOR_DRIFT_MIN..MAX seconds the
        // wander pivot slides to a random point within DRIFT_HOME_RADIUS
        // of the cemetery. Skipped in legacy regime (nextAnchorDriftAt
        // stays Infinity).
        if (this._elapsed >= ai.nextAnchorDriftAt) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * PROTO_DRIFT_HOME_RADIUS;
            ai.spawnAnchor.set(
                ai.homePos.x + Math.cos(angle) * r,
                0,
                ai.homePos.z + Math.sin(angle) * r
            );
            ai.nextAnchorDriftAt = this._elapsed + PROTO_ANCHOR_DRIFT_MIN
                + Math.random() * (PROTO_ANCHOR_DRIFT_MAX - PROTO_ANCHOR_DRIFT_MIN);
            ai.wanderTarget = null; // force a fresh pick relative to new anchor
        }

        if (!ai.wanderTarget) {
            ai.pauseTimer -= deltaTime;
            if (ai.pauseTimer <= 0) {
                // Wander targets are anchored at spawnAnchor (the cemetery
                // pos, OR the zombie's birth pos in legacy regime). Keeps
                // each spawn cluster glued to its own threat geography
                // instead of drifting across the map.
                const angle = Math.random() * Math.PI * 2;
                const r = 1.5 + Math.random() * aiComp.wanderLeash;
                const rawTarget = new THREE.Vector3(
                    ai.spawnAnchor.x + Math.cos(angle) * r,
                    0,
                    ai.spawnAnchor.z + Math.sin(angle) * r
                );
                // Map-wide safety clamp so a stray anchor can't push a
                // wander target into oblivion.
                const maxRange = 60;
                const distFromCenter = Math.sqrt(rawTarget.x * rawTarget.x + rawTarget.z * rawTarget.z);
                if (distFromCenter > maxRange) {
                    rawTarget.x *= maxRange / distFromCenter;
                    rawTarget.z *= maxRange / distFromCenter;
                }
                ai.wanderTarget = rawTarget;
                // Direction picks every 3–5s — match V1 spec by re-using the
                // archetype's wanderPauseMin/Max as the pick interval.
                ai.pauseTimer = aiComp.wanderPauseMin
                    + Math.random() * (aiComp.wanderPauseMax - aiComp.wanderPauseMin);
            }
            return;
        }

        const dir = new THREE.Vector3().subVectors(ai.wanderTarget, pos);
        const dist = dir.length();

        if (dist < 0.5) {
            ai.wanderTarget = null;
            ai.pauseTimer = aiComp.wanderPauseMin
                + Math.random() * (aiComp.wanderPauseMax - aiComp.wanderPauseMin);
            return;
        }

        dir.normalize();
        const wanderSpeed = movement.speed * aiComp.wanderSpeed;
        pos.addScaledVector(dir, wanderSpeed * deltaTime);
        transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }

    _nearestBoundaryPoint(enemyPos, wb) {
        return new THREE.Vector3(
            Math.max(wb.minX, Math.min(enemyPos.x, wb.maxX)),
            0,
            Math.max(wb.minZ, Math.min(enemyPos.z, wb.maxZ))
        );
    }

    _destroyEnemy(entityId, ecs, transform) {
        const instanceRef = ecs.getComponent(entityId, 'InstanceRef');
        if (instanceRef) {
            instanceRef.pool.release(instanceRef.index);
        } else {
            this.scene.remove(transform.mesh);
        }
        ecs.destroyEntity(entityId);
        this._aiState.delete(entityId);
    }

    _tickMultiSpawn() {
        const tiers = Math.floor(this._elapsed / PROTO_RAMP_INTERVAL);
        const currentCap = Math.min(PROTO_INITIAL_CAP + tiers * PROTO_CAP_RAMP, PROTO_MAX_CAP);

        if (this._spawnTimer < this._nextSpawnAt) return;
        if (this._aiState.size >= currentCap) return;

        const ids = [...this._spawnPoints.keys()];
        if (ids.length === 0) return;
        const spId = ids[Math.floor(Math.random() * ids.length)];
        const sp = this._spawnPoints.get(spId);
        if (!sp) return;

        const archetype = this._spawn.archetype || 'enemy-prototype';
        const j = 0.6;
        const pos = new THREE.Vector3(
            sp.pos.x + (Math.random() * 2 - 1) * j,
            0,
            sp.pos.z + (Math.random() * 2 - 1) * j
        );
        const newId = this._factory.create(archetype, pos);
        const ai = this._ecs?.getComponent(newId, 'EnemyAI');
        if (ai) ai.spawnPointId = sp.entityId;

        this._spawnTimer = 0;
        this._nextSpawnAt = PROTO_SPAWN_MIN_S
            + Math.random() * (PROTO_SPAWN_MAX_S - PROTO_SPAWN_MIN_S);

        EventBus.emit('spawn:emerged', { spawnPointId: spId, zombieId: newId });
    }

    _spawnEnemyLegacy() {
        const s = this._spawn;
        const slotsLeft = s.maxAlive - this._aiState.size;
        let count;
        if (s.mode === 'trickle') {
            count = 1;
        } else {
            const range = s.countMax - s.countMin + 1;
            count = s.countMin + Math.floor(Math.random() * range);
        }
        const toSpawn = Math.min(count, slotsLeft);
        const sp = s.point;
        const j = s.jitter;
        const archetype = s.archetype || 'enemy';
        for (let i = 0; i < toSpawn; i++) {
            const jx = (Math.random() * 2 - 1) * j;
            const jz = (Math.random() * 2 - 1) * j;
            const pos = new THREE.Vector3(sp.x + jx, 0, sp.z + jz);
            this._factory.create(archetype, pos);
        }
    }

    /**
     * State-machine `enemy.sendWave` hook. Burst-spawns N zombies at random
     * cemeteries (multi-spawn regime) or the legacy spawn point. Bypasses
     * the cap — used by stall escalation to push visible reinforcements.
     * Each emergence emits 'spawn:emerged' so LavaHoleSystem can flash.
     */
    sendWave({ count = 4, archetype = null } = {}) {
        const arch = archetype || this._spawn.archetype || 'enemy-prototype';
        const ids = [...this._spawnPoints.keys()];
        for (let i = 0; i < count; i++) {
            let pos;
            let spId = null;
            if (ids.length > 0) {
                spId = ids[Math.floor(Math.random() * ids.length)];
                const sp = this._spawnPoints.get(spId);
                pos = new THREE.Vector3(
                    sp.pos.x + (Math.random() * 2 - 1) * 0.6,
                    0,
                    sp.pos.z + (Math.random() * 2 - 1) * 0.6
                );
            } else {
                const s = this._spawn;
                pos = new THREE.Vector3(
                    s.point.x + (Math.random() * 2 - 1) * s.jitter,
                    0,
                    s.point.z + (Math.random() * 2 - 1) * s.jitter
                );
            }
            const newId = this._factory.create(arch, pos);
            if (spId != null) {
                const ai = this._ecs?.getComponent(newId, 'EnemyAI');
                if (ai) ai.spawnPointId = spId;
                EventBus.emit('spawn:emerged', { spawnPointId: spId, zombieId: newId });
            }
        }
    }
}
