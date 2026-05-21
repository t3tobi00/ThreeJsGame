import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import { Bullet } from '../entities/Bullet.js';
import { PlayerGun } from '../entities/PlayerGun.js';
import { AimReticle } from '../entities/AimReticle.js';
import { ObjectPool } from '../utils/ObjectPool.js';

/**
 * PlayerGunSystem — Auto-aim gun + PUBG-style aim/feedback visuals.
 *
 * Stop-to-fire model:
 *   - While the joystick is active (input magnitude > STOP_THRESHOLD),
 *     MovementSystem owns rotation and the gun is idle (reticle fades out).
 *   - The instant input drops below threshold, this system takes over rotation
 *     and the reticle slides to the nearest enemy's chest. Bullets fire at
 *     gun.fireRate per second while the lock holds.
 *
 * Rotation handoff is implicit: MovementSystem only writes rotation.y when
 * `velocity.length() > 0.1` (MovementSystem.js:49). This system only writes
 * rotation.y when input magnitude < STOP_THRESHOLD. They never write the same
 * frame — but PlayerGunSystem MUST be registered AFTER MovementSystem so its
 * write is the final value of the frame.
 *
 * Visuals:
 *   - PlayerGun (rifle mesh + muzzle flash + recoil) — one per gunner,
 *     parented to the entity's mesh, lazy-created on first sight.
 *   - AimReticle (sliding dot + hit X marker) — one global, lives in scene.
 */
const STOP_THRESHOLD = 0.1;          // matches MovementSystem velocity threshold
const HIT_RADIUS_SQ  = 0.7 * 0.7;    // XZ-only hit radius around enemy center
const HYSTERESIS_DELTA = 1.5;        // u — new candidate must be this much
                                      // closer to steal the lock from the
                                      // current target. Mirrors HeroAISystem
                                      // _scoreAggro (line 399-410).
const RETICLE_CHEST_OFFSET = 1.1;    // Y offset above enemy feet for reticle dot

export class PlayerGunSystem {
    constructor(scene, joystick, keyboard, particleSystem) {
        this.scene = scene;
        this.joystick = joystick;
        this.keyboard = keyboard;
        this.particleSystem = particleSystem;

        this.bulletPool = new ObjectPool(() => new Bullet(), 60, 'BulletPool');
        this.bullets = [];

        // Single global reticle — there's only one player, no need for one per gunner
        this.reticle = new AimReticle(scene);

        // Per-entity gun meshes, lazy-created on first sight
        this._guns = new Map(); // entityId → PlayerGun

        // Reusable temps to avoid per-frame allocations
        this._tmpDir       = new THREE.Vector3();
        this._tmpMuzzle    = new THREE.Vector3();
        this._tmpReticle   = new THREE.Vector3();
        this._tmpPopupPos  = new THREE.Vector3();
        this._tmpHitPos    = new THREE.Vector3();
        this._tmpRight     = new THREE.Vector3();
        this._tmpBrassPos  = new THREE.Vector3();
        this._tmpSmokePos  = new THREE.Vector3();
        this._tmpExitWound = new THREE.Vector3();
    }

    update(entities, deltaTime, ecs) {
        // Track which gunners we saw this frame — clears reticle when there
        // are no active gunners. (Currently we have one player; the loop is
        // structured for future multi-gunner support.)
        let anyGunnerActive = false;

        for (const id of entities) {
            const wasActive = this._updateGunner(id, deltaTime, ecs);
            anyGunnerActive = anyGunnerActive || wasActive;
        }

        if (!anyGunnerActive) this.reticle.clearTarget();

        this._updateBullets(deltaTime, ecs);
        this.reticle.update(deltaTime);
    }

    // ── Per-entity gun tick ────────────────────────────────────────────

    /**
     * @returns {boolean} true if this gunner has an active target lock this frame
     */
    _updateGunner(entityId, deltaTime, ecs) {
        const transform = ecs.getComponent(entityId, 'Transform');
        const gun = ecs.getComponent(entityId, 'Gun');
        const movement = ecs.getComponent(entityId, 'Movement');
        if (!transform || !gun || !movement) return false;

        // Lazy-create the visible rifle on first sight
        let gunMesh = this._guns.get(entityId);
        if (!gunMesh) {
            gunMesh = new PlayerGun();
            gunMesh.attachToPlayer(transform.mesh);
            this._guns.set(entityId, gunMesh);
        }
        gunMesh.update(deltaTime);

        // Cooldown ticks every frame regardless of input state so the gun is
        // "ready" the instant the player stops.
        if (gun.cooldownLeft > 0) {
            gun.cooldownLeft = Math.max(0, gun.cooldownLeft - deltaTime);
        }

        if (!gun.enabled) {
            gun.isFiring = false;
            return false;
        }

        // Stop-to-fire — only joystick-controlled entities (player) react to
        // input. Keeps the system reusable for future gun-equipped NPCs.
        if (movement.controller === 'joystick') {
            const kb = this.keyboard ? this.keyboard.getVector() : { x: 0, y: 0 };
            const js = this.joystick ? this.joystick.getVector() : { x: 0, y: 0 };
            const inputMag = Math.hypot(kb.x + js.x, kb.y + js.y);
            if (inputMag > STOP_THRESHOLD) {
                gun.isFiring = false;
                return false;
            }
        }

        const target = this._findTarget(entityId, transform, gun, ecs);
        if (!target) {
            gun.isFiring = false;
            return false;
        }

        // Aim — snap-rotate toward target (matches MovementSystem's snap style)
        const dx = target.pos.x - transform.mesh.position.x;
        const dz = target.pos.z - transform.mesh.position.z;
        transform.mesh.rotation.y = Math.atan2(dx, dz);

        // Slide reticle to target's chest. Y offset puts the dot on the
        // enemy's torso rather than at their feet.
        this._tmpReticle.copy(target.pos);
        this._tmpReticle.y += RETICLE_CHEST_OFFSET;
        this.reticle.setTarget(this._tmpReticle);

        gun.isFiring = true;
        gun.currentTargetId = target.entityId;

        if (gun.cooldownLeft <= 0) {
            this._fire(transform, gun, target, gunMesh);
            gun.cooldownLeft = 1 / gun.fireRate;
        }
        return true;
    }

