import * as THREE from 'three';
import { ENEMY_CONFIG } from '../config/gameConfig.js';
import EventBus from '../core/EventBus.js';

/**
 * EnemySystem — ECS-driven enemy spawning and steering.
 * Enemies are created via EntityFactory (archetype 'enemy').
 * Queries: ['Transform', 'Movement', 'Health']
 */
export class EnemySystem {
    constructor(scene, factory, playerTransform) {
        this.scene = scene;
        this._factory = factory;
        this._playerTransform = playerTransform;
        this._spawnTimer = 0;
        this._ecs = null;
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

        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const movement = ecs.getComponent(entityId, 'Movement');
            const health = ecs.getComponent(entityId, 'Health');

            if (!transform || !movement || !health) continue;

            // Skip dead/destroyed enemies (HealthSystem handles death)
            if (health.hp <= 0) continue;

            const pos = transform.mesh.position;

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
                    // Face the wall
                    const wallDir = new THREE.Vector3().subVectors(wallTransform.mesh.position, pos);
                    if (wallDir.length() > 0.1) {
                        transform.mesh.rotation.y = Math.atan2(wallDir.x, wallDir.z);
                    }
                    break;
                }
            }

            if (blocked) continue; // ContactDamageSystem handles the attack damage

            // Chase player
            const dir = new THREE.Vector3().subVectors(playerPos, pos);
            if (dir.length() > 0.5) {
                dir.normalize();
                pos.addScaledVector(dir, movement.speed * deltaTime);
                transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            }
        }
    }

    _spawnEnemy() {
        const angle = Math.random() * Math.PI * 2;
        const dist = ENEMY_CONFIG.spawnDistance + Math.random() * 5;
        const pos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
        this._factory.create('enemy', pos);
    }
}
