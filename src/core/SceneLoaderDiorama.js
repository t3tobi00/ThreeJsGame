import * as THREE from 'three';
import { SceneLoader } from './SceneLoader.js';
import MeshPresets from './MeshPresets.js';
// Side-effect import: registers all `dio-*` presets into the shared registry.
import './MeshPresetsDiorama.js';
// Standalone machine presets (extracted from MeshPresetsDiorama for modularity).
import '../entities/machines/GearworksMachine.js';
// Zone presets (extracted from MeshPresetsDiorama into independent zones).
import '../zones/basecamp/BasecampZone.js';
import '../zones/market/MarketZone.js';
import '../zones/jungle/JungleZone.js';
import '../zones/factory/FactoryZone.js';
// Enemy zone presets (extracted from MeshPresetsDiorama into independent zone).
import '../zones/enemy/EnemyZone.js';

// SceneLoaderDiorama — wraps the legacy SceneLoader and, when the level JSON
// includes a `dioramaWorld` block, builds the four-corner cardboard diorama
// on top of the existing ground/fence/road. Returns the same shape as
// SceneLoader.load() so main.js can consume it identically.
//
// The diorama is purely visual scenery — none of these meshes are ECS
// entities, none of them have colliders. Gameplay (gates, villagers,
// unlock zones, enemies) is defined by the SAME level JSON fields as
// legacy and behaves unchanged.
//
// dioramaWorld JSON shape (all fields optional, see level-1-diorama.json):
//   {
//     "pads":       [{ "preset": "dio-pad-jungle", "x":-22, "z":-22, "size":16 }, ...],
//     "thresholds": [{ "preset": "dio-threshold-logs", "x":-14, "z":-22, "rotY":1.5708, "length":12 }, ...],
//     "landmarks":  [{ "preset": "dio-hive", "x":-22, "z":22, "rotY":0 }, ...],
//     "scatter":    [{ "preset": "dio-palm-tree", "x":..., "z":..., "rotY":..., "scale":... }, ...],
//     "rim":        [{ "x":..., "z":..., "rotY":... }, ...]   // uses dio-rim-cliff
//   }
//
// Anything that's not in the JSON is simply skipped. Adding new prop types
// later just means registering a new preset and adding entries here.

export class SceneLoaderDiorama {
    static async load(path, scene) {
        const result = await SceneLoader.load(path, scene);

        const dw = result.levelData.dioramaWorld;
        if (dw) {
            // The big defensive fence is the only razor-wire wall in the
            // diorama — basecamp itself has no perimeter visual. When
            // bigFence is present we hide the legacy log-fence visuals
            // (their colliders in main.js are unaffected — gates still
            // gate enemies in the underlying gameplay).
            if (dw.bigFence) {
                if (result.fenceGroup) result.fenceGroup.visible = false;
                SceneLoaderDiorama._buildBigFence(scene, dw.bigFence);
            }
            const dioramaRefs = SceneLoaderDiorama._buildDiorama(scene, dw);
            result.machines = dioramaRefs.machines;
            SceneLoaderDiorama._upgradeDangerZone(scene);
        }

        return result;
    }

