import * as THREE from 'three';

/**
 * InstancedCharacterPool — GPU-instanced rendering for many identical characters.
 *
 * Creates 4 InstancedMesh objects (body, head, leftEye, rightEye) that share
 * cached geometry. Each "slot" has a lightweight proxy Object3D whose position,
 * rotation, and scale are read by ECS systems as if it were a real mesh.
 *
 * Call sync() once per frame before render — it copies all proxy transforms
 * into the InstancedMesh matrix buffers in one batch.
 *
 * Usage:
 *   const pool = new InstancedCharacterPool(scene, 0xff3333, 120);
 *   const { index, proxy } = pool.allocate(startPos);
 *   // systems write proxy.position, proxy.rotation.y, proxy.scale
 *   pool.sync();           // before render
 *   pool.release(index);   // on death/despawn
 */

// Shared geometry — created once, reused by ALL pools
let _bodyGeo, _headGeo, _eyeGeo;
function _ensureGeometry() {
    if (_bodyGeo) return;
    _bodyGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
    _headGeo = new THREE.SphereGeometry(0.2, 8, 6);
    _eyeGeo  = new THREE.SphereGeometry(0.05, 4, 4);
}

// Shared materials for non-colored parts
const _headMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.6 });
const _eyeMat  = new THREE.MeshStandardMaterial({ color: 0x000000 });

// Reusable math objects (avoid per-frame allocation)
const _mat4  = new THREE.Matrix4();
const _quat  = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos   = new THREE.Vector3();
const _scl   = new THREE.Vector3();
const _zero  = new THREE.Matrix4().compose(
    new THREE.Vector3(0, -1000, 0), // off-screen
    new THREE.Quaternion(),
    new THREE.Vector3(0, 0, 0)      // zero scale = invisible
);

// Character child offsets (from MeshPresets 'character' preset)
const BODY_Y  = 0.5;
const HEAD_Y  = 1.1;
const EYE_L   = new THREE.Vector3(-0.08, 1.12, 0.18);
const EYE_R   = new THREE.Vector3( 0.08, 1.12, 0.18);

