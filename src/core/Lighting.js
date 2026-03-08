import * as THREE from 'three';
import { COLORS } from '../config/gameConfig.js';

export class Lighting {
    constructor(scene) {
        this.scene = scene;

        // Ambient Light
        this.ambientLight = new THREE.AmbientLight(COLORS.ambient, 0.7);
        this.scene.add(this.ambientLight);

        // Directional Light (Sun)
        this.sunLight = new THREE.DirectionalLight(COLORS.sun, 1.2);
        this.sunLight.position.set(20, 30, 20);
        this.sunLight.castShadow = true;

        // Shadow config
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.left = -50;
        this.sunLight.shadow.camera.right = 50;
        this.sunLight.shadow.camera.top = 50;
        this.sunLight.shadow.camera.bottom = -50;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 100;
        this.sunLight.shadow.bias = -0.0001;

        this.scene.add(this.sunLight);
    }
}
