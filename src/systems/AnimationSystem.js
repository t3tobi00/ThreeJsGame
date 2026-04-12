import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import SkillRegistry from '../core/SkillRegistry.js';

/**
 * AnimationSystem — Plays keyframe-based animation clips on entities with
 * a Component_Animator. Replaces the older 3-phase PoseLayerSystem with a
 * fully general keyframe format that can express:
 *
 *   - Looping cycles (walk, run, idle breath) via loop: true
 *   - Held poses (sit, sleep) via hold: true
 *   - One-shot actions (sword swing, jump, hit reaction) — default
 *
 * A keyframe drives any combination of `rot`, `scale`, and `pos` per bone,
 * which is what unlocks cartoony exaggeration: an arm can stretch to 1.6×
 * length and shoot 0.2m forward on the impact frame, then snap back.
 *
 * Per bone, the value at time `t` is interpolated between the prev and next
 * keyframes that explicitly mention that bone. Bones not in the clip at all
 * are never touched, so this system layers cleanly on top of PlayerAnimSystem
 * (the walk anim) — only the bones the action animation cares about are
 * overridden.
 *
 * Triggered by:
 *   EventBus.emit('animation:play', { entityId, clipName })
 *   EventBus.emit('animation:stop', { entityId })
 *   EventBus.emit('skill:fired',    { entityId, skillId })  // looks up skill.animation
 *
 * Required components: ['Transform', 'Animator']
 */
export class AnimationSystem {
    constructor() {
        this._clips = null;          // dict from animations.json (loaded async)
        this._ecs = null;
        this._pendingPlays = [];     // events that arrived before clips loaded

        // Lazy-load animations.json — relative to this module file
        const url = new URL('../config/animations.json', import.meta.url);
        fetch(url)
            .then(r => r.json())
            .then(json => {
                const { _doc, ...clips } = json;
                this._clips = clips;
                console.log(`[AnimationSystem] Loaded ${Object.keys(clips).length} clips:`, Object.keys(clips));
                for (const ev of this._pendingPlays) this._handlePlay(ev.entityId, ev.clipName);
                this._pendingPlays = [];
            })
            .catch(err => console.warn('[AnimationSystem] Failed to load animations.json:', err));

        EventBus.on('animation:play', ({ entityId, clipName }) => {
            this._handlePlay(entityId, clipName);
        });

        EventBus.on('animation:stop', ({ entityId }) => {
            if (!this._ecs) return;
            const animator = this._ecs.getComponent(entityId, 'Animator');
            if (animator) {
                animator.activeClip = null;
                animator.activeName = null;
                animator.time = 0;
                animator.finished = false;
                if (animator._refs && animator._restPose) {
                    this._restoreRestPose(animator);
                }
            }
        });

        // Skill system hook — when a skill fires, look up its animation field
        EventBus.on('skill:fired', ({ entityId, skillId }) => {
            let skill;
            try { skill = SkillRegistry.getSkill(skillId); }
            catch { return; }
            const clipName = skill?.animation;
            if (!clipName) return;
            this._handlePlay(entityId, clipName);
        });
    }

    // ── Public API for systems / lab to query clips ──
    getClips() { return this._clips; }
    isLoaded() { return this._clips !== null; }

    _handlePlay(entityId, clipName) {
        if (!this._clips) {
            this._pendingPlays.push({ entityId, clipName });
            return;
        }
        const clip = this._clips[clipName];
        if (!clip) {
            console.warn(`[AnimationSystem] Unknown clip: '${clipName}'`);
            return;
        }
        if (!this._ecs) return;
        const animator = this._ecs.getComponent(entityId, 'Animator');
        if (!animator) return;

        // If switching clips on a character that already has cached rest pose,
        // snap bones back to rest first so the new clip starts cleanly.
        if (animator._refs && animator._restPose) {
            this._restoreRestPose(animator);
        }

        animator.activeClip = clip;
        animator.activeName = clipName;
        animator.time       = 0;
        animator.finished   = false;
    }

