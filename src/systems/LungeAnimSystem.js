import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

// ── Three-phase attack animation ──────────────────────────────────────
// 1. wind-up (slow, ease-in)  — arms raise overhead-and-back, torso leans
//    back, head tilts up. Reads as anticipation.
// 2. strike (fast, ease-out)  — arms slam down past forward, torso lunges
//    forward, head bites forward, brief scale pulse for impact emphasis.
// 3. recovery                 — everything eases back to rest pose.
//
// Rotations are local-X on the relevant pivots; the arm rest pose for the
// 'character-zombie' preset is rotation.x ≈ -π/2 (arms forward), so the
// wind-up offset of -1.85 sweeps them past straight UP, and the strike
// offset of +1.6 slams them past straight DOWN. Total arc ≈ 3.4 rad / 195°.

const DURATION    = 0.55;
const WINDUP_END  = 0.30;   // 0..WINDUP_END  → wind-up
const STRIKE_END  = 0.55;   // WINDUP_END..STRIKE_END → strike
                            // STRIKE_END..1.0 → recovery (relative to 1)

const ARM_WINDUP_OFFSET   = -1.85;  // arms rotate past straight UP
const ARM_STRIKE_OFFSET   = +1.60;  // arms slam past straight DOWN
const TORSO_WINDUP_OFFSET = -0.30;  // lean back
const TORSO_STRIKE_OFFSET = +0.50;  // lunge forward
const HEAD_WINDUP_OFFSET  = -0.40;  // look up at sky
const HEAD_STRIKE_OFFSET  = +0.55;  // bite forward
const STRIKE_SCALE_BOOST  = 0.12;   // +12% scale at peak strike

// Fallback for unrigged attackers (legacy 'character' preset etc).
const BODY_LEAN_RAD = 0.55;
const BODY_STRETCH  = 0.30;

// ── Soldier two-arm hammer-smash (whole-body strike, fallback for ally) ─
const SOLDIER_DURATION         = 0.35;
const SOLDIER_WINDUP_END       = 0.25;
const SOLDIER_STRIKE_END       = 0.55;
const SOLDIER_ARM_WINDUP_OFF   = -1.50;
const SOLDIER_ARM_STRIKE_OFF   = +1.20;
const SOLDIER_TORSO_WINDUP_OFF = -0.18;
const SOLDIER_TORSO_STRIKE_OFF = +0.35;
const SOLDIER_PELVIS_DIP       = -0.12;
const SOLDIER_PELVIS_POP       = +0.06;
const SOLDIER_SCALE_BOOST      = 0.10;

// ── Scout: spear-throw projectile (no arm animation) ──────────────────
// Scout doesn't run an arm-thrust animation. On entity:attacked, _begin
// dispatches to CombatVFXSystem.spawnSpearThrow which hides the held
// spear, spawns a world-space projectile clone that flies straight to
// the target and returns on a cyan tether (siphon-beam visual idiom).
// All scout combat visuals live in CombatVFXSystem now.

// ── Bruiser magma-breath body animation (no held weapon) ──────────────
// Body-only windup→exhale lean. No arm rotation, no held weapon. The
// MAGMA BREATH VFX is the visual focus (fires at strike peak via
// CombatVFXSystem.spawnMagmaBreath). Body lean reads as "inhale →
// exhale fire."
const BRUISER_DURATION         = 0.85;
const BRUISER_WINDUP_END       = 0.35;
const BRUISER_STRIKE_END       = 0.70;
const BRUISER_TORSO_WINDUP_OFF = -0.25;   // lean back, "inhale"
const BRUISER_TORSO_STRIKE_OFF = +0.40;   // lean forward, "exhale fire"
const BRUISER_PELVIS_DIP       = -0.15;
const BRUISER_PELVIS_POP       = +0.05;
const BRUISER_BREATH_LENGTH    = 6.0;
const BRUISER_BREATH_ANGLE     = 60;
const BRUISER_BREATH_COLOR     = 0xff6622;

