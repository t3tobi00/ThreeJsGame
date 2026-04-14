// MeshPresetsDiorama — procedural meshes used by the "Cardboard Diorama"
// world. All presets are registered into the SAME shared MeshPresets
// registry as the legacy ones; their names are namespaced with `dio-` so
// they can never collide with existing presets.
//
// Loaded only when scene mode === 'diorama'. Importing this file has the
// side effect of registering the presets — `import './MeshPresetsDiorama.js'`
// is enough.
//
// Style: keep each preset under ~40 lines. Prefer 1-2 simple shapes per
// landmark over baroque modeling. The job is silhouette + color identity,
// not geometric realism.

import * as THREE from 'three';
import MeshPresets from './MeshPresets.js';
import ResourceRegistry from './ResourceRegistry.js';

// ---------------------------------------------------------------------------
// Shared canvas-texture helper
// ---------------------------------------------------------------------------
//
// Builds a 128×128 CanvasTexture from a paint function. Cached per cache key
// so we don't rebuild the same checker pattern 8 times.
const _texCache = new Map();
function makeTex(key, paint, repeatX = 1, repeatZ = 1) {
    if (_texCache.has(key)) return _texCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    paint(canvas.getContext('2d'));
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatZ);
    _texCache.set(key, tex);
    return tex;
}

// ---------------------------------------------------------------------------
// Ground pads — flat textured planes that mark each biome
// ---------------------------------------------------------------------------

function groundPad(width, depth, mat) {
    const geo = new THREE.PlaneGeometry(width, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
}


// dio-pad-jungle — extracted to src/zones/jungle/presets.js

MeshPresets.register('dio-pad-checker', ({ size = 16 } = {}) => {
    const tex = makeTex('dio-pad-checker', (ctx) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#e63946';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillRect(64, 64, 64, 64);
        // grout lines
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, 64, 64);
        ctx.strokeRect(64, 0, 64, 64);
        ctx.strokeRect(0, 64, 64, 64);
        ctx.strokeRect(64, 64, 64, 64);
    }, 4, 4);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1 });
    return groundPad(size, size, mat);
});

MeshPresets.register('dio-pad-concrete', ({ size = 16 } = {}) => {
    const tex = makeTex('dio-pad-concrete', (ctx) => {
        ctx.fillStyle = '#5a5a5a';
        ctx.fillRect(0, 0, 128, 128);
        // safety stripes
        ctx.fillStyle = '#f4c20d';
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(0, i * 32 + 12, 128, 4);
        }
        // oil stains
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * 128, y = Math.random() * 128;
            ctx.beginPath();
            ctx.arc(x, y, 4 + Math.random() * 6, 0, Math.PI * 2);
            ctx.fill();
        }
    }, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.2 });
    return groundPad(size, size, mat);
});

MeshPresets.register('dio-pad-cracked', ({ size = 16 } = {}) => {
    const tex = makeTex('dio-pad-cracked', (ctx) => {
        ctx.fillStyle = '#5d3a2c';
        ctx.fillRect(0, 0, 128, 128);
        // ash fade
        const grad = ctx.createLinearGradient(0, 0, 128, 128);
        grad.addColorStop(0, 'rgba(60, 30, 20, 0.6)');
        grad.addColorStop(1, 'rgba(20, 20, 20, 0.1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        // cracks
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * 128, Math.random() * 128);
            ctx.lineTo(Math.random() * 128, Math.random() * 128);
            ctx.stroke();
        }
        // blood splat hints
        ctx.fillStyle = 'rgba(120, 10, 10, 0.5)';
        for (let i = 0; i < 4; i++) {
            const x = Math.random() * 128, y = Math.random() * 128;
            ctx.beginPath();
            ctx.arc(x, y, 3 + Math.random() * 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }, 3, 3);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.0 });
    return groundPad(size, size, mat);
});

// dio-pad-cobble (small) — extracted to src/zones/basecamp/presets.js

// ---------------------------------------------------------------------------
// Thresholds — narrow border meshes placed on the edge between zones
// ---------------------------------------------------------------------------

