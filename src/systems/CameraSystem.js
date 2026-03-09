import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/gameConfig.js';

export class CameraSystem {
    constructor(camera, target) {
        this.camera = camera;
        this.target = target;
    }

    update(deltaTime) {
        const targetPos = this.target.position.clone();

        // Portrait mode compensation
        const aspect = window.innerWidth / window.innerHeight;
        let frustumMult = 1;

        if (aspect < 1) { // Portrait mode
            frustumMult = 1.3;
        }

        // Apply Orthographic adjustment
        const s = CAMERA_CONFIG.frustumSize * frustumMult;
        if (this.camera.instance.top !== s / 2) {
            this.camera.instance.left = s * aspect / -2;
            this.camera.instance.right = s * aspect / 2;
            this.camera.instance.top = s / 2;
            this.camera.instance.bottom = s / -2;
            this.camera.instance.updateProjectionMatrix();
        }

        const idealOffset = new THREE.Vector3(
            CAMERA_CONFIG.offset.x,
            CAMERA_CONFIG.offset.y,
            CAMERA_CONFIG.offset.z
        );

        const idealPos = targetPos.clone().add(idealOffset);

        // Frame-rate independent lerp
        const smoothing = 1 - Math.pow(1 - CAMERA_CONFIG.lerpFactor, deltaTime * 60);
        this.camera.instance.position.lerp(idealPos, smoothing);

        // Look at target with slight offset adjustment
        const lookAtPos = targetPos.clone().add(new THREE.Vector3(
            CAMERA_CONFIG.lookAtOffset.x,
            CAMERA_CONFIG.lookAtOffset.y,
            CAMERA_CONFIG.lookAtOffset.z
        ));

        this.camera.instance.lookAt(lookAtPos);
    }
}
