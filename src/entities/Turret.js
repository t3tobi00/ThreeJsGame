import * as THREE from 'three';
import { COLORS_P3, TURRET_CONFIG } from '../config/gameConfig.js';

export class Turret {
    constructor(scene, position) {
        this.scene = scene;
        this.position = position.clone();
        this.hp = TURRET_CONFIG.hp;
        this.fireTimer = 0;
        this.target = null;

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.scene.add(this.group);

        this.initVisuals();
        this.animateIn();
    }

    initVisuals() {
        // Base
        const baseGeo = new THREE.BoxGeometry(1.5, 0.4, 1.5);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.7
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.2;
        base.castShadow = true;
        base.receiveShadow = true;
        this.group.add(base);

        // Tower Body
        const towerGeo = new THREE.CylinderGeometry(0.5, 0.7, 1.2, 8);
        const towerMat = new THREE.MeshStandardMaterial({
            color: COLORS_P3.turret,
            roughness: 0.5
        });
        this.head = new THREE.Mesh(towerGeo, towerMat);
        this.head.position.y = 1.0;
        this.head.castShadow = true;
        this.group.add(this.head);

        // Cannon
        const cannonGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
        const cannonMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        this.cannon = new THREE.Mesh(cannonGeo, cannonMat);
        this.cannon.rotation.x = Math.PI / 2;
        this.cannon.position.z = 0.5;
        this.cannon.position.y = 0.2;
        this.head.add(this.cannon);
    }

    animateIn() {
        this.group.scale.set(0, 0, 0);
        let t = 0;
        const duration = 0.8;

        const animate = () => {
            t += 0.016;
            const progress = Math.min(t / duration, 1);

            // Back-out easing for bounce
            const c1 = 1.70158;
            const c3 = c1 + 1;
            const x = progress;
            const bounce = 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);

            this.group.scale.set(bounce, bounce, bounce);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.group.scale.set(1, 1, 1);
            }
        };
        animate();
    }

    update(deltaTime, enemies) {
        this.fireTimer += deltaTime;

        // Simple Target Selection (closest)
        let closestDist = TURRET_CONFIG.aggroRange;
        this.target = null;

        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const dist = this.group.position.distanceTo(enemy.position);
            if (dist < closestDist) {
                closestDist = dist;
                this.target = enemy;
            }
        }

        if (this.target) {
            // Face target
            const lookPos = this.target.position.clone();
            lookPos.y = this.head.position.y + this.group.position.y;
            this.head.lookAt(lookPos);

            // Fire
            if (this.fireTimer >= TURRET_CONFIG.fireRate) {
                this.fireTimer = 0;
                this.fire();
            }
        }
    }

    fire() {
        if (this.onFire) {
            // Calculate spawn position at cannon tip
            const tip = new THREE.Vector3(0, 0.2, 0.9);
            this.head.localToWorld(tip);

            const direction = new THREE.Vector3();
            direction.subVectors(this.target.position, tip).normalize();

            this.onFire(tip, direction);

            // Juice: Recoil
            this.animateRecoil();
        }
    }

    animateRecoil() {
        const originalZ = this.cannon.position.z;
        this.cannon.position.z -= 0.3;

        const animate = () => {
            if (this.cannon.position.z < originalZ) {
                this.cannon.position.z += 0.05;
                requestAnimationFrame(animate);
            } else {
                this.cannon.position.z = originalZ;
            }
        };
        animate();
    }
}