MeshPresets.register('dio-threshold-logs', ({ length = 16 } = {}) => {
    const group = new THREE.Group();
    const logMat = new THREE.MeshStandardMaterial({ color: 0x6b3e1c, roughness: 0.9 });
    const n = Math.max(2, Math.round(length / 0.7));
    for (let i = 0; i < n; i++) {
        const log = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 0.6, 6),
            logMat
        );
        log.position.set((i / (n - 1) - 0.5) * length, 0.15, (Math.random() - 0.5) * 0.1);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = (Math.random() - 0.5) * 0.2;
        log.castShadow = true;
        log.receiveShadow = true;
        group.add(log);
    }
    return group;
});

MeshPresets.register('dio-threshold-curb', ({ length = 16 } = {}) => {
    const group = new THREE.Group();
    const curbGeo = new THREE.BoxGeometry(length, 0.18, 0.4);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.7 });
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.y = 0.09;
    curb.castShadow = true;
    curb.receiveShadow = true;
    group.add(curb);
    // dark grout line on top
    const lineGeo = new THREE.BoxGeometry(length, 0.02, 0.05);
    const line = new THREE.Mesh(lineGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
    line.position.y = 0.19;
    group.add(line);
    return group;
});

MeshPresets.register('dio-threshold-chainlink', ({ length = 16 } = {}) => {
    const group = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.5, metalness: 0.6 });
    // posts
    const postCount = Math.max(2, Math.round(length / 2));
    for (let i = 0; i < postCount; i++) {
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6),
            postMat
        );
        post.position.set((i / (postCount - 1) - 0.5) * length, 0.6, 0);
        post.castShadow = true;
        group.add(post);
    }
    // mesh "cloth" — single transparent plane with diagonal hatch tex
    const tex = makeTex('dio-chainlink', (ctx) => {
        ctx.clearRect(0, 0, 128, 128);
        ctx.strokeStyle = 'rgba(180,180,180,0.85)';
        ctx.lineWidth = 2;
        for (let i = -128; i < 128; i += 10) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i, 128); ctx.lineTo(i + 128, 0); ctx.stroke();
        }
    }, 4, 1);
    const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(length, 1.1),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    cloth.position.y = 0.6;
    group.add(cloth);
    return group;
});

MeshPresets.register('dio-threshold-sandbag', ({ length = 16 } = {}) => {
    const group = new THREE.Group();
    const bagMat = new THREE.MeshStandardMaterial({ color: 0xa68a5b, roughness: 0.95 });
    const n = Math.max(2, Math.round(length / 0.9));
    for (let i = 0; i < n; i++) {
        // bottom row
        const bag = new THREE.Mesh(
            new THREE.SphereGeometry(0.45, 8, 6),
            bagMat
        );
        bag.position.set((i / (n - 1) - 0.5) * length, 0.3, 0);
        bag.scale.set(1, 0.55, 0.7);
        bag.castShadow = true;
        bag.receiveShadow = true;
        group.add(bag);
        // top row, offset
        if (i < n - 1) {
            const top = bag.clone();
            top.position.set(((i + 0.5) / (n - 1) - 0.5) * length, 0.7, 0);
            group.add(top);
        }
    }
    return group;
});

// ---------------------------------------------------------------------------
// Landmarks — the 4 hero props that anchor each corner
// ---------------------------------------------------------------------------

// NW jungle landmark — broken stone totem
MeshPresets.register('dio-totem', () => {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a7c66, roughness: 0.95 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x5aaa3a, roughness: 0.9 });
    // stacked blocks
    const heights = [1.0, 0.8, 0.6, 0.4];
    let y = 0;
    for (let i = 0; i < heights.length; i++) {
        const h = heights[i];
        const w = 1.6 - i * 0.15;
        const block = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, w),
            i % 2 === 0 ? stoneMat : mossMat
        );
        block.position.y = y + h / 2;
        block.rotation.y = (Math.random() - 0.5) * 0.25;
        block.castShadow = true;
        block.receiveShadow = true;
        group.add(block);
        y += h;
    }
    // tilted broken cap — sells "ancient ruin"
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), stoneMat);
    cap.position.set(0.4, y + 0.15, 0.2);
    cap.rotation.set(0.3, 0.2, 0.4);
    cap.castShadow = true;
    group.add(cap);
    return group;
});

