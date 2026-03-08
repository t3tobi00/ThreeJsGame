import * as THREE from 'three';
import { ENEMY_CONFIG } from '../config/gameConfig.js';

export class Enemy extends THREE.Group {
    constructor() {
        super();
        this.createBody();
        this.createEyes();

        this.hp = ENEMY_CONFIG.health;
        this.state = 'ALIVE'; // ALIVE, DYING, DEAD
    }

    createBody() {
        const bodyGeo = new THREE.CylinderGeometry(
            ENEMY_CONFIG.size * 0.5,
            ENEMY_CONFIG.size * 0.5,
            ENEMY_CONFIG.size * 1.2,
            16
        );
        const bodyMat = new THREE.MeshStandardMaterial({
            color: ENEMY_CONFIG.bodyColor,
            roughness: 0.4,
            metalness: 0.2
        });

        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = ENEMY_CONFIG.size * 0.6;
        this.body.castShadow = true;
        this.add(this.body);
    }

    createEyes() {
        // glowing red eyes
        const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const eyeMat = new THREE.MeshStandardMaterial({
            color: ENEMY_CONFIG.eyeColor,
            emissive: ENEMY_CONFIG.eyeColor,
            emissiveIntensity: 2
        });

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.2, ENEMY_CONFIG.size * 0.8, 0.35);
        this.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.2, ENEMY_CONFIG.size * 0.8, 0.35);
        this.add(rightEye);
    }

    reset() {
        this.hp = ENEMY_CONFIG.health;
        this.state = 'ALIVE';
        this.scale.set(1, 1, 1);
        this.visible = true;
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0 && this.state === 'ALIVE') {
            this.state = 'DYING';
        }
    }
}
