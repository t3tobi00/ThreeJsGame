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
        this._countMin = 4;
        this._countMax = 5;
    }

    setECS(ecs) { this._ecs = ecs; }

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
            this._spawnEnemy();
        }

        const playerPos = this._playerTransform.mesh.position;

        // Clean up AI state for dead/removed entities
        for (const [id] of this._aiState) {
            if (!entities.includes(id)) this._aiState.delete(id);
        }

        // --- Pass 1: Initialize AI state + direct player aggro ---
        const alive = [];
        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const movement = ecs.getComponent(entityId, 'Movement');
            const health = ecs.getComponent(entityId, 'Health');

            if (!transform || !movement || !health) continue;
            if (health.hp <= 0) continue;

            const pos = transform.mesh.position;
            const aiComp = ecs.getComponent(entityId, 'EnemyAI') || DEFAULT_AI;

            if (!this._aiState.has(entityId)) {
                this._aiState.set(entityId, {
                    state: 'wander',
                    spawnPos: pos.clone(),
                    wanderTarget: null,
                    pauseTimer: Math.random() * aiComp.wanderPauseMax
                });
            }

            const ai = this._aiState.get(entityId);
            const distToPlayer = pos.distanceTo(playerPos);

            if (ai.state === 'wander' && distToPlayer < aiComp.aggroRadius) {
                ai.state = 'chase';
            } else if (ai.state === 'chase' && distToPlayer > aiComp.aggroRadius * 1.5) {
                ai.state = 'wander';
                ai.wanderTarget = null;
                ai.pauseTimer = aiComp.wanderPauseMin;
            }

            alive.push({ entityId, transform, movement, pos, ai, aiComp });
        }

        // --- Pass 2: Herd aggro ---
        for (const a of alive) {
            if (a.ai.state !== 'wander') continue;
            for (const b of alive) {
                if (b.ai.state !== 'chase') continue;
                if (b.pos.distanceTo(playerPos) > b.aiComp.aggroRadius) continue;
                if (a.pos.distanceTo(b.pos) < a.aiComp.herdRadius) {
                    a.ai.state = 'chase';
                    break;
                }
            }
        }

        // --- Pass 3: Movement ---
        for (const { transform, movement, pos, ai, aiComp } of alive) {
            if (ai.state === 'chase') {
                const dir = new THREE.Vector3().subVectors(playerPos, pos);
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

    _spawnEnemy() {
        const range = this._countMax - this._countMin + 1;
        const count = this._countMin + Math.floor(Math.random() * range);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = ENEMY_CONFIG.spawnDistance + Math.random() * 5;
            const pos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
            this._factory.create('enemy', pos);
        }
    }
}