// ── Spit attack animation (head recoil → thrust) ──────────────────────
// Drives the rigged head + torso pivots when SpitterSystem fires
// 'zombie:spit:windup'. The thrust peak coincides with windupDuration in
// the Spitter component so the projectile appears to leave the mouth at
// the top of the forward lurch.
const SPIT_DURATION       = 0.55;
const SPIT_RECOIL_END     = 0.45;   // 0..0.45 → recoil back
const SPIT_THRUST_END     = 0.65;   // 0.45..0.65 → thrust forward (release)
const SPIT_HEAD_RECOIL    = -0.50;
const SPIT_HEAD_THRUST    = +0.70;
const SPIT_TORSO_RECOIL   = -0.20;
const SPIT_TORSO_THRUST   = +0.35;

const easeInQuad   = (t) => t * t;
const easeOutCubic = (t) => { const u = 1 - t; return 1 - u * u * u; };

/**
 * LungeAnimSystem — Three-phase attack animation triggered by
 * ContactDamageSystem (subscribes to 'entity:attacked').
 *
 * Rigged attackers (leftArm+rightArm pivots) get the full wind-up → slam →
 * recovery treatment, with torso lean, head bite, and impact scale pulse.
 * Unrigged attackers fall back to a torso lean + Z-stretch.
 *
 * Runs AFTER PlayerAnimSystem so per-frame walk writes are overridden while
 * a swing is active. Re-attacks during an in-flight swing are ignored.
 */
export class LungeAnimSystem {
    constructor(particleSystem = null, combatVFX = null) {
        this._active = new Map();
        this._ecs = null;
        this._particleSystem = particleSystem;
        this._combatVFX = combatVFX;
        EventBus.on('entity:attacked', ({ attackerId, targetId }) => this._begin(attackerId, targetId));
        EventBus.on('zombie:spit:windup', ({ attackerId }) => this._beginSpit(attackerId));
    }

    _spawnVFX(_root, _kind) {
        // Currently unused — scout dispatches directly via spawnSpearThrow,
        // bruiser via _spawnMagmaBreath. Kept as a no-op hook for future
        // melee branches that may reuse the existing arc/shockwave VFX.
    }

    _spawnMagmaBreath(root) {
        if (!this._combatVFX) return;
        // Origin = bruiser's mouth (head world position, slight downward
        // shift so flame issues from face level rather than crown).
        const head = root.getObjectByName('head');
        const origin = new THREE.Vector3();
        if (head) {
            head.getWorldPosition(origin);
            origin.y -= 0.05;
        } else {
            root.getWorldPosition(origin);
            origin.y += 1.5;
        }
        // Forward direction from the bruiser's facing rotation.
        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
        this._combatVFX.spawnMagmaBreath({
            position: origin,
            direction: fwd,
            length: BRUISER_BREATH_LENGTH,
            angleDeg: BRUISER_BREATH_ANGLE,
            color: BRUISER_BREATH_COLOR
        });
    }

    _beginSpit(attackerId) {
        if (!this._ecs) return;
        if (this._active.has(attackerId)) return;
        const tr = this._ecs.getComponent(attackerId, 'Transform');
        if (!tr?.mesh) return;
        const head  = tr.mesh.getObjectByName('head');
        const torso = tr.mesh.getObjectByName('torso');
        if (!head) return;
        this._active.set(attackerId, {
            kind: 'spit',
            head,
            torso,
            baseHeadX:  head.rotation.x,
            baseTorsoX: torso ? torso.rotation.x : 0,
            t: 0
        });
    }

    setECS(ecs) { this._ecs = ecs; }

