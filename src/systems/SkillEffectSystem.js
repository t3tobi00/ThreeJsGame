import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import SkillRegistry from '../core/SkillRegistry.js';

/**
 * SkillEffectSystem — Spawns short-lived visual effects per skill use.
 *
 * Instead of animating physical arm meshes on the character, this system
 * creates effect objects that appear around the character at the moment
 * of using a skill — a bow visual during bow windup, a muzzle flash when
 * a gun fires, a slash arc for melee, etc.
 *
 * This is a NON-ECS system: it doesn't query entities. It subscribes to
 * skill events and keeps its own list of active effects. Call update(dt)
 * manually from the game's animate loop (like ParticleSystem).
 *
 * Effect definitions live in each skill's JSON under the "effect" field:
 *
 *   "effect": { "type": "bow_draw", "color": "0x8b4513" }
 *   "effect": { "type": "gun_flash", "color": "0xffee88" }
 *
 * Supported types (Phase 3):
 *   - "gun_flash"  — bright cone at muzzle, fires on skill:fired
 *   - "bow_draw"   — curved bow visual during skill:windup_start, auto-expires on fire
 *
 * Later phases will add: melee_slash, mine_impact, fireball_charge, etc.
 */
export class SkillEffectSystem {
    constructor(scene) {
        this.scene = scene;
        this._ecs = null;
        this._active = []; // { anchor, elapsed, duration, follow, tick, onEnd? }

        EventBus.on('skill:windup_start', (e) => this._onWindupStart(e));
        EventBus.on('skill:fired',        (e) => this._onFired(e));
        EventBus.on('skill:melee_swing',  (e) => this._onMeleeSwing(e));
        EventBus.on('effect:hit_spark',   (e) => this._spawnHitSpark(e));
        // Per-hit chop effect — any weapon can trigger this when striking a
        // harvestable (so swords get the woodsy crunch on trees even though
        // their swing animation is the cyan slash arc).
        EventBus.on('effect:mine_chop',   (e) => {
            const impactColor = 0xfff2b3;
            const dustColor   = 0x8b6b3a;
            this._spawnChopAt(e.position, impactColor, dustColor, 2.2, 0.1, 1.0);
        });
    }

    setECS(ecs) { this._ecs = ecs; }

    /** Call from main.js animate loop, outside ecs.update(). */
    update(deltaTime) {
        for (let i = this._active.length - 1; i >= 0; i--) {
            const fx = this._active[i];
            fx.elapsed += deltaTime;

            // Follow mode: keep anchor glued to a moving entity
            if (fx.follow != null && this._ecs) {
                const t = this._ecs.getComponent(fx.follow, 'Transform');
                if (t) fx.anchor.position.copy(t.mesh.position).add(fx.followOffset);
            }

            // Tick per-effect logic (scale, fade, rotate, etc.)
            if (fx.tick) fx.tick(deltaTime, fx.elapsed, fx.duration);

            if (fx.elapsed >= fx.duration) {
                if (fx.onEnd) fx.onEnd();
                this.scene.remove(fx.anchor);
                this._disposeAnchor(fx.anchor);
                this._active.splice(i, 1);
            }
        }
    }

    _disposeAnchor(anchor) {
        anchor.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
    }

    // ── Event handlers ─────────────────────────────────────────────

    _onWindupStart({ entityId, skillId, duration, origin, target }) {
        const skill = this._lookupSkill(skillId);
        if (!skill || !skill.effect) return;

        if (skill.effect.type === 'bow_draw') {
            this._spawnBowDraw(entityId, duration, origin, target, skill.effect);
        }
    }

    _onFired({ entityId, skillId, origin, target, animation }) {
        const skill = this._lookupSkill(skillId);
        if (!skill || !skill.effect) return;

        if (skill.effect.type === 'gun_flash') {
            this._spawnGunFlash(origin, target, skill.effect);
        }
        // Note: bow_draw spawns on windup_start and expires on its own.
        // Melee slash arcs spawn from 'skill:melee_swing' for richer info
        // (direction, isFinisher, hitCount).
    }

