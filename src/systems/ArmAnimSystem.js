import EventBus from '../core/EventBus.js';

/**
 * ArmAnimSystem — Drives character arm animations in response to skill events.
 *
 * Queries: ['Arms']
 *
 * Responsibilities:
 *   1. Listen to 'skill:fired' — start a new arm animation for the entity
 *      using the skill's animation config (type, duration, armSide).
 *   2. Per frame, advance animPhase on all arms and set pivot rotation.
 *   3. Return to rest pose (rotation.x = 0) when the animation finishes.
 *
 * Animation types:
 *   - 'recoil' — quick raise-and-return (pistol kick)
 *   - 'swing'  — full forward swipe (punch / bow release)
 *   - 'mine'   — raise overhead, slam down, recover (pickaxe)
 *
 * Pivot convention:
 *   Each arm is a Group parented at the shoulder. The arm mesh is a child
 *   hanging down along -Y. Rotating the Group around X rotates the arm
 *   forward (−angle → forward in +Z) or backward (+angle → -Z).
 */
export class ArmAnimSystem {
    constructor() {
        this._ecs = null;

        // Listen for skill fires — we'll look up the entity's Arms component
        // on the next update tick via stored pending animations.
        this._pending = new Map(); // entityId → { type, duration, side }

        EventBus.on('skill:fired', ({ entityId, animation }) => {
            if (!animation || !animation.type) return;
            this._pending.set(entityId, {
                type:     animation.type,
                duration: animation.duration || 0.2,
                side:     animation.armSide  || 'both'
            });
        });
    }

    update(entities, deltaTime, ecs) {
        this._ecs = ecs;

        // Apply any pending animation starts
        if (this._pending.size > 0) {
            for (const [entityId, anim] of this._pending) {
                const arms = ecs.getComponent(entityId, 'Arms');
                if (arms) {
                    arms.animType     = anim.type;
                    arms.animDuration = anim.duration;
                    arms.animSide     = anim.side;
                    arms.animPhase    = 0;
                }
            }
            this._pending.clear();
        }

        for (const id of entities) {
            const arms = ecs.getComponent(id, 'Arms');
            if (!arms) continue;
            if (!arms.leftArm && !arms.rightArm) continue;

            // At rest — keep arms at zero rotation
            if (!arms.animType) {
                if (arms.leftArm)  arms.leftArm.rotation.x  = 0;
                if (arms.rightArm) arms.rightArm.rotation.x = 0;
                continue;
            }

            // Advance phase
            arms.animPhase += deltaTime / Math.max(arms.animDuration, 0.001);
            if (arms.animPhase >= 1) {
                arms.animType  = null;
                arms.animPhase = 0;
                if (arms.leftArm)  arms.leftArm.rotation.x  = 0;
                if (arms.rightArm) arms.rightArm.rotation.x = 0;
                continue;
            }

            const angle = this._computeAngle(arms.animType, arms.animPhase);

            const leftAngle  = (arms.animSide === 'left'  || arms.animSide === 'both') ? angle : 0;
            const rightAngle = (arms.animSide === 'right' || arms.animSide === 'both') ? angle : 0;

            if (arms.leftArm)  arms.leftArm.rotation.x  = leftAngle;
            if (arms.rightArm) arms.rightArm.rotation.x = rightAngle;
        }
    }

    /**
     * Phase → rotation angle (radians) for each animation type.
     * Negative angle = swing forward (+Z); positive = swing back (-Z).
     */
    _computeAngle(type, phase) {
        const PI = Math.PI;

        if (type === 'recoil') {
            // Quick forward-jerk and slower return
            // 0.0–0.2: rise to -PI/4   |   0.2–1.0: return to 0
            if (phase < 0.2) return (-PI / 4) * (phase / 0.2);
            return (-PI / 4) * (1 - (phase - 0.2) / 0.8);
        }

        if (type === 'swing') {
            // Full forward swipe
            // 0.0–0.4: 0 → -PI/2       |   0.4–1.0: -PI/2 → 0
            if (phase < 0.4) return (-PI / 2) * (phase / 0.4);
            return (-PI / 2) * (1 - (phase - 0.4) / 0.6);
        }

        if (type === 'mine') {
            // Overhand chop: forward → overhead → slam forward-down → rest
            // 0.0–0.35: 0 → -PI (up via forward arc)
            // 0.35–0.65: -PI → -PI/4 (slam)
            // 0.65–1.0: -PI/4 → 0 (recover)
            if (phase < 0.35) return -PI * (phase / 0.35);
            if (phase < 0.65) {
                const t = (phase - 0.35) / 0.30;
                return -PI * (1 - t) + (-PI / 4) * t;
            }
            return (-PI / 4) * (1 - (phase - 0.65) / 0.35);
        }

        return 0;
    }
}
