import * as THREE from 'three';

/**
 * FaceCamera — pure camera-facing math utilities.
 *
 * Every function takes an explicit offset/direction vector instead of
 * reading from any config singleton, making them reusable anywhere
 * (market stalls, machines, signs, any future object).
 *
 * Includes yawToCamera() — a one-liner that auto-reads CAMERA_CONFIG.
 * For any new object: import { yawToCamera } from '../utils/FaceCamera.js';
 *                      yawToCamera(mesh);
 */

import { CAMERA_CONFIG } from '../config/gameConfig.js';

/**
 * Yaw-only facing — rotates `mesh` around its local Y axis so its
 * local +Z points toward the horizontal quadrant defined by `offset`.
 * Leaves pitch and roll untouched (mesh stays upright on the ground).
 *
 * @param {THREE.Object3D} mesh
 * @param {{x:number, y:number, z:number}} offset  Camera offset vector.
 */
export function yawTo(mesh, offset) {
    mesh.rotation.y = Math.atan2(offset.x, offset.z);
}

/**
 * Full yaw + pitch facing — rotates `mesh` so its +Z normal points
 * toward the camera direction defined by `offset`.
 *
 * @param {THREE.Object3D} mesh
 * @param {{x:number, y:number, z:number}} offset  Camera offset vector.
 * @param {number} [pitchBoost=0]  Extra pitch (radians). Positive values
 *                                  over-tilt the top toward the camera.
 */
export function faceTo(mesh, offset, pitchBoost = 0) {
    const len = Math.sqrt(offset.x * offset.x + offset.y * offset.y + offset.z * offset.z);
    if (len < 1e-6) return;

    const yaw   = Math.atan2(offset.x, offset.z);
    const pitch = -Math.asin(offset.y / len) + pitchBoost;

    mesh.rotation.order = 'YXZ';
    mesh.rotation.set(pitch, yaw, 0);
}

/**
 * Pitch-only facing — tilts `mesh` forward/back around its local X axis
 * to match the pitch angle implied by `offset`. Use on a child whose
 * parent is already yawed (child inherits yaw, only adds tilt).
 *
 * @param {THREE.Object3D} mesh
 * @param {{x:number, y:number, z:number}} offset  Camera offset vector.
 * @param {number} [pitchBoost=0]  Extra pitch (radians).
 */
export function pitchTo(mesh, offset, pitchBoost = 0) {
    const len = Math.sqrt(offset.x * offset.x + offset.y * offset.y + offset.z * offset.z);
    if (len < 1e-6) return;
    mesh.rotation.order = 'YXZ';
    mesh.rotation.x = -Math.asin(offset.y / len) + pitchBoost;
}

/**
 * Per-frame camera tracking — rotates `mesh` so its +Z normal points
 * at the live camera position. Use when the camera moves or rotates
 * (perspective camera, rotating rig, etc.).
 *
 * @param {THREE.Object3D} mesh
 * @param {THREE.Camera}   camera
 */
/**
 * Yaw-only camera facing — one-liner convenience.
 * Auto-reads CAMERA_CONFIG.offset so callers don't need to import config.
 * Use for any ground object that should face the isometric camera.
 *
 * @param {THREE.Object3D} mesh
 */
export function yawToCamera(mesh) {
    yawTo(mesh, CAMERA_CONFIG.offset);
}

/**
 * Full yaw + pitch camera facing — one-liner convenience.
 * Auto-reads CAMERA_CONFIG.offset. Use for signs, billboards, flat panels.
 *
 * @param {THREE.Object3D} mesh
 * @param {number} [pitchBoost=0]
 */
export function faceToCamera(mesh, pitchBoost = 0) {
    faceTo(mesh, CAMERA_CONFIG.offset, pitchBoost);
}

export function faceCameraLive(mesh, camera) {
    const dir = new THREE.Vector3();
    camera.getWorldPosition(dir).sub(mesh.getWorldPosition(new THREE.Vector3()));
    const len = dir.length();
    if (len < 1e-6) return;
    dir.multiplyScalar(1 / len);

    const yaw   = Math.atan2(dir.x, dir.z);
    const pitch = -Math.asin(dir.y);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.set(pitch, yaw, 0);
}
