import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * CombatSystem — Pure ECS. No legacy enemySystem bridge.
 * Queries shooter entities: ['Transform', 'Shooter']
 * Targets are found by querying entities with ['Transform', 'Movement'] and matching faction.
 */
export class CombatSystem {
    constructor(scene, projectilePool) {
        this.scene = scene;
        this.projectilePool = projectilePool;
        this.projectiles = [];
    }

    update(entities, deltaTime, ecs) {
        for (const shooterId of entities) {
            const transform = ecs.getComponent(shooterId, 'Transform');
            const shooter = ecs.getComponent(shooterId, 'Shooter');
            if (!transform || !shooter) continue;

            shooter.lastFireTime += deltaTime;

            let closestDist = shooter.range;
            let bestTarget = null;

            // Find targets from ECS only — no legacy array
            const targetables = ecs.queryEntities(['Transform', 'Movement']);
            for (const targetId of targetables) {
                if (targetId === shooterId) continue;
                const targetMovement = ecs.getComponent(targetId, 'Movement');
                if (!shooter.targetFactions.includes(targetMovement.faction)) continue;

                const targetTransform = ecs.getComponent(targetId, 'Transform');
                const dist = transform.mesh.position.distanceTo(targetTransform.mesh.position);
                if (dist < closestDist) {
                    closestDist = dist;
                    bestTarget = { pos: targetTransform.mesh.position.clone(), entityId: targetId };
                }
            }

            if (bestTarget && shooter.lastFireTime >= shooter.fireRate) {
                this._fireProjectile(transform.mesh.position, bestTarget.pos, shooter.damage);
                shooter.lastFireTime = 0;
            }
        }

        this._updateProjectiles(deltaTime, ecs);
    }

    _fireProjectile(origin, target, damage) {
        const direction = new THREE.Vector3().subVectors(target, origin).normalize();
        const projectile = this.projectilePool.get();
        projectile.reset(origin, direction);
        projectile.damage = damage;
        this.scene.add(projectile);
        this.projectiles.push(projectile);
    }

    _updateProjectiles(deltaTime, ecs) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(deltaTime);
            let hit = false;

            // Collision check against ECS entities with Health
            const hittable = ecs.queryEntities(['Transform', 'Health', 'Movement']);
            for (const entityId of hittable) {
                const movement = ecs.getComponent(entityId, 'Movement');
                if (movement.faction === 'player' || movement.faction === 'neutral') continue;

                const t = ecs.getComponent(entityId, 'Transform');
                const health = ecs.getComponent(entityId, 'Health');
                const dist = p.position.distanceTo(t.mesh.position);
                if (dist < 1.0) {
                    EventBus.emit('entity:damaged', { entityId, damage: p.damage || 1 });
                    hit = true;
                    break;
                }
            }

            if (hit || !p.visible || p.position.length() > 50) {
                this.scene.remove(p);
                this.projectilePool.release(p);
                this.projectiles.splice(i, 1);
            }
        }
    }
}
