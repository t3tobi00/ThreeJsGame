import * as THREE from 'three';

export class Resource extends THREE.Mesh {
    /**
     * @param {string} type - 'meat', 'coin', etc.
     * @param {number} color - Hex color code (e.g., 0xff3333)
     */
    constructor(type, color) {
        // Uniform chunk size for both Player, Table, and Villagers
        const geo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16);
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.6,
            metalness: type === 'coin' ? 0.6 : 0.1 // Coins look shinier
        });
        super(geo, mat);

        this.type = type;
        this.velocity = new THREE.Vector3();

        // Harvest system properties
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
