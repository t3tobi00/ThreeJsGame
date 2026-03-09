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
        const aspect = this.camera.instance.aspect;
        let yOffsetMult = 1;
        let fovBonus = 0;

        if (aspect < 1) { // Portrait mode
            yOffsetMult = 1.3;
            fovBonus = 10;
        }

        // Apply FOV adjustment
        if (this.camera.instance.fov !== CAMERA_CONFIG.fov + fovBonus) {
            this.camera.instance.fov = CAMERA_CONFIG.fov + fovBonus;
            this.camera.instance.updateProjectionMatrix();
        }

        const idealOffset = new THREE.Vector3(
            CAMERA_CONFIG.offset.x,
            CAMERA_CONFIG.offset.y * yOffsetMult,
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
