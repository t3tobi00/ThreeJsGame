import * as THREE from 'three';
import { ENEMY_CONFIG } from '../config/gameConfig.js';
import EventBus from '../core/EventBus.js';

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
 * Spawn counts come from level JSON via setSpawnConfig().
 *
 * Performance guards:
 *   - Hard cap on alive enemies (ENEMY_CONFIG.maxAlive)
 *   - Far wanderers despawned (ENEMY_CONFIG.despawnDistance)
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

        // Spawn config — set from level JSON via setSpawnConfig()
        this._countMin  = 4;
        this._countMax  = 5;
        this._playerId  = null; // set via setPlayerEntityId() for ZoneStatus lookup
    }

    setECS(ecs) { this._ecs = ecs; }

    /** Player entity ID — used to read ZoneStatus and redirect chase target. */
    setPlayerEntityId(id) { this._playerId = id; }

    /** Called from main.js after level load to pass level-specific spawn config. */
    setSpawnConfig({ countMin, countMax } = {}) {
        if (countMin !== undefined) this._countMin = countMin;
        if (countMax !== undefined) this._countMax = countMax;
    }

    /** Called by ECS every frame. */
    update(entities, deltaTime, ecs) {
        this._ecs = ecs;
        this._spawnTimer += deltaTime;

        if (this._spawnTimer >= ENEMY_CONFIG.spawnInterval) {
            this._spawnTimer = 0;
            if (this._aiState.size < ENEMY_CONFIG.maxAlive) {
                this._spawnEnemy();
            }
        }

        const playerPos = this._playerTransform.mesh.position;

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
            if (health.hp <= 0) continue;

            const pos = transform.mesh.position;
            const aiComp = ecs.getComponent(entityId, 'EnemyAI') || DEFAULT_AI;

            // Despawn far-off-screen wanderers to free slots for fresh spawns
            const ai = this._aiState.get(entityId);
            if (ai && ai.state === 'wander' && pos.distanceTo(playerPos) > ENEMY_CONFIG.despawnDistance) {
                this.scene.remove(transform.mesh);
                ecs.destroyEntity(entityId);
                this._aiState.delete(entityId);
                continue;
            }

            if (!this._aiState.has(entityId)) {
                this._aiState.set(entityId, {
                    state: 'wander',
                    spawnPos: pos.clone(),
                    wanderTarget: null,
                    pauseTimer: Math.random() * aiComp.wanderPauseMax
                });
            }

            const aiState = this._aiState.get(entityId);
            const distToPlayer = pos.distanceTo(playerPos);

            if (aiState.state === 'wander' && distToPlayer < aiComp.aggroRadius) {
                aiState.state = 'chase';
            } else if (aiState.state === 'chase' && distToPlayer > aiComp.aggroRadius * 1.5) {
                aiState.state = 'wander';
                aiState.wanderTarget = null;
                aiState.pauseTimer = aiComp.wanderPauseMin;
            }

            alive.push({ entityId, transform, movement, pos, ai: aiState, aiComp });
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
        for (const { transform, movement, pos, ai, aiComp } of alive) {
            if (ai.state === 'chase') {
                const target = (playerZoneStatus?.insideZone && playerZoneStatus.zoneBoundsWorld)
                    ? this._nearestBoundaryPoint(pos, playerZoneStatus.zoneBoundsWorld)
                    : playerPos;
                const dir = new THREE.Vector3().subVectors(target, pos);
                if (dir.length() > 0.5) {
                    dir.normalize();
                    pos.addScaledVector(dir, movement.speed * deltaTime);
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
        const range = this._countMax - this._countMin + 1;
        const count = this._countMin + Math.floor(Math.random() * range);
        const slotsLeft = ENEMY_CONFIG.maxAlive - this._aiState.size;
        const toSpawn = Math.min(count, slotsLeft);
        for (let i = 0; i < toSpawn; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = ENEMY_CONFIG.spawnDistance + Math.random() * 5;
            const pos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
            this._factory.create('enemy', pos);
        }
    }
}
