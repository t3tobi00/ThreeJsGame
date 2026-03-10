import * as THREE from 'three';

/**
 * ECS CombatSystem — Handles auto-firing for any entity with a Shooter component.
 */
export class CombatSystem {
    constructor(scene, projectilePool, enemySystem) {
        this.scene = scene;
        this.projectilePool = projectilePool;
        this.enemySystem = enemySystem;
        this.projectiles = [];
    }

    /**
     * @param {number[]} entities IDs of entities with ['Transform', 'Shooter']
     */
    update(entities, deltaTime, ecs) {
        for (const shooterId of entities) {
            const transform = ecs.getComponent(shooterId, 'Transform');
            const shooter = ecs.getComponent(shooterId, 'Shooter');
            const movement = ecs.getComponent(shooterId, 'Movement');

            if (!transform || !shooter) continue;

            shooter.lastFireTime += deltaTime;

            // 1. Find the closest target in range belonging to an enemy faction
            let closestDist = shooter.range;
            let bestTarget = null;

            // Find valid target entities (entities with Transform & Movement mapped in ECS)
            const targetableIds = ecs.queryEntities(['Transform', 'Movement']);
            for (const targetId of targetableIds) {
                if (targetId === shooterId) continue;

                const targetMovement = ecs.getComponent(targetId, 'Movement');
                if (!shooter.targetFactions.includes(targetMovement.faction)) continue;

                const targetTransform = ecs.getComponent(targetId, 'Transform');
                const dist = transform.mesh.position.distanceTo(targetTransform.mesh.position);

                if (dist < closestDist) {
                    closestDist = dist;
                    bestTarget = targetTransform.mesh.position.clone();
                }
            }

            // Bridge to legacy EnemySystem (Temporary until enemies are fully ported to ECS Factory)
            if (this.enemySystem && this.enemySystem.enemies) {
                for (const enemy of this.enemySystem.enemies) {
                    if (enemy.state === 'DYING') continue;
                    const dist = transform.mesh.position.distanceTo(enemy.position);
                    if (dist < closestDist) {
                        closestDist = dist;
                        bestTarget = enemy.position.clone();
                    }
                }
            }

            // 2. Fire projectile if target found and cooldown ready
            if (bestTarget && shooter.lastFireTime >= shooter.fireRate) {
                this.fireProjectile(transform.mesh.position, bestTarget, shooter.damage);
                shooter.lastFireTime = 0;
            }
        }

        // Update in-flight projectiles
        this.updateProjectiles(deltaTime);
    }

    fireProjectile(origin, target, damage = 5) {
        const direction = new THREE.Vector3().subVectors(target, origin).normalize();
        const projectile = this.projectilePool.get();
        projectile.reset(origin, direction);
        projectile.damage = damage;
        this.scene.add(projectile);
        this.projectiles.push(projectile);
    }

    updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(deltaTime);
            let hit = false;

            // Check collisions with legacy enemies
            if (this.enemySystem && this.enemySystem.enemies) {
                for (const enemy of this.enemySystem.enemies) {
                    if (enemy.state !== 'ALIVE') continue;

                    // Simple distance check (enemy capsule radius + projectile radius)
                    const dist = p.position.distanceTo(enemy.position);
                    if (dist < 1.0) {
                        enemy.takeDamage(p.damage || 5);
                        hit = true;
                        break;
                    }
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