    _findTarget(shooterId, shooterTransform, gun, ecs) {
        const shooterPos = shooterTransform.mesh.position;

        // Sticky lock: hold the current target unless someone meaningfully
        // closer shows up. Without this the gun flips between two equidistant
        // zombies every frame and reticle + body whip back and forth.
        let sticky = null;
        let stickyDist = Infinity;
        if (gun.currentTargetId !== -1 &&
            ecs.hasComponents(gun.currentTargetId, ['Transform', 'Movement', 'Health'])) {
            const m = ecs.getComponent(gun.currentTargetId, 'Movement');
            if (gun.targetFactions.includes(m.faction)) {
                const t = ecs.getComponent(gun.currentTargetId, 'Transform');
                const dx = t.mesh.position.x - shooterPos.x;
                const dz = t.mesh.position.z - shooterPos.z;
                const d = Math.hypot(dx, dz);
                if (d <= gun.range) {
                    sticky = { entityId: gun.currentTargetId, pos: t.mesh.position };
                    stickyDist = d;
                }
            }
        }

        let best = null;
        let bestDist = gun.range;
        const candidates = ecs.queryEntities(['Transform', 'Movement', 'Health']);
        for (const id of candidates) {
            if (id === shooterId) continue;
            const m = ecs.getComponent(id, 'Movement');
            if (!gun.targetFactions.includes(m.faction)) continue;

            const t = ecs.getComponent(id, 'Transform');
            const dx = t.mesh.position.x - shooterPos.x;
            const dz = t.mesh.position.z - shooterPos.z;
            const dist = Math.hypot(dx, dz);
            if (dist < bestDist) {
                bestDist = dist;
                best = { entityId: id, pos: t.mesh.position };
            }
        }

        // Stick with current target unless someone is at least HYSTERESIS_DELTA closer
        if (sticky && best && best.entityId !== sticky.entityId) {
            if (stickyDist - bestDist < HYSTERESIS_DELTA) return sticky;
        }
        return best || sticky;
    }

    _fire(shooterTransform, gun, target, gunMesh) {
        // Visual recoil + muzzle flash on the rifle
        gunMesh.fire();
        // Reticle pulse — small scale-up that decays
        this.reticle.pulse();

        // Subtle screen kick per shot. Tiny amount + tiny duration reads as
        // a snap, not a wobble — that's the "weight" of each round.
        EventBus.emit('camera:shake', { amount: 0.04, duration: 0.05 });

        // Bullet originates from the gun's muzzle in world space
        gunMesh.getMuzzleWorld(this._tmpMuzzle);

        // Flat trajectory — keep target Y aligned with muzzle Y so the
        // bullet doesn't tilt down into the ground
        const targetPos = target.pos.clone();
        targetPos.y = this._tmpMuzzle.y;

        this._tmpDir.subVectors(targetPos, this._tmpMuzzle);
        this._tmpDir.y = 0;
        if (this._tmpDir.lengthSq() < 0.0001) return;
        this._tmpDir.normalize();

        const bullet = this.bulletPool.get();
        bullet.reset(this._tmpMuzzle, this._tmpDir, gun.bulletSpeed, gun.damage, gun.bulletMaxRange);
        this.scene.add(bullet);
        this.bullets.push(bullet);

        if (this.particleSystem) {
            // Brass ejection — small amber out the gun's right side
            gunMesh.getRightWorld(this._tmpRight);
            this._tmpBrassPos.copy(this._tmpMuzzle);
            this._tmpBrassPos.addScaledVector(this._tmpRight, 0.06);
            this._tmpBrassPos.y -= 0.04;
            this.particleSystem.createImpactBurst(this._tmpBrassPos, 0xd4a85a, 3);

            // Muzzle smoke — small grey wisp that lingers ~0.4s
            this._tmpSmokePos.copy(this._tmpMuzzle);
            this._tmpSmokePos.y += 0.04;
            this.particleSystem.createImpactBurst(this._tmpSmokePos, 0x9a948a, 4);
        }
    }

