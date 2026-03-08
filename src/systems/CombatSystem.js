import * as THREE from 'three';
import { COMBAT_CONFIG } from '../config/gameConfig.js';
import { Projectile } from '../entities/Projectile.js';
import { AggroRing } from '../entities/AggroRing.js';
import { ObjectPool } from '../utils/ObjectPool.js';

export class CombatSystem {
    constructor(scene, player, enemySystem) {
        this.scene = scene;
        this.player = player;
        this.enemySystem = enemySystem;
        this.projectiles = [];
        this.fireTimer = 0;

        this.pool = new ObjectPool(() => new Projectile(), 20, 'ProjectilePool');

        // Visual Aggro Range
        this.aggroRing = new AggroRing();
        this.player.group.add(this.aggroRing); // Attach to player
    }

    update(deltaTime) {
        this.fireTimer += deltaTime;

        // Auto-combat: Find nearest enemy in range
        const nearest = this.getNearestEnemy(COMBAT_CONFIG.aggroRange);
        if (nearest && this.fireTimer >= COMBAT_CONFIG.fireRate) {
            this.fireTimer = 0;
            this.fireProjectile(nearest);
        }

        // Update Projectiles: Movement and Collision
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];

            p.position.addScaledVector(p.velocity, deltaTime);

            // Out of range check
            if (p.position.distanceTo(this.player.position) > COMBAT_CONFIG.aggroRange * 1.5) {
                this.removeProjectile(p, i);
                continue;
            }

            // Hit detection
            const hitEnemy = this.checkCollision(p);
            if (hitEnemy) {
                hitEnemy.takeDamage(1);
                this.removeProjectile(p, i);
            }
        }
    }

    getNearestEnemy(range) {
        let nearest = null;
        let minDist = range;

        for (const enemy of this.enemySystem.enemies) {
            const dist = enemy.position.distanceTo(this.player.position);
            if (dist < minDist) {
                minDist = dist;
                nearest = enemy;
            }
        }
        return nearest;
    }

    fireProjectile(target) {
        const startPos = this.player.position.clone().add(new THREE.Vector3(0, 1, 0));
        const direction = target.position.clone().add(new THREE.Vector3(0, 0.5, 0)).sub(startPos);

        const p = this.pool.get();
        p.reset(startPos, direction);
        this.scene.add(p);
        this.projectiles.push(p);
    }

    checkCollision(p) {
        for (const enemy of this.enemySystem.enemies) {
            if (enemy.position.distanceTo(p.position) < 0.8) {
                return enemy;
            }
        }
        return null;
    }

    removeProjectile(p, index) {
        this.pool.release(p);
        this.scene.remove(p);
        this.projectiles.splice(index, 1);
    }
}
