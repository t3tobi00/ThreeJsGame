import * as THREE from 'three';
import { COLORS_P3, WALL_CONFIG } from '../config/gameConfig.js';

export class Wall {
    constructor(scene, position) {
        this.scene = scene;
        this.position = position.clone();
        this.hp = WALL_CONFIG.hp;
        this.maxHP = WALL_CONFIG.hp;

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.scene.add(this.group);

        this.initVisuals();
        this.animateIn();
    }

    initVisuals() {
        const geo = new THREE.BoxGeometry(
            WALL_CONFIG.size.x,
            WALL_CONFIG.size.y,
            WALL_CONFIG.size.z
        );
        const mat = new THREE.MeshStandardMaterial({
            color: COLORS_P3.wall,
            roughness: 0.8,
            metalness: 0.2
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.y = WALL_CONFIG.size.y / 2;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.group.add(this.mesh);

        // Simple Top Cap for detail
        const capGeo = new THREE.BoxGeometry(
            WALL_CONFIG.size.x + 0.2,
            0.2,
            WALL_CONFIG.size.z + 0.2
        );
        const capMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = WALL_CONFIG.size.y;
        this.group.add(cap);
    }

    animateIn() {
        this.group.scale.set(0, 0, 0);
        let t = 0;
        const duration = 0.7;

        const animate = () => {
            t += 0.016;
            const progress = Math.min(t / duration, 1);

            // Back-out easing
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

    takeDamage(amount) {
        this.hp -= amount;

        // Red flash
        this.mesh.material.emissive.setHex(0xff0000);
        setTimeout(() => {
            if (this.mesh) this.mesh.material.emissive.setHex(0x000000);
        }, 100);

        if (this.hp <= 0) {
            this.destroy();
        }
    }

    destroy() {
        this.scene.remove(this.group);
        // Add particle effect logic if needed
    }
}
