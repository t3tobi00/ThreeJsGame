import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/gameConfig.js';

export class CameraSystem {
    constructor(camera, target) {
        this.camera = camera;
        this.target = target;
    }

    update() {
        const targetPos = this.target.position.clone();

        const idealOffset = new THREE.Vector3(
            CAMERA_CONFIG.offset.x,
            CAMERA_CONFIG.offset.y,
            CAMERA_CONFIG.offset.z
        );

        const idealPos = targetPos.clone().add(idealOffset);

        // Smooth lerp follow
        this.camera.instance.position.lerp(idealPos, CAMERA_CONFIG.lerpFactor);

        // Look at target with slight offset adjustment if needed
        const lookAtPos = targetPos.clone().add(new THREE.Vector3(
            CAMERA_CONFIG.lookAtOffset.x,
            CAMERA_CONFIG.lookAtOffset.y,
            CAMERA_CONFIG.lookAtOffset.z
        ));

        this.camera.instance.lookAt(lookAtPos);
    }
}