// NE business landmark — neon ZOMBURGER arch
MeshPresets.register('dio-neon-arch', () => {
    const group = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.4, metalness: 0.8 });
    // 2 vertical posts
    for (const x of [-2.5, 2.5]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.5, 8), postMat);
        post.position.set(x, 2.25, 0);
        post.castShadow = true;
        group.add(post);
    }
    // top crossbar
    const bar = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.4, 0.4), postMat);
    bar.position.y = 4.4;
    bar.castShadow = true;
    group.add(bar);
    // neon sign panel — emissive plane
    const signGeo = new THREE.BoxGeometry(4.6, 1.4, 0.2);
    const signMat = new THREE.MeshStandardMaterial({
        color: 0xff3380,
        emissive: 0xff66aa,
        emissiveIntensity: 1.4,
        roughness: 0.3
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.y = 5.3;
    sign.castShadow = true;
    group.add(sign);
    // neon tubes — bright cylinders along the arch top
    const tubeMat = new THREE.MeshStandardMaterial({
        color: 0xffe6f1,
        emissive: 0xff80c0,
        emissiveIntensity: 2.0
    });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.6, 8), tubeMat);
    tube.rotation.z = Math.PI / 2;
    tube.position.y = 6.0;
    group.add(tube);
    // soft glow point light at the sign
    const glow = new THREE.PointLight(0xff66aa, 0.6, 10, 1.8);
    glow.position.y = 5.3;
    group.add(glow);
    return group;
});

// SE factory landmark — smokestack with billowing cylinder of "smoke"
MeshPresets.register('dio-smokestack', () => {
    const group = new THREE.Group();
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x7a3c2c, roughness: 0.95 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2e6, roughness: 0.85 });
    // base
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.2),
        new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 }));
    base.position.y = 0.25;
    base.castShadow = true; base.receiveShadow = true;
    group.add(base);
    // stack
    const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.75, 5.5, 16),
        brickMat
    );
    stack.position.y = 0.5 + 2.75;
    stack.castShadow = true;
    group.add(stack);
    // 3 white stripes
    for (let i = 0; i < 3; i++) {
        const stripe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.62, 0.7, 0.18, 16),
            stripeMat
        );
        stripe.position.y = 1.5 + i * 1.3;
        group.add(stripe);
    }
    // top rim
    const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.55, 0.4, 16),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })
    );
    rim.position.y = 6.0;
    group.add(rim);
    // smoke puffs — 3 stacked emissive spheres
    const smokeMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee, emissive: 0x888888, emissiveIntensity: 0.2,
        transparent: true, opacity: 0.75
    });
    for (let i = 0; i < 3; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.6 + i * 0.15, 12, 10), smokeMat);
        puff.position.set((i % 2 === 0 ? 0.1 : -0.1), 6.6 + i * 0.6, 0);
        puff.userData.driftPhase = Math.random() * Math.PI * 2;
        group.add(puff);
    }
    // animate smoke gently with onBeforeRender (no system needed)
    group.onBeforeRender = () => {
        const t = performance.now() * 0.001;
        let i = 0;
        for (const child of group.children) {
            if (child.material === smokeMat) {
                child.position.x = (i % 2 === 0 ? 0.1 : -0.1) + Math.sin(t + child.userData.driftPhase) * 0.15;
                i++;
            }
        }
    };
    return group;
});

// SW combat landmark — wooden watchtower
MeshPresets.register('dio-watchtower', () => {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.9 });
    // 4 legs
    const legPositions = [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]];
    for (const [x, z] of legPositions) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.0, 0.22), woodMat);
        leg.position.set(x, 2.0, z);
        // splay outward slightly
        leg.rotation.x = Math.sign(z) * 0.04;
        leg.rotation.z = -Math.sign(x) * 0.04;
        leg.castShadow = true;
        group.add(leg);
    }
    // platform
    const plat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 2.8), woodMat);
    plat.position.y = 4.0;
    plat.castShadow = true; plat.receiveShadow = true;
    group.add(plat);
    // railing
    for (const [x, z, w, d] of [[0, -1.3, 2.6, 0.1], [0, 1.3, 2.6, 0.1], [-1.3, 0, 0.1, 2.6], [1.3, 0, 0.1, 2.6]]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), darkMat);
        rail.position.set(x, 4.4, z);
        group.add(rail);
    }
    // roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.2, 4), darkMat);
    roof.position.y = 5.5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    // searchlight glow
    const lampMat = new THREE.MeshStandardMaterial({
        color: 0xfff2a0, emissive: 0xffcc44, emissiveIntensity: 1.6
    });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), lampMat);
    lamp.position.set(0, 4.7, 1.1);
    group.add(lamp);
    return group;
});

