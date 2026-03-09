import * as THREE from 'three';
import { COLORS } from '../config/gameConfig.js';

export class Lighting {
    constructor(scene) {
        this.scene = scene;

        // Hemisphere Light for natural ambient fill
        this.hemiLight = new THREE.HemisphereLight(0xffffff, COLORS.dangerZone, 0.7);
        this.scene.add(this.hemiLight);

        // Directional Light (Sun)
        this.sunLight = new THREE.DirectionalLight(COLORS.sun, 1.4);
        this.sunLight.position.set(10, 20, -5); // Angled sun to cast shadows diagonally, similar to Kingshot
        this.sunLight.castShadow = true;

        // Shadow config - soften and tighten bounds for high res
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        const d = 25; // Shrunken shadow camera for higher res shadows within play area
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 100;
        this.sunLight.shadow.bias = -0.001;
        this.sunLight.shadow.normalBias = 0; // Reset normal bias because it was clipping shadows on mobile

        this.scene.add(this.sunLight);
    }
}