    _begin(attackerId, targetId) {
        if (!this._ecs) return;
        if (this._active.has(attackerId)) return;
        const tr = this._ecs.getComponent(attackerId, 'Transform');
        if (!tr?.mesh) return;

        const root = tr.mesh;
        const leftArm  = root.getObjectByName('leftArm');
        const rightArm = root.getObjectByName('rightArm');

        if (leftArm && rightArm) {
            // Branch by attacker faction so allies (Scout/Bruiser) get a
            // snappy overhand swing while enemies (zombies) get the slow
            // overhead slam. Both share the same rig pipeline.
            const movement = this._ecs.getComponent(attackerId, 'Movement');
            const isAlly = movement?.faction === 'ally';

            if (isAlly) {
                const tag = this._ecs.getComponent(attackerId, 'Tag');
                const tagList = (tag && Array.isArray(tag.tags)) ? tag.tags : [];
                const isScout   = tagList.includes('scout');
                const isBruiser = tagList.includes('bruiser');
                const torso  = root.getObjectByName('torso');
                const pelvis = root.getObjectByName('pelvis');

                if (isScout) {
                    // Scout doesn't get an arm-thrust animation — instead,
                    // dispatch to combatVFX which spawns a world-space
                    // spear projectile + cyan tether (siphon-beam idiom).
                    // Damage is already delivered by ContactDamage; this
                    // is purely the visual.
                    if (this._combatVFX && targetId != null) {
                        const targetTr = this._ecs.getComponent(targetId, 'Transform');
                        if (targetTr?.mesh) {
                            const targetPos = new THREE.Vector3();
                            targetTr.mesh.getWorldPosition(targetPos);
                            // Aim at chest height so the spear doesn't dive
                            // into the ground.
                            targetPos.y += 0.6;
                            this._combatVFX.spawnSpearThrow({
                                scoutId: attackerId,
                                scoutMesh: root,
                                targetPos
                            });
                        }
                    }
                    EventBus.emit('audio:cue', { name: 'impact_thud' });
                    return;
                }

                // Bruiser (or any other ally) → diagonal two-hand sword
                // cleave (Bruiser) or fallback overhead smash (generic).
                this._active.set(attackerId, {
                    kind: isBruiser ? 'bruiser' : 'soldier',
                    root, leftArm, rightArm, torso, pelvis,
                    baseLeftX:    leftArm.rotation.x,
                    baseRightX:   rightArm.rotation.x,
                    baseTorsoX:   torso  ? torso.rotation.x  : 0,
                    baseTorsoY:   torso  ? torso.rotation.y  : 0,
                    basePelvisY:  pelvis ? pelvis.position.y : 0,
                    baseScaleX:   root.scale.x,
                    baseScaleY:   root.scale.y,
                    baseScaleZ:   root.scale.z,
                    impactFired:  false,
                    t: 0
                });
                EventBus.emit('audio:cue', { name: 'impact_thud' });
                return;
            }

            const torso = root.getObjectByName('torso');
            const head  = root.getObjectByName('head');
            this._active.set(attackerId, {
                kind: 'rig',
                root, leftArm, rightArm, torso, head,
                baseLeftX:  leftArm.rotation.x,
                baseRightX: rightArm.rotation.x,
                baseTorsoX: torso ? torso.rotation.x : 0,
                baseHeadX:  head  ? head.rotation.x  : 0,
                baseScaleX: root.scale.x,
                baseScaleY: root.scale.y,
                baseScaleZ: root.scale.z,
                t: 0
            });
        } else {
            this._active.set(attackerId, {
                kind: 'body',
                mesh: root,
                baseRotX: root.rotation.x,
                baseScaleZ: root.scale.z,
                t: 0
            });
        }
    }

