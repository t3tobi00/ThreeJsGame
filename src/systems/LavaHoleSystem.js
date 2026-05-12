import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * LavaHoleSystem — animates the cemetery / zombie-spawn lava holes.
 *
 * Each entity tagged `zombie-spawn` whose mesh is a `lava-hole` MeshPreset
 * gets:
 *   • Sinusoidal brightness pulse on its lava core + mid layers (color lerp
 *     between dim-orange and bright-yellow), so the hole "breathes".
 *   • Slow opacity oscillation on the heat-haze cap above the bowl.
 *   • A trickle of ember particles rising from the bowl every 0.4–0.8s.
 *   • A flash + ember burst whenever a zombie emerges from this spawn point
 *     (driven by the `spawn:emerged` event from EnemySystem).
 *
 * Non-ECS: registered in main.js and ticked from the animate loop. Cheap
 * enough to run unconditionally — 4 spawn points × ~5 mesh tweaks per frame.
 */
export class LavaHoleSystem {
    constructor(scene, particleSystem, ecs) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.ecs = ecs;

        this._t = 0;
        // Per-spawn-point timer state, keyed by entity id.
        // { nextEmberAt:number, flashLeft:number }
        this._state = new Map();

        // EnemySystem fires this when a zombie emerges; the {entityId} payload
        // is the spawn-point's entity id (NOT the new zombie's id).
        EventBus.on('spawn:emerged', ({ spawnPointId } = {}) => {
            if (spawnPointId == null) return;
            this._triggerFlash(spawnPointId);
        });
    }

    update(deltaTime) {
        this._t += deltaTime;
        if (!this.ecs) return;

        // Discover all lava-hole spawn points — cheap; called each frame
        // because spawn points are static and rare (4-6 per level).
        const ids = this.ecs.queryEntities(['Transform', 'Tag']);
        for (const id of ids) {
            const tag = this.ecs.getComponent(id, 'Tag');
            if (!tag || !tag.tags.includes('zombie-spawn')) continue;
            const tr = this.ecs.getComponent(id, 'Transform');
            if (!tr?.mesh?.userData?.isLavaHole) continue;
            // Skip hidden cemeteries (locked input #2 — visuals removed,
            // spawn logic preserved). Saves per-frame work + prevents
            // ember bursts from invisible holes.
            if (!tr.mesh.visible) continue;
            this._tickHole(id, tr.mesh, deltaTime);
        }
    }

    _tickHole(id, mesh, dt) {
        let st = this._state.get(id);
        if (!st) {
            st = { nextEmberAt: this._t + 0.2 + Math.random() * 0.4, flashLeft: 0 };
            this._state.set(id, st);
        }

        // ── Lava brightness pulse ────────────────────────────────────────
        // Sinusoidal mix between a dim and bright orange. Each layer gets
        // a slightly different phase so the gradient feels alive, not
        // synchronized.
        const basePulse = (Math.sin(this._t * 1.8) + 1) * 0.5;          // 0..1
        const offsetPulse = (Math.sin(this._t * 1.8 + 0.7) + 1) * 0.5;  // 0..1

        // Flash overlay — when a zombie emerges we ramp this from 1 → 0
        // over 0.5s on top of the pulse, giving a clear visual "pop".
        if (st.flashLeft > 0) st.flashLeft = Math.max(0, st.flashLeft - dt);
        const flash = st.flashLeft > 0 ? (st.flashLeft / 0.5) : 0;

        const core = mesh.userData.lavaCore;
        const mid  = mesh.userData.lavaMid;
        const haze = mesh.userData.haze;

        if (core) {
            // Core: warm yellow-orange (0xffc750) ↔ near-white-yellow (0xffe8a0)
            // Lerp brightness via simple per-channel math; flash kicks it
            // toward a bright pale yellow.
            const dim = { r: 0xff, g: 0xa8, b: 0x40 };
            const bright = { r: 0xff, g: 0xe8, b: 0xa0 };
            const flashTint = { r: 0xff, g: 0xff, b: 0xe0 };
            const t = basePulse * 0.6 + 0.25;            // baseline 0.25–0.85
            const r = lerp(dim.r, bright.r, t);
            const g = lerp(dim.g, bright.g, t);
            const b = lerp(dim.b, bright.b, t);
            core.material.color.setRGB(
                lerp(r, flashTint.r, flash) / 255,
                lerp(g, flashTint.g, flash) / 255,
                lerp(b, flashTint.b, flash) / 255
            );
        }
        if (mid) {
            const dim = { r: 0xc8, g: 0x4a, b: 0x18 };
            const bright = { r: 0xff, g: 0x80, b: 0x28 };
            const t = offsetPulse * 0.7 + 0.2;
            mid.material.color.setRGB(
                lerp(dim.r, bright.r, t) / 255,
                lerp(dim.g, bright.g, t) / 255,
                lerp(dim.b, bright.b, t) / 255
            );
        }
        if (haze && haze.material) {
            // Slow opacity wave + flash bump.
            const baseOp = 0.10 + 0.06 * basePulse;
            haze.material.opacity = Math.min(0.5, baseOp + flash * 0.25);
            // Heat-shimmer subtle scale wobble.
            const s = 1 + 0.05 * Math.sin(this._t * 2.2);
            haze.scale.set(s, s, s);
        }

        // ── Ember trickle ────────────────────────────────────────────────
        if (this._t >= st.nextEmberAt) {
            st.nextEmberAt = this._t + 0.4 + Math.random() * 0.45;
            if (this.particleSystem) {
                const wp = mesh.position.clone();
                wp.y += 0.10;
                // Nudge ember origin off-center for variety.
                wp.x += (Math.random() - 0.5) * 0.7;
                wp.z += (Math.random() - 0.5) * 0.7;
                // Reuse the existing impact-burst helper — count 3 keeps
                // the trickle subtle so it doesn't compete with combat VFX.
                this.particleSystem.createImpactBurst(wp, 0xff8822, 3);
            }
        }
    }

    _triggerFlash(spawnPointId) {
        const tr = this.ecs?.getComponent(spawnPointId, 'Transform');
        if (!tr?.mesh) return;
        let st = this._state.get(spawnPointId);
        if (!st) {
            st = { nextEmberAt: this._t + 0.2, flashLeft: 0 };
            this._state.set(spawnPointId, st);
        }
        st.flashLeft = 0.5;
        // Big ember burst on emergence so the spawn moment reads.
        if (this.particleSystem) {
            const wp = tr.mesh.position.clone();
            wp.y += 0.15;
            this.particleSystem.createImpactBurst(wp, 0xffaa44, 14);
        }
    }
}

function lerp(a, b, t) { return a + (b - a) * t; }
