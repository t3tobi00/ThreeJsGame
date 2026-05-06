import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

// Fallback spawn config if setConfig() is never called. Normally populated
// from the 'spawn' block of src/config/archetypes/enemy.json.
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

// Fallback defaults if EnemyAI component is missing
const DEFAULT_AI = {
    aggroRadius: 10,
    herdRadius: 5,
    wanderSpeed: 0.4,
    wanderRadius: 8,
    wanderPauseMin: 1.0,
    wanderPauseMax: 3.0
};

/**
 * EnemySystem — ECS-driven enemy spawning and steering.
 *
 * AI parameters are read from each entity's EnemyAI component (JSON archetype).
 * Spawn config comes from enemy.json → "spawn" block via setConfig().
 *
 * Performance guards:
 *   - Hard cap on alive enemies (spawn.maxAlive)
 *   - Far wanderers despawned (spawn.despawnDistance)
 *   - Herd aggro is O(N*C) not O(N²) — only checks chasers
 *
 * AI states:
 *   'wander' — pick random points, idle between moves
 *   'chase'  — pursue the player
 *
 * Transition: wander→chase when player < aggroRadius (or herd aggro)
 *             chase→wander when player > aggroRadius * 1.5
 */
export class EnemySystem {
    constructor(scene, factory, playerTransform) {
        this.scene = scene;
        this._factory = factory;
        this._playerTransform = playerTransform;
        this._spawnTimer = 0;
        this._ecs = null;
        this._aiState = new Map();
        this._spawn = { ...DEFAULT_SPAWN, point: { ...DEFAULT_SPAWN.point } };
        this._playerId = null; // set via setPlayerEntityId() for ZoneStatus lookup
        this._frozen = false;  // when true, update() short-circuits — zombies sit still
    }

    setECS(ecs) { this._ecs = ecs; }

    /** Player entity ID — used to read ZoneStatus and redirect chase target. */
    setPlayerEntityId(id) { this._playerId = id; }

    /**
     * Freeze enemy AI + spawning. Used by PrototypeStateMachine BOOT state to
     * give the player a few seconds to orient before zombies start aggroing.
     * Pre-placed zombies remain in the world but don't move; ContactDamage
     * still applies if the player walks into them, so combat is not disabled
     * — only autonomous AI is paused.
     */
    setFrozen(frozen) { this._frozen = !!frozen; }

    /** Called from main.js after archetype load. Accepts the 'spawn' block from enemy.json. */
    setConfig(spawn = {}) {
        this._spawn = {
            ...DEFAULT_SPAWN,
            ...spawn,
            point: { ...DEFAULT_SPAWN.point, ...(spawn.point || {}) },
        };
    }

    /** Called by ECS every frame. */
    update(entities, deltaTime, ecs) {
        if (this._frozen) return;
        this._ecs = ecs;
        this._spawnTimer += deltaTime;

        if (this._spawnTimer >= this._spawn.interval) {
            this._spawnTimer = 0;
            if (this._aiState.size < this._spawn.maxAlive) {
                this._spawnEnemy();
            }
        }

        const playerPos = this._playerTransform.mesh.position;

        // Gather all valid aggro targets: the player + any ally (heroes).
        // Enemies pick the nearest of these each frame.
        const targets = [{ pos: playerPos, isPlayer: true }];
        const potentialAllies = ecs.queryEntities(['Transform', 'Movement', 'Health']);
        for (const id of potentialAllies) {
            const m = ecs.getComponent(id, 'Movement');
            if (!m || m.faction !== 'ally') continue;
            const h = ecs.getComponent(id, 'Health');
            if (!h || h.hp <= 0) continue;
            const t = ecs.getComponent(id, 'Transform');
            if (!t) continue;
            targets.push({ pos: t.mesh.position, isPlayer: false });
        }

        // Clean up AI state for dead/removed entities
        for (const [id] of this._aiState) {
            if (!entities.includes(id)) this._aiState.delete(id);
        }

        // --- Pass 1: Despawn far wanderers + Initialize AI state + direct player aggro ---
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

            // Despawn far-off-screen wanderers to free slots for fresh spawns
            const ai = this._aiState.get(entityId);
            if (ai && ai.state === 'wander' && pos.distanceTo(playerPos) > this._spawn.despawnDistance) {
                const instanceRef = ecs.getComponent(entityId, 'InstanceRef');
                if (instanceRef) {
                    instanceRef.pool.release(instanceRef.index);
                } else {
                    this.scene.remove(transform.mesh);
                }
                ecs.destroyEntity(entityId);
                this._aiState.delete(entityId);
                continue;
            }

            if (!this._aiState.has(entityId)) {
                // Marchers (permanentChase) start in 'chase' so they walk toward
                // the player from anywhere on the map. Standard zombies start
                // in 'wander' and only chase when within aggroRadius.
                this._aiState.set(entityId, {
                    state: aiComp.permanentChase ? 'chase' : 'wander',
                    spawnPos: pos.clone(),
                    wanderTarget: null,
                    pauseTimer: Math.random() * aiComp.wanderPauseMax
                });
            }

            const aiState = this._aiState.get(entityId);

            // Nearest aggro target (player or ally). Stored on the alive
            // entry so Pass 3 can reuse it without re-scanning.
            let nearestTarget = targets[0];
            let nearestDist = pos.distanceTo(nearestTarget.pos);
            for (let i = 1; i < targets.length; i++) {
                const d = pos.distanceTo(targets[i].pos);
                if (d < nearestDist) { nearestDist = d; nearestTarget = targets[i]; }
            }

            if (!aiComp.permanentChase) {
                // Standard wander↔chase transitions based on aggroRadius.
                if (aiState.state === 'wander' && nearestDist < aiComp.aggroRadius) {
                    aiState.state = 'chase';
                } else if (aiState.state === 'chase' && nearestDist > aiComp.aggroRadius * 1.5) {
                    aiState.state = 'wander';
                    aiState.wanderTarget = null;
                    aiState.pauseTimer = aiComp.wanderPauseMin;
                }
            }
            // Marchers stay in 'chase' permanently — no transition logic runs.

            alive.push({ entityId, transform, movement, pos, ai: aiState, aiComp, nearestTarget });
        }