    update(deltaTime) {
        for (const [id, a] of this._active) {
            const dur = a.kind === 'spit'    ? SPIT_DURATION
                      : a.kind === 'bruiser' ? BRUISER_DURATION
                      : a.kind === 'soldier' ? SOLDIER_DURATION
                      : DURATION;
            a.t += deltaTime;
            const ratio = Math.min(1, a.t / dur);

            if (a.kind === 'bruiser') {
                // Magma-breath body animation: body-only lean (no arm
                // rotation, no held weapon). Wind-up = lean back ("inhale"),
                // strike = lean forward ("exhale fire"), recovery = ease back.
                // Magma breath VFX fires once at strike peak.
                let torsoOff, pelvisOff;

                if (ratio < BRUISER_WINDUP_END) {
                    const u = easeInQuad(ratio / BRUISER_WINDUP_END);
                    torsoOff  = BRUISER_TORSO_WINDUP_OFF * u;
                    pelvisOff = BRUISER_PELVIS_DIP       * u;
                } else if (ratio < BRUISER_STRIKE_END) {
                    const u = easeOutCubic((ratio - BRUISER_WINDUP_END) / (BRUISER_STRIKE_END - BRUISER_WINDUP_END));
                    torsoOff  = BRUISER_TORSO_WINDUP_OFF + (BRUISER_TORSO_STRIKE_OFF - BRUISER_TORSO_WINDUP_OFF) * u;
                    pelvisOff = BRUISER_PELVIS_DIP       + (BRUISER_PELVIS_POP       - BRUISER_PELVIS_DIP)       * u;
                    if (!a.impactFired && u > 0.30) {
                        a.impactFired = true;
                        this._spawnMagmaBreath(a.root);
                    }
                } else {
                    const u = easeOutCubic((ratio - BRUISER_STRIKE_END) / (1 - BRUISER_STRIKE_END));
                    torsoOff  = BRUISER_TORSO_STRIKE_OFF * (1 - u);
                    pelvisOff = BRUISER_PELVIS_POP       * (1 - u);
                }

                if (a.torso)  a.torso.rotation.x  = a.baseTorsoX  + torsoOff;
                if (a.pelvis) a.pelvis.position.y = a.basePelvisY + pelvisOff;

                if (ratio >= 1) {
                    if (a.torso)  a.torso.rotation.x  = a.baseTorsoX;
                    if (a.pelvis) a.pelvis.position.y = a.basePelvisY;
                    this._active.delete(id);
                }
                continue;
            }

            if (a.kind === 'soldier') {
                let armOff, torsoOff, pelvisOff, scaleMul;

                if (ratio < SOLDIER_WINDUP_END) {
                    const u = easeInQuad(ratio / SOLDIER_WINDUP_END);
                    armOff    = SOLDIER_ARM_WINDUP_OFF   * u;
                    torsoOff  = SOLDIER_TORSO_WINDUP_OFF * u;
                    pelvisOff = SOLDIER_PELVIS_DIP       * u;
                    scaleMul  = 1.0;
                } else if (ratio < SOLDIER_STRIKE_END) {
                    const u = easeOutCubic((ratio - SOLDIER_WINDUP_END) / (SOLDIER_STRIKE_END - SOLDIER_WINDUP_END));
                    armOff    = SOLDIER_ARM_WINDUP_OFF   + (SOLDIER_ARM_STRIKE_OFF   - SOLDIER_ARM_WINDUP_OFF)   * u;
                    torsoOff  = SOLDIER_TORSO_WINDUP_OFF + (SOLDIER_TORSO_STRIKE_OFF - SOLDIER_TORSO_WINDUP_OFF) * u;
                    pelvisOff = SOLDIER_PELVIS_DIP       + (SOLDIER_PELVIS_POP       - SOLDIER_PELVIS_DIP)       * u;
                    scaleMul  = 1 + SOLDIER_SCALE_BOOST * Math.sin(u * Math.PI);
                } else {
                    const u = easeOutCubic((ratio - SOLDIER_STRIKE_END) / (1 - SOLDIER_STRIKE_END));
                    armOff    = SOLDIER_ARM_STRIKE_OFF   * (1 - u);
                    torsoOff  = SOLDIER_TORSO_STRIKE_OFF * (1 - u);
                    pelvisOff = SOLDIER_PELVIS_POP       * (1 - u);
                    scaleMul  = 1.0;
                }

                a.leftArm.rotation.x  = a.baseLeftX  + armOff;
                a.rightArm.rotation.x = a.baseRightX + armOff;
                if (a.torso)  a.torso.rotation.x   = a.baseTorsoX  + torsoOff;
                if (a.pelvis) a.pelvis.position.y  = a.basePelvisY + pelvisOff;
                a.root.scale.set(
                    a.baseScaleX * scaleMul,
                    a.baseScaleY * scaleMul,
                    a.baseScaleZ * scaleMul
                );

                if (ratio >= 1) {
                    a.leftArm.rotation.x  = a.baseLeftX;
                    a.rightArm.rotation.x = a.baseRightX;
                    if (a.torso)  a.torso.rotation.x  = a.baseTorsoX;
                    if (a.pelvis) a.pelvis.position.y = a.basePelvisY;
                    a.root.scale.set(a.baseScaleX, a.baseScaleY, a.baseScaleZ);
                    this._active.delete(id);
                }
                continue;
            }

            if (a.kind === 'spit') {
                let headOffset, torsoOffset;
                if (ratio < SPIT_RECOIL_END) {
                    const u = easeInQuad(ratio / SPIT_RECOIL_END);
                    headOffset  = SPIT_HEAD_RECOIL  * u;
                    torsoOffset = SPIT_TORSO_RECOIL * u;
                } else if (ratio < SPIT_THRUST_END) {
                    const u = easeOutCubic((ratio - SPIT_RECOIL_END) / (SPIT_THRUST_END - SPIT_RECOIL_END));
                    headOffset  = SPIT_HEAD_RECOIL  + (SPIT_HEAD_THRUST  - SPIT_HEAD_RECOIL)  * u;
                    torsoOffset = SPIT_TORSO_RECOIL + (SPIT_TORSO_THRUST - SPIT_TORSO_RECOIL) * u;
                } else {
                    const u = easeOutCubic((ratio - SPIT_THRUST_END) / (1 - SPIT_THRUST_END));
                    headOffset  = SPIT_HEAD_THRUST  * (1 - u);
                    torsoOffset = SPIT_TORSO_THRUST * (1 - u);
                }
                a.head.rotation.x = a.baseHeadX + headOffset;
                if (a.torso) a.torso.rotation.x = a.baseTorsoX + torsoOffset;

                if (ratio >= 1) {
                    a.head.rotation.x = a.baseHeadX;
                    if (a.torso) a.torso.rotation.x = a.baseTorsoX;
                    this._active.delete(id);
                }
                continue;
            }

            if (a.kind === 'rig') {
                let armOffset, torsoOffset, headOffset, scaleMul;

                if (ratio < WINDUP_END) {
                    // Wind-up: ease-in slow → fast as arms reach apex
                    const u = easeInQuad(ratio / WINDUP_END);
                    armOffset   = ARM_WINDUP_OFFSET   * u;
                    torsoOffset = TORSO_WINDUP_OFFSET * u;
                    headOffset  = HEAD_WINDUP_OFFSET  * u;
                    scaleMul    = 1.0;
                } else if (ratio < STRIKE_END) {
                    // Strike: ease-out fast snap from windup pose to slam pose
                    const u = easeOutCubic((ratio - WINDUP_END) / (STRIKE_END - WINDUP_END));
                    armOffset   = ARM_WINDUP_OFFSET   + (ARM_STRIKE_OFFSET   - ARM_WINDUP_OFFSET)   * u;
                    torsoOffset = TORSO_WINDUP_OFFSET + (TORSO_STRIKE_OFFSET - TORSO_WINDUP_OFFSET) * u;
                    headOffset  = HEAD_WINDUP_OFFSET  + (HEAD_STRIKE_OFFSET  - HEAD_WINDUP_OFFSET)  * u;
                    // Scale pulse: 1 → 1+boost → 1 across the strike phase
                    scaleMul    = 1 + STRIKE_SCALE_BOOST * Math.sin(u * Math.PI);
                } else {
                    // Recovery: ease-out from slam pose back to rest
                    const u = easeOutCubic((ratio - STRIKE_END) / (1 - STRIKE_END));
                    armOffset   = ARM_STRIKE_OFFSET   * (1 - u);
                    torsoOffset = TORSO_STRIKE_OFFSET * (1 - u);
                    headOffset  = HEAD_STRIKE_OFFSET  * (1 - u);
                    scaleMul    = 1.0;
                }

                a.leftArm.rotation.x  = a.baseLeftX  + armOffset;
                a.rightArm.rotation.x = a.baseRightX + armOffset;
                if (a.torso) a.torso.rotation.x = a.baseTorsoX + torsoOffset;
                if (a.head)  a.head.rotation.x  = a.baseHeadX  + headOffset;
                a.root.scale.set(
                    a.baseScaleX * scaleMul,
                    a.baseScaleY * scaleMul,
                    a.baseScaleZ * scaleMul
                );
            } else {
                const u = Math.sin(ratio * Math.PI);
                a.mesh.rotation.x = a.baseRotX + BODY_LEAN_RAD * u;
                a.mesh.scale.z    = a.baseScaleZ + BODY_STRETCH * u;
            }

            if (ratio >= 1) {
                if (a.kind === 'rig') {
                    a.leftArm.rotation.x  = a.baseLeftX;
                    a.rightArm.rotation.x = a.baseRightX;
                    if (a.torso) a.torso.rotation.x = a.baseTorsoX;
                    if (a.head)  a.head.rotation.x  = a.baseHeadX;
                    a.root.scale.set(a.baseScaleX, a.baseScaleY, a.baseScaleZ);
                } else {
                    a.mesh.rotation.x = a.baseRotX;
                    a.mesh.scale.z    = a.baseScaleZ;
                }
                this._active.delete(id);
            }
        }
    }
}