// THE HIVE — the central enemy of the entire game. Pulsing, invulnerable,
// SW frontier centerpiece. This deserves the most love of any preset.
// Hive preset — extracted to src/zones/enemy/presets.js

// ---------------------------------------------------------------------------
// Per-corner dressing
// ---------------------------------------------------------------------------

// NW jungle dressing
// palm-tree, fern, mossy-boulder — extracted to src/zones/jungle/presets.js

// Restaurant dressing (patio-table, queue-rope, awning-stripe) — DELETED
// Factory dressing (pipe-arch, crate-stack, conveyor-stub, locked-plinth) — DELETED

// ---------------------------------------------------------------------------
// Basecamp — town square dressing
// ---------------------------------------------------------------------------

// Basecamp presets (pad-cobble, flagpole, well, lamp-post, bench, barrel-water, flower-box)
// — extracted to src/zones/basecamp/presets.js

// Market Zone presets — extracted to src/zones/market/presets.js

// Restaurant presets (building, kitchen-counter, menu-board, trash-can) — DELETED

// SW combat dressing
// Sandbag, broken-car, tent presets — extracted to src/zones/enemy/presets.js

// dio-bulletin-board — extracted to src/zones/basecamp/presets.js

// Mountain — tall low-poly cone with optional snow cap. Used along the
// NW arc to give the jungle a receding-distance backdrop instead of a
// hard rim.
MeshPresets.register('dio-mountain', ({ height = 12, radius = 5, snowCap = true } = {}) => {
    const group = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x5a4a3e,
        roughness: 1.0,
        flatShading: true
    });
    const cone = new THREE.Mesh(
        new THREE.ConeGeometry(radius, height, 6, 1, false),
        rockMat
    );
    cone.position.y = height / 2;
    cone.castShadow = true;
    cone.receiveShadow = true;
    cone.rotation.y = Math.random() * Math.PI;
    group.add(cone);
    if (snowCap) {
        const snowMat = new THREE.MeshStandardMaterial({
            color: 0xf4f4f8,
            roughness: 0.5,
            flatShading: true
        });
        const snow = new THREE.Mesh(
            new THREE.ConeGeometry(radius * 0.42, height * 0.28, 6),
            snowMat
        );
        snow.position.y = height * 0.86;
        snow.rotation.y = cone.rotation.y;
        group.add(snow);
    }
    return group;
});

