import * as THREE from 'three';
import { COMBAT_CONFIG, COLORS_P2 } from '../config/gameConfig.js';

export class AggroRing extends THREE.Mesh {
    constructor() {
        const geo = new THREE.RingGeometry(COMBAT_CONFIG.aggroRange - 0.02, COMBAT_CONFIG.aggroRange + 0.02, 64);
        const mat = new THREE.MeshBasicMaterial({
            color: COLORS_P2.aggroRing,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });
        super(geo, mat);

        this.rotation.x = -Math.PI / 2;
        this.position.y = 0.02; // Just above ground
    }
}
