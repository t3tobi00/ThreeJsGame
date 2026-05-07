import * as THREE from 'three';

/**
 * CombatVFXSystem — Transient mesh effects for melee strikes.
 *
 * Two effect kinds:
 *   - 'arc'       — a partial-torus slash trail in front of the attacker,
 *                   used by Scout. Cyan, vertical, scales+fades fast.
 *   - 'shockwave' — a flat expanding ring on the ground, used by Bruiser.
 *                   Red/orange, grows from small to wide while fading.
 *
 * Standalone (not ECS-registered). Tick from main.js animate loop.
 * LungeAnimSystem owns the spawn-timing decision and calls into us.
 */
// Spear-throw cycle timings (seconds). Total 0.55s, fits the scout's
// 0.5s cooldown with a small overlap on reset (held spear reappears
// before next throw fires).
const SPEAR_OUTBOUND  = 0.20;
const SPEAR_RETURN    = 0.20;
const SPEAR_RESET     = 0.15;
const SPEAR_TOTAL     = SPEAR_OUTBOUND + SPEAR_RETURN + SPEAR_RESET;

// Bezier-arc lift — the throw curves upward through a mid-point lifted
// this many units above the straight-line midpoint. Read as a thrown
// projectile rather than a laser line.
const SPEAR_ARC_LIFT  = 0.7;

// Iron-chain link material/geometry (shared across all active throws).
const CHAIN_LINK_COUNT = 8;
const _chainLinkGeo = new THREE.TorusGeometry(0.10, 0.028, 6, 12);
const _chainLinkMat = new THREE.MeshStandardMaterial({
    color: 0x4a4a4a,
    metalness: 0.85,
    roughness: 0.35
});
const _LINK_AXIS = new THREE.Vector3(0, 0, 1);   // torus default axis

// ── Magma-breath fire particles ───────────────────────────────────────
// Soft glowing-orb sprite texture, lazy-created on first use. Shared
// across every fire particle ever spawned.
let _fireParticleTexture = null;
function _getFireParticleTexture() {
    if (_fireParticleTexture) return _fireParticleTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.30, 'rgba(255, 240, 180, 0.95)');
    grad.addColorStop(0.70, 'rgba(255, 140,  60, 0.45)');
    grad.addColorStop(1.00, 'rgba(255,  80,   0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    _fireParticleTexture = new THREE.CanvasTexture(canvas);
    _fireParticleTexture.colorSpace = THREE.SRGBColorSpace;
    return _fireParticleTexture;
}

// Tuned for "intense dangerous flamethrower" feel: lots of particles,
// long life so they linger far out, near-zero gravity for flat reach,
// minimal drag so they keep moving, big size variation with chunky
// fireballs in the mix.
const FIRE_PARTICLE_COUNT     = 90;       // particles per breath
const FIRE_PARTICLE_GRAVITY   = 0.4;      // m/s² downward (lower = flatter flight)
const FIRE_PARTICLE_DRAG      = 0.98;     // velocity multiplier per frame (closer to 1 = less slowdown)
const FIRE_LIFETIME_MIN       = 1.00;
const FIRE_LIFETIME_MAX       = 1.50;
const FIRE_PARTICLE_SIZE_MIN  = 0.50;
const FIRE_PARTICLE_SIZE_MAX  = 1.30;

export class CombatVFXSystem {
    constructor(scene) {
        this.scene = scene;
        this._fx = [];
        // Map<scoutId, { state }> — prevents two simultaneous throws on
        // the same scout. Cleared when a throw finishes.
        this._activeThrows = new Map();
        // Pool of in-flight fire particles (sprites). Spawned in batches
        // by spawnMagmaBreath; ticked in update().
        this._fireParticles = [];
    }

    /**
     * Cyan slash arc for Scout — a partial-torus trail oriented vertically
     * in front of the attacker, like a weapon-swing trail. Briefly visible.
     */
    spawnSlashArc({ position, direction, color = 0x44eeff }) {
        const radius = 0.85;
        const tube   = 0.08;
        const geo = new THREE.TorusGeometry(radius, tube, 8, 24, Math.PI * 0.6);
        const mat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.95,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);

        // Make the arc face forward (along `direction`) and open horizontally.
        // Default torus lies in the XY plane (axis along +Z). After lookAt the
        // axis points toward the target; rotate the local Z so the gap (the
        // open side of the partial torus) faces the strike direction.
        const lookTarget = position.clone().add(direction);
        mesh.lookAt(lookTarget);
        mesh.rotateZ(Math.PI / 2);

