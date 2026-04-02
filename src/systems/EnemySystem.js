import * as THREE from 'three';
import { ENEMY_CONFIG } from '../config/gameConfig.js';
import EventBus from '../core/EventBus.js';

const AGGRO_RADIUS = 10;
const WANDER_RADIUS = 8;       // how far from spawn point a zombie wanders
const WANDER_PAUSE_MIN = 1.0;  // seconds idle between wander moves
const WANDER_PAUSE_MAX = 3.0;

/**
 * EnemySystem — ECS-driven enemy spawning and steering.
 *
 * AI states:
 *   'wander' — pick random points near spawn, idle between moves
 *   'chase'  — pursue the player (original behavior)
 *
 * Transition: wander→chase when player < AGGRO_RADIUS
 *             chase→wander when player > AGGRO_RADIUS
 */
export class EnemySystem {
    constructor(scene, factory, playerTransform) {
        this.scene = scene;
        this._factory = factory;
        this._playerTransform = playerTransform;
        this._spawnTimer = 0;
        this._ecs = null;
        this._aiState = new Map(); // entityId → { state, spawnPos, wanderTarget, pauseTimer }
    }

    setECS(ecs) { this._ecs = ecs; }

    /** Called by ECS every frame. */
    update(entities, deltaTime, ecs) {
        this._ecs = ecs;
        this._spawnTimer += deltaTime;

        if (this._spawnTimer >= ENEMY_CONFIG.spawnInterval) {
            this._spawnTimer = 0;
            this._spawnEnemy();
        }

        const playerPos = this._playerTransform.mesh.position;

        // Query entities that could be walls (have Transform, Health, Tag)
        const walls = ecs.queryEntities(['Transform', 'Health', 'Tag']);

        // Clean up AI state for dead/removed entities
        for (const [id] of this._aiState) {
            if (!entities.includes(id)) this._aiState.delete(id);
        }

        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const movement = ecs.getComponent(entityId, 'Movement');
            const health = ecs.getComponent(entityId, 'Health');

            if (!transform || !movement || !health) continue;
            if (health.hp <= 0) continue;

            const pos = transform.mesh.position;

            // Initialize AI state on first encounter
            if (!this._aiState.has(entityId)) {
                this._aiState.set(entityId, {
                    state: 'wander',
                    spawnPos: pos.clone(),
                    wanderTarget: null,
                    pauseTimer: Math.random() * WANDER_PAUSE_MAX
                });
            }

            const ai = this._aiState.get(entityId);
            const distToPlayer = pos.distanceTo(playerPos);

            // State transitions
            if (ai.state === 'wander' && distToPlayer < AGGRO_RADIUS) {
                ai.state = 'chase';
            } else if (ai.state === 'chase' && distToPlayer > AGGRO_RADIUS) {
                ai.state = 'wander';
                ai.wanderTarget = null;
                ai.pauseTimer = WANDER_PAUSE_MIN;
            }

            // Check if blocked by a wall/structure
            let blocked = false;
            for (const wallId of walls) {
                const wallTag = ecs.getComponent(wallId, 'Tag');
                if (!wallTag || !wallTag.has('structure')) continue;
                const wallTransform = ecs.getComponent(wallId, 'Transform');
                if (!wallTransform) continue;

                const distToWall = pos.distanceTo(wallTransform.mesh.position);
                if (distToWall < 1.5) {
                    blocked = true;
                    const wallDir = new THREE.Vector3().subVectors(wallTransform.mesh.position, pos);
                    if (wallDir.length() > 0.1) {
                        transform.mesh.rotation.y = Math.atan2(wallDir.x, wallDir.z);
                    }
                    break;
                }
            }

            if (blocked) continue; // ContactDamageSystem handles the attack damage

            if (ai.state === 'chase') {
                // Chase player
                const dir = new THREE.Vector3().subVectors(playerPos, pos);
                if (dir.length() > 0.5) {
                    dir.normalize();
                    pos.addScaledVector(dir, movement.speed * deltaTime);
                    transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                }
            } else {
                // Wander
                this._updateWander(ai, pos, transform, movement, deltaTime);
            }
        }
    }

    _updateWander(ai, pos, transform, movement, deltaTime) {
        // Pausing between wander moves
        if (!ai.wanderTarget) {
            ai.pauseTimer -= deltaTime;
            if (ai.pauseTimer <= 0) {
                // Pick a random point near spawn
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * WANDER_RADIUS;
                ai.wanderTarget = new THREE.Vector3(
                    ai.spawnPos.x + Math.cos(angle) * r,
                    0,
                    ai.spawnPos.z + Math.sin(angle) * r
                );
            }
            return;
        }

        // Move toward wander target
        const dir = new THREE.Vector3().subVectors(ai.wanderTarget, pos);
        const dist = dir.length();

        if (dist < 0.5) {
            // Reached target, pause before picking next
            ai.wanderTarget = null;
            ai.pauseTimer = WANDER_PAUSE_MIN + Math.random() * (WANDER_PAUSE_MAX - WANDER_PAUSE_MIN);
            return;
        }

        dir.normalize();
        const wanderSpeed = movement.speed * 0.4; // wander slower than chase
        pos.addScaledVector(dir, wanderSpeed * deltaTime);
        transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }

    _spawnEnemy() {
        const count = 4 + Math.floor(Math.random() * 2); // 4-5 per wave
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = ENEMY_CONFIG.spawnDistance + Math.random() * 5;
            const pos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
            this._factory.create('enemy', pos);
        }
    }
}