    update(entities, deltaTime, ecs) {
        this._ecs = ecs;
        if (deltaTime <= 0) return;

        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const animator  = ecs.getComponent(id, 'Animator');
            if (!transform || !animator || !animator.activeClip) continue;

            const root = transform.mesh;
            if (!root) continue;

            // First-time setup: cache bone refs and rest pose for the bones
            // this clip touches.
            if (!animator._refs) {
                animator._refs = {};
                animator._restPose = {};
            }

            const clip = animator.activeClip;
            animator.time += deltaTime;

            // ── Phase / time progression ──
            let t01;  // normalized 0..1 within the clip
            const dur = clip.duration || 1;

            if (clip.loop) {
                // Wrap forever
                const phase = animator.time % dur;
                t01 = phase / dur;
            } else if (clip.hold) {
                // Clamp at the end and stay
                t01 = Math.min(1, animator.time / dur);
            } else {
                // Once: end when finished
                if (animator.time >= dur) {
                    // Play the final frame, then end
                    t01 = 1;
                    this._evaluateAndApply(clip, t01, animator, root);
                    // After applying the final frame, restore rest pose so
                    // we don't leave bones stuck mid-pose.
                    this._restoreRestPose(animator);
                    animator.activeClip = null;
                    animator.activeName = null;
                    animator.finished = true;
                    animator.time = 0;
                    continue;
                }
                t01 = animator.time / dur;
            }

            this._evaluateAndApply(clip, t01, animator, root);
        }
    }

    /**
     * Resolve the bone targets at normalized time t01 and apply them to the mesh.
     * Caches bone refs + rest pose lazily on the animator.
     */
    _evaluateAndApply(clip, t01, animator, root) {
        const target = _evaluateClip(clip, t01);

        for (const boneName of Object.keys(target)) {
            // Cache bone ref + rest pose on first encounter.
            // Special case: 'root' refers to the entity mesh itself, so
            // animations can drive whole-character squash/stretch and
            // root translation (jump squash, dramatic pose changes).
            let bone = animator._refs[boneName];
            if (bone === undefined) {
                bone = (boneName === 'root') ? root : (root.getObjectByName(boneName) || null);
                animator._refs[boneName] = bone;
                if (bone && !animator._restPose[boneName]) {
                    animator._restPose[boneName] = {
                        pos:   bone.position.clone(),
                        rot:   { x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z },
                        scale: bone.scale.clone(),
                    };
                }
            }
            if (!bone) continue;

            const rest = animator._restPose[boneName];
            const props = target[boneName];

            // Rotation: if specified, replace rest rotation (rest is the
            // baseline; the keyframe value IS the angle we want).
            if (props.rot) {
                bone.rotation.x = props.rot.x !== undefined ? props.rot.x : rest.rot.x;
                bone.rotation.y = props.rot.y !== undefined ? props.rot.y : rest.rot.y;
                bone.rotation.z = props.rot.z !== undefined ? props.rot.z : rest.rot.z;
            }

            // Scale: keyframe value is the multiplier we want (rest is 1).
            if (props.scale) {
                bone.scale.x = props.scale.x !== undefined ? props.scale.x : rest.scale.x;
                bone.scale.y = props.scale.y !== undefined ? props.scale.y : rest.scale.y;
                bone.scale.z = props.scale.z !== undefined ? props.scale.z : rest.scale.z;
            }

            // Position: keyframe value is an OFFSET added to rest position.
            // Lets us write { pos: { z: 0.2 } } to mean "shift 0.2m forward
            // from wherever this shoulder normally sits."
            if (props.pos) {
                bone.position.x = rest.pos.x + (props.pos.x || 0);
                bone.position.y = rest.pos.y + (props.pos.y || 0);
                bone.position.z = rest.pos.z + (props.pos.z || 0);
            }
        }
    }

    /**
     * Snap every bone we've animated back to its cached rest pose. Called
     * when a clip ends or when switching clips, so we don't leave bones
     * stuck mid-stretch.
     */
    _restoreRestPose(animator) {
        if (!animator._refs || !animator._restPose) return;
        for (const [name, bone] of Object.entries(animator._refs)) {
            if (!bone) continue;
            const rest = animator._restPose[name];
            if (!rest) continue;
            bone.position.copy(rest.pos);
            bone.rotation.set(rest.rot.x, rest.rot.y, rest.rot.z);
            bone.scale.copy(rest.scale);
        }
    }
}

// ─── Clip evaluator ────────────────────────────────────────────────────────
/**
 * Resolve a clip at normalized time t01 (0..1) into a bone → props map.
 * For each bone mentioned anywhere in the clip, finds the surrounding
 * keyframes that mention it and lerps between them.
 */
function _evaluateClip(clip, t01) {
    const result = {};
    const keyframes = clip.keyframes || [];
    if (keyframes.length === 0) return result;

    // Collect all bone names that appear in any keyframe
    const allBones = new Set();
    for (const kf of keyframes) {
        if (!kf.pose) continue;
        for (const name of Object.keys(kf.pose)) allBones.add(name);
    }

    for (const name of allBones) {
        // Sub-list of keyframes that explicitly mention this bone
        const entries = [];
        for (const kf of keyframes) {
            if (kf.pose && kf.pose[name]) entries.push({ t: kf.t, props: kf.pose[name] });
        }
        if (entries.length === 0) continue;

        // Find bracketing entries for the current t01
        let prev = entries[0];
        let next = entries[entries.length - 1];

        if (t01 <= entries[0].t) {
            prev = next = entries[0];
        } else if (t01 >= entries[entries.length - 1].t) {
            prev = next = entries[entries.length - 1];
        } else {
            for (let i = 0; i < entries.length - 1; i++) {
                if (entries[i].t <= t01 && entries[i + 1].t >= t01) {
                    prev = entries[i];
                    next = entries[i + 1];
                    break;
                }
            }
        }

        const range = next.t - prev.t;
        const localT = range > 0 ? (t01 - prev.t) / range : 0;
        result[name] = _lerpBoneProps(prev.props, next.props, localT);
    }

    return result;
}

function _lerpBoneProps(a, b, t) {
    // a and b are partial { rot, scale, pos } objects. Lerp each component
    // that exists in EITHER, falling back to the other (or undefined).
    const out = {};
    for (const channel of ['rot', 'scale', 'pos']) {
        const av = a[channel];
        const bv = b[channel];
        if (av === undefined && bv === undefined) continue;
        out[channel] = {};
        for (const axis of ['x', 'y', 'z']) {
            const ax = av && av[axis] !== undefined ? av[axis] : undefined;
            const bx = bv && bv[axis] !== undefined ? bv[axis] : undefined;
            if (ax === undefined && bx === undefined) continue;
            if (ax === undefined) { out[channel][axis] = bx; continue; }
            if (bx === undefined) { out[channel][axis] = ax; continue; }
            out[channel][axis] = ax + (bx - ax) * t;
        }
    }
    return out;
}