        // --- Pass 2: Herd aggro — O(N*C) where C = number of chasers ---
        const chasers = [];
        for (const a of alive) {
            if (a.ai.state === 'chase') chasers.push(a);
        }
        for (const a of alive) {
            if (a.ai.state !== 'wander') continue;
            for (const b of chasers) {
                if (a.pos.distanceTo(b.pos) < a.aiComp.herdRadius) {
                    a.ai.state = 'chase';
                    break;
                }
            }
        }

        // Read player's ZoneStatus once — if player is inside an active zone,
        // redirect each chasing enemy to the nearest point on the zone boundary
        // instead of the player position (prevents gate-pathfinding exploit).
        const playerZoneStatus = this._playerId != null
            ? ecs.getComponent(this._playerId, 'ZoneStatus') : null;

        // --- Pass 3: Movement ---
        // Stop-at-attack-range: when the enemy is within its melee reach,
        // halt and just face the target so the LungeAnimSystem swing has
        // visible space instead of overlapping the victim. Stop distance
        // is `ContactDamage.range - STOP_BUFFER` so the zombie sits a hair
        // inside its damage radius (the swing still lands).
        const STOP_BUFFER = 0.4;
        for (const { entityId, transform, movement, pos, ai, aiComp, nearestTarget } of alive) {
            if (ai.state === 'chase') {
                const target = (nearestTarget.isPlayer
                    && playerZoneStatus?.insideZone
                    && playerZoneStatus.zoneBoundsWorld)
                    ? this._nearestBoundaryPoint(pos, playerZoneStatus.zoneBoundsWorld)
                    : nearestTarget.pos;
                const dir = new THREE.Vector3().subVectors(target, pos);
                const dist = dir.length();

                const contact = ecs.getComponent(entityId, 'ContactDamage');
                const stopDist = contact ? Math.max(0.5, contact.range - STOP_BUFFER) : 0.5;

                if (dist > stopDist) {
                    dir.normalize();
                    pos.addScaledVector(dir, movement.speed * deltaTime);
                    transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                } else if (dist > 0.001) {
                    // In attack range — face target, no positional drift.
                    transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                }
            } else {
                this._updateWander(ai, aiComp, pos, transform, movement, deltaTime);
            }
        }
    }

    _updateWander(ai, aiComp, pos, transform, movement, deltaTime) {
        if (!ai.wanderTarget) {
            ai.pauseTimer -= deltaTime;
            if (ai.pauseTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                const r = 3 + Math.random() * aiComp.wanderRadius;
                const rawTarget = new THREE.Vector3(
                    pos.x + Math.cos(angle) * r,
                    0,
                    pos.z + Math.sin(angle) * r
                );
                const maxRange = 40;
                const distFromCenter = Math.sqrt(rawTarget.x * rawTarget.x + rawTarget.z * rawTarget.z);
                if (distFromCenter > maxRange) {
                    rawTarget.x *= maxRange / distFromCenter;
                    rawTarget.z *= maxRange / distFromCenter;
                }
                ai.wanderTarget = rawTarget;
            }
            return;
        }

        const dir = new THREE.Vector3().subVectors(ai.wanderTarget, pos);
        const dist = dir.length();

        if (dist < 0.5) {
            ai.wanderTarget = null;
            ai.pauseTimer = aiComp.wanderPauseMin + Math.random() * (aiComp.wanderPauseMax - aiComp.wanderPauseMin);
            return;
        }

        dir.normalize();
        const wanderSpeed = movement.speed * aiComp.wanderSpeed;
        pos.addScaledVector(dir, wanderSpeed * deltaTime);
        transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }

    /**
     * Nearest point on the zone boundary rectangle to enemyPos.
     * wb (zoneBoundsWorld) is provided by the player's ZoneStatus component —
     * EnemySystem needs no grid or zone reference of its own.
     */
    _nearestBoundaryPoint(enemyPos, wb) {
        return new THREE.Vector3(
            Math.max(wb.minX, Math.min(enemyPos.x, wb.maxX)),
            0,
            Math.max(wb.minZ, Math.min(enemyPos.z, wb.maxZ))
        );
    }

    _spawnEnemy() {
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
        // Spawn config can override which archetype to spawn (e.g.
        // 'enemy-prototype' under ?prototype mode). Defaults to 'enemy'.
        const archetype = s.archetype || 'enemy';
        for (let i = 0; i < toSpawn; i++) {
            const jx = (Math.random() * 2 - 1) * j;
            const jz = (Math.random() * 2 - 1) * j;
            const pos = new THREE.Vector3(sp.x + jx, 0, sp.z + jz);
            this._factory.create(archetype, pos);
        }
    }
}
