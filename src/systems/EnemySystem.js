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

// 2026-05-12 v3: real boids — separation + alignment + cohesion + random.
// Weights below are pre-normalize; the final vector is normalized after sum.
// Separation gets the highest weight so zombies can never occupy the same
// point (was the "religious performance" freeze bug with cohesion-only).
const BOID_W_RANDOM = 0.40;
const BOID_W_COHESION = 0.25;
const BOID_W_ALIGNMENT = 0.20;
const BOID_W_SEPARATION = 0.50;
const BOID_SEP_RADIUS = 2.5;          // close-quarters anti-collision
const BOID_ALIGN_RADIUS = 8;          // flock-direction matching
// Cohesion radius is balance-controlled (PROTO_COHESION_RADIUS).

const STALL_BREAK_THRESHOLD_SEC = 6;  // sec without significant movement
const STALL_BREAK_MOVE_THRESHOLD = 1.0; // u of movement to reset the timer

const DETECTION_FLASH_SEC = 1.5;

// Lazy canvas-texture pair for the floating !/? detection icons. Generated
// once on first use (DOM must be ready). All zombies share these two
// textures; per-zombie sprites just swap their material's `map` field.
let _detectionTextures = null;
function _getDetectionTextures() {
    if (_detectionTextures) return _detectionTextures;
    _detectionTextures = {};
    const makeTex = (symbol, fillColor) => {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        const ctx = c.getContext('2d');
        ctx.font = 'bold 54px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#000';
        ctx.strokeText(symbol, 32, 34);
        ctx.fillStyle = fillColor;
        ctx.fillText(symbol, 32, 34);
        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    };
    _detectionTextures.chase = makeTex('!', '#ffd400'); // yellow — sighted real target
    _detectionTextures.hunt  = makeTex('?', '#ff8800'); // orange — heard noise
    return _detectionTextures;
}

// 2026-05-12 (haunt pass): batch spawns, cohesion, noise, herd patrols, emergence.
let PROTO_BURST_SIZE_MIN     = 3;
let PROTO_BURST_SIZE_MAX     = 5;
let PROTO_BURST_INTERVAL_MIN = 8;
let PROTO_BURST_INTERVAL_MAX = 14;
let PROTO_COHESION_RADIUS    = 8;
let PROTO_COHESION_WEIGHT    = 0.35;
let PROTO_NOISE_RADIUS       = 14;
let PROTO_NOISE_DURATION     = 8;
let PROTO_NOISE_COOLDOWN     = 0.25;
let PROTO_HERD_PATROL_MIN    = 60;
let PROTO_HERD_PATROL_MAX    = 90;
let PROTO_HERD_PATROL_SIZE   = 4;
let PROTO_EMERGE_INTERVAL_MIN = 90;
let PROTO_EMERGE_INTERVAL_MAX = 120;
let PROTO_EMERGE_WARNING_SEC  = 2;
let PROTO_BURST_SHARED_OFFSET = 18;

