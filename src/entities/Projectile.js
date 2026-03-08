import * as THREE from 'three';
import { COMBAT_CONFIG } from '../config/gameConfig.js';

export class Projectile extends THREE.Mesh {
    constructor() {
        const geo = new THREE.SphereGeometry(COMBAT_CONFIG.projectileSize, 8, 8);
        const mat = new THREE.MeshStandardMaterial({
            color: COMBAT_CONFIG.projectileColor,
            emissive: COMBAT_CONFIG.projectileColor,
            emissiveIntensity: 1
        });
        super(geo, mat);

        this.velocity = new THREE.Vector3();
    }

    reset(startPos, targetDirection) {
        this.position.copy(startPos);
        this.velocity.copy(targetDirection).normalize().multiplyScalar(COMBAT_CONFIG.projectileSpeed);
        this.visible = true;
    }
}
