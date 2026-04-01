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

        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const movement = ecs.getComponent(entityId, 'Movement');
            const health = ecs.getComponent(entityId, 'Health');

            if (!transform || !movement || !health) continue;

            // Dead enemies — emit died event and destroy
            if (health.hp <= 0) {
                EventBus.emit('entity:died', {
                    entityId,
                    position: transform.mesh.position.clone(),
                    drops: ['meat']
                });
                this.scene.remove(transform.mesh);
                ecs.destroyEntity(entityId);
                continue;
            }

            // Steer toward player
            const dir = new THREE.Vector3()
                .subVectors(playerPos, transform.mesh.position);
            if (dir.length() > 0.5) {
                dir.normalize();
                transform.mesh.position.addScaledVector(dir, movement.speed * deltaTime);
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