// 2026-05-12 v4 (smart zombies): memory, tiered horde call, combat blood.
let PROTO_INVESTIGATE_DURATION     = 10;
let PROTO_INVESTIGATE_SENSE_MULT   = 1.5;
let PROTO_HORDECALL_IMMEDIATE_R    = 25;
let PROTO_HORDECALL_DRIFT_R        = 60;
let PROTO_HORDECALL_ALERT_R        = 120;
let PROTO_HORDECALL_DRIFT_DURATION = 15;
let PROTO_HORDECALL_ALERT_DURATION = 30;
let PROTO_HORDECALL_ALERT_MULT     = 2.0;
let PROTO_HORDECALL_COOLDOWN       = 1.5;
let PROTO_COMBAT_BLOOD_R           = 20;
let PROTO_COMBAT_BLOOD_DURATION    = 5;
let PROTO_COMBAT_BLOOD_MULT        = 1.5;
let PROTO_EFFECTIVE_SENSE_MAX_MULT = 2.5;

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

        // Haunt pass — optional, fall back to defaults if missing.
        if (w.burst_size_min     != null) PROTO_BURST_SIZE_MIN     = w.burst_size_min;
        if (w.burst_size_max     != null) PROTO_BURST_SIZE_MAX     = w.burst_size_max;
        if (w.burst_interval_min != null) PROTO_BURST_INTERVAL_MIN = w.burst_interval_min;
        if (w.burst_interval_max != null) PROTO_BURST_INTERVAL_MAX = w.burst_interval_max;
        if (w.cohesion_radius    != null) PROTO_COHESION_RADIUS    = w.cohesion_radius;
        if (w.cohesion_weight    != null) PROTO_COHESION_WEIGHT    = w.cohesion_weight;
        if (w.noise_radius       != null) PROTO_NOISE_RADIUS       = w.noise_radius;
        if (w.noise_duration     != null) PROTO_NOISE_DURATION     = w.noise_duration;
        if (w.noise_cooldown_per_event != null) PROTO_NOISE_COOLDOWN = w.noise_cooldown_per_event;
        if (w.herd_patrol_interval_min != null) PROTO_HERD_PATROL_MIN = w.herd_patrol_interval_min;
        if (w.herd_patrol_interval_max != null) PROTO_HERD_PATROL_MAX = w.herd_patrol_interval_max;
        if (w.herd_patrol_size   != null) PROTO_HERD_PATROL_SIZE   = w.herd_patrol_size;
        if (w.emerge_interval_min != null) PROTO_EMERGE_INTERVAL_MIN = w.emerge_interval_min;
        if (w.emerge_interval_max != null) PROTO_EMERGE_INTERVAL_MAX = w.emerge_interval_max;
        if (w.emerge_warning_duration != null) PROTO_EMERGE_WARNING_SEC = w.emerge_warning_duration;
        if (w.burst_shared_offset != null) PROTO_BURST_SHARED_OFFSET = w.burst_shared_offset;

        // Smart-zombies pass (v4)
        if (w.investigate_duration   != null) PROTO_INVESTIGATE_DURATION   = w.investigate_duration;
        if (w.investigate_sense_multiplier != null) PROTO_INVESTIGATE_SENSE_MULT = w.investigate_sense_multiplier;
        if (w.hordecall_immediate_radius != null) PROTO_HORDECALL_IMMEDIATE_R = w.hordecall_immediate_radius;
        if (w.hordecall_drift_radius != null) PROTO_HORDECALL_DRIFT_R     = w.hordecall_drift_radius;
        if (w.hordecall_alert_radius != null) PROTO_HORDECALL_ALERT_R     = w.hordecall_alert_radius;
        if (w.hordecall_drift_duration != null) PROTO_HORDECALL_DRIFT_DURATION = w.hordecall_drift_duration;
        if (w.hordecall_alert_duration != null) PROTO_HORDECALL_ALERT_DURATION = w.hordecall_alert_duration;
        if (w.hordecall_alert_sense_multiplier != null) PROTO_HORDECALL_ALERT_MULT = w.hordecall_alert_sense_multiplier;
        if (w.hordecall_cooldown != null) PROTO_HORDECALL_COOLDOWN = w.hordecall_cooldown;
        if (w.combat_blood_radius != null) PROTO_COMBAT_BLOOD_R    = w.combat_blood_radius;
        if (w.combat_blood_duration != null) PROTO_COMBAT_BLOOD_DURATION = w.combat_blood_duration;
        if (w.combat_blood_sense_multiplier != null) PROTO_COMBAT_BLOOD_MULT = w.combat_blood_sense_multiplier;
        if (w.effective_sense_max_mult != null) PROTO_EFFECTIVE_SENSE_MAX_MULT = w.effective_sense_max_mult;
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
        // 2026-05-12 (haunt pass): cemeteries spawn in BURSTS, not single
        // trickles. _nextBurstAt is the elapsed-time threshold for the next
        // burst.
        this._nextBurstAt = PROTO_BURST_INTERVAL_MIN
            + Math.random() * (PROTO_BURST_INTERVAL_MAX - PROTO_BURST_INTERVAL_MIN);
        this._elapsed = 0;
        this._ecs = null;
        this._aiState = new Map();
        this._spawn = { ...DEFAULT_SPAWN, point: { ...DEFAULT_SPAWN.point } };
        this._playerId = null;
        this._frozen = false;
        // Cemetery registry — keyed by entity id. Empty => legacy regime.
        this._spawnPoints = new Map();

        // Haunt-pass runtime state.
        this._noisePulses = [];                 // queued noise events (drained each frame)
        this._noiseThrottle = new Map();         // victimId → lastEmittedAt (cooldown per source)
        this._nextHerdPatrolAt = PROTO_HERD_PATROL_MIN
            + Math.random() * (PROTO_HERD_PATROL_MAX - PROTO_HERD_PATROL_MIN);
        this._nextEmergeAt = PROTO_EMERGE_INTERVAL_MIN
            + Math.random() * (PROTO_EMERGE_INTERVAL_MAX - PROTO_EMERGE_INTERVAL_MIN);
        this._pendingEmergences = [];            // [{ pos, spawnAtElapsed, marker }]
        // 2026-05-12 v2: burst members share an initial wander target so
        // they walk OUT of the cemetery as a clump (otherwise each member
        // immediately picks an independent target and disperses before
        // cohesion can hold them). Consumed in the ai state init block.
        this._pendingWanderTargets = new Map(); // entityId → Vector3

        // Listen for combat-noise events. Any non-silent entity:damaged
        // becomes a noise pulse at the victim's world position. Wandering
        // zombies within PROTO_NOISE_RADIUS get a synthetic chase target.
        EventBus.on('entity:damaged', this._onNoiseEvent.bind(this));
    }

    /**
     * Effective sense radius — base × MAX of currently-active boosts,
     * capped at PROTO_EFFECTIVE_SENSE_MAX_MULT. Multiple boosts take the
     * max (not multiply) so they don't compound into runaway omniscience.
     *
     * Active boost sources:
     *   • investigate — zombie is searching at LKP / noise position
     *   • alert       — Tier 3 horde-call still in window
     *   • combatBlood — recent damage event nearby
     */
    _effectiveSenseRadius(ai, aiComp) {
        const base = aiComp.senseRadius;
        let mult = 1.0;
        if (ai.noiseTargetPos && this._elapsed < ai.noiseTargetExpiresAt) {
            mult = Math.max(mult, PROTO_INVESTIGATE_SENSE_MULT);
        }
        if (this._elapsed < ai.alertExpiresAt) {
            mult = Math.max(mult, PROTO_HORDECALL_ALERT_MULT);
        }
        if (this._elapsed < ai.combatBloodExpiresAt) {
            mult = Math.max(mult, PROTO_COMBAT_BLOOD_MULT);
        }
        if (mult > PROTO_EFFECTIVE_SENSE_MAX_MULT) mult = PROTO_EFFECTIVE_SENSE_MAX_MULT;
        return base * mult;
    }

    /**
     * Flash the floating detection icon above a zombie's head for
     * DETECTION_FLASH_SEC. kind = 'chase' (yellow !) or 'hunt' (orange ?).
     * No-op if the sprite hasn't been created yet.
     */
    _flashDetection(ai, kind) {
        if (!ai.detectionSprite) return;
        if (ai.detectionKind !== kind) {
            const textures = _getDetectionTextures();
            ai.detectionSprite.material.map = textures[kind];
            ai.detectionSprite.material.needsUpdate = true;
            ai.detectionKind = kind;
        }
        ai.detectionSprite.visible = true;
        ai.detectionExpiresAt = this._elapsed + DETECTION_FLASH_SEC;
    }

    /**
     * Combat noise from entity:damaged. Throttled per-victim by
     * PROTO_NOISE_COOLDOWN so a furious melee doesn't spam pulses.
     */
    _onNoiseEvent({ entityId, silent } = {}) {
        if (silent) return;
        if (this._frozen) return;
        if (!this._ecs) return;
        const last = this._noiseThrottle.get(entityId) || -Infinity;
        if (this._elapsed - last < PROTO_NOISE_COOLDOWN) return;
        const t = this._ecs.getComponent(entityId, 'Transform');
        if (!t?.mesh) return;
        this._noiseThrottle.set(entityId, this._elapsed);
        this._noisePulses.push({
            x: t.mesh.position.x,
            z: t.mesh.position.z,
            emittedAt: this._elapsed
        });
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
            // Haunt-pass: herds migrate cemetery→cemetery + the rare
            // ground emergence ("wait, where did THAT come from"). Both
            // are no-ops outside multi-spawn regime.
            this._tickHerdPatrol();
            this._tickEmergence();
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
                // 2026-05-12 v2: consume any pre-assigned burst-shared
                // wander target so members of the same burst march out of
                // the cemetery as a clump instead of scattering.
                const pendingTarget = this._pendingWanderTargets.get(entityId);
                if (pendingTarget) this._pendingWanderTargets.delete(entityId);

                // 2026-05-12 v3: detection sprite — a child Sprite parented
                // to the zombie mesh. Hidden by default; shown briefly when
                // the zombie senses a real target (`!` yellow) or picks up
                // a noise pulse (`?` orange). Lets us debug the cascade
                // visually + sells "this zombie just noticed you" to the
                // player. Sprite is auto-removed when the mesh is removed
                // from the scene at zombie death.
                const detTextures = _getDetectionTextures();
                const spriteMat = new THREE.SpriteMaterial({
                    map: detTextures.chase,
                    transparent: true,
                    depthTest: false,
                    depthWrite: false
                });
                const detectionSprite = new THREE.Sprite(spriteMat);
                detectionSprite.scale.set(0.6, 0.6, 1);
                detectionSprite.position.set(0, 2.1, 0);
                detectionSprite.renderOrder = 100;
                detectionSprite.visible = false;
                transform.mesh.add(detectionSprite);

                this._aiState.set(entityId, {
                    state: aiComp.permanentChase ? 'chase' : 'wander',
                    spawnAnchor: anchor.clone(),
                    homePos: anchor.clone(),
                    nextAnchorDriftAt: driftAt,
                    wanderTarget: pendingTarget || null,
                    // If burst-shared, walk immediately. Else stagger so a
                    // freshly-respawned solo zombie doesn't twitch.
                    pauseTimer: pendingTarget ? 0 : Math.random() * aiComp.wanderPauseMax,
                    // 2026-05-12 haunt-pass: noise hunting. When a damage
                    // event fires within PROTO_NOISE_RADIUS, the wanderer
                    // gets a synthetic chase target at the noise position
                    // (valid until noiseTargetExpiresAt). On real-target
                    // sense, noise target is cleared and normal chase wins.
                    noiseTargetPos: null,
                    noiseTargetExpiresAt: 0,
                    // 2026-05-12 v3: detection-icon state.
                    detectionSprite,
                    detectionExpiresAt: 0,
                    detectionKind: null,
                    // 2026-05-12 v3: stall-break tracker. If position
                    // hasn't moved STALL_BREAK_MOVE_THRESHOLD u in the
                    // last STALL_BREAK_THRESHOLD_SEC seconds, force a
                    // fresh random wander target. Safety net against
                    // boids local minima.
                    lastSignificantMoveAt: this._elapsed,
                    lastSignificantPos: pos.clone(),
                    // 2026-05-12 v4 smart-zombies: memory + horde-call
                    // alerts + combat blood. Each tracked as expires-at
                    // timestamps so the per-frame _effectiveSenseRadius
                    // helper can read them with one comparison.
                    lastRealTargetPos: null,           // updated during chase-real; captured as LKP on loss
                    alertExpiresAt: 0,                 // Tier 3 horde-call alert (sense × 2.0)
                    driftPullPos: null,                // Tier 2 horde-call drift target
                    driftPullExpiresAt: 0,
                    combatBloodExpiresAt: 0            // sense × 1.5 from nearby damage events
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

        // ── 4.5. Process noise pulses + combat blood ───────────────────
        // Drain queued noise events (from entity:damaged). Two effects:
        //   (a) Noise hunt — wanderers within PROTO_NOISE_RADIUS get a
        //       synthetic chase target at the noise position for
        //       PROTO_NOISE_DURATION s. Pulls them to investigate.
        //   (b) Combat blood — wanderers within PROTO_COMBAT_BLOOD_R get
        //       a sense × 1.5 buff for PROTO_COMBAT_BLOOD_DURATION s. They
        //       don't move toward the noise, but become more easily
        //       aggro'd while the buff lasts.
        // Real-target sense overrides hunt in the transition loop below.
        if (this._noisePulses.length > 0) {
            const noiseR2 = PROTO_NOISE_RADIUS * PROTO_NOISE_RADIUS;
            const bloodR2 = PROTO_COMBAT_BLOOD_R * PROTO_COMBAT_BLOOD_R;
            for (const pulse of this._noisePulses) {
                const huntExpiresAt = pulse.emittedAt + PROTO_NOISE_DURATION;
                const bloodExpiresAt = pulse.emittedAt + PROTO_COMBAT_BLOOD_DURATION;
                for (const a of alive) {
                    if (a.aiComp.permanentChase) continue;
                    const dx = a.pos.x - pulse.x;
                    const dz = a.pos.z - pulse.z;
                    const d2 = dx * dx + dz * dz;
                    // (a) Noise hunt — wanderers in close radius
                    if (d2 <= noiseR2 && a.ai.state === 'wander') {
                        if (huntExpiresAt > a.ai.noiseTargetExpiresAt) {
                            a.ai.noiseTargetPos = new THREE.Vector3(pulse.x, 0, pulse.z);
                            a.ai.noiseTargetExpiresAt = huntExpiresAt;
                            this._flashDetection(a.ai, 'hunt');
                        }
                    }
                    // (b) Combat blood — wanderers in wider radius
                    if (d2 <= bloodR2 && a.ai.state === 'wander') {
                        if (bloodExpiresAt > a.ai.combatBloodExpiresAt) {
                            a.ai.combatBloodExpiresAt = bloodExpiresAt;
                        }
                    }
                }
            }
            this._noisePulses.length = 0;
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

            // 2026-05-12 v4: effective sense radius accounts for
            // investigate / alert / combat-blood boosts.
            const senseR = this._effectiveSenseRadius(ai, aiComp);
            const nearest = this._pickNearestTarget(pos, targets, senseR, attackerCount, this._multiSpawn());

            // Noise hunting (haunt pass). A wanderer that's heard a recent
            // combat noise pursues that position until either it reaches the
            // spot or the noiseTargetExpiresAt timer runs out. A real target
            // ALWAYS overrides noise; reaching the noise origin clears it.
            if (ai.noiseTargetPos) {
                if (this._elapsed >= ai.noiseTargetExpiresAt
                    || pos.distanceTo(ai.noiseTargetPos) < 1.5) {
                    ai.noiseTargetPos = null;
                    ai.noiseTargetExpiresAt = 0;
                }
            }
            const hasNoise = !!ai.noiseTargetPos;
            const synthNoiseTarget = hasNoise ? {
                id: '__noise',
                pos: ai.noiseTargetPos,
                isPlayer: false,
                isWorker: false,
                __synthetic: true
            } : null;

            if (ai.state === 'wander') {
                if (nearest) {
                    // Real target wins.
                    ai.state = 'chase';
                    aiComp.currentTargetId = nearest.id;
                    attackerCount.set(nearest.id, (attackerCount.get(nearest.id) || 0) + 1);
                    a.target = nearest;
                    transitionedToChase.push({ a, target: nearest });
                    // Real target supersedes noise + drift — clear.
                    ai.noiseTargetPos = null;
                    ai.noiseTargetExpiresAt = 0;
                    ai.driftPullPos = null;
                    ai.driftPullExpiresAt = 0;
                    this._flashDetection(ai, 'chase');
                } else if (synthNoiseTarget) {
                    // No real target but noise is calling — synthetic chase.
                    ai.state = 'chase';
                    a.target = synthNoiseTarget;
                    aiComp.currentTargetId = null; // synthetic = no cap counting
                }
            } else { // chase
                if (nearest) {
                    // Detect synthetic→real promotion BEFORE updating
                    // currentTargetId. When a zombie was hunting an LKP
                    // (currentTargetId === null) and just re-acquired a
                    // real target, that counts as a fresh chase trigger
                    // → push to broadcast list so the horde-call cascade
                    // doesn't die at the search-and-find step.
                    const synthToReal = aiComp.currentTargetId == null;
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
                    // Real target overrides any noise.
                    ai.noiseTargetPos = null;
                    ai.noiseTargetExpiresAt = 0;
                    // Drift pull is consumed by entering chase.
                    ai.driftPullPos = null;
                    ai.driftPullExpiresAt = 0;
                    // Remember position each frame so we can capture LKP
                    // the moment we lose sight.
                    if (!ai.lastRealTargetPos) ai.lastRealTargetPos = new THREE.Vector3();
                    ai.lastRealTargetPos.copy(nearest.pos);
                    if (synthToReal) {
                        // Search-and-find: zombie was hunting LKP, just
                        // sighted the real target again. Treat as a new
                        // chase trigger so the broadcast cascades.
                        transitionedToChase.push({ a, target: nearest });
                        this._flashDetection(ai, 'chase');
                    }
                } else if (synthNoiseTarget) {
                    // No real target — keep chasing noise origin.
                    a.target = synthNoiseTarget;
                    if (aiComp.currentTargetId != null) {
                        aiComp.currentTargetId = null; // dropped real, on synthetic now
                    }
                } else if (ai.lastRealTargetPos) {
                    // 2026-05-12 v4 MEMORY (LKP): real target just left
                    // effective sense. Save its last known position as a
                    // synthetic hunt target. The existing synthetic-chase
                    // pathway picks it up next frame. F.E.A.R. / Half-Life
                    // 'search' state pattern — zombie persists toward the
                    // spot where it last saw the target, with heightened
                    // sense, then gives up after INVESTIGATE_DURATION.
                    ai.noiseTargetPos = ai.lastRealTargetPos.clone();
                    ai.noiseTargetExpiresAt = this._elapsed + PROTO_INVESTIGATE_DURATION;
                    ai.lastRealTargetPos = null;
                    aiComp.currentTargetId = null;
                    // Hand off to the synthetic chase this frame.
                    a.target = {
                        id: '__lkp',
                        pos: ai.noiseTargetPos,
                        isPlayer: false,
                        isWorker: false,
                        __synthetic: true
                    };
                    this._flashDetection(ai, 'hunt');
                } else {
                    // Real target lost AND no LKP / no noise → wander.
                    ai.state = 'wander';
                    ai.spawnAnchor.copy(pos);
                    ai.wanderTarget = null;
                    ai.pauseTimer = aiComp.wanderPauseMin;
                    aiComp.currentTargetId = null;
                    a.target = null;
                }
            }
        }

        // ── 6. Horde Call broadcast (tiered) ────────────────────────────
        // 2026-05-12 v4: replaces single-tier pack-aggro. When a zombie
        // transitions wander→chase REAL target, it emits a 3-tier alert:
        //   Tier 1 (≤25u):  immediate chase join, target = broadcaster's
        //                   target. NO receiver-sight requirement — the
        //                   shout itself is enough. Capped by stack_cap.
        //   Tier 2 (≤60u):  drift pull — wanderer's wander target is
        //                   overridden to broadcaster's position for
        //                   PROTO_HORDECALL_DRIFT_DURATION sec.
        //   Tier 3 (≤120u): alert — sense radius temporarily × 2.0 for
        //                   PROTO_HORDECALL_ALERT_DURATION sec.
        // Tier 1 joiners will themselves transition wander→chase and
        // re-broadcast → cascade propagates outward across the map.
        if (this._multiSpawn() && transitionedToChase.length > 0) {
            const now = this._elapsed;
            const immR2 = PROTO_HORDECALL_IMMEDIATE_R * PROTO_HORDECALL_IMMEDIATE_R;
            const driftR2 = PROTO_HORDECALL_DRIFT_R * PROTO_HORDECALL_DRIFT_R;
            const alertR2 = PROTO_HORDECALL_ALERT_R * PROTO_HORDECALL_ALERT_R;
            for (const { a, target } of transitionedToChase) {
                if (now - a.aiComp.lastPackBroadcast < PROTO_HORDECALL_COOLDOWN) continue;
                a.aiComp.lastPackBroadcast = now;
                const ax = a.pos.x, az = a.pos.z;
                for (const b of alive) {
                    if (b === a) continue;
                    if (b.aiComp.permanentChase) continue;
                    const dx = b.pos.x - ax, dz = b.pos.z - az;
                    const d2 = dx * dx + dz * dz;

                    if (d2 <= immR2) {
                        // Tier 1: immediate join (only wanderers, subject to cap)
                        if (b.ai.state !== 'wander') continue;
                        const cnt = attackerCount.get(target.id) || 0;
                        if (cnt >= PROTO_STACK_CAP) continue;
                        b.ai.state = 'chase';
                        b.aiComp.currentTargetId = target.id;
                        attackerCount.set(target.id, cnt + 1);
                        b.target = target;
                        // Stale drift from a prior broadcast must clear.
                        b.ai.driftPullPos = null;
                        b.ai.driftPullExpiresAt = 0;
                        this._flashDetection(b.ai, 'chase');
                    } else if (d2 <= driftR2) {
                        // Tier 2: drift pull — wanderers only
                        if (b.ai.state !== 'wander') continue;
                        if (!b.ai.driftPullPos) b.ai.driftPullPos = new THREE.Vector3();
                        b.ai.driftPullPos.set(ax, 0, az);
                        b.ai.driftPullExpiresAt = now + PROTO_HORDECALL_DRIFT_DURATION;
                        this._flashDetection(b.ai, 'hunt');
                    } else if (d2 <= alertR2) {
                        // Tier 3: heightened alert — any state benefits
                        b.ai.alertExpiresAt = now + PROTO_HORDECALL_ALERT_DURATION;
                    }
                }
            }
        }

        // ── 7. Movement ─────────────────────────────────────────────────
        const playerZoneStatus = this._playerId != null
            ? ecs.getComponent(this._playerId, 'ZoneStatus') : null;

        const STOP_BUFFER = 0.4;
        for (const a of alive) {
            const { entityId, transform, movement, pos, ai, aiComp } = a;

            // Hide detection sprite once its flash window expires.
            if (ai.detectionSprite?.visible && this._elapsed >= ai.detectionExpiresAt) {
                ai.detectionSprite.visible = false;
            }

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
                this._updateWander(ai, aiComp, pos, transform, movement, deltaTime, alive);
            }
        }

        // ── 8. Drive pending random-emergence markers + spawns ──────────
        this._updateEmergence();
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
            // 2026-05-12: opt-out flag for objective entities (e.g. rival
            // kings) that should remain damageable by the player but NOT
            // be hunted by zombies. Without this filter, zombies converge
            // on the king flags and chew them down without player input.
            if (tag?.tags?.includes('no_zombie_target')) continue;
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

    _updateWander(ai, aiComp, pos, transform, movement, deltaTime, alive) {
        // 2026-05-12 v4 — drift pull override (Tier 2 horde call).
        // If this wanderer has been pulled by a recent broadcast, force
        // its wander target toward the broadcaster's position. Once
        // arrived (or the pull expires) it resumes normal wander.
        if (ai.driftPullPos) {
            if (this._elapsed >= ai.driftPullExpiresAt) {
                ai.driftPullPos = null;
                ai.driftPullExpiresAt = 0;
            } else if (!ai.wanderTarget
                || ai.wanderTarget.distanceTo(ai.driftPullPos) > 4) {
                // Bias toward broadcaster with a small jitter (so multiple
                // drifters don't stack on the same point).
                ai.wanderTarget = new THREE.Vector3(
                    ai.driftPullPos.x + (Math.random() * 2 - 1) * 3,
                    0,
                    ai.driftPullPos.z + (Math.random() * 2 - 1) * 3
                );
                ai.pauseTimer = 0;
            }
        }

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
                // wander target into oblivion. 100u map (2026-05-12) →
                // half-extent 50, clamp to 48 for safety margin.
                const maxRange = 48;
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

        // 2026-05-12 v3: REAL BOIDS — separation + alignment + cohesion +
        // random. Cohesion-only collapsed everyone to a single point
        // ("religious performance" freeze). The three Reynolds forces
        // produce flocking without singularity:
        //   • Separation (close, ~2.5u): push away — prevents collapse
        //   • Alignment (medium, ~8u): match heading — moves as flock
        //   • Cohesion (far, ~14u): pull toward mean — stays grouped
        // Random walk stays as the base wander direction; the 3 boid
        // vectors blend in with their respective weights. Universal rule
        // — applies the same to every wandering zombie.
        if (alive) {
            let cohX = 0, cohZ = 0, cohCount = 0;
            let aliX = 0, aliZ = 0, aliCount = 0;
            let sepX = 0, sepZ = 0, sepCount = 0;
            const sepR2 = BOID_SEP_RADIUS * BOID_SEP_RADIUS;
            const aliR2 = BOID_ALIGN_RADIUS * BOID_ALIGN_RADIUS;
            const cohR2 = PROTO_COHESION_RADIUS * PROTO_COHESION_RADIUS;

            for (const b of alive) {
                if (b.pos === pos) continue;
                const ddx = b.pos.x - pos.x;
                const ddz = b.pos.z - pos.z;
                const d2 = ddx * ddx + ddz * ddz;

                // Separation — applies regardless of neighbor state
                // (even a chasing zombie shouldn't be allowed to occupy
                // the same point as a wanderer).
                if (d2 < sepR2 && d2 > 0.0001) {
                    const d = Math.sqrt(d2);
                    // Falloff: stronger when very close
                    const falloff = 1 - d / BOID_SEP_RADIUS;
                    sepX -= (ddx / d) * falloff;
                    sepZ -= (ddz / d) * falloff;
                    sepCount++;
                }
                // Alignment + cohesion — wandering neighbors only
                if (b.ai.state === 'wander') {
                    if (d2 < aliR2 && b.transform?.mesh) {
                        aliX += Math.sin(b.transform.mesh.rotation.y);
                        aliZ += Math.cos(b.transform.mesh.rotation.y);
                        aliCount++;
                    }
                    if (d2 < cohR2) {
                        cohX += b.pos.x;
                        cohZ += b.pos.z;
                        cohCount++;
                    }
                }
            }

            // Accumulated direction starts at random-walk × W_RANDOM
            let aX = dir.x * BOID_W_RANDOM;
            let aZ = dir.z * BOID_W_RANDOM;

            // Separation (always wins close in)
            if (sepCount > 0) {
                const m = Math.sqrt(sepX * sepX + sepZ * sepZ);
                if (m > 0.001) {
                    aX += (sepX / m) * BOID_W_SEPARATION;
                    aZ += (sepZ / m) * BOID_W_SEPARATION;
                }
            }
            // Alignment
            if (aliCount > 0) {
                aliX /= aliCount; aliZ /= aliCount;
                const m = Math.sqrt(aliX * aliX + aliZ * aliZ);
                if (m > 0.001) {
                    aX += (aliX / m) * BOID_W_ALIGNMENT;
                    aZ += (aliZ / m) * BOID_W_ALIGNMENT;
                }
            }
            // Cohesion
            if (cohCount > 0) {
                cohX /= cohCount; cohZ /= cohCount;
                const cohDx = cohX - pos.x, cohDz = cohZ - pos.z;
                const m = Math.sqrt(cohDx * cohDx + cohDz * cohDz);
                if (m > 0.001) {
                    aX += (cohDx / m) * BOID_W_COHESION;
                    aZ += (cohDz / m) * BOID_W_COHESION;
                }
            }

            const totalM = Math.sqrt(aX * aX + aZ * aZ);
            if (totalM > 0.001) {
                dir.x = aX / totalM;
                dir.z = aZ / totalM;
            }
        }

        const wanderSpeed = movement.speed * aiComp.wanderSpeed;
        pos.addScaledVector(dir, wanderSpeed * deltaTime);
        transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);

        // 2026-05-12 v3: stall-break safety net. If the zombie hasn't moved
        // STALL_BREAK_MOVE_THRESHOLD u in STALL_BREAK_THRESHOLD_SEC seconds,
        // force a fresh random wander target. Protects against boids local
        // minima where separation forces a zombie into a corner with no
        // valid direction.
        const movedDist = pos.distanceTo(ai.lastSignificantPos);
        if (movedDist > STALL_BREAK_MOVE_THRESHOLD) {
            ai.lastSignificantMoveAt = this._elapsed;
            ai.lastSignificantPos.copy(pos);
        } else if (this._elapsed - ai.lastSignificantMoveAt > STALL_BREAK_THRESHOLD_SEC) {
            const a2 = Math.random() * Math.PI * 2;
            const r2 = 6 + Math.random() * 8;
            ai.wanderTarget = new THREE.Vector3(
                pos.x + Math.cos(a2) * r2,
                0,
                pos.z + Math.sin(a2) * r2
            );
            ai.lastSignificantMoveAt = this._elapsed;
            ai.lastSignificantPos.copy(pos);
        }
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

    /**
     * BURST spawn: every PROTO_BURST_INTERVAL_MIN..MAX seconds, pick a random
     * cemetery and vomit PROTO_BURST_SIZE_MIN..MAX zombies at once (with small
     * jitter). Same average flow as the old trickle, but zombies arrive AS
     * a clump → whoever they reach faces a group, not a single. Combined with
     * the cohesion force in _updateWander, the clump stays together while it
     * roams. Burst respects current cap; partial bursts allowed when slots
     * are tight.
     */
    _tickMultiSpawn() {
        const tiers = Math.floor(this._elapsed / PROTO_RAMP_INTERVAL);
        const currentCap = Math.min(PROTO_INITIAL_CAP + tiers * PROTO_CAP_RAMP, PROTO_MAX_CAP);

        if (this._elapsed < this._nextBurstAt) return;
        if (this._aiState.size >= currentCap) {
            // Defer burst slightly so we don't pile up when the cap is held.
            this._nextBurstAt = this._elapsed + 1.5;
            return;
        }

        const ids = [...this._spawnPoints.keys()];
        if (ids.length === 0) return;
        const spId = ids[Math.floor(Math.random() * ids.length)];
        const sp = this._spawnPoints.get(spId);
        if (!sp) return;

        const archetype = this._spawn.archetype || 'enemy-prototype';
        const burstSize = PROTO_BURST_SIZE_MIN
            + Math.floor(Math.random() * (PROTO_BURST_SIZE_MAX - PROTO_BURST_SIZE_MIN + 1));
        const slots = Math.max(0, currentCap - this._aiState.size);
        const toSpawn = Math.min(burstSize, slots);

        // Burst-shared wander destination: a single random point
        // PROTO_BURST_SHARED_OFFSET units from the cemetery in ANY direction.
        // 2026-05-12 v3: removed the center bias — every cemetery used to
        // aim its bursts at the origin, which made all 100 zombies converge
        // on (0,0) and clump into a religious-performance freeze. Random
        // angle + spread offset means each burst goes its own way.
        const sharedAngle = Math.random() * Math.PI * 2;
        const offset = (PROTO_BURST_SHARED_OFFSET * 0.7) + Math.random() * (PROTO_BURST_SHARED_OFFSET * 0.6);
        const sharedTarget = new THREE.Vector3(
            sp.pos.x + Math.cos(sharedAngle) * offset,
            0,
            sp.pos.z + Math.sin(sharedAngle) * offset
        );
        // Clamp to playable area (avoid map-edge leaks).
        const maxR = 48;
        const sLen = Math.sqrt(sharedTarget.x * sharedTarget.x + sharedTarget.z * sharedTarget.z);
        if (sLen > maxR) {
            sharedTarget.x *= maxR / sLen;
            sharedTarget.z *= maxR / sLen;
        }

        for (let i = 0; i < toSpawn; i++) {
            // Wider jitter so the burst doesn't stack on a single tile.
            const angle = Math.random() * Math.PI * 2;
            const r = 0.8 + Math.random() * 1.6;
            const pos = new THREE.Vector3(
                sp.pos.x + Math.cos(angle) * r,
                0,
                sp.pos.z + Math.sin(angle) * r
            );
            const newId = this._factory.create(archetype, pos);
            const ai = this._ecs?.getComponent(newId, 'EnemyAI');
            if (ai) ai.spawnPointId = sp.entityId;
            // Stash shared destination — consumed in ai state init.
            this._pendingWanderTargets.set(newId, sharedTarget.clone());
            EventBus.emit('spawn:emerged', { spawnPointId: spId, zombieId: newId });
        }

        this._nextBurstAt = this._elapsed + PROTO_BURST_INTERVAL_MIN
            + Math.random() * (PROTO_BURST_INTERVAL_MAX - PROTO_BURST_INTERVAL_MIN);
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
     * Herd patrol. Every PROTO_HERD_PATROL_MIN..MAX seconds, pick a source
     * cemetery and a destination cemetery, find PROTO_HERD_PATROL_SIZE
     * wandering zombies currently anchored at the source, and reassign their
     * homePos + spawnAnchor to the destination cemetery. Their wanderTarget
     * is cleared so they re-pick relative to the new anchor → natural
     * migration. Cohesion keeps them grouped during the trip.
     */
    _tickHerdPatrol() {
        if (this._elapsed < this._nextHerdPatrolAt) return;
        this._nextHerdPatrolAt = this._elapsed + PROTO_HERD_PATROL_MIN
            + Math.random() * (PROTO_HERD_PATROL_MAX - PROTO_HERD_PATROL_MIN);

        const cems = [...this._spawnPoints.values()];
        if (cems.length < 2) return;

        const source = cems[Math.floor(Math.random() * cems.length)];
        // Pick a destination different from source.
        let dest = source;
        let tries = 0;
        while (dest.entityId === source.entityId && tries++ < 8) {
            dest = cems[Math.floor(Math.random() * cems.length)];
        }
        if (dest.entityId === source.entityId) return;

        // Collect wanderers currently at source.
        const candidates = [];
        for (const [entityId, ai] of this._aiState) {
            if (ai.state !== 'wander') continue;
            // Match by homePos (the cemetery position, not the drifting anchor).
            if (ai.homePos.distanceTo(source.pos) > 2.0) continue;
            candidates.push({ entityId, ai });
        }
        if (candidates.length === 0) return;

        // Shuffle and pick the first N.
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        const n = Math.min(PROTO_HERD_PATROL_SIZE, candidates.length);
        for (let i = 0; i < n; i++) {
            const { entityId, ai } = candidates[i];
            ai.homePos.copy(dest.pos);
            ai.spawnAnchor.copy(dest.pos);
            ai.wanderTarget = null;
            ai.pauseTimer = 0; // re-pick immediately
            ai.nextAnchorDriftAt = this._elapsed + PROTO_ANCHOR_DRIFT_MIN
                + Math.random() * (PROTO_ANCHOR_DRIFT_MAX - PROTO_ANCHOR_DRIFT_MIN);
            // Also update EnemyAI.spawnPointId so future re-anchor calls
            // resolve to the new cemetery.
            const aiComp = this._ecs?.getComponent(entityId, 'EnemyAI');
            if (aiComp) aiComp.spawnPointId = dest.entityId;
        }
    }

    /**
     * Random ground emergence. Every PROTO_EMERGE_INTERVAL_MIN..MAX seconds,
     * pick a random ground position (anywhere on the playable map, not a
     * cemetery), spawn a warning marker, and queue a single zombie to emerge
     * at that position after PROTO_EMERGE_WARNING_SEC. Sells "nowhere is
     * safe" without crossing into unfair — the marker gives the player a
     * 2-second tell.
     */
    _tickEmergence() {
        if (this._elapsed < this._nextEmergeAt) return;
        this._nextEmergeAt = this._elapsed + PROTO_EMERGE_INTERVAL_MIN
            + Math.random() * (PROTO_EMERGE_INTERVAL_MAX - PROTO_EMERGE_INTERVAL_MIN);

        // Respect cap: if at cap, skip this emergence.
        const tiers = Math.floor(this._elapsed / PROTO_RAMP_INTERVAL);
        const currentCap = Math.min(PROTO_INITIAL_CAP + tiers * PROTO_CAP_RAMP, PROTO_MAX_CAP);
        if (this._aiState.size + this._pendingEmergences.length >= currentCap) return;

        // Random position within ±42u (just inside the 48u procedural area).
        const r = 8 + Math.random() * 34; // 8..42
        const angle = Math.random() * Math.PI * 2;
        const pos = new THREE.Vector3(
            Math.cos(angle) * r,
            0,
            Math.sin(angle) * r
        );

        // Build a small dark ring + inner disc as a "ground crack" marker.
        const markerGroup = new THREE.Group();
        markerGroup.position.copy(pos);
        markerGroup.position.y = 0.02;
        const ringGeo = new THREE.RingGeometry(0.55, 0.85, 18);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x1a0d05,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        markerGroup.add(ring);
        const discGeo = new THREE.CircleGeometry(0.5, 16);
        const discMat = new THREE.MeshBasicMaterial({
            color: 0x2a1810,
            transparent: true,
            opacity: 0.0,
            depthWrite: false
        });
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.rotation.x = -Math.PI / 2;
        markerGroup.add(disc);
        this.scene.add(markerGroup);

        this._pendingEmergences.push({
            pos: pos.clone(),
            spawnAtElapsed: this._elapsed + PROTO_EMERGE_WARNING_SEC,
            startedAt: this._elapsed,
            marker: markerGroup,
            ringMat, discMat
        });
    }

    /**
     * Per-frame: pulse the emergence marker (fade in over warning duration)
     * then, on expiry, spawn the zombie and remove the marker.
     */
    _updateEmergence() {
        if (this._pendingEmergences.length === 0) return;
        for (let i = this._pendingEmergences.length - 1; i >= 0; i--) {
            const e = this._pendingEmergences[i];
            const t = (this._elapsed - e.startedAt) / PROTO_EMERGE_WARNING_SEC;
            const opacity = Math.min(0.85, Math.max(0, t)) * (0.7 + 0.3 * Math.sin(this._elapsed * 8));
            e.ringMat.opacity = opacity;
            e.discMat.opacity = opacity * 0.6;

            if (this._elapsed >= e.spawnAtElapsed) {
                // Remove marker
                this.scene.remove(e.marker);
                e.ringMat.dispose?.();
                e.discMat.dispose?.();

                // Spawn the zombie. No spawnPointId → it'll resolve to the
                // nearest cemetery on first sense init (acceptable; ground
                // emergence is a one-off, then it joins the local crowd).
                const archetype = this._spawn.archetype || 'enemy-prototype';
                this._factory.create(archetype, e.pos.clone());

                this._pendingEmergences.splice(i, 1);
            }
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