    // ── Bullet flight + collision ──────────────────────────────────────

    _updateBullets(deltaTime, ecs) {
        // Hoist the hittable-entities query outside the bullet loop — same
        // candidate set per frame, no need to re-query per bullet.
        const hittable = this.bullets.length > 0
            ? ecs.queryEntities(['Transform', 'Movement', 'Health'])
            : null;

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.update(deltaTime);

            // Despawn on range or lifetime cap
            if (b.distanceTraveled > b.maxRange || b.elapsed > b.maxLifetime) {
                this._despawn(b, i);
                continue;
            }

            // Collision — XZ only, ignores Y (entity feet on ground, bullet at
            // shoulder height would otherwise never hit).
            let hitId = -1;
            for (const id of hittable) {
                const m = ecs.getComponent(id, 'Movement');
                // Bullets are player-fired; ally / player / neutral are
                // friendly fire and skipped.
                if (m.faction === 'player' || m.faction === 'ally' || m.faction === 'neutral') continue;

                const t = ecs.getComponent(id, 'Transform');
                const dx = b.position.x - t.mesh.position.x;
                const dz = b.position.z - t.mesh.position.z;
                if (dx * dx + dz * dz < HIT_RADIUS_SQ) {
                    hitId = id;
                    break;
                }
            }

            if (hitId !== -1) {
                this._applyHit(b, hitId, ecs);
                this._despawn(b, i);
            }
        }
    }

    _applyHit(bullet, targetId, ecs) {
        const targetTransform = ecs.getComponent(targetId, 'Transform');
        if (!targetTransform) return;

        // Predict kill BEFORE emitting damage so the hit marker, popup, and
        // hitstop all branch correctly. HealthSystem hasn't run yet for this
        // frame, so the HP value is the pre-damage state.
        const health = ecs.getComponent(targetId, 'Health');
        const willKill = !!health && (health.hp - bullet.damage) <= 0;

        // Knockback stumble — shove the zombie back along the bullet's flight
        // direction. Skipped on the killing shot so the death visual reads as
        // a collapse, not a yeet (slice 4 will add proper ragdoll death push).
        if (!willKill) {
            const vel = bullet.velocity;
            const len = vel.length();
            if (len > 0.001) {
                const kb = 0.18;
                targetTransform.mesh.position.x += (vel.x / len) * kb;
                targetTransform.mesh.position.z += (vel.z / len) * kb;
            }
        }

        EventBus.emit('entity:damaged', { entityId: targetId, damage: bullet.damage });

        // Damage popup — yellow number for normal hits, gold "KILL!" on the
        // killing shot (see DamagePopupUI .kill style).
        this._tmpPopupPos.copy(targetTransform.mesh.position);
        this._tmpPopupPos.y += 1.6;
        if (willKill) {
            EventBus.emit('damage:popup', {
                position: this._tmpPopupPos.clone(),
                amount: Math.round(bullet.damage),
                label: 'KILL!',
                style: 'kill'
            });
            // 50ms freeze-frame — gameplay pauses, render keeps going. The
            // hitstop handler in main.js (line 95) consumes this.
            EventBus.emit('game:hitstop', { duration: 0.05 });
            // Heavier camera shake on the kill — emphasis above the per-shot kick
            EventBus.emit('camera:shake', { amount: 0.12, duration: 0.12 });
        } else {
            EventBus.emit('damage:popup', {
                position: this._tmpPopupPos.clone(),
                amount: Math.round(bullet.damage),
                isCrit: false
            });
        }

        // PUBG hit marker — white X on hit, red X on kill.
        this._tmpHitPos.copy(bullet.position);
        this.reticle.showHit(this._tmpHitPos, willKill);

        // Exit-wound blood — directional cloud behind the zombie (in the
        // bullet's flight direction). The generic listener in main.js still
        // spawns radial blood at the zombie's center on entity:damaged; this
        // adds a second burst at the exit point so hits read directional
        // rather than radial. Bigger burst on kill.
        if (this.particleSystem) {
            const vel = bullet.velocity;
            const len = vel.length();
            if (len > 0.001) {
                this._tmpExitWound.copy(targetTransform.mesh.position);
                this._tmpExitWound.y += 1.0;
                this._tmpExitWound.x += (vel.x / len) * 0.35;
                this._tmpExitWound.z += (vel.z / len) * 0.35;
                this.particleSystem.createBloodSplatter(
                    this._tmpExitWound,
                    willKill ? 14 : 6
                );
            }
        }

        // Spark — bigger ("finisher") flavor on the killing shot.
        EventBus.emit('effect:hit_spark', {
            position: this._tmpHitPos.clone(),
            isFinisher: willKill
        });
    }

    _despawn(bullet, index) {
        this.scene.remove(bullet);
        bullet.visible = false;
        this.bulletPool.release(bullet);
        this.bullets.splice(index, 1);
    }
}
