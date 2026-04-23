import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/gameConfig.js';
import EventBus from '../core/EventBus.js';

export class CameraSystem {
    constructor(camera, target) {
        this.camera = camera;
        this.target = target;

        // Two-finger pan offset — added to the follow target each frame.
        // Accumulated by pan(), cleared by recenter(). Persistent until
        // the user recenters so the view stays where they left it.
        this._panOffset = new THREE.Vector3(0, 0, 0);

        // Smoothed follow position — INTERNAL state, separate from
        // camera.position so the follow lerp never sees the pan offset.
        // Lazy-initialized on first update to the live camera position.
        this._followPos = null;

        // Screen shake — amplitude decays each frame. Triggered via 'camera:shake'.
        this._shakeAmount = 0;
        EventBus.on('camera:shake', ({ amount = 0.2 } = {}) => {
            // Take the larger of current vs incoming so back-to-back shakes
            // don't downgrade in strength
            this._shakeAmount = Math.max(this._shakeAmount, amount);
        });
    }

    /**
     * Pan the camera on the XZ plane by an accumulating world-space offset.
     * Kept for callers that want delta-based panning.
     */
    pan(dx, dz) {
        this._panOffset.x += dx;
        this._panOffset.z += dz;
    }

    /**
     * Set the absolute pan offset. Used by DragInputSystem's two-finger pan,
     * which computes the desired offset from a fixed snapshot-camera reference
     * each frame (no feedback loop, no shake).
     */
    setPan(x, z) {
        this._panOffset.x = x;
        this._panOffset.z = z;
    }

    /** Current pan offset in world units (XZ). */
    getPan() {
        return { x: this._panOffset.x, z: this._panOffset.z };
    }

    /** Reset the pan offset — snaps the follow target back to the player. */
    recenter() {
        this._panOffset.set(0, 0, 0);
    }

    update(deltaTime) {
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

        // Follow ideal: PLAYER ONLY, pan offset deliberately excluded. The
        // lerp runs on an INTERNAL position (_followPos) — never on
        // camera.position — so re-adding the pan each frame doesn't feed
        // back into the smoothing and amplify. Final camera position is the
        // smoothed follow plus the instant pan (see below).
        const followIdeal = this.target.position.clone().add(idealOffset);

        if (!this._followPos) {
            this._followPos = followIdeal.clone();
        }

        // Frame-rate independent lerp — FOLLOW STATE ONLY.
        const smoothing = 1 - Math.pow(1 - CAMERA_CONFIG.lerpFactor, deltaTime * 60);
        this._followPos.lerp(followIdeal, smoothing);

        // Final camera position = smoothed follow + instant pan.
        // Pan is applied outside the lerp → 1:1 response, zero amplification.
        this.camera.instance.position.copy(this._followPos).add(this._panOffset);

        // Look at the PANNED target so rotation stays in lockstep with the
        // instant pan translation above (no rotation-before-translation
        // phase mismatch).
        const lookAtPos = this.target.position.clone()
            .add(this._panOffset)
            .add(new THREE.Vector3(
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
