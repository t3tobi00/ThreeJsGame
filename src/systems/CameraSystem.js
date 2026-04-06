import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/gameConfig.js';
import EventBus from '../core/EventBus.js';

export class CameraSystem {
    constructor(camera, target) {
        this.camera = camera;
        this.target = target;

        // Screen shake — amplitude decays each frame. Triggered via 'camera:shake'.
        this._shakeAmount = 0;
        EventBus.on('camera:shake', ({ amount = 0.2 } = {}) => {
            // Take the larger of current vs incoming so back-to-back shakes
            // don't downgrade in strength
            this._shakeAmount = Math.max(this._shakeAmount, amount);
        });
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

        // Apply screen shake AFTER lookAt so the offset isn't normalized away.
        if (this._shakeAmount > 0.001) {
            const sx = (Math.random() - 0.5) * this._shakeAmount * 2;
            const sz = (Math.random() - 0.5) * this._shakeAmount * 2;
            this.camera.instance.position.x += sx;
            this.camera.instance.position.z += sz;
            // Fast exponential decay — most of the shake is over in ~150ms
            this._shakeAmount *= Math.pow(0.001, deltaTime);
        } else {
            this._shakeAmount = 0;
        }
    }
}
