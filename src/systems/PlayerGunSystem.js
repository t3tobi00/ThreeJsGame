import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import { Bullet } from '../entities/Bullet.js';
import { PlayerGun } from '../entities/PlayerGun.js';
import { PlayerAxe } from '../entities/PlayerAxe.js';
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

        // Per-entity gun + axe meshes, lazy-created on first sight
        this._guns = new Map(); // entityId → PlayerGun
        this._axes = new Map(); // entityId → PlayerAxe

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
     * @returns {boolean} true if this gunner has an active GUN target this frame
     *                    (reticle stays on). False in axe mode + idle.
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

        // Lazy-create the axe mesh on first sight (hidden until chop mode)
        let axeMesh = this._axes.get(entityId);
        if (!axeMesh) {
            axeMesh = new PlayerAxe();
            axeMesh.attachToPlayer(transform.mesh);
            this._axes.set(entityId, axeMesh);
        }

        // Both cooldowns tick every frame regardless of mode so the player
        // is ready the instant they enter the relevant mode.
        if (gun.cooldownLeft > 0) gun.cooldownLeft = Math.max(0, gun.cooldownLeft - deltaTime);
        if (gun.chopCooldownLeft > 0) gun.chopCooldownLeft = Math.max(0, gun.chopCooldownLeft - deltaTime);

        if (!gun.enabled) {
            gun.isFiring = false;
            gun.isChopping = false;
            gunMesh.visible = true;
            axeMesh.setActive(false);
            return false;
        }

        // ── Combat priority: an enemy in gun range always wins ──────────
        const enemy = this._findTarget(entityId, transform, gun, ecs);
        if (enemy) {
            gunMesh.visible = true;
            axeMesh.setActive(false);
            gun.isChopping = false;

            // Stop-to-fire: while joystick is active, movement owns rotation
            // and the gun is idle (no shots, no reticle).
            if (movement.controller === 'joystick') {
                const kb = this.keyboard ? this.keyboard.getVector() : { x: 0, y: 0 };
                const js = this.joystick ? this.joystick.getVector() : { x: 0, y: 0 };
                const inputMag = Math.hypot(kb.x + js.x, kb.y + js.y);
                if (inputMag > STOP_THRESHOLD) {
                    gun.isFiring = false;
                    return false;
                }
            }

            // Aim + reticle + fire (existing behavior)
            const dx = enemy.pos.x - transform.mesh.position.x;
            const dz = enemy.pos.z - transform.mesh.position.z;
            transform.mesh.rotation.y = Math.atan2(dx, dz);

            this._tmpReticle.copy(enemy.pos);
            this._tmpReticle.y += RETICLE_CHEST_OFFSET;
            this.reticle.setTarget(this._tmpReticle);

            gun.isFiring = true;
            gun.currentTargetId = enemy.entityId;

            if (gun.cooldownLeft <= 0) {
                this._fire(transform, gun, enemy, gunMesh);
                gun.cooldownLeft = 1 / gun.fireRate;
            }
            return true;
        }

        // ── No enemy: check for a nearby tree to chop ────────────────────
        const tree = this._findNearbyTree(transform, gun, ecs);
        if (tree) {
            // Hide gun, show axe — woodsman mode
            gunMesh.visible = false;
            axeMesh.setActive(true);
            gun.isFiring = false;
            gun.isChopping = true;
            gun.currentTreeId = tree.entityId;

            // Face the tree when stopped. When moving, MovementSystem still
            // owns rotation — axe stays in hand mid-walk, swing snaps on stop.
            if (movement.controller === 'joystick') {
                const kb = this.keyboard ? this.keyboard.getVector() : { x: 0, y: 0 };
                const js = this.joystick ? this.joystick.getVector() : { x: 0, y: 0 };
                const inputMag = Math.hypot(kb.x + js.x, kb.y + js.y);
                if (inputMag <= STOP_THRESHOLD) {
                    const dx = tree.pos.x - transform.mesh.position.x;
                    const dz = tree.pos.z - transform.mesh.position.z;
                    transform.mesh.rotation.y = Math.atan2(dx, dz);
                }
            }

            // Chop cadence — emit damage + animation events when the
            // worker-matched cooldown expires.
            if (gun.chopCooldownLeft <= 0) {
                this._chop(entityId, gun, tree);
                gun.chopCooldownLeft = gun.chopCooldown;
            }
            return false; // reticle off in axe mode
        }

        // ── Idle: no enemies, no nearby trees ────────────────────────────
        gunMesh.visible = true;
        axeMesh.setActive(false);
        gun.isFiring = false;
        gun.isChopping = false;
        return false;
    }

    /**
     * Find the nearest entity tagged "tree" within chopRange. Stones share
     * the "harvestable" tag but NOT "tree", so the player's axe only targets
     * actual trees (per spec).
     */
    _findNearbyTree(shooterTransform, gun, ecs) {
        const shooterPos = shooterTransform.mesh.position;
        let best = null;
        let bestDist = gun.chopRange;

        const candidates = ecs.queryEntities(['Transform', 'Tag', 'Health']);
        for (const id of candidates) {
            const tag = ecs.getComponent(id, 'Tag');
            if (!tag?.has?.('tree')) continue;

            const t = ecs.getComponent(id, 'Transform');
            const dx = t.mesh.position.x - shooterPos.x;
            const dz = t.mesh.position.z - shooterPos.z;
            const dist = Math.hypot(dx, dz);
            if (dist < bestDist) {
                bestDist = dist;
                best = { entityId: id, pos: t.mesh.position };
            }
        }
        return best;
    }

    /**
     * One chop beat — animation + damage. Matches WorkerAISystem._chop:
     *   - emit 'worker:chop:swing' so LungeAnimSystem swings the player's
     *     axe (the inner workerAxe Group is tagged userData.isWorkerAxe)
     *   - emit 'entity:damaged' to reduce tree HP. The existing
     *     HealthSystem → CollectorSystem death chain handles wood drops;
     *     the player's Collector component magnets them in just like the
     *     worker's does.
     */
    _chop(playerId, gun, tree) {
        const hitPos = tree.pos.clone();
        hitPos.y += 0.8; // mid-trunk strike point — matches WorkerAISystem

        EventBus.emit('worker:chop:swing', { workerId: playerId, hitPos });
        EventBus.emit('entity:damaged', { entityId: tree.entityId, damage: gun.chopDamage });
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
        EventBus.emit('audio:cue', { name: 'gunshot' });

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
