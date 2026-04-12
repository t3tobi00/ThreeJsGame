/**
 * Component_Animator — Plays a single keyframe animation clip on a hero-tier
 * character mesh (one with named bone pivots: torso, body, head, leftArm,
 * rightArm, leftElbow, rightElbow, leftLeg, rightLeg, leftKnee, rightKnee).
 *
 * Drives bone rotation, scale, AND position from JSON keyframes — that's
 * what enables the cartoony "stretchy limb" feel: a keyframe can scale a
 * bone to 1.6× length and shoot it forward 0.2m, then snap back next frame.
 *
 * Clips live in src/config/animations.json. The format:
 *   {
 *     "clip-name": {
 *       "loop": true | false,
 *       "hold": true | false,
 *       "duration": 0.5,
 *       "keyframes": [
 *         { "t": 0.0, "pose": { "rightArm": { "rot": {"z": -1.4}, "scale": {"y": 1.2} } } },
 *         { "t": 0.5, "pose": { "rightArm": { "rot": {"z":  1.2}, "scale": {"y": 1.6}, "pos": {"z": 0.2} } } },
 *         { "t": 1.0, "pose": {} }
 *       ]
 *     }
 *   }
 *
 * Flags:
 *   loop: true  → time wraps to 0 forever (idle, walk, run)
 *   hold: true  → time clamps at duration; bones stay at last keyframe (sit, sleep)
 *   neither     → plays once, ends, AnimationSystem clears the clip (sword swing, jump)
 *
 * Bone properties (all optional, all relative to the bone's REST pose):
 *   rot   { x, y, z }  — euler rotation (radians); replaces rest rotation
 *   scale { x, y, z }  — scale multiplier; replaces rest scale (defaults 1)
 *   pos   { x, y, z }  — offset added to rest position
 *
 * If a bone is missing from a keyframe, its value at that time is interpolated
 * from the keyframes that DO mention it. If a bone is missing from the entire
 * clip, AnimationSystem doesn't touch it (so it stays where the walk anim or
 * other systems put it).
 */
export class Component_Animator {
    constructor() {
        // Active clip state — set by AnimationSystem.play()
        this.activeClip = null;   // resolved clip object from animations.json
        this.activeName = null;   // string name (used for HUD / debug)
        this.time       = 0;      // seconds elapsed within the clip
        this.finished   = false;  // true after a non-loop non-hold clip ends

        // Lazy-cached bone refs (populated on first frame by AnimationSystem)
        this._refs    = null;
        // Per-bone rest pose snapshot — pos/rot/scale at the time the bone
        // was first encountered. All keyframe values are applied relative
        // to these (rot replaces, pos is offset, scale replaces).
        this._restPose = null;
    }
}