    // Post-apocalyptic wasteland ground — ashen, scorched, dead.
    // Dark grey-brown earth with ash, deep cracks, toxic stains,
    // rubble debris, and charred scorch craters.
    static _upgradeDangerZone(scene) {
        const plane = scene.getObjectByName('danger-zone-ground');
        if (!plane) return;

        const S = 512;
        const canvas = document.createElement('canvas');
        canvas.width = S;
        canvas.height = S;
        const ctx = canvas.getContext('2d');

        let _s = 42;
        const rng = () => { _s = (_s * 16807) % 2147483647; return (_s - 1) / 2147483646; };

        // ── 1. Dead earth base — desaturated grey-brown ──
        ctx.fillStyle = '#5a5248';
        ctx.fillRect(0, 0, S, S);

        // Tonal variation — patches of darker/lighter dead ground
        const deadZones = [
            { x: S * 0.2, y: S * 0.3, r: S * 0.35, c: '68,60,50' },
            { x: S * 0.8, y: S * 0.7, r: S * 0.3,  c: '50,45,38' },
            { x: S * 0.5, y: S * 0.1, r: S * 0.25, c: '75,68,58' },
            { x: S * 0.1, y: S * 0.8, r: S * 0.28, c: '55,48,40' },
            { x: S * 0.7, y: S * 0.2, r: S * 0.2,  c: '62,55,45' },
        ];
        for (const z of deadZones) {
            const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
            g.addColorStop(0, `rgba(${z.c},0.3)`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, S, S);
        }

        // ── 2. Ash and dirt grain — dense, gritty ──
        for (let i = 0; i < 8000; i++) {
            const x = rng() * S, y = rng() * S;
            const v = 60 + Math.floor(rng() * 50);
            ctx.fillStyle = `rgba(${v + 5},${v},${v - 5},0.1)`;
            ctx.fillRect(x, y, 1 + rng() * 2, 1 + rng());
        }

        // ── 3. Deep cracks — dried scorched earth, thick and branching ──
        for (let i = 0; i < 25; i++) {
            let cx = rng() * S, cy = rng() * S;
            let a = rng() * Math.PI * 2;
            // Main crack — dark, wide
            ctx.strokeStyle = `rgba(25,20,15,${0.2 + rng() * 0.15})`;
            ctx.lineWidth = 1.5 + rng() * 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            const len = 30 + rng() * 70;
            for (let step = 0; step < len; step += 3) {
                a += (rng() - 0.5) * 0.6;
                cx += Math.cos(a) * 3;
                cy += Math.sin(a) * 3;
                ctx.lineTo(cx, cy);
                // Branching cracks
                if (rng() < 0.12 && step > 6) {
                    const ba = a + (rng() - 0.5) * 2.2;
                    let bx = cx, by = cy;
                    ctx.moveTo(cx, cy);
                    for (let bs = 0; bs < 10 + rng() * 25; bs += 3) {
                        bx += Math.cos(ba + (rng() - 0.5) * 0.4) * 3;
                        by += Math.sin(ba + (rng() - 0.5) * 0.4) * 3;
                        ctx.lineTo(bx, by);
                    }
                    ctx.moveTo(cx, cy);
                }
            }
            ctx.stroke();
            // Crack edge highlight (depth)
            ctx.strokeStyle = 'rgba(90,82,70,0.08)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // ── 4. Scorch craters — dark burnt impact marks ──
        for (let i = 0; i < 8; i++) {
            const sx = rng() * S, sy = rng() * S;
            const sr = 18 + rng() * 40;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(rng() * Math.PI);
            ctx.scale(1, 0.55 + rng() * 0.45);
            // Charred center
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
            g.addColorStop(0, 'rgba(20,15,10,0.35)');
            g.addColorStop(0.4, 'rgba(30,22,15,0.2)');
            g.addColorStop(0.7, 'rgba(45,35,25,0.08)');
            g.addColorStop(1, 'rgba(45,35,25,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(0, 0, sr * 1.3, sr, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // ── 5. Toxic/chemical stains — sickly green-yellow patches ──
        for (let i = 0; i < 4; i++) {
            const tx = rng() * S, ty = rng() * S;
            const tr = 15 + rng() * 25;
            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(rng() * Math.PI);
            ctx.scale(1.2, 0.7 + rng() * 0.6);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, tr);
            g.addColorStop(0, 'rgba(85,95,40,0.18)');
            g.addColorStop(0.5, 'rgba(70,80,35,0.08)');
            g.addColorStop(1, 'rgba(70,80,35,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(0, 0, tr * 1.4, tr, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // ── 6. Ash drifts — pale grey streaks where wind pushed ash ──
        ctx.strokeStyle = 'rgba(120,115,105,0.06)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 20; i++) {
            const y0 = rng() * S;
            ctx.beginPath();
            ctx.moveTo(0, y0);
            for (let x = 0; x < S; x += 12) {
                ctx.lineTo(x, y0 + Math.sin(x * 0.02 + i) * 4 + (rng() - 0.5) * 2);
            }
            ctx.stroke();
        }

        // ── 7. Rubble and debris — small irregular chunks ──
        for (let i = 0; i < 60; i++) {
            const px = rng() * S, py = rng() * S;
            const pr = 1.5 + rng() * 4;
            ctx.beginPath();
            // Irregular polygon shape (4-6 sides)
            const sides = 4 + Math.floor(rng() * 3);
            for (let s = 0; s < sides; s++) {
                const ang = (Math.PI * 2 / sides) * s + rng() * 0.5;
                const dist = pr * (0.6 + rng() * 0.4);
                const vx = px + Math.cos(ang) * dist;
                const vy = py + Math.sin(ang) * dist;
                if (s === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
            }
            ctx.closePath();
            const v = 50 + Math.floor(rng() * 40);
            ctx.fillStyle = `rgba(${v + 8},${v + 3},${v - 5},0.3)`;
            ctx.fill();
            // Highlight edge
            ctx.strokeStyle = `rgba(${v + 30},${v + 25},${v + 15},0.1)`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // ── 8. Rust stains — from buried metal ──
        for (let i = 0; i < 5; i++) {
            const rx = rng() * S, ry = rng() * S;
            const rr = 10 + rng() * 20;
            const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, rr);
            g.addColorStop(0, `rgba(120,60,25,${0.12 + rng() * 0.1})`);
            g.addColorStop(0.6, 'rgba(100,50,20,0.04)');
            g.addColorStop(1, 'rgba(100,50,20,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(rx, ry, rr, 0, Math.PI * 2);
            ctx.fill();
        }

        // ── 9. Overall darkening vignette ──
        const vig = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.15, S * 0.5, S * 0.5, S * 0.7);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.08)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, S, S);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(8, 8);

        plane.material.dispose();
        plane.material = new THREE.MeshStandardMaterial({
            map: tex, roughness: 0.95, metalness: 0.02
        });
    }

    // Big fence — one long horizontal razor-wire wall running E↔W along a
    // fixed Z line, optionally with a center gap so the player can walk
    // through to the combat front. Visual only (no colliders); zombies
    // still funnel through the legacy basecamp gates that live just to
    // the north of this wall.
    //
    // Config shape:
    //   bigFence: {
    //     z:      14,        // world Z line the wall sits on
    //     xStart: -48,       // west end of the wall
    //     xEnd:    48,       // east end of the wall
    //     gap: { center: 0, width: 4 }   // optional opening
    //   }
    static _buildBigFence(scene, cfg) {
        const root = new THREE.Group();
        root.name = 'diorama-big-fence';
        const z       = cfg.z      ?? 14;
        const xStart  = cfg.xStart ?? -48;
        const xEnd    = cfg.xEnd   ??  48;
        const panelLen = 2;
        const gapCenter = (cfg.gap && typeof cfg.gap.center === 'number') ? cfg.gap.center : null;
        const gapHalf   = (cfg.gap && typeof cfg.gap.width  === 'number') ? cfg.gap.width / 2 : 0;

        // Lay 2-unit panels along the line, skipping any panel whose center
        // falls inside the gap window.
        for (let x = xStart + panelLen / 2; x <= xEnd; x += panelLen) {
            if (gapCenter !== null && Math.abs(x - gapCenter) < gapHalf + panelLen / 2) continue;
            const panel = MeshPresets.create('dio-fence-panel', { length: panelLen });
            panel.position.set(x, 0, z);
            // Default panel orientation is along its local X axis, which
            // already matches world X — no rotation needed.
            root.add(panel);
        }
        scene.add(root);
    }

    static _buildDiorama(scene, dw) {
        const machines = [];
        const root = new THREE.Group();
        root.name = 'diorama-world';

        // Optional: scale up props on the zombie side of the big fence (z > zombieAreaZ).
        // Defaults are NO-OP — if zombieAreaScale is missing or 1.0, behavior is identical
        // to the original layout. Only `scatter` and `landmarks` entries with z strictly
        // greater than zombieAreaZ are affected; player, basecamp, restaurant, factory,
        // jungle, pads, mountains, and the fence itself are untouched.
        const zombieAreaScale = dw.zombieAreaScale ?? 1.0;
        const zombieAreaZ     = dw.zombieAreaZ     ?? 14;
        const inZombieArea = (z) => zombieAreaScale !== 1.0 && (z ?? 0) > zombieAreaZ;

        // Ground pads sit just above the legacy ground plane (y=0)
        // so they cover the sandy danger zone in their footprint.
        // Pads are square and texture-tiled — yaw rotation is intentionally
        // not supported (the textures look identical at any angle).
        if (Array.isArray(dw.pads)) {
            for (const p of dw.pads) {
                const mesh = MeshPresets.create(p.preset, {
                    size: p.size,
                    width: p.width,
                    depth: p.depth
                });
                mesh.position.set(p.x || 0, (p.y ?? 0.02), p.z || 0);
                // The pad is built by groundPad() with rotation.x = -PI/2.
                // After that X-flip, the plane's local Z axis points up in
                // world space, so yawing it on the ground means setting Z.
                if (p.rotY) mesh.rotation.z = p.rotY;
                root.add(mesh);
            }
        }

        // Threshold borders — narrow strips between zones
        if (Array.isArray(dw.thresholds)) {
            for (const t of dw.thresholds) {
                const mesh = MeshPresets.create(t.preset, { length: t.length });
                mesh.position.set(t.x || 0, (t.y ?? 0), t.z || 0);
                if (t.rotY) mesh.rotation.y = t.rotY;
                root.add(mesh);
            }
        }

        // Landmarks — the 4 hero props (one per corner)
        if (Array.isArray(dw.landmarks)) {
            for (const l of dw.landmarks) {
                const mesh = MeshPresets.create(l.preset, l);
                mesh.position.set(l.x || 0, (l.y ?? 0), l.z || 0);
                if (l.rotY) mesh.rotation.y = l.rotY;
                const baseScale = l.scale ?? 1;
                const finalScale = inZombieArea(l.z) ? baseScale * zombieAreaScale : baseScale;
                if (finalScale !== 1) mesh.scale.setScalar(finalScale);
                root.add(mesh);
                if (l.preset === 'gearworks-machine') {
                    machines.push({ mesh, config: l });
                }
            }
        }

        // Scatter dressing — palms, ferns, crates, sandbags, etc.
        // String entries (used as section markers in the JSON for readability)
        // are skipped silently.
        if (Array.isArray(dw.scatter)) {
            for (const s of dw.scatter) {
                if (typeof s !== 'object' || !s || !s.preset) continue;
                const mesh = MeshPresets.create(s.preset, s);
                mesh.position.set(s.x || 0, (s.y ?? 0), s.z || 0);
                if (s.rotY) mesh.rotation.y = s.rotY;
                const baseScale = s.scale ?? 1;
                const finalScale = inZombieArea(s.z) ? baseScale * zombieAreaScale : baseScale;
                if (finalScale !== 1) mesh.scale.setScalar(finalScale);
                root.add(mesh);
            }
        }

        // Mountains — receding-distance backdrop on the NW side
        if (Array.isArray(dw.mountains)) {
            for (const m of dw.mountains) {
                const mesh = MeshPresets.create('dio-mountain', {
                    height: m.height ?? 12,
                    radius: m.radius ?? 5,
                    snowCap: m.snowCap !== false
                });
                mesh.position.set(m.x || 0, (m.y ?? 0), m.z || 0);
                if (m.rotY) mesh.rotation.y = m.rotY;
                root.add(mesh);
            }
        }

        // Outer rim — frames the map
        if (Array.isArray(dw.rim)) {
            for (const r of dw.rim) {
                const mesh = MeshPresets.create('dio-rim-cliff');
                mesh.position.set(r.x || 0, (r.y ?? 0), r.z || 0);
                if (r.rotY) mesh.rotation.y = r.rotY;
                root.add(mesh);
            }
        }

        scene.add(root);
        return { machines };
    }
}
