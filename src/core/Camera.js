import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/gameConfig.js';

export class Camera {
    constructor() {
        const aspect = window.innerWidth / window.innerHeight;
        const s = CAMERA_CONFIG.frustumSize;

        this.threeCamera = new THREE.OrthographicCamera(
            s * aspect / -2,
            s * aspect / 2,
            s / 2,
            s / -2,
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
        const aspect = window.innerWidth / window.innerHeight;
        const s = CAMERA_CONFIG.frustumSize;

        this.threeCamera.left = s * aspect / -2;
        this.threeCamera.right = s * aspect / 2;
        this.threeCamera.top = s / 2;
        this.threeCamera.bottom = s / -2;

        this.threeCamera.updateProjectionMatrix();
    }

    get instance() {
        return this.threeCamera;
    }
}