// Reinforced steel checkpoint gate — the centerpiece sitting in the 4-unit
// gap of the big razor-wire wall. Visual only, no collider — the player
// walks straight through. Designed to read as "this is the heavily defended
// chokepoint" without any text needed.
//
// Anatomy:
//   - 2 chunky concrete buttress pillars at the gap edges
//   - heavy steel double-leaf gate between them with center seam, rivets,
//     horizontal reinforcement bars, and a yellow caution hatch stripe
//   - top crossbar connecting the pillars, carrying a "ZONE 1" sign and a
//     mounted spotlight (with real point light)
//   - razor coil row crowning the crossbar so it integrates with the wall
MeshPresets.register('dio-fortress-gate', () => {
    const group = new THREE.Group();

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.95 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4e, roughness: 0.45, metalness: 0.85 });
    const seamMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6, metalness: 0.7 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf4c20d, roughness: 0.7 });
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.3, metalness: 0.85 });
    const lampMat = new THREE.MeshStandardMaterial({
        color: 0xfff2a0, emissive: 0xffcc44, emissiveIntensity: 1.6
    });
    const signMat = new THREE.MeshStandardMaterial({
        color: 0xf4c20d, emissive: 0x553300, emissiveIntensity: 0.4, roughness: 0.7
    });
    const rivetMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.9 });

    // 2 concrete buttress pillars at the edges of the 4-unit gap
    const pillarH = 3.5;
    for (const x of [-2.4, 2.4]) {
        const pillar = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, pillarH, 0.8),
            concreteMat
        );
        pillar.position.set(x, pillarH / 2, 0);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        group.add(pillar);
        // angled cap on top
        const cap = new THREE.Mesh(
            new THREE.BoxGeometry(0.95, 0.18, 0.95),
            seamMat
        );
        cap.position.set(x, pillarH + 0.09, 0);
        group.add(cap);
    }

    // heavy steel gate between the pillars
    const gateW = 4.0;
    const gateH = 3.0;
    const gate = new THREE.Mesh(
        new THREE.BoxGeometry(gateW, gateH, 0.18),
        steelMat
    );
    gate.position.set(0, gateH / 2 + 0.1, 0);
    gate.castShadow = true;
    gate.receiveShadow = true;
    group.add(gate);

    // center seam (where the two leaves meet)
    const seam = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, gateH, 0.22),
        seamMat
    );
    seam.position.set(0, gateH / 2 + 0.1, 0);
    group.add(seam);

    // horizontal reinforcement bars across the gate
    for (const y of [0.6, 1.5, 2.4]) {
        const bar = new THREE.Mesh(
            new THREE.BoxGeometry(gateW - 0.1, 0.12, 0.22),
            seamMat
        );
        bar.position.set(0, y + 0.1, 0);
        group.add(bar);
    }

    // rivets at corners and seams
    const rivetGeo = new THREE.SphereGeometry(0.06, 6, 6);
    for (const x of [-1.85, 1.85]) {
        for (const y of [0.4, 1.5, 2.6]) {
            const rivet = new THREE.Mesh(rivetGeo, rivetMat);
            rivet.position.set(x, y + 0.1, 0.12);
            group.add(rivet);
        }
    }

    // yellow caution stripe across the bottom
    const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(gateW - 0.05, 0.32, 0.01),
        yellowMat
    );
    stripe.position.set(0, 0.27, 0.115);
    group.add(stripe);

    // black diagonal hatches on the yellow stripe
    for (let i = 0; i < 8; i++) {
        const hatch = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.32, 0.005),
            seamMat
        );
        hatch.position.set(-1.8 + i * 0.5, 0.27, 0.12);
        hatch.rotation.z = Math.PI / 4;
        group.add(hatch);
    }

    // top crossbar connecting the two pillars
    const crossbar = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.45, 0.6),
        concreteMat
    );
    crossbar.position.set(0, pillarH + 0.42, 0);
    crossbar.castShadow = true;
    group.add(crossbar);

    // "ZONE 1" sign plate hanging from the crossbar
    const sign = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.55, 0.08),
        signMat
    );
    sign.position.set(0, pillarH + 0.95, 0.2);
    group.add(sign);
    // dark text strip inside the sign
    const signText = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 0.2, 0.01),
        seamMat
    );
    signText.position.set(0, pillarH + 0.95, 0.245);
    group.add(signText);

    // spotlight mounted on the crossbar, angled forward
    const spotMount = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8),
        seamMat
    );
    spotMount.position.set(0, pillarH + 0.78, -0.45);
    spotMount.rotation.x = Math.PI / 4;
    group.add(spotMount);

    const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 12, 10),
        lampMat
    );
    lamp.position.set(0, pillarH + 1.0, -0.6);
    group.add(lamp);

    // soft glow point light from the lamp
    const glow = new THREE.PointLight(0xffcc44, 0.9, 14, 1.6);
    glow.position.set(0, pillarH + 0.9, -0.4);
    group.add(glow);

    // razor coil row on top of the crossbar — matches the wall crown
    const coilCount = 14;
    for (let i = 0; i < coilCount; i++) {
        const coil = new THREE.Mesh(
            new THREE.TorusGeometry(0.095, 0.022, 4, 8),
            wireMat
        );
        const t = (i + 0.5) / coilCount;
        coil.position.set(-2.6 + t * 5.2, pillarH + 0.72, 0);
        coil.rotation.x = Math.PI / 2;
        coil.rotation.z = (i % 2) * 0.3;
        group.add(coil);
    }

    return group;
});

