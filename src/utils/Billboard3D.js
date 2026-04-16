/**
 * Billboard3D — re-exports camera-facing utilities from FaceCamera.js.
 *
 * All camera-facing logic now lives in FaceCamera.js as the single source.
 * This file exists for backward compatibility — existing imports from
 * Billboard3D.js continue to work without changes.
 *
 * For new code, import directly from FaceCamera.js:
 *   import { yawToCamera, faceToCamera } from '../utils/FaceCamera.js';
 */

export { yawToCamera, faceToCamera, faceCameraLive } from './FaceCamera.js';

// Legacy alias
export { faceToCamera as faceIsometricCamera } from './FaceCamera.js';