    _onMeleeSwing({ entityId, skillId, origin, direction, isFinisher, hitCount, hitPositions }) {
        const skill = this._lookupSkill(skillId);
        if (!skill || !skill.effect) return;

        // The effect type can be specified per skill, OR the skill declares
        // a finisher override in skill.effect.finisher.type.
        const baseType = skill.effect.type;
        const finisherType = skill.effect.finisher?.type;

        if (isFinisher && finisherType) {
            this._spawnSlashArc(origin, direction, skill.effect.finisher, true);
        } else if (baseType === 'slash_arc') {
            this._spawnSlashArc(origin, direction, skill.effect, false);
        } else if (baseType === 'mine_chop') {
            this._spawnMineChop(origin, direction, skill.effect, hitPositions || []);
        }
    }

    _lookupSkill(skillId) {
        try { return SkillRegistry.getSkill(skillId); }
        catch (e) { return null; }
    }

    // ── Effect builders ────────────────────────────────────────────

    /**
     * Bow draw effect — a curved bow + drawn string visual that appears
     * in front of the character during windup. Scales in, holds, then
     * expires with the windup.
     */
    _spawnBowDraw(entityId, duration, origin, target, cfg) {
        const color = this._parseColor(cfg.color, 0x8b4513);

        const anchor = new THREE.Group();

        // Position in front of character at chest height
        const chestY = 1.0;
        const forwardOffset = 0.4;

        // Direction from shooter toward target (flattened to XZ for facing)
        const dir = new THREE.Vector3().subVectors(target, origin);
        dir.y = 0;
        if (dir.lengthSq() < 0.0001) dir.set(0, 0, 1); else dir.normalize();

        // Rotate the anchor so its +Z axis points at the target
        const yaw = Math.atan2(dir.x, dir.z);
        anchor.rotation.y = yaw;

        // Initial position (origin - y + chest + forward push)
        anchor.position.copy(origin);
        anchor.position.y = chestY;
        anchor.position.x += dir.x * forwardOffset;
        anchor.position.z += dir.z * forwardOffset;

        // Bow curve — a partial torus held vertically (the bow arc)
        const bowRadius = 0.4;
        const bowThickness = 0.04;
        const bowArc = Math.PI * 1.1; // a bit more than half
        const bowGeo = new THREE.TorusGeometry(bowRadius, bowThickness, 8, 24, bowArc);
        const bowMat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.5,
            roughness: 0.6
        });
        const bow = new THREE.Mesh(bowGeo, bowMat);
        // Torus lies in XY plane by default; rotate so its arc opens toward the target
        // and the curve stands vertical in front of the character.
        bow.rotation.x = Math.PI / 2;      // lay flat in XZ plane? no — we want vertical
        // Actually we want the torus arc to form a bow shape standing upright in front
        // of the character. Default torus is in XY plane (ring around +Z). Rotate it:
        bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
        // Shift so the arc opens toward the shooter (string side toward character)
        bow.position.x = 0;
        anchor.add(bow);

        // String — thin cylinder from bow top to bow bottom, pulled back slightly
        const stringGeo = new THREE.CylinderGeometry(0.008, 0.008, bowRadius * 1.6, 4);
        const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const str = new THREE.Mesh(stringGeo, stringMat);
        // Pull the string toward the archer (-Z relative to anchor facing)
        str.position.z = -0.08;
        anchor.add(str);

        // Nock point — small white dot where the arrow is drawn
        const nockGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const nockMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const nock = new THREE.Mesh(nockGeo, nockMat);
        nock.position.z = -0.12;
        anchor.add(nock);

        this.scene.add(anchor);

        // Keep bow glued to the archer while they wind up
        const followOffset = new THREE.Vector3(
            dir.x * forwardOffset,
            chestY,
            dir.z * forwardOffset
        );

        this._active.push({
            anchor,
            follow: entityId,
            followOffset,
            elapsed: 0,
            duration: Math.max(duration, 0.1),
            tick: (dt, elapsed, dur) => {
                // Scale in over first 30% of windup, hold until the end
                const t = Math.min(elapsed / (dur * 0.3), 1);
                anchor.scale.setScalar(0.6 + 0.4 * t);
                // Fade the string slightly to suggest tension release near the end
                if (elapsed > dur * 0.85) {
                    const k = 1 - (elapsed - dur * 0.85) / (dur * 0.15);
                    stringMat.opacity = Math.max(k, 0);
                    stringMat.transparent = true;
                }
            }
        });
    }

    /**
     * Gun flash effect — a short, bright cone pointing along the shot
     * direction. Fades out in ~0.12s.
     */
    _spawnGunFlash(origin, target, cfg) {
        const color = this._parseColor(cfg.color, 0xffee66);

        const dir = new THREE.Vector3().subVectors(target, origin);
        if (dir.lengthSq() < 0.0001) return;
        dir.normalize();

        const anchor = new THREE.Group();
        // Position just in front of shooter at the muzzle point
        const muzzleForward = 0.5;
        anchor.position.copy(origin).add(dir.clone().multiplyScalar(muzzleForward));

        // Cone — apex pointing along the shot direction
        const coneGeo = new THREE.ConeGeometry(0.18, 0.45, 10);
        const coneMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 1.0
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);

        // Rotate cone so its apex (+Y default) aligns with dir
        const quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), dir
        );
        cone.quaternion.copy(quat);
        anchor.add(cone);

        // Outer glow sphere for extra pop
        const glowGeo = new THREE.SphereGeometry(0.22, 8, 6);
        const glowMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.6
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        anchor.add(glow);

        this.scene.add(anchor);

        const duration = cfg.duration || 0.12;
        this._active.push({
            anchor,
            elapsed: 0,
            duration,
            tick: (dt, elapsed, dur) => {
                const t = elapsed / dur;
                anchor.scale.setScalar(1 + t * 0.6);
                coneMat.opacity = 1 - t;
                glowMat.opacity = 0.6 * (1 - t);
            }
        });
    }

    // ── Melee: slash arc ───────────────────────────────────────────

    /**
     * Slash arc effect — a curved ring-segment that sweeps in front of the
     * character along the given direction. Normal swings use a lighter
     * white/cyan arc; finishers use a fatter red/orange arc with a shockwave
     * disk underneath for weight.
     */
    _spawnSlashArc(origin, direction, cfg, isFinisher) {
        const color = this._parseColor(cfg.color, isFinisher ? 0xff5522 : 0xffffff);
        const scale = cfg.scale != null ? cfg.scale : (isFinisher ? 1.5 : 1.0);
        const duration = cfg.duration || (isFinisher ? 0.28 : 0.18);
        const radius = (cfg.radius || 1.3) * scale;
        const thickness = (cfg.thickness || 0.12) * scale;
        const arcSpan = THREE.MathUtils.degToRad(cfg.arcDeg || 140);

        const anchor = new THREE.Group();
        anchor.position.copy(origin);
        anchor.position.y += 1.0; // chest height
        const yaw = Math.atan2(direction.x, direction.z);
        anchor.rotation.y = yaw;

        // Main arc — torus partial segment, laid flat in XZ plane
        const arcGeo = new THREE.TorusGeometry(radius, thickness, 8, 32, arcSpan);
        arcGeo.rotateX(Math.PI / 2); // lay flat
        // Torus sweeps counter-clockwise from angle 0. Rotate so the arc is
        // centered on +Z (the character's facing direction).
        arcGeo.rotateY(-arcSpan / 2 + Math.PI / 2);

        const arcMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide
        });
        const arc = new THREE.Mesh(arcGeo, arcMat);
        anchor.add(arc);

        // Inner bright ribbon for extra brightness
        const innerGeo = new THREE.TorusGeometry(radius, thickness * 0.35, 6, 24, arcSpan);
        innerGeo.rotateX(Math.PI / 2);
        innerGeo.rotateY(-arcSpan / 2 + Math.PI / 2);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0
        });
        const innerArc = new THREE.Mesh(innerGeo, innerMat);
        anchor.add(innerArc);

        // Finisher shockwave — ground disk expanding outward
        let shockMat = null;
        if (isFinisher) {
            const shockGeo = new THREE.RingGeometry(0.2, 0.35, 24);
            shockMat = new THREE.MeshBasicMaterial({
                color: 0xffcc33,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            const shock = new THREE.Mesh(shockGeo, shockMat);
            shock.rotation.x = -Math.PI / 2;
            shock.position.y = -0.95; // sit on the ground
            anchor.add(shock);
            anchor.userData.shock = shock;
        }

        this.scene.add(anchor);

        const sweepStart = THREE.MathUtils.degToRad(isFinisher ? 40 : 25);
        const sweepEnd   = THREE.MathUtils.degToRad(isFinisher ? -40 : -25);

        this._active.push({
            anchor,
            elapsed: 0,
            duration,
            tick: (dt, elapsed, dur) => {
                const t = elapsed / dur;

                // Scale in fast, hold briefly, fade out
                const scalePhase = t < 0.25 ? (t / 0.25) : (t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1);
                anchor.scale.setScalar(scalePhase * scale);

                // Sweep rotation (around local Y = facing axis)
                arc.rotation.y      = sweepStart + (sweepEnd - sweepStart) * t;
                innerArc.rotation.y = arc.rotation.y;

                // Opacity fade
                const opacity = t < 0.15 ? (t / 0.15) : 1 - (t - 0.15) / 0.85;
                arcMat.opacity   = Math.max(0, opacity * 0.95);
                innerMat.opacity = Math.max(0, opacity * 1.0);

                // Shockwave: expand + fade
                if (shockMat) {
                    const s = 1 + t * 3.5;
                    anchor.userData.shock.scale.set(s, s, s);
                    shockMat.opacity = 0.9 * (1 - t);
                }
            }
        });
    }

    // ── Harvest: downward chop + dust puff ─────────────────────────

    /**
     * Mine chop effect — for each hit node (tree, rock), spawns a vertical
     * impact bar that snaps down onto the target plus a ground-level dust
     * puff (expanding ring + particles). Reads effect color config for
     * theming (wood vs stone).
     *
     * When the swing misses everything (hitPositions empty), spawns a small
     * chop in front of the player at range so the swing still feels
     * responsive.
     */
    _spawnMineChop(origin, direction, cfg, hitPositions) {
        const impactColor = this._parseColor(cfg.impactColor || cfg.color, 0xfff2b3);
        const dustColor   = this._parseColor(cfg.dustColor || cfg.sparkColor, 0x8b6b3a);
        const barHeight   = cfg.barHeight || 2.2;
        const barRadius   = cfg.barRadius || 0.10;

        if (hitPositions.length === 0) {
            // Whiff — still give the player feedback in front of them
            const whiffPos = origin.clone();
            whiffPos.x += direction.x * 1.5;
            whiffPos.z += direction.z * 1.5;
            whiffPos.y = 0;
            this._spawnChopAt(whiffPos, impactColor, dustColor, barHeight, barRadius, 0.5);
            return;
        }

        for (const pos of hitPositions) {
            this._spawnChopAt(pos, impactColor, dustColor, barHeight, barRadius, 1.0);
        }
    }

    /**
     * Single chop instance: impact bar + ring + dust particles.
     */
    _spawnChopAt(pos, impactColor, dustColor, barHeight, barRadius, intensity) {
        const anchor = new THREE.Group();
        anchor.position.copy(pos);
        anchor.position.y = 0;

        // ── Vertical impact bar — snaps down over 0.06s, then fades out ──
        const barGeo = new THREE.CylinderGeometry(barRadius, barRadius, barHeight, 8);
        const barMat = new THREE.MeshBasicMaterial({
            color: impactColor,
            transparent: true,
            opacity: 1.0
        });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.y = barHeight / 2 + 3.0; // start high above
        anchor.add(bar);

        // ── Inner bright core — slightly thinner, pure white ──
        const coreGeo = new THREE.CylinderGeometry(barRadius * 0.4, barRadius * 0.4, barHeight, 6);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = barHeight / 2 + 3.0;
        anchor.add(core);

        // ── Expanding ground ring at target base (dust shockwave) ──
        const ringGeo = new THREE.RingGeometry(0.15, 0.30, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: dustColor,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        anchor.add(ring);

        // ── Dust particles — small spheres bursting outward along ground ──
        const particleCount = Math.round(12 * intensity);
        const particles = [];
        const dustMat = new THREE.MeshBasicMaterial({
            color: dustColor,
            transparent: true,
            opacity: 0.95
        });
        for (let i = 0; i < particleCount; i++) {
            const geo = new THREE.SphereGeometry(0.07 + Math.random() * 0.06, 4, 4);
            const p = new THREE.Mesh(geo, dustMat);

            // Random horizontal direction, slight upward kick
            const theta = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 2;
            const upSpeed = 1.5 + Math.random() * 1.5;
            p.userData.velocity = new THREE.Vector3(
                Math.cos(theta) * speed,
                upSpeed,
                Math.sin(theta) * speed
            );
            p.position.y = 0.1 + Math.random() * 0.1;
            anchor.add(p);
            particles.push(p);
        }

        this.scene.add(anchor);

        const duration = 0.55;
        this._active.push({
            anchor,
            elapsed: 0,
            duration,
            tick: (dt, elapsed, dur) => {
                const t = elapsed / dur;

                // Impact bar: first 0.08s = snap down (lerp y from +3 → 0),
                // then fade/shrink over the rest
                if (elapsed < 0.08) {
                    const k = elapsed / 0.08;
                    const y0 = barHeight / 2 + 3.0;
                    const y1 = barHeight / 2;
                    bar.position.y  = y0 + (y1 - y0) * k;
                    core.position.y = bar.position.y;
                } else {
                    const k = (elapsed - 0.08) / (dur - 0.08);
                    barMat.opacity  = Math.max(0, 1 - k * 1.5);
                    coreMat.opacity = Math.max(0, 1 - k * 1.3);
                    const s = 1 + k * 0.3;
                    bar.scale.set(s, 1, s);
                }

                // Ring: expand + fade
                const ringScale = 1 + t * 6;
                ring.scale.set(ringScale, ringScale, ringScale);
                ringMat.opacity = 0.85 * (1 - t);

                // Particles: integrate with gravity, fade
                const gravity = 9;
                for (const p of particles) {
                    p.position.addScaledVector(p.userData.velocity, dt);
                    p.userData.velocity.y -= gravity * dt;
                    if (p.position.y < 0.02) {
                        p.position.y = 0.02;
                        p.userData.velocity.y = 0;
                        p.userData.velocity.x *= 0.6;
                        p.userData.velocity.z *= 0.6;
                    }
                    p.scale.setScalar(1 - t * 0.5);
                }
                dustMat.opacity = 0.95 * (1 - t);
            }
        });
    }

    // ── Hit sparks ─────────────────────────────────────────────────

    /**
     * Hit spark — small burst of bright particles at the impact point.
     * Cheap, spawned one per enemy per swing. Finisher variant is bigger
     * and hotter-colored.
     */
    _spawnHitSpark({ position, isFinisher, color }) {
        const particleCount = isFinisher ? 10 : 6;
        // Allow per-event color override (e.g. brown dust for mining, yellow
        // sparks for combat). Falls back to the finisher/default palette.
        const baseColor = (color != null)
            ? this._parseColor(color, 0xffffaa)
            : (isFinisher ? 0xffaa22 : 0xffffaa);
        const speed = isFinisher ? 5 : 3;
        const duration = isFinisher ? 0.35 : 0.22;

        const anchor = new THREE.Group();
        anchor.position.copy(position);
        this.scene.add(anchor);

        const particles = [];
        const mat = new THREE.MeshBasicMaterial({
            color: baseColor,
            transparent: true,
            opacity: 1.0
        });

        for (let i = 0; i < particleCount; i++) {
            const geo = new THREE.SphereGeometry(0.08, 4, 4);
            const p = new THREE.Mesh(geo, mat);

            // Random direction on a sphere, biased upward slightly
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(1 - Math.random() * 1.4);
            const dir = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta),
                Math.cos(phi),
                Math.sin(phi) * Math.sin(theta)
            );
            const v = dir.multiplyScalar(speed * (0.6 + Math.random() * 0.6));
            p.userData.velocity = v;
            anchor.add(p);
            particles.push(p);
        }

        this._active.push({
            anchor,
            elapsed: 0,
            duration,
            tick: (dt, elapsed, dur) => {
                const t = elapsed / dur;
                mat.opacity = 1 - t;
                for (const p of particles) {
                    p.position.addScaledVector(p.userData.velocity, dt);
                    // Gravity pull
                    p.userData.velocity.y -= 9 * dt;
                    p.scale.setScalar(1 - t * 0.6);
                }
            }
        });
    }

    // ── Utils ──────────────────────────────────────────────────────

    _parseColor(raw, fallback) {
        if (typeof raw === 'string') return parseInt(raw.replace('0x', ''), 16);
        if (typeof raw === 'number') return raw;
        return fallback;
    }
}