        this.scene.add(mesh);
        this._fx.push({
            kind: 'arc',
            mesh, geo, mat,
            life: 0.20,
            lifeMax: 0.20,
            startOpacity: 0.95,
            startScale: 0.55,
            endScale:   1.30
        });
    }

    /**
     * Scout spear throw — hides the held spear, spawns a world-space
     * projectile clone that flies straight to the target, then returns
     * to the scout's hand. Cyan tether trails between hand and projectile
     * for the entire flight + return (siphon-beam visual idiom).
     *
     * Called by LungeAnimSystem when ContactDamage fires entity:attacked
     * for a scout. `targetPos` is captured at throw-start (cloned) so the
     * spear flies to where the target was at the moment of release, even
     * if the target dies or moves mid-flight.
     */
    spawnSpearThrow({ scoutId, scoutMesh, targetPos }) {
        if (!scoutMesh || !targetPos) return;
        if (this._activeThrows.has(scoutId)) return;   // prevent overlap

        // Find the held spear under the scout mesh — tagged
        // userData.weaponKind === 'spear' by the character-soldier preset.
        let heldSpear = null;
        scoutMesh.traverse(obj => {
            if (heldSpear) return;
            if (obj.userData?.weaponKind === 'spear') heldSpear = obj;
        });
        if (!heldSpear) return;

        // Capture hand world position + clone the spear into world space.
        // The clone keeps the same geometry/materials (shared via .clone()
        // shallow material reuse) so it visually matches the held weapon.
        const startPos = new THREE.Vector3();
        heldSpear.getWorldPosition(startPos);

        const projectile = heldSpear.clone(true);
        projectile.position.copy(startPos);
        // The held spear sits in elbow-local space with its own orientation.
        // Reset the clone's rotation; we'll orient it along the throw
        // direction each frame.
        projectile.rotation.set(0, 0, 0);
        projectile.scale.set(1, 1, 1);
        this.scene.add(projectile);

        // Hide the held spear for the duration of the throw.
        heldSpear.visible = false;

        // Iron-chain links — N small dark torus rings distributed along the
        // hand→spear path. Geometry + material are module-shared; only
        // per-link Mesh wrappers are per-throw. Even links axis along path,
        // odd links axis perpendicular = chain-interlock read.
        const chainLinks = [];
        for (let i = 0; i < CHAIN_LINK_COUNT; i++) {
            const link = new THREE.Mesh(_chainLinkGeo, _chainLinkMat);
            link.frustumCulled = false;
            this.scene.add(link);
            chainLinks.push(link);
        }

        const targetClone = targetPos.clone();

        const state = {
            scoutId,
            heldSpear,
            projectile,
            chainLinks,
            scoutMesh,
            startPos: startPos.clone(),     // release position (snapshot at throw-start)
            targetPos: targetClone,
            handPosOnReturn: null,           // captured at outbound-end, used as return anchor
            t: 0
        };

        this._activeThrows.set(scoutId, state);
        this._fx.push({ kind: 'spear-throw', state });
    }

    _tickSpearThrow(state, deltaTime) {
        state.t += deltaTime;
        const t = state.t;

        // Always recompute hand position fresh — scout may be moving.
        const handPos = new THREE.Vector3();
        state.heldSpear.getWorldPosition(handPos);

        // Quadratic Bezier arc through a lifted mid-point. Read as a
        // thrown projectile rather than a straight line.
        let spearPos, tangent;
        if (t < SPEAR_OUTBOUND) {
            const u = t / SPEAR_OUTBOUND;
            const start = state.startPos;
            const end   = state.targetPos;
            const mid = start.clone().lerp(end, 0.5);
            mid.y += SPEAR_ARC_LIFT;
            spearPos = _bezierPoint(start, mid, end, u);
            tangent  = _bezierTangent(start, mid, end, u);
        } else if (t < SPEAR_OUTBOUND + SPEAR_RETURN) {
            const u = (t - SPEAR_OUTBOUND) / SPEAR_RETURN;
            const start = state.targetPos;
            const end   = handPos;
            const mid = start.clone().lerp(end, 0.5);
            mid.y += SPEAR_ARC_LIFT;
            spearPos = _bezierPoint(start, mid, end, u);
            tangent  = _bezierTangent(start, mid, end, u);
        } else {
            // Reset phase — hold spear at hand position, then end.
            spearPos = handPos.clone();
            tangent  = null;
        }
        state.projectile.position.copy(spearPos);

        // Orient the spear's local +Y (its tip) along the curve tangent so
        // the tip leads the flight direction.
        if (tangent) {
            const len = tangent.length();
            if (len > 1e-3) {
                tangent.normalize();
                state.projectile.quaternion.setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0),
                    tangent
                );
            }
        }

        // Iron-chain links distributed along the (curved) path from hand
        // to spear. Visible during outbound + return, hidden during reset.
        if (t < SPEAR_OUTBOUND + SPEAR_RETURN) {
            // Bezier from hand to spear (matches whichever phase we're in).
            // For outbound: hand → spear (start is at hand, end is at
            // spearPos). For return: same — chain spans hand to spear.
            const chainStart = handPos;
            const chainEnd   = spearPos;
            const chainMid = chainStart.clone().lerp(chainEnd, 0.5);
            chainMid.y += SPEAR_ARC_LIFT;
            this._updateChain(state.chainLinks, chainStart, chainMid, chainEnd);
        } else {
            for (const link of state.chainLinks) link.visible = false;
        }

        if (t >= SPEAR_TOTAL) {
            // Cleanup: remove projectile + chain links, restore held spear.
            this.scene.remove(state.projectile);
            for (const link of state.chainLinks) this.scene.remove(link);
            // Note: projectile is a clone of the held spear — its geometry
            // and materials are shared with the original, so we must NOT
            // dispose them here. Chain links use module-shared geometry
            // and material, so no per-throw disposal needed either.
            state.heldSpear.visible = true;
            this._activeThrows.delete(state.scoutId);
            return true; // signal removal from _fx
        }
        return false;
    }

    _updateChain(links, start, mid, end) {
        const N = links.length;
        for (let i = 0; i < N; i++) {
            const link = links[i];
            link.visible = true;
            // Distribute links along the curve at evenly-spaced t values.
            const u = (i + 0.5) / N;
            const pos = _bezierPoint(start, mid, end, u);
            link.position.copy(pos);

            // Tangent along curve at this point — alternate links rotate
            // 90° to the previous so they read as interlocking chain rings.
            const tan = _bezierTangent(start, mid, end, u);
            const len = tan.length();
            if (len < 1e-3) continue;
            tan.normalize();

            if (i % 2 === 0) {
                // Even: torus axis along tangent (ring lies perpendicular to path)
                link.quaternion.setFromUnitVectors(_LINK_AXIS, tan);
            } else {
                // Odd: torus axis perpendicular to tangent in the world-up
                // plane (ring lies along path)
                const worldUp = new THREE.Vector3(0, 1, 0);
                let perp = new THREE.Vector3().crossVectors(tan, worldUp);
                if (perp.lengthSq() < 1e-4) perp.set(1, 0, 0);
                perp.normalize();
                link.quaternion.setFromUnitVectors(_LINK_AXIS, perp);
            }
        }
    }

    /**
     * Magma breath for Bruiser — emits a burst of fire-particle sprites
     * from the bruiser's mouth along the forward direction. Each particle
     * has a randomized direction inside the cone, randomized speed, and
     * its own color/scale/opacity timeline so the flame reads as chaotic
     * dynamic fire (not a static cone). Particles are tracked in
     * this._fireParticles and ticked each frame in update().
     */
    spawnMagmaBreath({ position, direction, length = 6, angleDeg = 60 }) {
        const halfAngle = (angleDeg / 2) * Math.PI / 180;

        // Build a local frame: forward + right + up axes.
        const forward = direction.clone().setY(0);
        if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
        forward.normalize();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
        if (right.lengthSq() < 1e-4) right.set(1, 0, 0);
        const localUp = new THREE.Vector3().crossVectors(right, forward).normalize();

        const tex = _getFireParticleTexture();
        // Speed is roughly tuned so the average particle travels ~length
        // units before fading. mean speed * mean lifetime ≈ length.
        const speedMean = length / ((FIRE_LIFETIME_MIN + FIRE_LIFETIME_MAX) / 2);
        const speedSpread = speedMean * 0.4;

        for (let i = 0; i < FIRE_PARTICLE_COUNT; i++) {
            // Random direction inside cone (uniform in solid angle)
            const azimuth = Math.random() * Math.PI * 2;
            const polar   = Math.random() * halfAngle;
            const sinP = Math.sin(polar);
            const cosP = Math.cos(polar);
            const dirVec = new THREE.Vector3()
                .addScaledVector(forward, cosP)
                .addScaledVector(right,   sinP * Math.cos(azimuth))
                .addScaledVector(localUp, sinP * Math.sin(azimuth));

            const speed    = speedMean - speedSpread + Math.random() * (2 * speedSpread);
            const velocity = dirVec.multiplyScalar(speed);
            // Slight upward bias — fire rises naturally
            velocity.y += 0.4 + Math.random() * 0.8;

            const lifetime  = FIRE_LIFETIME_MIN + Math.random() * (FIRE_LIFETIME_MAX - FIRE_LIFETIME_MIN);
            const peakSize  = FIRE_PARTICLE_SIZE_MIN
                            + Math.random() * (FIRE_PARTICLE_SIZE_MAX - FIRE_PARTICLE_SIZE_MIN);

            const mat = new THREE.SpriteMaterial({
                map: tex,
                color: 0xffffaa,
                transparent: true,
                opacity: 0.0,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const sprite = new THREE.Sprite(mat);
            // Tiny random offset around the mouth so particles don't all
            // spawn from the same point (looks more like a billowing source)
            sprite.position.copy(position);
            sprite.position.x += (Math.random() - 0.5) * 0.10;
            sprite.position.y += (Math.random() - 0.5) * 0.10;
            sprite.position.z += (Math.random() - 0.5) * 0.10;
            sprite.scale.setScalar(peakSize * 0.55);
            sprite.renderOrder = 7;
            this.scene.add(sprite);

            this._fireParticles.push({
                sprite,
                mat,
                velocity,
                age: 0,
                lifetime,
                peakSize
            });
        }

        // Ground-fire patches — 3-5 burning ground decals inside the cone.
        // Distance starts at 3u (skipping the bruiser's footprint) and
        // extends to `length`.
        const patchCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < patchCount; i++) {
            const azimuth = (Math.random() - 0.5) * 2 * halfAngle;
            const dist    = 3 + Math.random() * Math.max(1, length - 3);
            const cosA    = Math.cos(azimuth);
            const sinA    = Math.sin(azimuth);
            const patchPos = new THREE.Vector3()
                .copy(position)
                .addScaledVector(forward, cosA * dist)
                .addScaledVector(right,   sinA * dist);
            this.spawnGroundFire(patchPos, 0.65 + Math.random() * 0.45);
        }
    }

    /**
     * Spawn a single small fire ember at `position`. Used by BurningSystem
     * to emit body-rising flames from burning entities. Same particle
     * pool as the magma breath, so it ticks through the same _fireParticles
     * loop with the same color/scale/opacity timeline.
     */
    spawnFireEmber(position) {
        const tex = _getFireParticleTexture();
        const lifetime = 0.55 + Math.random() * 0.30;
        const peakSize = 0.20 + Math.random() * 0.20;   // smaller than breath particles

        const mat = new THREE.SpriteMaterial({
            map: tex,
            color: 0xffffaa,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(mat);
        sprite.position.copy(position);
        sprite.scale.setScalar(peakSize * 0.55);
        sprite.renderOrder = 7;
        this.scene.add(sprite);

        // Mostly upward velocity with small lateral wobble
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.7,
            1.2 + Math.random() * 1.4,
            (Math.random() - 0.5) * 0.7
        );

        this._fireParticles.push({
            sprite, mat, velocity,
            age: 0, lifetime, peakSize
        });
    }

    /**
     * Spawn a flat ground-fire patch at `position` (y forced to ground
     * level). Reads as scorched/burning ground where the magma breath
     * landed. Lives ~1.8-2.6s, flickers, fades out.
     */
    spawnGroundFire(position, radius = 0.8) {
        const geo = new THREE.RingGeometry(radius * 0.35, radius, 18);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xff6622,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(position.x, 0.05, position.z);
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 5;
        this.scene.add(mesh);

        const lifetime = 1.8 + Math.random() * 0.8;
        this._fx.push({
            kind: 'ground-fire',
            mesh, geo, mat,
            life: lifetime,
            lifeMax: lifetime,
            startScale: 0.55,
            endScale:   1.20
        });
    }

    _tickFireParticles(deltaTime) {
        if (this._fireParticles.length === 0) return;
        // Scale the per-frame drag to the current frame so framerate
        // changes don't change the deceleration shape.
        const dragPerSec = Math.pow(FIRE_PARTICLE_DRAG, 60);   // 60fps reference
        const dragThisFrame = Math.pow(dragPerSec, deltaTime);

        for (let i = this._fireParticles.length - 1; i >= 0; i--) {
            const p = this._fireParticles[i];
            p.age += deltaTime;
            const t = p.age / p.lifetime;

            if (t >= 1.0) {
                this.scene.remove(p.sprite);
                p.mat.dispose();
                this._fireParticles.splice(i, 1);
                continue;
            }

            // Velocity: gravity + drag, then integrate position
            p.velocity.y -= FIRE_PARTICLE_GRAVITY * deltaTime;
            p.velocity.multiplyScalar(dragThisFrame);
            p.sprite.position.addScaledVector(p.velocity, deltaTime);

            // Color phases: yellow-white → orange → dark red
            let r, g, b;
            if (t < 0.30) {
                const u = t / 0.30;
                // 0xffffaa (1.00, 1.00, 0.667) → 0xff8833 (1.00, 0.53, 0.20)
                r = 1.00;
                g = 1.00 + (0.53 - 1.00) * u;
                b = 0.667 + (0.20 - 0.667) * u;
            } else if (t < 0.70) {
                const u = (t - 0.30) / 0.40;
                // 0xff8833 (1.00, 0.53, 0.20) → 0x661100 (0.40, 0.07, 0.0)
                r = 1.00 + (0.40 - 1.00) * u;
                g = 0.53 + (0.07 - 0.53) * u;
                b = 0.20 + (0.00 - 0.20) * u;
            } else {
                // 0x661100 → near-black at end
                const u = (t - 0.70) / 0.30;
                r = 0.40 + (0.10 - 0.40) * u;
                g = 0.07 + (0.02 - 0.07) * u;
                b = 0;
            }
            p.mat.color.setRGB(r, g, b);

            // Opacity: ramp up fast (0..0.10), hold (0.10..0.65), fade out
            let opacity;
            if (t < 0.10)      opacity = t / 0.10;
            else if (t < 0.65) opacity = 1.0;
            else               opacity = 1.0 - (t - 0.65) / 0.35;
            p.mat.opacity = opacity;

            // Scale: grow fast (0..0.20), hold (0.20..0.55), shrink (0.55..1)
            let scaleMul;
            if (t < 0.20)      scaleMul = 0.55 + (1.00 - 0.55) * (t / 0.20);
            else if (t < 0.55) scaleMul = 1.0;
            else               scaleMul = 1.0 - 0.85 * ((t - 0.55) / 0.45);
            p.sprite.scale.setScalar(p.peakSize * scaleMul);
        }
    }

    /**
     * Spectral hawk silhouette for Bruiser — a translucent angular hawk
     * shape that flashes along the swing arc at the strike peak. Reads as
     * the "bird-of-prey" flourish on top of the sword cleave. Lives for
     * ~0.20s, scales up + fades out.
     *
     * The shape lies in a vertical plane facing perpendicular to the swing
     * direction (so the hawk silhouette reads as a side profile from the
     * camera's typical isometric angle).
     */
    spawnSpectralHawk({ position, direction, color = 0xff4444 }) {
        const shape = new THREE.Shape();
        // Stylized angular hawk (head pointing +Y, wings spread +/-X).
        // Tail at bottom, body up the middle, two back-swept wings.
        shape.moveTo(0.00,  0.00);
        shape.lineTo(-0.18, 0.05);   // tail-left flare
        shape.lineTo(-0.55, 0.32);   // body-left waist
        shape.lineTo(-1.40, 0.55);   // left wing tip (back-swept)
        shape.lineTo(-1.05, 0.72);   // wing notch
        shape.lineTo(-0.35, 0.58);   // shoulder-left
        shape.lineTo(-0.18, 0.95);   // neck-left
        shape.lineTo(0.00,  1.20);   // head tip
        shape.lineTo(0.18,  0.95);   // neck-right
        shape.lineTo(0.35,  0.58);   // shoulder-right
        shape.lineTo(1.05,  0.72);   // wing notch
        shape.lineTo(1.40,  0.55);   // right wing tip
        shape.lineTo(0.55,  0.32);   // body-right waist
        shape.lineTo(0.18,  0.05);   // tail-right flare
        shape.lineTo(0.00,  0.00);

        const geo = new THREE.ShapeGeometry(shape);
        const mat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);

        // Orient the hawk so its body axis (+Y in shape-local space) points
        // along the swing direction, and its wing-plane (XY in shape-local
        // space) faces upward — the hawk looks like it's flying along the
        // direction of attack.
        const fwd = direction.clone().setY(0).normalize();
        const yaw = Math.atan2(fwd.x, fwd.z);
        // Rotate the shape so its local +Y aligns with world +Z (so the
        // hawk's body points "north" in shape-space), then yaw to attack
        // direction. Tilt slightly forward so it isn't a flat decal.
        mesh.rotation.set(-Math.PI / 2, 0, 0);
        mesh.rotateZ(-yaw + Math.PI);
        mesh.rotateX(-0.35);
        mesh.renderOrder = 6;

        this.scene.add(mesh);
        this._fx.push({
            kind: 'hawk',
            mesh, geo, mat,
            life: 0.22,
            lifeMax: 0.22,
            startOpacity: 0.85,
            startScale: 0.65,
            endScale:   1.55
        });
    }

    /**
     * Red ground shockwave for Bruiser — a flat ring that expands rapidly
     * outward from the impact point on the ground plane.
     */
    spawnShockwave({ position, color = 0xff5522 }) {
        const innerR = 0.85;
        const outerR = 1.0;
        const geo = new THREE.RingGeometry(innerR, outerR, 36);
        const mat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.90,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(position.x, 0.04, position.z);
        mesh.rotation.x = -Math.PI / 2;          // lie flat
        mesh.scale.setScalar(0.5);

        this.scene.add(mesh);
        this._fx.push({
            kind: 'shockwave',
            mesh, geo, mat,
            life: 0.40,
            lifeMax: 0.40,
            startOpacity: 0.90,
            startScale: 0.5,
            endScale:   2.8
        });
    }

    update(deltaTime) {
        for (let i = this._fx.length - 1; i >= 0; i--) {
            const f = this._fx[i];

            // Spear-throw is its own state machine — handle separately.
            if (f.kind === 'spear-throw') {
                const finished = this._tickSpearThrow(f.state, deltaTime);
                if (finished) this._fx.splice(i, 1);
                continue;
            }

            f.life -= deltaTime;
            if (f.life <= 0) {
                this.scene.remove(f.mesh);
                f.geo.dispose();
                f.mat.dispose();
                this._fx.splice(i, 1);
                continue;
            }

            const t = 1 - (f.life / f.lifeMax);   // 0 → 1 over lifetime

            if (f.kind === 'ground-fire') {
                // Ground patch: ramp in, hold with flicker, fade out.
                const scale = f.startScale + (f.endScale - f.startScale) * t;
                f.mesh.scale.setScalar(scale);
                let opacity;
                if (t < 0.12) {
                    opacity = (t / 0.12) * 0.85;
                } else if (t < 0.75) {
                    // Flicker via sin oscillation, two slightly out-of-phase
                    opacity = 0.55 + 0.25 * Math.sin(t * 28) + 0.10 * Math.sin(t * 11.5);
                } else {
                    opacity = 0.85 * (1 - (t - 0.75) / 0.25);
                }
                f.mat.opacity = Math.max(0, opacity);
                continue;
            }

            const scale = f.startScale + (f.endScale - f.startScale) * t;
            f.mesh.scale.setScalar(scale);
            // Slash arc + hawk: ease-out fade. Shockwave: linear fade.
            const fade = (f.kind === 'arc' || f.kind === 'hawk') ? (1 - t * t) : (1 - t);
            f.mat.opacity = f.startOpacity * fade;
        }

        // Fire particles (magma breath) — separate per-particle simulation.
        this._tickFireParticles(deltaTime);
    }
}

// ── Quadratic Bezier helpers (shared by spear-throw + chain links) ────
// B(u)  = (1-u)²·P0 + 2(1-u)u·P1 + u²·P2
// B'(u) = 2(1-u)·(P1 - P0) + 2u·(P2 - P1)
function _bezierPoint(p0, p1, p2, u) {
    const v = 1 - u;
    return new THREE.Vector3()
        .addScaledVector(p0, v * v)
        .addScaledVector(p1, 2 * v * u)
        .addScaledVector(p2, u * u);
}

function _bezierTangent(p0, p1, p2, u) {
    const v = 1 - u;
    return new THREE.Vector3()
        .addScaledVector(p1.clone().sub(p0), 2 * v)
        .addScaledVector(p2.clone().sub(p1), 2 * u);
}
