import * as THREE from 'three';
import { COLORS_P2 } from '../config/gameConfig.js';

export class ResourceDisk extends THREE.Mesh {
    constructor() {
        // Uniform chunk size for both Player, Table, and Villagers
        const geo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16);
        const mat = new THREE.MeshStandardMaterial({
            color: COLORS_P2.meatDisk,
            roughness: 0.6,
            metalness: 0.1
        });
        super(geo, mat);

        this.velocity = new THREE.Vector3();
        this.isBeingHarvested = false;
        this.harvestStartTime = 0;
        this.curve = null;
        this.castShadow = true;
    }

    reset(pos) {
        this.position.copy(pos);
        this.rotation.set(0, Math.random() * Math.PI, 0);
        this.visible = true;
        this.isBeingHarvested = false;
        this.harvestStartTime = 0;
        this.curve = null;
        this.scale.set(1, 1, 1);
    }
}
