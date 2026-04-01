import * as THREE from 'three';
import { ENEMY_CONFIG, WORLD_CONFIG } from '../config/gameConfig.js';
import { Enemy } from '../entities/Enemy.js';
import { ObjectPool } from '../utils/ObjectPool.js';
import EventBus from '../core/EventBus.js';

export class EnemySystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.enemies = [];
        this.spawnTimer = 0;

        this.pool = new ObjectPool(() => new Enemy(), 10, 'EnemyPool');
    }

    update(deltaTime) {
        this.spawnTimer += deltaTime;

        // Auto-spawn logic
        if (this.spawnTimer >= ENEMY_CONFIG.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnEnemy();
        }

        // Behavior: Move toward player
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            if (enemy.state === 'DYING') {
                this.handleEnemyDeath(enemy, i);
                continue;
            }

            // Direction to player
            const direction = new THREE.Vector3()
                .copy(this.player.position)
                .sub(enemy.position);

            // basic avoidance or stop near player
            if (direction.length() > 0.5) {
                direction.normalize();
                enemy.position.addScaledVector(direction, ENEMY_CONFIG.speed * deltaTime);
                // Look at player (rotation snap)
                enemy.rotation.y = Math.atan2(direction.x, direction.z);
            }
        }
    }

    spawnEnemy() {
        // Spawn at random angle on a distance circle
        const angle = Math.random() * Math.PI * 2;
        const dist = ENEMY_CONFIG.spawnDistance + (Math.random() * 5);
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;

        const enemy = this.pool.get();
        enemy.reset();
        enemy.position.set(x, 0, z);
        this.scene.add(enemy);
        this.enemies.push(enemy);
    }

    handleEnemyDeath(enemy, index) {
        // EventBus emission (new ECS path)
        EventBus.emit('entity:died', {
            entityId: null,            // legacy enemies have no ECS ID yet
            position: enemy.position.clone(),
            drops: ['meat']
        });

        // Legacy callback (kept during migration — remove in Task 9)
        if (this.onEnemyDeath) {
            this.onEnemyDeath(enemy.position.clone());
        }

        // Return to pool
        this.pool.release(enemy);
        this.scene.remove(enemy);
        this.enemies.splice(index, 1);
    }
}
