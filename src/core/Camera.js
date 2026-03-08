import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/gameConfig.js';

export class Camera {
    constructor() {
        const aspect = window.innerWidth / window.innerHeight;
        this.threeCamera = new THREE.PerspectiveCamera(
            CAMERA_CONFIG.fov,
            aspect,
            CAMERA_CONFIG.near,
            CAMERA_CONFIG.far
        );

        // Initial position
        this.threeCamera.position.set(
            CAMERA_CONFIG.offset.x,
            CAMERA_CONFIG.offset.y,
            CAMERA_CONFIG.offset.z
        );

        this.threeCamera.lookAt(0, 0, 0);

        window.addEventListener('resize', this.onResize.bind(this));
    }

    onResize() {
        this.threeCamera.aspect = window.innerWidth / window.innerHeight;
        this.threeCamera.updateProjectionMatrix();
    }

    get instance() {
        return this.threeCamera;
    }
}
