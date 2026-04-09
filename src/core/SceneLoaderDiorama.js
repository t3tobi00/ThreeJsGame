import * as THREE from 'three';
import { SceneLoader } from './SceneLoader.js';
import MeshPresets from './MeshPresets.js';
// Side-effect import: registers all `dio-*` presets into the shared registry.
import './MeshPresetsDiorama.js';

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
            SceneLoaderDiorama._buildDiorama(scene, dw);
        }

        return result;
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
        const root = new THREE.Group();
        root.name = 'diorama-world';

        // Ground pads sit just above the legacy ground plane (y=0)
        // so they cover the sandy danger zone in their footprint.
        // Pads are square and texture-tiled — yaw rotation is intentionally
        // not supported (the textures look identical at any angle).
        if (Array.isArray(dw.pads)) {
            for (const p of dw.pads) {
                const mesh = MeshPresets.create(p.preset, { size: p.size });
                mesh.position.set(p.x || 0, (p.y ?? 0.02), p.z || 0);
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
                const mesh = MeshPresets.create(l.preset);
                mesh.position.set(l.x || 0, (l.y ?? 0), l.z || 0);
                if (l.rotY) mesh.rotation.y = l.rotY;
                if (l.scale) mesh.scale.setScalar(l.scale);
                root.add(mesh);
            }
        }

        // Scatter dressing — palms, ferns, crates, sandbags, etc.
        // String entries (used as section markers in the JSON for readability)
        // are skipped silently.
        if (Array.isArray(dw.scatter)) {
            for (const s of dw.scatter) {
                if (typeof s !== 'object' || !s || !s.preset) continue;
                const mesh = MeshPresets.create(s.preset);
                mesh.position.set(s.x || 0, (s.y ?? 0), s.z || 0);
                if (s.rotY) mesh.rotation.y = s.rotY;
                if (s.scale) mesh.scale.setScalar(s.scale);
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
    }
}