// Razor-wire fence panel — a single 2-unit segment placed along an edge
// of the basecamp perimeter. Replaces the cute log fence to sell the
// "town defending against zombies" narrative.
//
// Structure:
//   - 2 metal end posts (slim, cold gray)
//   - chain-link cloth (transparent diagonal-hatch tex)
//   - 3 horizontal barbed wires near the top
//   - razor coil row crowning the panel
MeshPresets.register('dio-fence-panel', ({ length = 2, height = 2.2 } = {}) => {
    const group = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({
        color: 0x6a6a6a,
        roughness: 0.4,
        metalness: 0.85
    });
    const wireMat = new THREE.MeshStandardMaterial({
        color: 0x9a9a9a,
        roughness: 0.3,
        metalness: 0.85
    });

    // 2 end posts
    for (const x of [-length / 2, length / 2]) {
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.07, height, 8),
            postMat
        );
        post.position.set(x, height / 2, 0);
        post.castShadow = true;
        group.add(post);
        // post cap
        const cap = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 8, 6),
            postMat
        );
        cap.position.set(x, height + 0.04, 0);
        group.add(cap);
    }

    // Chain-link cloth — reuses the dio-chainlink tex from the threshold preset
    const tex = makeTex('dio-chainlink', (ctx) => {
        ctx.clearRect(0, 0, 128, 128);
        ctx.strokeStyle = 'rgba(180,180,180,0.85)';
        ctx.lineWidth = 2;
        for (let i = -128; i < 128; i += 10) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i, 128); ctx.lineTo(i + 128, 0); ctx.stroke();
        }
    }, 4, 1);
    const clothH = height - 0.4;
    const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(length, clothH),
        new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    cloth.position.y = clothH / 2 + 0.1;
    group.add(cloth);

    // 3 horizontal barbed wires near the top
    for (const y of [height - 0.06, height - 0.18, height - 0.32]) {
        const wire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.018, 0.018, length, 4),
            wireMat
        );
        wire.rotation.z = Math.PI / 2;
        wire.position.y = y;
        group.add(wire);
    }

    // Razor coil — small torus rings strung along the top
    const coilCount = Math.max(2, Math.floor(length * 4));
    for (let i = 0; i < coilCount; i++) {
        const coil = new THREE.Mesh(
            new THREE.TorusGeometry(0.085, 0.02, 4, 8),
            wireMat
        );
        const t = (i + 0.5) / coilCount;
        coil.position.set(-length / 2 + t * length, height + 0.06, 0);
        coil.rotation.x = Math.PI / 2;
        coil.rotation.z = (i % 2) * 0.3;
        group.add(coil);
    }

    return group;
});

// Outer rim — small cliff segments that frame the playable area
MeshPresets.register('dio-rim-cliff', () => {
    const group = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4035, roughness: 1.0 });
    // 3 stacked icospheres of varying sizes
    const sizes = [1.2, 0.8, 0.6];
    let x = 0;
    for (const s of sizes) {
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), rockMat);
        rock.position.set(x, s * 0.6, (Math.random() - 0.5) * 0.4);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true; rock.receiveShadow = true;
        group.add(rock);
        x += s * 0.9;
    }
    return group;
});

// ---------------------------------------------------------------------------
// SW Hellscape — combat-front dressing south of the wall (z > 14).
// Tone: post-apocalyptic urban decay. Restrained palette (greys, browns,
// rust, dried-blood). No saturated cartoon reds. Geometry is deliberately
// irregular — every box, sphere, and cylinder is jittered so nothing reads
// as machine-perfect.
// ---------------------------------------------------------------------------

// Vertex-jitter helper — scrambles a geometry's vertices in place so primitive
// shapes (Sphere, Icosahedron, Box, Cone) read as weathered/irregular.
// Call BEFORE the geometry is shared with multiple meshes.
function jitterGeo(geo, amount = 0.05) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * amount);
        pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * amount);
        pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * amount);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
}

// blobPath, paintAlphaFalloff, featheredPadMat — extracted to src/zones/enemy/presets.js
// All zombie-zone presets (grounds, gore, debris, buildings, hazards) — extracted to src/zones/enemy/presets.js
// Placeholder removed — see src/zones/enemy/presets.js for the full set.
export default MeshPresets;
