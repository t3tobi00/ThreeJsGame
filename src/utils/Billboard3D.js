import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/gameConfig.js';

/**
 * Billboard3D — orient 3D signage to face the game's isometric camera.
 *
 * The game uses a THREE.OrthographicCamera with a fixed orientation
 * (camera translates with the player via CameraSystem, but its view
 * direction never rotates). With orthographic projection, the view
 * direction is world-uniform — every point in the scene sees the
 * camera from the same angular direction. That means a single baked
 * rotation applied once is enough to make any flat sign readable
 * anywhere in the world. No per-frame billboard work required.
 *
 * Applied once after the mesh is constructed:
 *
 *   import { faceIsometricCamera } from '../utils/Billboard3D.js';
 *   faceIsometricCamera(signMesh);
 *
 * Assumes the mesh's "front face" is its default +Z normal (true for
 * PlaneGeometry and any group that wraps one). Mesh rotation order is
 * set to 'YXZ' so yaw-then-pitch decomposes cleanly.
 */

/**
 * Rotate `mesh` so its +Z normal points toward the orthographic camera
 * derived from `CAMERA_CONFIG.offset`.
 *
 * @param {THREE.Object3D} mesh
 * @param {Object}  [opts]
 * @param {number}  [opts.pitchBoost=0]  Extra pitch rotation (radians).
 *                                       Positive values over-tilt the top
 *                                       toward the camera for readability.
 * @param {{x:number,y:number,z:number}} [opts.cameraOffset]
 *                                       Override the global camera offset
 *                                       (useful for per-scene variants).
 */
export function faceIsometricCamera(mesh, opts = {}) {
    const o = opts.cameraOffset || CAMERA_CONFIG.offset;
    const len = Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z);
    if (len < 1e-6) return;

    // Yaw: rotate around world Y so the face turns into the camera's
    // horizontal quadrant.
    const yaw   = Math.atan2(o.x, o.z);
    // Pitch: tilt the top of the plane backward so the normal aims up
    // along the camera's pitch. Negative because rotating around +X by a
    // positive angle tilts the plane's top TOWARD the viewer (+Z), and
    // we want it the other way for a sign hanging at an orthographic
    // overhead angle.
    const pitch = -Math.asin(o.y / len) + (opts.pitchBoost || 0);

    mesh.rotation.order = 'YXZ';
    mesh.rotation.set(pitch, yaw, 0);
}

/**
 * Yaw-only camera facing — rotates `mesh` around its local Y axis so
 * its local +Z points into the camera's horizontal quadrant. Leaves
 * pitch and roll untouched (i.e., the mesh stays upright on the ground).
 * Use this for ground-mounted objects like stalls, shops, signs-with-
 * physical-bases so they look like they're actively turned toward the
 * player/camera without tilting.
 */
export function yawToCamera(mesh, opts = {}) {
    const o = opts.cameraOffset || CAMERA_CONFIG.offset;
    mesh.rotation.y = Math.atan2(o.x, o.z);
}

/**
 * Pitch-only camera facing — tilts `mesh` forward/back around its local
 * X axis to match the camera's pitch angle. Use this on a CHILD mesh
 * whose parent has already been yawed via `yawToCamera`; the child
 * inherits yaw from the parent and only adds the tilt, so a sign's
 * +Z normal ends up pointing directly at the orthographic camera.
 */
export function pitchToCamera(mesh, opts = {}) {
    const o = opts.cameraOffset || CAMERA_CONFIG.offset;
    const len = Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z);
    if (len < 1e-6) return;
    mesh.rotation.order = 'YXZ';
    mesh.rotation.x = -Math.asin(o.y / len) + (opts.pitchBoost || 0);
}

/**
 * Alternative: per-frame camera tracking for cases where the camera
 * angle is NOT fixed (e.g., if someone later introduces a perspective
 * camera or a rotating rig). Call Billboard3D.update(camera) each frame.
 */
export function faceCamera(mesh, camera) {
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