export class InstancedCharacterPool {
    /**
     * @param {THREE.Scene} scene
     * @param {number} bodyColor Hex color for the body material
     * @param {number} maxCount Maximum simultaneous instances
     */
    constructor(scene, bodyColor, maxCount = 150) {
        _ensureGeometry();

        this._maxCount = maxCount;
        this._scene = scene;

        // Per-pool body material (unique color per character type)
        const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 });

        // Create the 4 InstancedMesh objects
        this._bodyMesh    = new THREE.InstancedMesh(_bodyGeo, bodyMat, maxCount);
        this._headMesh    = new THREE.InstancedMesh(_headGeo, _headMat, maxCount);
        this._eyeLMesh    = new THREE.InstancedMesh(_eyeGeo, _eyeMat, maxCount);
        this._eyeRMesh    = new THREE.InstancedMesh(_eyeGeo, _eyeMat, maxCount);

        // Only body casts shadows (head/eyes too small to matter)
        this._bodyMesh.castShadow = true;
        this._headMesh.castShadow = false;
        this._eyeLMesh.castShadow = false;
        this._eyeRMesh.castShadow = false;

        // Frustum culling off — we manage visibility ourselves
        this._bodyMesh.frustumCulled = false;
        this._headMesh.frustumCulled = false;
        this._eyeLMesh.frustumCulled = false;
        this._eyeRMesh.frustumCulled = false;

        // Initialize all slots as hidden (off-screen, zero scale)
        for (let i = 0; i < maxCount; i++) {
            this._bodyMesh.setMatrixAt(i, _zero);
            this._headMesh.setMatrixAt(i, _zero);
            this._eyeLMesh.setMatrixAt(i, _zero);
            this._eyeRMesh.setMatrixAt(i, _zero);
        }

        // Add all 4 to scene
        scene.add(this._bodyMesh);
        scene.add(this._headMesh);
        scene.add(this._eyeLMesh);
        scene.add(this._eyeRMesh);

        // Slot management
        this._proxies  = new Array(maxCount).fill(null); // index → proxy Object3D
        this._active   = new Set();                       // active slot indices
        this._freeList = [];
        for (let i = maxCount - 1; i >= 0; i--) this._freeList.push(i);
    }

    /**
     * Allocate a slot for a new character instance.
     * @param {THREE.Vector3} pos Initial world position
     * @returns {{ index: number, proxy: THREE.Object3D }} or null if pool full
     */
    allocate(pos) {
        if (this._freeList.length === 0) return null;

        const index = this._freeList.pop();
        const proxy = new THREE.Object3D();
        proxy.position.copy(pos);

        this._proxies[index] = proxy;
        this._active.add(index);

        return { index, proxy };
    }

    /**
     * Release a slot (entity died or despawned).
     * Hides the instance immediately.
     */
    release(index) {
        if (!this._active.has(index)) return;

        // Hide this instance
        this._bodyMesh.setMatrixAt(index, _zero);
        this._headMesh.setMatrixAt(index, _zero);
        this._eyeLMesh.setMatrixAt(index, _zero);
        this._eyeRMesh.setMatrixAt(index, _zero);

        this._proxies[index] = null;
        this._active.delete(index);
        this._freeList.push(index);

        // Mark matrices dirty so the hidden instance updates this frame
        this._bodyMesh.instanceMatrix.needsUpdate = true;
        this._headMesh.instanceMatrix.needsUpdate = true;
        this._eyeLMesh.instanceMatrix.needsUpdate = true;
        this._eyeRMesh.instanceMatrix.needsUpdate = true;
    }

    /**
     * Sync all active proxy transforms into InstancedMesh matrices.
     * Call once per frame, before renderer.render().
     */
    sync() {
        if (this._active.size === 0) return;

        for (const index of this._active) {
            const proxy = this._proxies[index];
            if (!proxy) continue;

            const px = proxy.position.x;
            const py = proxy.position.y;
            const pz = proxy.position.z;
            const rotY = proxy.rotation.y;
            const sx = proxy.scale.x;
            const sy = proxy.scale.y;
            const sz = proxy.scale.z;

            _euler.set(0, rotY, 0);
            _quat.setFromEuler(_euler);

            // Body — centered at BODY_Y above ground, inherits scale (squash-stretch)
            _pos.set(px, py + BODY_Y, pz);
            _scl.set(sx, sy, sz);
            _mat4.compose(_pos, _quat, _scl);
            this._bodyMesh.setMatrixAt(index, _mat4);

            // Head — fixed offset, no squash-stretch (scale 1,1,1)
            _pos.set(px, py + HEAD_Y * sy, pz); // head moves with body squash
            _scl.set(1, 1, 1);
            _mat4.compose(_pos, _quat, _scl);
            this._headMesh.setMatrixAt(index, _mat4);

            // Eyes — rotate local offset by body rotation
            _scl.set(1, 1, 1);

            // Left eye
            const cosR = Math.cos(rotY);
            const sinR = Math.sin(rotY);
            _pos.set(
                px + EYE_L.x * cosR + EYE_L.z * sinR,
                py + EYE_L.y * sy,
                pz - EYE_L.x * sinR + EYE_L.z * cosR
            );
            _mat4.compose(_pos, _quat, _scl);
            this._eyeLMesh.setMatrixAt(index, _mat4);

            // Right eye
            _pos.set(
                px + EYE_R.x * cosR + EYE_R.z * sinR,
                py + EYE_R.y * sy,
                pz - EYE_R.x * sinR + EYE_R.z * cosR
            );
            _mat4.compose(_pos, _quat, _scl);
            this._eyeRMesh.setMatrixAt(index, _mat4);
        }

        this._bodyMesh.instanceMatrix.needsUpdate = true;
        this._headMesh.instanceMatrix.needsUpdate = true;
        this._eyeLMesh.instanceMatrix.needsUpdate = true;
        this._eyeRMesh.instanceMatrix.needsUpdate = true;
    }

    /** Number of currently active instances. */
    get activeCount() { return this._active.size; }

    /** Whether the pool has free slots. */
    get hasFreeSlots() { return this._freeList.length > 0; }
}
