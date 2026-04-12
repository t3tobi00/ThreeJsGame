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

MeshPresets.register('dio-pad-jungle', ({ size = 16 } = {}) => {
    const tex = makeTex('dio-pad-jungle', (ctx) => {
        ctx.fillStyle = '#3da14a';
        ctx.fillRect(0, 0, 128, 128);
        // dark grass patches
        ctx.fillStyle = 'rgba(20, 60, 20, 0.35)';
        for (let i = 0; i < 24; i++) {
            const x = Math.random() * 128, y = Math.random() * 128;
            ctx.beginPath();
            ctx.arc(x, y, 6 + Math.random() * 10, 0, Math.PI * 2);
            ctx.fill();
        }
        // light highlights
        ctx.fillStyle = 'rgba(180, 255, 140, 0.18)';
        for (let i = 0; i < 18; i++) {
            const x = Math.random() * 128, y = Math.random() * 128;
            ctx.fillRect(x, y, 2, 2);
        }
    }, 4, 4);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.0 });
    return groundPad(size, size, mat);
});

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

MeshPresets.register('dio-pad-cobble', ({ size = 12 } = {}) => {
    const tex = makeTex('dio-pad-cobble', (ctx) => {
        ctx.fillStyle = '#9a9a8c';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = 'rgba(40,40,35,0.5)';
        ctx.lineWidth = 2;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const offset = (r % 2) * 8;
                ctx.beginPath();
                ctx.arc(c * 16 + offset, r * 16 + 8, 7, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        // bullseye decal at center (only painted once per cache, fine)
        ctx.fillStyle = 'rgba(255, 220, 0, 0.55)';
        ctx.beginPath(); ctx.arc(64, 64, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(40, 40, 0, 0.7)';
        ctx.beginPath(); ctx.arc(64, 64, 9, 0, Math.PI * 2); ctx.fill();
    }, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.0 });
    return groundPad(size, size, mat);
});

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
MeshPresets.register('dio-hive', () => {
    const group = new THREE.Group();

    // crater base — wide flat dark plate
    const crater = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.6, 0.3, 24),
        new THREE.MeshStandardMaterial({ color: 0x1a0808, roughness: 1.0 })
    );
    crater.position.y = 0.15;
    crater.receiveShadow = true;
    group.add(crater);

    // main blob — multi-layer emissive icospheres for a fleshy core
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x550018,
        emissive: 0xff1133,
        emissiveIntensity: 1.2,
        roughness: 0.4,
        metalness: 0.0
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), coreMat);
    core.position.y = 1.9;
    core.castShadow = true;
    group.add(core);

    // outer membrane — translucent shell
    const membraneMat = new THREE.MeshStandardMaterial({
        color: 0x880022,
        emissive: 0xff4466,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.55,
        roughness: 0.6
    });
    const membrane = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), membraneMat);
    membrane.position.y = 1.95;
    group.add(membrane);

    // tendrils — 5 curved cylinders sticking out at angles
    const tendrilMat = new THREE.MeshStandardMaterial({
        color: 0x440011,
        emissive: 0xaa1133,
        emissiveIntensity: 0.6,
        roughness: 0.8
    });
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const tendril = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.18, 2.2, 6),
            tendrilMat
        );
        tendril.position.set(Math.cos(angle) * 1.5, 1.6, Math.sin(angle) * 1.5);
        tendril.rotation.z = -Math.cos(angle) * 0.6;
        tendril.rotation.x = Math.sin(angle) * 0.6;
        tendril.castShadow = true;
        group.add(tendril);
    }

    // ominous red point light pulsing from inside
    const innerLight = new THREE.PointLight(0xff2244, 1.4, 14, 1.5);
    innerLight.position.y = 1.9;
    group.add(innerLight);

    // animation: pulse the membrane scale + emissive intensity, slow rotate
    // the tendrils. No system needed — onBeforeRender does it locally.
    group.onBeforeRender = () => {
        const t = performance.now() * 0.001;
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
        membrane.scale.setScalar(1.0 + pulse * 0.08);
        coreMat.emissiveIntensity = 1.0 + pulse * 0.7;
        innerLight.intensity = 1.0 + pulse * 1.2;
        // rotation removed — was distracting and read as "fast spinning thing in the ground"
    };

    return group;
});

// ---------------------------------------------------------------------------
// Per-corner dressing
// ---------------------------------------------------------------------------

// NW jungle dressing
MeshPresets.register('dio-palm-tree', () => {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2db84a, roughness: 0.7 });
    // curved trunk — 3 stacked tapered cylinders
    let y = 0;
    for (let i = 0; i < 3; i++) {
        const seg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18 - i * 0.03, 0.22 - i * 0.03, 1.1, 8),
            trunkMat
        );
        seg.position.y = y + 0.55;
        seg.rotation.z = (i - 1) * 0.12;
        seg.castShadow = true;
        group.add(seg);
        y += 1.05;
    }
    // 6 leaf fronds at the top
    for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(
            new THREE.ConeGeometry(0.3, 1.6, 4),
            leafMat
        );
        const a = (i / 6) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.6, 3.5, Math.sin(a) * 0.6);
        leaf.rotation.z = Math.cos(a) * 1.0;
        leaf.rotation.x = Math.sin(a) * 1.0;
        leaf.scale.x = 0.4;
        leaf.castShadow = true;
        group.add(leaf);
    }
    return group;
});

MeshPresets.register('dio-fern', () => {
    const group = new THREE.Group();
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3aaa45, roughness: 0.8 });
    for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(
            new THREE.ConeGeometry(0.18, 0.9, 4),
            leafMat
        );
        const a = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.15, 0.45, Math.sin(a) * 0.15);
        leaf.rotation.z = Math.cos(a) * 0.6;
        leaf.rotation.x = Math.sin(a) * 0.6;
        leaf.scale.x = 0.5;
        group.add(leaf);
    }
    return group;
});

MeshPresets.register('dio-mossy-boulder', () => {
    const group = new THREE.Group();
    const stone = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.8, 0),
        new THREE.MeshStandardMaterial({ color: 0x787872, roughness: 0.95 })
    );
    stone.scale.set(1.2, 0.8, 1.1);
    stone.castShadow = true; stone.receiveShadow = true;
    group.add(stone);
    // moss patch on top
    const moss = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x4ab84a, roughness: 0.85 })
    );
    moss.position.y = 0.55;
    moss.scale.set(1.3, 0.5, 1.2);
    group.add(moss);
    return group;
});

// NE business dressing
MeshPresets.register('dio-patio-table', () => {
    const group = new THREE.Group();
    const topMat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.5 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.7 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16), topMat);
    top.position.y = 0.85;
    top.castShadow = true;
    group.add(top);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), legMat);
    stem.position.y = 0.45;
    group.add(stem);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.06, 12), legMat);
    foot.position.y = 0.03;
    group.add(foot);
    return group;
});

MeshPresets.register('dio-queue-rope', () => {
    const group = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0xddaa22, roughness: 0.3, metalness: 0.8 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x880000, roughness: 0.8 });
    for (const x of [-0.7, 0.7]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 8), postMat);
        post.position.set(x, 0.5, 0);
        post.castShadow = true;
        group.add(post);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), postMat);
        cap.position.set(x, 1.05, 0);
        group.add(cap);
    }
    // sagging rope
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), ropeMat);
    rope.position.set(0, 0.85, 0);
    rope.rotation.z = Math.PI / 2;
    group.add(rope);
    return group;
});

MeshPresets.register('dio-awning-stripe', ({ width = 4 } = {}) => {
    const group = new THREE.Group();
    const tex = makeTex('dio-awning-stripe', (ctx) => {
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#e63946';
            ctx.fillRect(i * 16, 0, 16, 128);
        }
    }, 4, 1);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide });
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.6), mat);
    awning.position.y = 2.4;
    awning.rotation.x = -Math.PI / 4;
    group.add(awning);
    // 2 support posts
    const postMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    for (const x of [-width / 2 + 0.2, width / 2 - 0.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), postMat);
        post.position.set(x, 1.2, 0);
        post.castShadow = true;
        group.add(post);
    }
    return group;
});

// SE factory dressing
MeshPresets.register('dio-pipe-arch', () => {
    const group = new THREE.Group();
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.4, metalness: 0.85 });
    // 2 vertical pipes
    for (const x of [-2.0, 2.0]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.2, 12), pipeMat);
        pipe.position.set(x, 1.6, 0);
        pipe.castShadow = true;
        group.add(pipe);
    }
    // top horizontal pipe
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.4, 12), pipeMat);
    top.rotation.z = Math.PI / 2;
    top.position.y = 3.2;
    top.castShadow = true;
    group.add(top);
    // valve wheels
    for (const x of [-2.0, 2.0]) {
        const wheel = new THREE.Mesh(
            new THREE.TorusGeometry(0.22, 0.05, 6, 12),
            new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.5 })
        );
        wheel.position.set(x, 2.4, 0);
        group.add(wheel);
    }
    return group;
});

MeshPresets.register('dio-crate-stack', () => {
    const group = new THREE.Group();
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb37a3a, roughness: 0.95 });
    const slats = new THREE.MeshStandardMaterial({ color: 0x6e451d, roughness: 0.95 });
    const positions = [
        [0, 0.4, 0, 0],
        [0.7, 0.4, 0.2, 0.3],
        [0.35, 1.2, 0.1, 0.15]
    ];
    for (const [x, y, z, ry] of positions) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), crateMat);
        crate.position.set(x, y, z);
        crate.rotation.y = ry;
        crate.castShadow = true; crate.receiveShadow = true;
        group.add(crate);
        // slats on top
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.05, 0.74), slats);
        top.position.set(x, y + 0.36, z);
        top.rotation.y = ry;
        group.add(top);
    }
    return group;
});

MeshPresets.register('dio-conveyor-stub', () => {
    const group = new THREE.Group();
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.7 });
    const belt = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.7), beltMat);
    belt.position.y = 0.5;
    belt.castShadow = true; belt.receiveShadow = true;
    group.add(belt);
    // 4 legs
    for (const [x, z] of [[-1.0, -0.3], [1.0, -0.3], [-1.0, 0.3], [1.0, 0.3]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), frameMat);
        leg.position.set(x, 0.25, z);
        group.add(leg);
    }
    // end rollers
    for (const x of [-1.2, 1.2]) {
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 12), frameMat);
        roller.rotation.x = Math.PI / 2;
        roller.position.set(x, 0.5, 0);
        group.add(roller);
    }
    return group;
});

MeshPresets.register('dio-locked-plinth', () => {
    const group = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
    const lockMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00, emissive: 0x553300, emissiveIntensity: 0.6
    });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), baseMat);
    plinth.position.y = 0.2;
    plinth.castShadow = true; plinth.receiveShadow = true;
    group.add(plinth);
    // padlock icon — torus + box
    const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.15), lockMat);
    lockBody.position.y = 0.7;
    group.add(lockBody);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 10, Math.PI), lockMat);
    shackle.position.y = 0.85;
    shackle.rotation.x = Math.PI / 2;
    group.add(shackle);
    return group;
});

// ---------------------------------------------------------------------------
// Basecamp — town square dressing
// ---------------------------------------------------------------------------

// Cobblestone ground pad for the safe zone
MeshPresets.register('dio-pad-cobble', ({ size, width = 20, depth = 20 } = {}) => {
    const w = size ?? width;
    const d = size ?? depth;
    const tex = makePadTex('dio-pad-cobble', 256, 256, (ctx, W, H) => {
        // warm grey base
        ctx.fillStyle = '#8a8478';
        ctx.fillRect(0, 0, W, H);
        // cobblestone grid — irregular rounded rects
        for (let gx = 0; gx < W; gx += 18) {
            for (let gy = 0; gy < H; gy += 18) {
                const ox = (Math.random() - 0.5) * 4;
                const oy = (Math.random() - 0.5) * 4;
                const sw = 14 + (Math.random() - 0.5) * 4;
                const sh = 14 + (Math.random() - 0.5) * 4;
                const light = 100 + Math.floor(Math.random() * 50);
                ctx.fillStyle = `rgb(${light},${light - 8},${light - 16})`;
                ctx.beginPath();
                ctx.roundRect(gx + ox + 1, gy + oy + 1, sw, sh, 3);
                ctx.fill();
            }
        }
        // grout lines — darker gaps
        ctx.strokeStyle = 'rgba(50,45,40,0.4)';
        ctx.lineWidth = 1.5;
        for (let gx = 0; gx < W; gx += 18) {
            for (let gy = 0; gy < H; gy += 18) {
                ctx.strokeRect(gx + 1, gy + 1, 16, 16);
            }
        }
    });
    const mat = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.95, metalness: 0.0
    });
    return groundPad(w, d, mat);
});

// Flagpole with pennant
MeshPresets.register('dio-flagpole', () => {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.7 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.0, 8), poleMat);
    pole.position.y = 2.5;
    pole.castShadow = true;
    g.add(pole);
    // ball finial
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), poleMat);
    ball.position.y = 5.05;
    g.add(ball);
    // pennant
    const flagMat = new THREE.MeshStandardMaterial({
        color: 0xe63946, roughness: 0.8, side: THREE.DoubleSide
    });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), flagMat);
    flag.position.set(0.5, 4.7, 0);
    g.add(flag);
    // gentle sway
    flag.onBeforeRender = () => {
        const t = performance.now() * 0.001;
        flag.rotation.y = Math.sin(t * 1.2) * 0.15;
        flag.position.x = 0.5 + Math.sin(t * 1.2) * 0.05;
    };
    return g;
});

// Stone well
MeshPresets.register('dio-well', () => {
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7a756e, roughness: 0.95 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
    // circular wall
    const wallGeo = jitterGeo(new THREE.CylinderGeometry(0.7, 0.75, 0.8, 12), 0.04);
    const wall = new THREE.Mesh(wallGeo, stoneMat);
    wall.position.y = 0.4;
    wall.castShadow = true;
    g.add(wall);
    // inner dark void
    const inner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.1, 12),
        new THREE.MeshStandardMaterial({ color: 0x111115 })
    );
    inner.position.y = 0.81;
    g.add(inner);
    // cross-beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), woodMat);
    beam.position.y = 1.5;
    beam.castShadow = true;
    g.add(beam);
    // 2 uprights
    for (const x of [-0.65, 0.65]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), woodMat);
        post.position.set(x, 1.15, 0);
        g.add(post);
    }
    // bucket
    const bucket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.14, 6),
        new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.85 })
    );
    bucket.position.set(0.1, 1.2, 0);
    g.add(bucket);
    return g;
});

// Warm lamp post
MeshPresets.register('dio-lamp-post', () => {
    const g = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.7 });
    // pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.8, 8), metalMat);
    pole.position.y = 1.4;
    pole.castShadow = true;
    g.add(pole);
    // arm
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), metalMat);
    arm.position.set(0.25, 2.75, 0);
    g.add(arm);
    // lantern
    const lanternMat = new THREE.MeshStandardMaterial({
        color: 0xffe8a0, emissive: 0xffcc44, emissiveIntensity: 1.2, roughness: 0.4
    });
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.18), lanternMat);
    lantern.position.set(0.5, 2.65, 0);
    g.add(lantern);
    // warm light
    const light = new THREE.PointLight(0xffcc66, 0.5, 8, 1.5);
    light.position.set(0.5, 2.6, 0);
    g.add(light);
    return g;
});

// Wooden bench
MeshPresets.register('dio-bench', () => {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.9 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.5 });
    // seat planks
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.4), woodMat);
    seat.position.y = 0.45;
    seat.castShadow = true; seat.receiveShadow = true;
    g.add(seat);
    // backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.05), woodMat);
    back.position.set(0, 0.7, -0.18);
    back.rotation.x = 0.1;
    g.add(back);
    // 2 leg frames
    for (const x of [-0.45, 0.45]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.35), legMat);
        leg.position.set(x, 0.225, 0);
        g.add(leg);
    }
    return g;
});

// Water barrel
MeshPresets.register('dio-barrel-water', () => {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.95 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.5 });
    const barrel = new THREE.Mesh(
        jitterGeo(new THREE.CylinderGeometry(0.35, 0.3, 0.8, 10), 0.02),
        woodMat
    );
    barrel.position.y = 0.4;
    barrel.castShadow = true;
    g.add(barrel);
    // metal bands
    for (const y of [0.15, 0.65]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.31, 0.04, 10), bandMat);
        band.position.y = y;
        g.add(band);
    }
    // water surface
    const water = new THREE.Mesh(
        new THREE.CircleGeometry(0.32, 10),
        new THREE.MeshStandardMaterial({ color: 0x3a6a8a, roughness: 0.2, metalness: 0.1 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.78;
    g.add(water);
    return g;
});

// Flower planter box
MeshPresets.register('dio-flower-box', () => {
    const g = new THREE.Group();
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.95 });
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1.0 });
    // planter
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.4), boxMat);
    box.position.y = 0.175;
    box.castShadow = true;
    g.add(box);
    // dirt top
    const dirt = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.05, 0.34), dirtMat);
    dirt.position.y = 0.35;
    g.add(dirt);
    // flowers — small colorful spheres
    const colors = [0xff4466, 0xffaa22, 0xff66aa, 0xffee44, 0xaa44ff];
    for (let i = 0; i < 5; i++) {
        const bloom = new THREE.Mesh(
            new THREE.SphereGeometry(0.06 + Math.random() * 0.04, 6, 6),
            new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.7 })
        );
        bloom.position.set(
            (Math.random() - 0.5) * 0.6,
            0.42 + Math.random() * 0.1,
            (Math.random() - 0.5) * 0.2
        );
        g.add(bloom);
    }
    // stems — thin green cylinders
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2a7a2a, roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15, 4), stemMat);
        stem.position.set((Math.random() - 0.5) * 0.5, 0.42, (Math.random() - 0.5) * 0.15);
        g.add(stem);
    }
    return g;
});

// ---------------------------------------------------------------------------
// Market Zone — open-air zombie product bazaar (north of basecamp)
// ---------------------------------------------------------------------------

// Terracotta/clay ground pad for the market square
MeshPresets.register('dio-pad-market', ({ size, width = 14, depth = 12 } = {}) => {
    const w = size ?? width;
    const d = size ?? depth;
    const tex = makePadTex('dio-pad-market', 256, 256, (ctx, W, H) => {
        // warm terracotta base
        ctx.fillStyle = '#a08060';
        ctx.fillRect(0, 0, W, H);
        // clay tile pattern — offset rows
        for (let row = 0; row < H; row += 20) {
            const offset = (Math.floor(row / 20) % 2) * 12;
            for (let col = 0; col < W; col += 24) {
                const ox = (Math.random() - 0.5) * 2;
                const oy = (Math.random() - 0.5) * 2;
                const light = 140 + Math.floor(Math.random() * 40);
                ctx.fillStyle = `rgb(${light},${light - 30},${light - 50})`;
                ctx.beginPath();
                ctx.roundRect(col + offset + ox + 1, row + oy + 1, 20, 16, 2);
                ctx.fill();
            }
        }
        // grout
        ctx.strokeStyle = 'rgba(60,40,30,0.3)';
        ctx.lineWidth = 1;
        for (let row = 0; row < H; row += 20) {
            const offset = (Math.floor(row / 20) % 2) * 12;
            for (let col = 0; col < W; col += 24) {
                ctx.strokeRect(col + offset + 1, row + 1, 20, 16);
            }
        }
    });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    return groundPad(w, d, mat);
});

// Factory ground pad — industrial concrete with oil stains and safety lines
MeshPresets.register('dio-pad-factory', ({ size, width = 20, depth = 20 } = {}) => {
    const w = size ?? width;
    const d = size ?? depth;

    // --- Tiling honeycomb metal grating ---
    // One tile = 2x2 panel section. Tiles via RepeatWrapping so hex cells
    // stay large and readable no matter how big the pad grows.
    // To expand the factory, just increase width/depth — the texture tiles.
    const S = 512;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // Seeded random for deterministic rust/oil placement across reloads
    let _s = 77;
    const rng = () => { _s = (_s * 16807) % 2147483647; return (_s - 1) / 2147483646; };

    // ── 1. Deep void beneath the grating ──
    ctx.fillStyle = '#0d0e10';
    ctx.fillRect(0, 0, S, S);
    // Faint under-structure glow (machinery beneath)
    const underGlow = ctx.createRadialGradient(S * 0.5, S * 0.5, 0, S * 0.5, S * 0.5, S * 0.45);
    underGlow.addColorStop(0, 'rgba(30,35,25,0.15)');
    underGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = underGlow;
    ctx.fillRect(0, 0, S, S);

    // ── 2. Frame grid — 3x3 panels per tile ──
    const cols = 3, rows = 3;
    const frameW = 8;
    const panelW = (S - frameW * (cols + 1)) / cols;
    const panelH = (S - frameW * (rows + 1)) / rows;

    // Frame body — brushed gunmetal
    ctx.fillStyle = '#3a3d42';
    ctx.fillRect(0, 0, S, S);
    // Brushed-metal grain on frame
    for (let y = 0; y < S; y += 1) {
        const a = 0.01 + rng() * 0.03;
        ctx.fillStyle = `rgba(200,205,210,${a})`;
        ctx.fillRect(0, y, S, 1);
    }
    // Frame edge bevels
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let c = 0; c <= cols; c++) {
        ctx.fillRect(c * (panelW + frameW), 0, 2, S);
    }
    for (let r = 0; r <= rows; r++) {
        ctx.fillRect(0, r * (panelH + frameW), S, 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let c = 0; c <= cols; c++) {
        ctx.fillRect(c * (panelW + frameW) + frameW - 2, 0, 2, S);
    }
    for (let r = 0; r <= rows; r++) {
        ctx.fillRect(0, r * (panelH + frameW) + frameW - 2, S, 2);
    }

    // ── 3. Panels with honeycomb mesh ──
    const hexR = 7;
    const spacingX = hexR * 2 * 0.82;
    const spacingY = hexR * Math.sqrt(3) * 0.88;

    function drawHex(cx, cy, r) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = Math.PI / 6 + (Math.PI / 3) * i;
            const vx = cx + r * Math.cos(a);
            const vy = cy + r * Math.sin(a);
            if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const px = frameW + c * (panelW + frameW);
            const py = frameW + r * (panelH + frameW);

            // Panel base
            ctx.fillStyle = '#1e2024';
            ctx.fillRect(px, py, panelW, panelH);

            // Per-panel tint drift
            const tint = 22 + Math.floor(rng() * 10);
            ctx.fillStyle = `rgba(${tint},${tint + 1},${tint + 3},0.3)`;
            ctx.fillRect(px, py, panelW, panelH);

            // Clip to panel
            ctx.save();
            ctx.beginPath();
            ctx.rect(px + 2, py + 2, panelW - 4, panelH - 4);
            ctx.clip();

            // Metal web between hexes — draw the solid metal first
            // then punch hex holes through it
            ctx.fillStyle = '#2a2d32';
            ctx.fillRect(px, py, panelW, panelH);

            // Hex holes
            for (let hy = py - hexR; hy < py + panelH + hexR * 2; hy += spacingY) {
                const rowIdx = Math.round((hy - py) / spacingY);
                const offX = (rowIdx % 2) * (spacingX / 2);
                for (let hx = px - hexR + offX; hx < px + panelW + hexR; hx += spacingX) {
                    // Void hole
                    drawHex(hx, hy, hexR - 3);
                    ctx.fillStyle = '#08090b';
                    ctx.fill();

                    // Inner edge shadow (depth illusion)
                    drawHex(hx, hy, hexR - 2.5);
                    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // Top-left lit edge of the metal web around each hex
                    drawHex(hx, hy, hexR - 2);
                    ctx.strokeStyle = 'rgba(120,125,135,0.25)';
                    ctx.lineWidth = 0.8;
                    ctx.stroke();

                    // Grime buildup in hex corners (years of dust/grease)
                    if (rng() < 0.3) {
                        const gAngle = rng() * Math.PI * 2;
                        const gx = hx + Math.cos(gAngle) * (hexR - 2);
                        const gy = hy + Math.sin(gAngle) * (hexR - 2);
                        const gr = 2 + rng() * 2;
                        const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
                        gg.addColorStop(0, 'rgba(50,42,30,0.4)');
                        gg.addColorStop(1, 'rgba(50,42,30,0)');
                        ctx.fillStyle = gg;
                        ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
                    }
                }
            }
            ctx.restore();

            // Panel inset shadow (recessed look)
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1);
            // Bottom-right highlight bevel
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px + panelW - 1, py + 3);
            ctx.lineTo(px + panelW - 1, py + panelH - 1);
            ctx.lineTo(px + 3, py + panelH - 1);
            ctx.stroke();
        }
    }

    // ── 4. Hex-head bolts at frame intersections ──
    const boltR = 4;
    for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
            const bx = c * (panelW + frameW) + frameW / 2;
            const by = r * (panelH + frameW) + frameW / 2;

            // Bolt shadow
            ctx.beginPath();
            ctx.arc(bx + 1, by + 1, boltR + 1, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fill();

            // Hex-head bolt body
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i;
                const vx = bx + boltR * Math.cos(a);
                const vy = by + boltR * Math.sin(a);
                if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
            }
            ctx.closePath();
            // Gradient fill — 3D rounded look
            const bGrad = ctx.createRadialGradient(bx - 2, by - 2, 0, bx, by, boltR);
            bGrad.addColorStop(0, '#7a7e85');
            bGrad.addColorStop(0.5, '#55585e');
            bGrad.addColorStop(1, '#35383d');
            ctx.fillStyle = bGrad;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Top highlight arc
            ctx.beginPath();
            ctx.arc(bx - 1, by - 1, boltR * 0.55, Math.PI * 1.1, Math.PI * 1.8);
            ctx.strokeStyle = 'rgba(200,205,215,0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Socket cross
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bx - 3, by); ctx.lineTo(bx + 3, by);
            ctx.moveTo(bx, by - 3); ctx.lineTo(bx, by + 3);
            ctx.stroke();

            // Random: some bolts have rust ring
            if (rng() < 0.35) {
                ctx.beginPath();
                ctx.arc(bx, by, boltR + 2, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(160,80,25,${0.15 + rng() * 0.15})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }

    // ── 5. Rust patches — years of weathering ──
    for (let i = 0; i < 6; i++) {
        const rx = rng() * S, ry = rng() * S;
        const rr = 25 + rng() * 50;
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(rng() * Math.PI);
        ctx.scale(1, 0.6 + rng() * 0.8);
        const rGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
        const intensity = 0.12 + rng() * 0.18;
        rGrad.addColorStop(0, `rgba(170,85,30,${intensity})`);
        rGrad.addColorStop(0.4, `rgba(140,65,20,${intensity * 0.6})`);
        rGrad.addColorStop(0.7, `rgba(120,55,15,${intensity * 0.3})`);
        rGrad.addColorStop(1, 'rgba(120,55,15,0)');
        ctx.fillStyle = rGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, rr * 1.3, rr, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    // Small intense rust pits
    for (let i = 0; i < 15; i++) {
        const px = rng() * S, py = rng() * S;
        const pr = 2 + rng() * 5;
        const pGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
        pGrad.addColorStop(0, `rgba(190,95,20,${0.2 + rng() * 0.2})`);
        pGrad.addColorStop(1, 'rgba(190,95,20,0)');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── 6. Oil drips & stains ──
    for (let i = 0; i < 4; i++) {
        const ox = 40 + rng() * (S - 80);
        const oy = 40 + rng() * (S - 80);
        // Drip trail — a wobbly line downward
        ctx.save();
        ctx.globalAlpha = 0.18 + rng() * 0.12;
        ctx.strokeStyle = '#15171a';
        ctx.lineWidth = 4 + rng() * 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        let dx = ox, dy = oy;
        const dripLen = 20 + rng() * 40;
        for (let step = 0; step < dripLen; step += 4) {
            dx += (rng() - 0.5) * 6;
            dy += 3 + rng() * 3;
            ctx.lineTo(dx, dy);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
        // Pooling spot at drip end
        const poolGrad = ctx.createRadialGradient(dx, dy, 0, dx, dy, 8 + rng() * 6);
        poolGrad.addColorStop(0, 'rgba(18,20,24,0.3)');
        poolGrad.addColorStop(1, 'rgba(18,20,24,0)');
        ctx.fillStyle = poolGrad;
        ctx.fillRect(dx - 15, dy - 15, 30, 30);
    }

    // ── 7. Scratch marks — years of dragging equipment ──
    ctx.strokeStyle = 'rgba(90,95,105,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        const sx = rng() * S, sy = rng() * S;
        const len = 15 + rng() * 40;
        const angle = rng() * Math.PI;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
        ctx.stroke();
    }

    // ── 8. Subtle dust/dirt accumulation in corners ──
    for (const [cx, cy] of [[0, 0], [S, 0], [0, S], [S, S]]) {
        const dGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70);
        dGrad.addColorStop(0, 'rgba(55,48,35,0.12)');
        dGrad.addColorStop(1, 'rgba(55,48,35,0)');
        ctx.fillStyle = dGrad;
        ctx.fillRect(cx - 70, cy - 70, 140, 140);
    }

    // ── Texture setup — tiling so panels stay readable at any size ──
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    // 2 repeats across the pad width → each tile covers 10 units at 20-wide.
    // Adjust repeat proportionally if width/depth differ from 20.
    tex.repeat.set(w / 10, d / 10);
    const mat = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.5, metalness: 0.5
    });
    return groundPad(w, d, mat);
});

// Market entrance arch — wooden posts + cross-beam + hanging sign
MeshPresets.register('dio-market-arch', () => {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.9 });
    // 2 posts
    for (const x of [-2.5, 2.5]) {
        const post = new THREE.Mesh(
            jitterGeo(new THREE.CylinderGeometry(0.15, 0.18, 3.8, 8), 0.02),
            woodMat
        );
        post.position.set(x, 1.9, 0);
        post.castShadow = true;
        g.add(post);
    }
    // cross-beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.3, 0.3), darkMat);
    beam.position.y = 3.8;
    beam.castShadow = true;
    g.add(beam);
    // sign board — hanging from beam
    const signTex = makeTex('dio-market-sign-tex', (ctx) => {
        ctx.fillStyle = '#2a1a10';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#f4c20d';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MARKET', 64, 55);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#ccaa44';
        ctx.fillText('Zombie Products', 64, 85);
    }, 1, 1);
    const signMat = new THREE.MeshStandardMaterial({
        map: signTex, emissive: 0x332200, emissiveIntensity: 0.3, roughness: 0.8
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 0.1), signMat);
    sign.position.y = 3.0;
    g.add(sign);
    // chains — thin cylinders connecting sign to beam
    for (const x of [-1.2, 1.2]) {
        const chain = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4),
            new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7 })
        );
        chain.position.set(x, 3.55, 0);
        g.add(chain);
    }
    // warm lights on the posts
    for (const x of [-2.5, 2.5]) {
        const light = new THREE.PointLight(0xffcc66, 0.4, 6, 1.5);
        light.position.set(x, 3.5, 0);
        g.add(light);
    }
    return g;
});

// Market stall — open vendor booth with awning + counter
MeshPresets.register('dio-market-stall', () => {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5a30, roughness: 0.9 });
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.85 });
    // 4 corner posts
    for (const [x, z] of [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), woodMat);
        post.position.set(x, 1.1, z);
        post.castShadow = true;
        g.add(post);
    }
    // awning — striped canvas
    const awningTex = makeTex('dio-market-awning', (ctx) => {
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#e8d8a0' : '#cc6622';
            ctx.fillRect(i * 16, 0, 16, 128);
        }
    }, 2, 1);
    const awningMat = new THREE.MeshStandardMaterial({
        map: awningTex, roughness: 0.8, side: THREE.DoubleSide
    });
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.5), awningMat);
    awning.position.set(0, 2.15, 0);
    awning.rotation.x = -Math.PI / 2 + 0.1;
    g.add(awning);
    // counter at front
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.5), counterMat);
    counter.position.set(0, 0.85, 0.55);
    counter.castShadow = true; counter.receiveShadow = true;
    g.add(counter);
    // shelf behind counter
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.4), woodMat);
    shelf.position.set(0, 1.3, -0.4);
    g.add(shelf);
    // a few product items on counter (colored boxes)
    const colors = [0xff4466, 0x44cc66, 0xffaa22, 0x4488ff];
    for (let i = 0; i < 3; i++) {
        const item = new THREE.Mesh(
            new THREE.BoxGeometry(0.15 + Math.random() * 0.1, 0.12, 0.12),
            new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.6 })
        );
        item.position.set(-0.5 + i * 0.5, 0.97, 0.55);
        g.add(item);
    }
    return g;
});

// Product crate — open crate with colorful product boxes
MeshPresets.register('dio-product-crate', () => {
    const g = new THREE.Group();
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.95 });
    // crate body
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), crateMat);
    crate.position.y = 0.2;
    crate.castShadow = true;
    g.add(crate);
    // product boxes inside
    const colors = [0xff3355, 0x33cc55, 0xffbb22, 0x3388ff, 0xff66aa];
    for (let i = 0; i < 4; i++) {
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(0.12 + Math.random() * 0.08, 0.1, 0.1),
            new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.5 })
        );
        box.position.set(
            (Math.random() - 0.5) * 0.35,
            0.45 + Math.random() * 0.05,
            (Math.random() - 0.5) * 0.25
        );
        box.rotation.y = Math.random() * 0.5;
        g.add(box);
    }
    return g;
});

// Market banner — tall pole with colorful fabric
MeshPresets.register('dio-market-banner', () => {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 6), poleMat);
    pole.position.y = 1.6;
    pole.castShadow = true;
    g.add(pole);
    // triangular pennant
    const pennantColors = [0xff4466, 0xffaa22, 0x44cc88, 0x4488ff, 0xff66cc];
    const color = pennantColors[Math.floor(Math.random() * pennantColors.length)];
    const pennantMat = new THREE.MeshStandardMaterial({
        color: color, roughness: 0.7, side: THREE.DoubleSide
    });
    // triangle shape
    const triGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([
        0, 0, 0, 0.6, 0, 0, 0, -0.8, 0
    ]);
    triGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    triGeo.computeVertexNormals();
    const pennant = new THREE.Mesh(triGeo, pennantMat);
    pennant.position.set(0.05, 3.1, 0);
    g.add(pennant);
    // gentle sway
    pennant.onBeforeRender = () => {
        const t = performance.now() * 0.001;
        pennant.rotation.y = Math.sin(t * 0.8 + g.position.x) * 0.12;
    };
    return g;
});

// Barrel with products displayed on top
MeshPresets.register('dio-barrel-display', () => {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.95 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.5 });
    const barrel = new THREE.Mesh(
        jitterGeo(new THREE.CylinderGeometry(0.35, 0.3, 0.8, 10), 0.02),
        woodMat
    );
    barrel.position.y = 0.4;
    barrel.castShadow = true;
    g.add(barrel);
    for (const y of [0.15, 0.65]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.31, 0.04, 10), bandMat);
        band.position.y = y;
        g.add(band);
    }
    // lid
    const lid = new THREE.Mesh(
        new THREE.CircleGeometry(0.33, 10),
        new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 })
    );
    lid.rotation.x = -Math.PI / 2;
    lid.position.y = 0.81;
    g.add(lid);
    // products on top
    const colors = [0xff3355, 0xffbb22, 0x33cc55];
    for (let i = 0; i < 3; i++) {
        const item = new THREE.Mesh(
            new THREE.BoxGeometry(0.13, 0.1, 0.1),
            new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.5 })
        );
        item.position.set(
            (Math.random() - 0.5) * 0.3,
            0.88,
            (Math.random() - 0.5) * 0.3
        );
        item.rotation.y = Math.random() * 1.0;
        g.add(item);
    }
    return g;
});

// A-frame market sign
MeshPresets.register('dio-market-sign', () => {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.9 });
    // two angled boards
    for (const sign of [-1, 1]) {
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.04), woodMat);
        board.position.set(0, 0.35, sign * 0.08);
        board.rotation.x = sign * 0.15;
        g.add(board);
    }
    // front face with text
    const faceTex = makeTex('dio-market-sign-face', (ctx) => {
        ctx.fillStyle = '#3a2a18';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#f4c20d';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SALE', 64, 50);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#ccaa44';
        ctx.fillText('Zombie Candy', 64, 75);
        ctx.fillText('& More!', 64, 95);
    }, 1, 1);
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.58), faceMat);
    face.position.set(0, 0.35, 0.1);
    g.add(face);
    return g;
});

// ---------------------------------------------------------------------------
// Restaurant — burger joint building + interior (LEGACY — kept for reuse)
// ---------------------------------------------------------------------------

MeshPresets.register('dio-restaurant-building', () => {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd4c8b0, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8a3030, roughness: 0.85 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x88aacc, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.4
    });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.95 });

    // floor slab
    const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 4), floorMat);
    floor.position.y = 0.05;
    floor.receiveShadow = true;
    g.add(floor);

    // back wall
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(6, 3.0, 0.15), wallMat);
    backWall.position.set(0, 1.5, -2);
    backWall.castShadow = true;
    g.add(backWall);

    // side walls
    for (const x of [-3, 3]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.0, 4), wallMat);
        side.position.set(x, 1.5, 0);
        side.castShadow = true;
        g.add(side);
        // window
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.0, 1.2), glassMat);
        win.position.set(x > 0 ? x + 0.08 : x - 0.08, 1.8, 0.3);
        g.add(win);
        // window frame
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.08), frameMat);
        frame.position.set(x > 0 ? x + 0.09 : x - 0.09, 1.8, -0.3);
        g.add(frame);
    }

    // roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.15, 4.4), roofMat);
    roof.position.y = 3.05;
    roof.castShadow = true; roof.receiveShadow = true;
    g.add(roof);

    // roof overhang (front awning)
    const overhang = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.08, 1.0), roofMat);
    overhang.position.set(0, 2.95, 2.5);
    overhang.rotation.x = -0.15;
    g.add(overhang);

    return g;
});

MeshPresets.register('dio-kitchen-counter', () => {
    const g = new THREE.Group();
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.3 });
    const applMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.5 });

    // main counter — long bar
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.0, 0.6), counterMat);
    counter.position.set(0, 0.5, 0);
    counter.castShadow = true; counter.receiveShadow = true;
    g.add(counter);

    // side counter — L shape
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 1.5), counterMat);
    side.position.set(-1.8, 0.5, -0.7);
    side.castShadow = true;
    g.add(side);

    // grill
    const grill = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.5), applMat);
    grill.position.set(0.5, 1.1, 0);
    g.add(grill);
    // fryer
    const fryer = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), applMat);
    fryer.position.set(-0.5, 1.15, 0);
    g.add(fryer);
    // register
    const reg = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.25, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 })
    );
    reg.position.set(1.5, 1.12, 0);
    g.add(reg);

    return g;
});

MeshPresets.register('dio-menu-board', () => {
    const g = new THREE.Group();
    const tex = makeTex('dio-menu-board', (ctx) => {
        // dark background
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(0, 0, 128, 128);
        // faint menu lines
        const colors = ['#ff6644', '#ffaa22', '#44cc66', '#ffee44', '#ff88aa'];
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = colors[i % colors.length];
            ctx.globalAlpha = 0.6;
            ctx.fillRect(10, 10 + i * 14, 50 + Math.random() * 40, 8);
        }
        ctx.globalAlpha = 1;
        // price column
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 8; i++) {
            ctx.fillRect(100, 10 + i * 14, 20, 8);
        }
    }, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
        map: tex,
        emissive: 0x222244,
        emissiveIntensity: 0.5,
        roughness: 0.7
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 0.06), mat);
    board.position.y = 2.0;
    g.add(board);
    return g;
});

MeshPresets.register('dio-trash-can', () => {
    const g = new THREE.Group();
    const canMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.6, 8), canMat);
    body.position.y = 0.3;
    body.castShadow = true;
    g.add(body);
    // lid
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 8), canMat);
    lid.position.y = 0.62;
    g.add(lid);
    // handle
    const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.06, 0.015, 4, 8, Math.PI),
        canMat
    );
    handle.position.y = 0.66;
    handle.rotation.x = Math.PI / 2;
    g.add(handle);
    return g;
});

// ---------------------------------------------------------------------------
// Factory — industrial compound dressing
// ---------------------------------------------------------------------------

MeshPresets.register('dio-factory-building', () => {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.85, metalness: 0.2 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.7, metalness: 0.3 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.95 });

    // concrete floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 5), floorMat);
    floor.position.y = 0.05;
    floor.receiveShadow = true;
    g.add(floor);

    // back wall
    const back = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 0.15), wallMat);
    back.position.set(0, 1.75, -2.5);
    back.castShadow = true;
    g.add(back);

    // side walls
    for (const x of [-4, 4]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.5, 5), wallMat);
        side.position.set(x, 1.75, 0);
        side.castShadow = true;
        g.add(side);
    }

    // front wall with bay door opening
    // left section
    const frontL = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.5, 0.15), wallMat);
    frontL.position.set(-2.75, 1.75, 2.5);
    frontL.castShadow = true;
    g.add(frontL);
    // right section
    const frontR = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.5, 0.15), wallMat);
    frontR.position.set(2.75, 1.75, 2.5);
    frontR.castShadow = true;
    g.add(frontR);
    // lintel above door
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 0.2), frameMat);
    lintel.position.set(0, 3.3, 2.5);
    g.add(lintel);

    // corrugated ridges on side walls — thin horizontal strips
    for (const x of [-4.08, 4.08]) {
        for (let y = 0.4; y < 3.4; y += 0.3) {
            const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 4.8), wallMat);
            ridge.position.set(x, y, 0);
            g.add(ridge);
        }
    }

    // roof — slight slope
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.12, 5.4), roofMat);
    roof.position.y = 3.56;
    roof.rotation.x = -0.05;
    roof.castShadow = true;
    g.add(roof);

    // interior light
    const light = new THREE.PointLight(0xffddaa, 0.3, 8, 1.5);
    light.position.set(0, 3.0, 0);
    g.add(light);

    return g;
});

// ─────────────────────────────────────────────────────────────────────
// GearWorks machine — unified-workbench variant. An outer metal rail
// frame borders the whole machine; inside, a single wooden workbench
// slab spans the full width, and everything sits on top of it as one
// continuous machine:
//
//   [metal rail frame ────────────────────────────────────]
//   |  ✨ essence (resting)   ⚙ ⚙ gears (on axles)   💰 coin (flat)  |
//   |  ● ● ● ● ● ● ● ● ● ●                                           |
//   |  pip counter ("need N")              gold slot ring (stack)    |
//   [ ──────────────── wooden workbench ──────────────── ]
//
// The rail frame defines the machine's footprint. The wooden slab fills
// the frame interior and is the "surface" everything rests on. Essence
// and coin are static; gears spin on metal axle posts rising from the
// wood. Counter pips on the wood near the essence show required input
// count (wave-pulse breathing). A gold torus ring is inlaid in the wood
// under the coin marking the stack slot.
//
// { cost, output, outputCount } are accepted for call-site compat — the
// first cost count drives the pip count.
// ─────────────────────────────────────────────────────────────────────
MeshPresets.register('dio-gearworks-machine', ({
    // eslint-disable-next-line no-unused-vars
    cost = { essence: 10 }, output = 'coin', outputCount = 1
} = {}) => {
    const root = new THREE.Group();

    const inputX = -2.5;
    const outputX = 3.2;
    const WOOD_TOP = 0.2;        // top surface of the wooden slab
    const GEAR_Y = 1.0;        // gear center height above the wood

    // ── Materials ──
    const railMat = new THREE.MeshStandardMaterial({
        color: 0x4a5058, roughness: 0.55, metalness: 0.35
    });
    const postMat = new THREE.MeshStandardMaterial({
        color: 0x2a2f34, roughness: 0.75, metalness: 0.25
    });
    const woodMat = new THREE.MeshStandardMaterial({
        color: 0x6b4a2b, roughness: 0.92, metalness: 0.0
    });
    const plankLineMat = new THREE.MeshStandardMaterial({
        color: 0x3e2a15, roughness: 0.95, metalness: 0.0
    });
    const axleMat = new THREE.MeshStandardMaterial({
        color: 0x5a5f66, roughness: 0.4, metalness: 0.85
    });
    const boltMat = new THREE.MeshStandardMaterial({
        color: 0x6a6f76, roughness: 0.35, metalness: 0.9
    });

    // ── Outer rail frame ("the border") ──
    // Four low metal rails forming a rectangle on the ground, plus four
    // corner posts rising above them for visual punctuation.
    const frameW = 8.4, frameD = 2.4;
    const railH = 0.15, railT = 0.12;

    const frontRail = new THREE.Mesh(
        new THREE.BoxGeometry(frameW, railH, railT), railMat
    );
    frontRail.position.set(0, railH / 2 + 0.05, frameD / 2);
    root.add(frontRail);

    const backRail = frontRail.clone();
    backRail.position.set(0, railH / 2 + 0.05, -frameD / 2);
    root.add(backRail);

    const leftRail = new THREE.Mesh(
        new THREE.BoxGeometry(railT, railH, frameD + railT), railMat
    );
    leftRail.position.set(-frameW / 2, railH / 2 + 0.05, 0);
    root.add(leftRail);

    const rightRail = leftRail.clone();
    rightRail.position.set(frameW / 2, railH / 2 + 0.05, 0);
    root.add(rightRail);

    // Four corner posts — short stubs at each corner, rising above rails
    const cornerPosts = [];
    for (const [cx, cz] of [
        [-frameW / 2, -frameD / 2],
        [frameW / 2, -frameD / 2],
        [-frameW / 2, frameD / 2],
        [frameW / 2, frameD / 2]
    ]) {
        const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.5, 0.18), postMat
        );
        post.position.set(cx, 0.27, cz);
        root.add(post);
        cornerPosts.push(post);
    }

    // ── Wooden workbench slab — fills the frame interior ──
    const woodW = frameW - railT * 2 - 0.02;
    const woodD = frameD - railT * 2 - 0.02;
    const woodH = 0.2;
    const wood = new THREE.Mesh(
        new THREE.BoxGeometry(woodW, woodH, woodD), woodMat
    );
    wood.position.set(0, woodH / 2, 0);
    wood.receiveShadow = true;
    root.add(wood);

    // Plank divider grooves — thin dark strips across the wood top,
    // suggesting 5 separate planks glued edge-to-edge. Recessed slightly
    // into the wood surface so they read as grooves, not ridges.
    const plankDividers = 4;
    for (let i = 0; i < plankDividers; i++) {
        const groove = new THREE.Mesh(
            new THREE.BoxGeometry(0.025, 0.03, woodD + 0.02), plankLineMat
        );
        // Evenly spaced across the wood width
        const gx = -woodW / 2 + (woodW * (i + 1)) / (plankDividers + 1);
        groove.position.set(gx, WOOD_TOP - 0.01, 0);
        root.add(groove);
    }

    // Edge bolts on the wood — small metal hemispheres along the long
    // edges, suggesting the wood is bolted to the rail frame.
    const edgeBoltGeo = new THREE.SphereGeometry(0.055, 10, 8);
    for (const zSide of [-woodD / 2 + 0.08, woodD / 2 - 0.08]) {
        for (const xBolt of [-woodW / 2 + 0.18, 0, woodW / 2 - 0.18]) {
            const bolt = new THREE.Mesh(edgeBoltGeo, boltMat);
            bolt.position.set(xBolt, WOOD_TOP + 0.01, zSide);
            root.add(bolt);
        }
    }

    // ── Status LEDs on the two front corner posts ──
    // Small emissive bulbs on the tops of the front-left and front-right
    // corner posts. They breathe out of phase with each other.
    const inputStatusMat = new THREE.MeshStandardMaterial({
        color: 0xddffdd, emissive: 0x44ff88, emissiveIntensity: 1.4,
        roughness: 0.2, metalness: 0.0
    });
    const outputStatusMat = new THREE.MeshStandardMaterial({
        color: 0xfff0dd, emissive: 0xffc044, emissiveIntensity: 1.4,
        roughness: 0.2, metalness: 0.0
    });
    const statusGeo = new THREE.SphereGeometry(0.07, 12, 10);
    const inputStatus = new THREE.Mesh(statusGeo, inputStatusMat);
    inputStatus.position.set(-frameW / 2, 0.56, frameD / 2);
    root.add(inputStatus);
    const outputStatus = new THREE.Mesh(statusGeo, outputStatusMat);
    outputStatus.position.set(frameW / 2, 0.56, frameD / 2);
    root.add(outputStatus);

    // ── Axle posts rising from the wood, one per gear ──
    // Small metal cylinders connecting the wood surface to the gear
    // hubs, so the gears look mounted to the bench rather than floating.
    const bigGearX = -0.2;
    const smallGearX = 0.9;
    const axleR = 0.055;
    const axleH = GEAR_Y - WOOD_TOP + 0.05; // slightly into the gear
    function makeAxle(ax) {
        const m = new THREE.Mesh(
            new THREE.CylinderGeometry(axleR, axleR, axleH, 14), axleMat
        );
        m.position.set(ax, WOOD_TOP + axleH / 2, 0);
        return m;
    }
    root.add(makeAxle(bigGearX));
    root.add(makeAxle(smallGearX));

    // (Overhead arch removed for cleaner input section visibility)

    // ── Coin stack slot — flush emissive gold torus inlaid in the wood ──
    // Marks the output zone: where coins land and stack. Sits directly
    // on the wood surface (slightly raised to avoid z-fighting).
    const slotMat = new THREE.MeshStandardMaterial({
        color: 0xffe088, emissive: 0xffaa22, emissiveIntensity: 1.0,
        roughness: 0.28, metalness: 0.3
    });
    const slot = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.032, 10, 36), slotMat
    );
    slot.position.set(outputX, WOOD_TOP + 0.012, 0);
    slot.rotation.x = Math.PI / 2; // lay flat on wood
    root.add(slot);

    // Shared glass material for gears (matches essence-tube aesthetic)
    const gearGlassMat = new THREE.MeshStandardMaterial({
        color: 0xbfe6ff,
        emissive: 0x3399ff,
        emissiveIntensity: 0.55,
        roughness: 0.12,
        metalness: 0.0,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const gearHubGlassMat = new THREE.MeshStandardMaterial({
        color: 0xddf3ff,
        emissive: 0x66bbff,
        emissiveIntensity: 0.9,
        roughness: 0.08,
        metalness: 0.0,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    // ── Gear factory — vertical (Y) spin axis ──
    // CylinderGeometry's default axis is Y, so no rotation correction
    // needed on disk or hub. Teeth live in the XZ plane, positioned
    // radially and rotated around Y to face outward.
    function makeGear(radius, toothCount) {
        const g = new THREE.Group();
        const thickness = 0.18;
        const toothLen = radius * 0.34;
        const toothTangentW = (radius * 2 * Math.PI / toothCount) * 0.55;

        // Disk
        const disk = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, thickness, 32),
            gearGlassMat
        );
        g.add(disk);

        // Teeth around the rim
        for (let i = 0; i < toothCount; i++) {
            const a = (i / toothCount) * Math.PI * 2;
            const tooth = new THREE.Mesh(
                // box X = radial length, Y = disc thickness, Z = tangential width
                new THREE.BoxGeometry(toothLen, thickness, toothTangentW),
                gearGlassMat
            );
            tooth.position.set(
                Math.cos(a) * (radius + toothLen * 0.45),
                0,
                -Math.sin(a) * (radius + toothLen * 0.45)
            );
            tooth.rotation.y = a; // align box +X with radial direction at angle a
            g.add(tooth);
        }

        // Hub — brighter glass center highlight
        const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, thickness * 1.25, 16),
            gearHubGlassMat
        );
        g.add(hub);

        return g;
    }

    // ── Two meshing gears on their axle posts ──
    const bigGear = makeGear(0.55, 10);
    bigGear.position.set(bigGearX, GEAR_Y, 0);
    root.add(bigGear);

    const smallGear = makeGear(0.38, 8);
    smallGear.position.set(smallGearX, GEAR_Y, 0);
    root.add(smallGear);

    // ── Input slots — data-driven, one per cost entry ──
    // Each slot: deep dark recessed tray with a thick raised metallic rim,
    // a miniature resource mesh sitting inside, and a large glowing "0/N"
    // counter floating high above. Scales to 1, 2, or 3+ inputs based on
    // Object.entries(cost).

    // Slot materials
    const slotBaseMat = new THREE.MeshStandardMaterial({
        color: 0x12141a, roughness: 0.8, metalness: 0.25
    });
    const slotRimMat = new THREE.MeshStandardMaterial({
        color: 0x7a8090, roughness: 0.35, metalness: 0.65
    });
    const slotRimTopMat = new THREE.MeshStandardMaterial({
        color: 0x8a909c, roughness: 0.3, metalness: 0.7
    });

    const inputs = Object.entries(cost);
    const slotW = 1.5, slotD = 1.5;
    const slotDepth = 0.12;        // how deep the cavity is sunk
    const rimW = 0.10;             // rim bar width
    const rimH = 0.08;             // rim bar height
    const slotGap = 0.35;
    const totalInputW = inputs.length * slotW + (inputs.length - 1) * slotGap;
    const slotStartX = inputX - totalInputW / 2 + slotW / 2;

    root.userData.inputCounters = [];

    inputs.forEach(([type, count], i) => {
        const sx = slotStartX + i * (slotW + slotGap);

        // ── Dark recessed cavity — sunk below the wood surface ──
        const cavity = new THREE.Mesh(
            new THREE.BoxGeometry(slotW - rimW, slotDepth, slotD - rimW),
            slotBaseMat
        );
        cavity.position.set(sx, WOOD_TOP - slotDepth / 2 - 0.005, 0);
        root.add(cavity);

        // ── Thick raised metallic rim — 4 chunky bars framing the slot ──
        // These sit ON the wood, rising above its surface. The inner edge
        // lines up with the cavity opening; the outer edge extends past it.
        const rimY = WOOD_TOP + rimH / 2;

        // Front + back rims (along X axis)
        for (const zSign of [-1, 1]) {
            const bar = new THREE.Mesh(
                new THREE.BoxGeometry(slotW + rimW, rimH, rimW), slotRimMat
            );
            bar.position.set(sx, rimY, zSign * (slotD / 2));
            root.add(bar);
        }
        // Left + right rims (along Z axis)
        for (const xSign of [-1, 1]) {
            const bar = new THREE.Mesh(
                new THREE.BoxGeometry(rimW, rimH, slotD - rimW), slotRimMat
            );
            bar.position.set(sx + xSign * (slotW / 2), rimY, 0);
            root.add(bar);
        }

        // Rim top face — subtle highlight strip
        const rimTopH = 0.01;
        // Front + back tops
        for (const zSign of [-1, 1]) {
            const top = new THREE.Mesh(
                new THREE.BoxGeometry(slotW + rimW + 0.02, rimTopH, rimW + 0.02),
                slotRimTopMat
            );
            top.position.set(sx, WOOD_TOP + rimH + rimTopH / 2, zSign * (slotD / 2));
            root.add(top);
        }
        // Left + right tops
        for (const xSign of [-1, 1]) {
            const top = new THREE.Mesh(
                new THREE.BoxGeometry(rimW + 0.02, rimTopH, slotD - rimW + 0.02),
                slotRimTopMat
            );
            top.position.set(sx + xSign * (slotW / 2), WOOD_TOP + rimH + rimTopH / 2, 0);
            root.add(top);
        }

        // ── Resource mesh inside the slot — sits on the cavity floor ──
        const resMesh = ResourceRegistry.createMesh(type, 'stacked');
        const resGroup = new THREE.Group();
        resGroup.add(resMesh);
        resGroup.position.set(sx, WOOD_TOP + 0.18, 0);
        resGroup.scale.setScalar(1.1);
        root.add(resGroup);

        // ── "0/N" counter — large glowing text floating high above slot ──
        // Positioned near gear height so it's prominent and readable from
        // the isometric camera angle, matching the screenshot.
        const cCanvas = document.createElement('canvas');
        cCanvas.width = 512; cCanvas.height = 512;
        const cCtx = cCanvas.getContext('2d');

        function drawCounter(current) {
            cCtx.clearRect(0, 0, 512, 512);
            cCtx.save();
            // Stretch text vertically so it reads tall from isometric camera
            cCtx.translate(256, 260);
            cCtx.scale(1, 2);
            cCtx.font = 'bold 160px system-ui, -apple-system, sans-serif';
            cCtx.textAlign = 'center';
            cCtx.textBaseline = 'middle';
            // Outer glow layer
            cCtx.shadowColor = '#22ff66';
            cCtx.shadowBlur = 36;
            cCtx.fillStyle = '#44ff88';
            cCtx.fillText(current + '/' + count, 0, 0);
            // Crisp inner layer (redraw on top, less blur)
            cCtx.shadowBlur = 8;
            cCtx.fillStyle = '#55ffaa';
            cCtx.fillText(current + '/' + count, 0, 0);
            cCtx.restore();
        }
        drawCounter(0);

        const cTex = new THREE.CanvasTexture(cCanvas);
        cTex.anisotropy = 4;
        const counterPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(2.2, 1.8),
            new THREE.MeshBasicMaterial({ map: cTex, transparent: true, side: THREE.DoubleSide })
        );
        counterPlane.position.set(sx, WOOD_TOP + 0.9, -slotD / 2);
        counterPlane.rotation.x = 0;
        root.add(counterPlane);

        root.userData.inputCounters.push({
            type,
            required: count,
            current: 0,
            texture: cTex,
            update(newCurrent) {
                this.current = newCurrent;
                drawCounter(newCurrent);
                this.texture.needsUpdate = true;
            }
        });
    });

    // ── Coin (output) — static, lies flat on the wood inside the slot ring ──
    // The `coin` preset is a cylinder with its flat faces already on
    // local +Y/-Y (stack-ready). No tilt. Future coins stack vertically
    // from this position using stackOffset.
    const coinMesh = ResourceRegistry.createMesh('coin');
    const coinGroup = new THREE.Group();
    coinGroup.add(coinMesh);
    // coin height 0.08 * scale 2.4 = 0.192 → center at WOOD_TOP + half
    coinGroup.position.set(outputX, WOOD_TOP + 0.1, 0);
    coinGroup.scale.setScalar(2.4);
    root.add(coinGroup);

    // ── Animation — gears spin, pips wave-pulse, status LEDs breathe ──
    // Groups don't fire onBeforeRender, so we use a real Mesh as the tick
    // source (big gear's disk), matching the pattern from other animated
    // dio-* presets. Essence and coin are static.
    const animTarget = bigGear.children[0];
    const startMs = performance.now();
    const animState = { lastMs: startMs };
    animTarget.onBeforeRender = () => {
        const now = performance.now();
        const dt = Math.min(0.1, (now - animState.lastMs) * 0.001);
        animState.lastMs = now;
        const t = (now - startMs) * 0.001;

        // Gears — opposite directions, big slower
        bigGear.rotation.y += dt * 1.6;
        smallGear.rotation.y -= dt * 2.4;

        // Status LEDs — slow breathing, input and output out of phase
        const breathe = 0.5 + 0.5 * Math.sin(t * 1.6);
        inputStatusMat.emissiveIntensity = 0.6 + breathe * 1.2;
        outputStatusMat.emissiveIntensity = 0.6 + (1 - breathe) * 1.2;
    };

    return root;
});

MeshPresets.register('dio-caution-sign', () => {
    const g = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.5 });
    // post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.8, 6), postMat);
    post.position.y = 0.9;
    post.castShadow = true;
    g.add(post);
    // diamond sign
    const signMat = new THREE.MeshStandardMaterial({ color: 0xf4c20d, roughness: 0.6 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.03), signMat);
    sign.position.y = 1.9;
    sign.rotation.z = Math.PI / 4;
    g.add(sign);
    // triangle warning mark
    const triMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    const triGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([0, 0.12, 0.02, -0.1, -0.08, 0.02, 0.1, -0.08, 0.02]);
    triGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    triGeo.computeVertexNormals();
    const tri = new THREE.Mesh(triGeo, triMat);
    tri.position.y = 1.9;
    g.add(tri);
    return g;
});

MeshPresets.register('dio-barrel-toxic', () => {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a6a4a, roughness: 0.7, metalness: 0.3 });
    const warnMat = new THREE.MeshStandardMaterial({ color: 0xddaa00, roughness: 0.6 });
    const barrel = new THREE.Mesh(
        jitterGeo(new THREE.CylinderGeometry(0.3, 0.28, 0.9, 10), 0.015),
        bodyMat
    );
    barrel.position.y = 0.45;
    barrel.castShadow = true;
    g.add(barrel);
    // warning band
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.29, 0.12, 10), warnMat);
    band.position.y = 0.45;
    g.add(band);
    // lid
    const lid = new THREE.Mesh(
        new THREE.CircleGeometry(0.28, 10),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6 })
    );
    lid.rotation.x = -Math.PI / 2;
    lid.position.y = 0.9;
    g.add(lid);
    return g;
});

MeshPresets.register('dio-pallet', () => {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x9a7a4a, roughness: 0.95 });
    // top planks
    for (let i = 0; i < 4; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.22), woodMat);
        plank.position.set(0, 0.12, -0.35 + i * 0.24);
        g.add(plank);
    }
    // 3 bottom runners
    for (const z of [-0.3, 0, 0.3]) {
        const runner = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.9), woodMat);
        runner.position.set(z === 0 ? 0 : (z > 0 ? 0.45 : -0.45), 0.05, 0);
        g.add(runner);
    }
    return g;
});

// SW combat dressing
MeshPresets.register('dio-sandbag-stack', () => {
    const group = new THREE.Group();
    const bagMat = new THREE.MeshStandardMaterial({ color: 0xa68a5b, roughness: 0.95 });
    // 3 bags pyramid
    const positions = [[-0.4, 0.25, 0], [0.4, 0.25, 0], [0, 0.65, 0]];
    for (const [x, y, z] of positions) {
        const bag = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), bagMat);
        bag.position.set(x, y, z);
        bag.scale.set(1, 0.5, 0.7);
        bag.castShadow = true; bag.receiveShadow = true;
        group.add(bag);
    }
    return group;
});

MeshPresets.register('dio-broken-car', () => {
    const group = new THREE.Group();
    const rustMat = new THREE.MeshStandardMaterial({ color: 0x6b4030, roughness: 0.95 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    // body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.1), rustMat);
    body.position.y = 0.55;
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    // cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 1.0), rustMat);
    cabin.position.set(-0.1, 1.05, 0);
    cabin.castShadow = true;
    group.add(cabin);
    // 4 wheels (some flat)
    const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12);
    for (const [x, z, sy] of [[-0.85, -0.55, 1.0], [0.85, -0.55, 0.55], [-0.85, 0.55, 1.0], [0.85, 0.55, 0.7]]) {
        const wheel = new THREE.Mesh(wheelGeo, darkMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.28, z);
        wheel.scale.y = sy;
        group.add(wheel);
    }
    // tilted slightly
    group.rotation.z = -0.08;
    return group;
});

// Plaza props
MeshPresets.register('dio-tent', () => {
    const group = new THREE.Group();
    const canvasMat = new THREE.MeshStandardMaterial({ color: 0xc4742d, roughness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.9 });
    // tent body — triangular prism
    const sides = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.6, 4), canvasMat);
    sides.position.y = 0.8;
    sides.rotation.y = Math.PI / 4;
    sides.castShadow = true; sides.receiveShadow = true;
    group.add(sides);
    // entrance flap (dark triangle)
    const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), darkMat);
    flap.position.set(0, 0.45, 1.0);
    flap.rotation.y = 0;
    group.add(flap);
    // small flag on top
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), darkMat);
    pole.position.y = 1.85;
    group.add(pole);
    const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xff3344, side: THREE.DoubleSide })
    );
    flag.position.set(0.15, 2.0, 0);
    group.add(flag);
    return group;
});

MeshPresets.register('dio-bulletin-board', () => {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
    const corkMat = new THREE.MeshStandardMaterial({ color: 0xd2a679, roughness: 0.95 });
    // posts
    for (const x of [-0.5, 0.5]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), woodMat);
        post.position.set(x, 0.6, 0);
        post.castShadow = true;
        group.add(post);
    }
    // cork board
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.08), corkMat);
    board.position.y = 0.95;
    board.castShadow = true;
    group.add(board);
    // wood frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.05), woodMat);
    frame.position.set(0, 0.95, -0.02);
    group.add(frame);
    // 3 colored "papers"
    for (const [x, y, c] of [[-0.3, 1.1, 0xffffff], [0.25, 1.05, 0xffe699], [0.0, 0.85, 0xffaaaa]]) {
        const paper = new THREE.Mesh(
            new THREE.PlaneGeometry(0.25, 0.18),
            new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })
        );
        paper.position.set(x, y, 0.05);
        group.add(paper);
    }
    return group;
});

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

// Build a closed irregular blob path (no perfect ellipses) for canvas decals.
function blobPath(ctx, cx, cy, baseR, jitter = 0.5, points = 14) {
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const r = baseR * (1 - jitter * 0.5 + Math.random() * jitter);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
}

// ---------------------------------------------------------------------------
// SW pad system v3 — non-tiling hi-res canvases with feathered alpha edges.
// ---------------------------------------------------------------------------
//
// Why: tiling small (128×128) textures across a 100×24 pad is visibly
// repetitive — the eye snaps to the grid. v3 paints each pad's texture once
// onto a larger canvas (256×256 / 256×512) with `repeat.set(1,1)` so there
// are NO seams along the pad. Edges fade to alpha so each patch feathers
// into the surrounding ground instead of showing a hard rectangular border.

function makePadTex(key, w, h, paint) {
    if (_texCache.has(key)) return _texCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    paint(ctx, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1, 1);
    _texCache.set(key, tex);
    return tex;
}

// Multiply the canvas alpha down toward the edges with a radial gradient.
// Call as the LAST step in the paint function.
function paintAlphaFalloff(ctx, w, h, innerStop = 0.55) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    const cx = w / 2, cy = h / 2;
    const inner = Math.min(w, h) * 0.18;
    const outer = Math.min(w, h) * innerStop;
    const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

function featheredPadMat(tex) {
    return new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        roughness: 0.95,
        metalness: 0.0
    });
}

// Wasteland — the v1 rust/clay/blood look the user said worked best,
// painted onto a 256×256 canvas with feathered edges. Drop-in patch.
MeshPresets.register('dio-pad-wasteland', ({ size, width = 12, depth = 12 } = {}) => {
    const w = size ?? width;
    const d = size ?? depth;
    const tex = makePadTex('dio-pad-wasteland', 256, 256, (ctx, W, H) => {
        ctx.fillStyle = '#3a2018';
        ctx.fillRect(0, 0, W, H);
        // warmer cracked-clay patches
        for (let i = 0; i < 36; i++) {
            ctx.fillStyle = `rgba(${90 + Math.random() * 30}, ${30 + Math.random() * 15}, ${20 + Math.random() * 10}, ${0.32 + Math.random() * 0.2})`;
            blobPath(ctx, Math.random() * W, Math.random() * H, 16 + Math.random() * 26, 0.7);
            ctx.fill();
        }
        // ash drift streaks
        ctx.fillStyle = 'rgba(180, 175, 170, 0.16)';
        for (let i = 0; i < 22; i++) {
            ctx.fillRect(Math.random() * W, Math.random() * H, 28 + Math.random() * 18, 2);
        }
        // jagged cracks (multi-segment polylines)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        for (let i = 0; i < 32; i++) {
            ctx.lineWidth = 0.8 + Math.random() * 1.4;
            let x = Math.random() * W, y = Math.random() * H;
            ctx.beginPath();
            ctx.moveTo(x, y);
            const segs = 3 + Math.floor(Math.random() * 4);
            for (let s = 0; s < segs; s++) {
                x += (Math.random() - 0.5) * 30;
                y += (Math.random() - 0.5) * 30;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        // dried-blood spatters (rust-brown, not red)
        for (let i = 0; i < 18; i++) {
            ctx.fillStyle = `rgba(${50 + Math.random() * 18}, ${20 + Math.random() * 8}, ${12 + Math.random() * 6}, ${0.55 + Math.random() * 0.25})`;
            blobPath(ctx, Math.random() * W, Math.random() * H, 3 + Math.random() * 7, 0.7, 10);
            ctx.fill();
        }
        // drag-mark streaks (curved bezier, irregular)
        ctx.strokeStyle = 'rgba(40, 14, 8, 0.55)';
        ctx.lineWidth = 4;
        for (let i = 0; i < 7; i++) {
            ctx.beginPath();
            const sx = Math.random() * W, sy = Math.random() * H;
            ctx.moveTo(sx, sy);
            ctx.bezierCurveTo(sx + 25, sy + 10, sx + 50, sy - 8, sx + 70 + Math.random() * 30, sy + (Math.random() - 0.5) * 14);
            ctx.stroke();
        }
        paintAlphaFalloff(ctx, W, H);
    });
    return groundPad(w, d, featheredPadMat(tex));
});

// Scorched dirt — dark charred earth with ash patches
MeshPresets.register('dio-pad-scorch-dirt', ({ size, width = 11, depth = 11 } = {}) => {
    const w = size ?? width;
    const d = size ?? depth;
    const tex = makePadTex('dio-pad-scorch-dirt', 256, 256, (ctx, W, H) => {
        ctx.fillStyle = '#1f1814';
        ctx.fillRect(0, 0, W, H);
        // dark char blobs
        for (let i = 0; i < 28; i++) {
            ctx.fillStyle = `rgba(${8 + Math.random() * 14}, ${6 + Math.random() * 10}, ${4 + Math.random() * 8}, ${0.55 + Math.random() * 0.25})`;
            blobPath(ctx, Math.random() * W, Math.random() * H, 14 + Math.random() * 22, 0.7);
            ctx.fill();
        }
        // ash dust
        for (let i = 0; i < 80; i++) {
            const g = 160 + Math.random() * 60;
            ctx.fillStyle = `rgba(${g}, ${g - 5}, ${g - 15}, ${0.35 + Math.random() * 0.3})`;
            ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
        }
        // soot streaks
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        for (let i = 0; i < 14; i++) {
            ctx.lineWidth = 1 + Math.random() * 2;
            const sx = Math.random() * W, sy = Math.random() * H;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + (Math.random() - 0.5) * 50, sy + (Math.random() - 0.5) * 50);
            ctx.stroke();
        }
        paintAlphaFalloff(ctx, W, H);
    });
    return groundPad(w, d, featheredPadMat(tex));
});

// Gravel mix — broken concrete pebbles + dirt
MeshPresets.register('dio-pad-gravel-mix', ({ size, width = 12, depth = 12 } = {}) => {
    const w = size ?? width;
    const d = size ?? depth;
    const tex = makePadTex('dio-pad-gravel-mix', 256, 256, (ctx, W, H) => {
        ctx.fillStyle = '#4a4238';
        ctx.fillRect(0, 0, W, H);
        // dirt patches
        for (let i = 0; i < 24; i++) {
            ctx.fillStyle = `rgba(${60 + Math.random() * 25}, ${45 + Math.random() * 20}, ${30 + Math.random() * 15}, ${0.45 + Math.random() * 0.25})`;
            blobPath(ctx, Math.random() * W, Math.random() * H, 14 + Math.random() * 24, 0.7);
            ctx.fill();
        }
        // gravel pebbles — small irregular blobs in greys
        for (let i = 0; i < 140; i++) {
            const g = 110 + Math.random() * 80;
            ctx.fillStyle = `rgba(${g}, ${g - 5}, ${g - 12}, ${0.6 + Math.random() * 0.3})`;
            blobPath(ctx, Math.random() * W, Math.random() * H, 1.5 + Math.random() * 3.5, 0.6, 8);
            ctx.fill();
        }
        // a few larger broken-concrete chunks
        for (let i = 0; i < 18; i++) {
            ctx.fillStyle = `rgba(${130 + Math.random() * 30}, ${125 + Math.random() * 30}, ${115 + Math.random() * 30}, 0.85)`;
            blobPath(ctx, Math.random() * W, Math.random() * H, 4 + Math.random() * 6, 0.5, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }
        paintAlphaFalloff(ctx, W, H);
    });
    return groundPad(w, d, featheredPadMat(tex));
});

// Ash & bone — pale ash with bone fragment specks
MeshPresets.register('dio-pad-ash-bone', ({ size, width = 11, depth = 11 } = {}) => {
    const w = size ?? width;
    const d = size ?? depth;
    const tex = makePadTex('dio-pad-ash-bone', 256, 256, (ctx, W, H) => {
        ctx.fillStyle = '#3a342e';
        ctx.fillRect(0, 0, W, H);
        // pale ash patches
        for (let i = 0; i < 30; i++) {
            const g = 120 + Math.random() * 60;
            ctx.fillStyle = `rgba(${g}, ${g - 5}, ${g - 15}, ${0.3 + Math.random() * 0.3})`;
            blobPath(ctx, Math.random() * W, Math.random() * H, 14 + Math.random() * 22, 0.7);
            ctx.fill();
        }
        // bone fragment specks (off-white, irregular)
        for (let i = 0; i < 60; i++) {
            ctx.fillStyle = `rgba(${190 + Math.random() * 30}, ${180 + Math.random() * 20}, ${150 + Math.random() * 20}, ${0.7 + Math.random() * 0.25})`;
            blobPath(ctx, Math.random() * W, Math.random() * H, 1.5 + Math.random() * 3, 0.6, 8);
            ctx.fill();
        }
        // dark crack web
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        for (let i = 0; i < 18; i++) {
            ctx.lineWidth = 0.8 + Math.random();
            let x = Math.random() * W, y = Math.random() * H;
            ctx.beginPath();
            ctx.moveTo(x, y);
            const segs = 3 + Math.floor(Math.random() * 3);
            for (let s = 0; s < segs; s++) {
                x += (Math.random() - 0.5) * 26;
                y += (Math.random() - 0.5) * 26;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        paintAlphaFalloff(ctx, W, H);
    });
    return groundPad(w, d, featheredPadMat(tex));
});

// Dried mud — dark cracked mud patch with deep fissures
MeshPresets.register('dio-pad-mud', ({ size, width = 10, depth = 10 } = {}) => {
    const w = size ?? width;
    const d = size ?? depth;
    const tex = makePadTex('dio-pad-mud', 256, 256, (ctx, W, H) => {
        ctx.fillStyle = '#2a1d12';
        ctx.fillRect(0, 0, W, H);
        // mud color variations
        for (let i = 0; i < 28; i++) {
            ctx.fillStyle = `rgba(${50 + Math.random() * 30}, ${32 + Math.random() * 18}, ${18 + Math.random() * 10}, ${0.4 + Math.random() * 0.25})`;
            blobPath(ctx, Math.random() * W, Math.random() * H, 14 + Math.random() * 22, 0.7);
            ctx.fill();
        }
        // dry-mud crack polygons (clusters of short connected lines)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = 1.4;
        for (let cluster = 0; cluster < 6; cluster++) {
            const ox = Math.random() * W, oy = Math.random() * H;
            for (let i = 0; i < 8; i++) {
                ctx.beginPath();
                const a1 = Math.random() * Math.PI * 2;
                const a2 = a1 + (Math.random() - 0.5) * 1.5;
                ctx.moveTo(ox + Math.cos(a1) * (10 + Math.random() * 14), oy + Math.sin(a1) * (10 + Math.random() * 14));
                ctx.lineTo(ox + Math.cos(a2) * (10 + Math.random() * 14), oy + Math.sin(a2) * (10 + Math.random() * 14));
                ctx.stroke();
            }
        }
        paintAlphaFalloff(ctx, W, H);
    });
    return groundPad(w, d, featheredPadMat(tex));
});

// Zombie-area ground tint — opaque flat colored plane that covers the
// SW combat zone, hiding the legacy green grass beneath. No texture, no
// alpha falloff: it's a flat tint we iterate on color until it feels right.
// Sits at the lowest y in the pad stack so the asphalt road and feathered
// patches render on top of it.
MeshPresets.register('dio-pad-zombie-ground', ({ size, width = 100, depth = 28 } = {}) => {
    const w = size ?? width;
    const d = size ?? depth;
    const mat = new THREE.MeshStandardMaterial({
        color: 0x3a2e24,   // muted dead-earth brown — tweak this to taste
        roughness: 1.0,
        metalness: 0.0
    });
    return groundPad(w, d, mat);
});

// Asphalt highway strip — straight black asphalt road in front of the gate.
// Reads as "highway / paved road for cars and trucks". 256×512 canvas,
// painted once, no tiling. No potholes yet — those land in a follow-up pass.
MeshPresets.register('dio-road-asphalt', ({ size, width = 4.5, depth = 24 } = {}) => {
    const w = size ?? width;
    const d = size ?? depth;
    const tex = makePadTex('dio-road-asphalt', 256, 512, (ctx, W, H) => {
        // base: deep asphalt charcoal (almost black)
        ctx.fillStyle = '#16161a';
        ctx.fillRect(0, 0, W, H);
        // subtle lighter wear blotches (sun-bleached patches)
        for (let i = 0; i < 28; i++) {
            const g = 38 + Math.random() * 22;
            ctx.fillStyle = `rgba(${g}, ${g}, ${g + 2}, ${0.3 + Math.random() * 0.25})`;
            blobPath(ctx, Math.random() * W, Math.random() * H, 14 + Math.random() * 24, 0.65);
            ctx.fill();
        }
        // a few even-lighter wear streaks (tire grooves down the road)
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = `rgba(${55 + Math.random() * 15}, ${55 + Math.random() * 15}, ${58 + Math.random() * 15}, 0.28)`;
            const cx = (i % 2 === 0 ? 80 : 176) + (Math.random() - 0.5) * 12;
            blobPath(ctx, cx, Math.random() * H, 10 + Math.random() * 20, 0.55);
            ctx.fill();
        }
        // aggregate specks (tiny stones embedded in the asphalt)
        for (let i = 0; i < 260; i++) {
            const g = 70 + Math.random() * 70;
            ctx.fillStyle = `rgba(${g}, ${g - 4}, ${g - 8}, ${0.35 + Math.random() * 0.3})`;
            ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random(), 1 + Math.random());
        }
        // dark tar seams / patch lines — wavy horizontals across the road
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        for (let i = 0; i < 6; i++) {
            ctx.lineWidth = 1.5 + Math.random() * 1.5;
            const y = Math.random() * H;
            ctx.beginPath();
            ctx.moveTo(0, y);
            const segs = 7;
            for (let s = 1; s <= segs; s++) {
                ctx.lineTo((s / segs) * W, y + (Math.random() - 0.5) * 4);
            }
            ctx.stroke();
        }
        // hairline cracks
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        for (let i = 0; i < 14; i++) {
            ctx.lineWidth = 0.6 + Math.random() * 0.8;
            let x = Math.random() * W, cy = Math.random() * H;
            ctx.beginPath();
            ctx.moveTo(x, cy);
            const segs = 3 + Math.floor(Math.random() * 3);
            for (let s = 0; s < segs; s++) {
                x += (Math.random() - 0.5) * 16;
                cy += (Math.random() - 0.5) * 16;
                ctx.lineTo(x, cy);
            }
            ctx.stroke();
        }
        // dashed white center line — broken/faded segments down the middle
        // (canvas X = 128, dashes spaced down canvas Y so they run along the road)
        ctx.fillStyle = 'rgba(220, 215, 200, 0.78)';
        for (let i = 0; i < 14; i++) {
            const ly = i * 38 + 12 + Math.random() * 6;
            const lx = 124 + (Math.random() - 0.5) * 3;
            const lw = 5 + Math.random() * 1.5;
            const lh = 18 + Math.random() * 5;
            // randomly skip a dash so the line is faded/broken
            if (Math.random() < 0.25) continue;
            ctx.fillRect(lx, ly, lw, lh);
            // chip a corner
            ctx.fillStyle = `rgba(28, 28, 30, ${0.6 + Math.random() * 0.2})`;
            ctx.fillRect(lx + lw - 2, ly + lh - 3, 3, 4);
            ctx.fillStyle = 'rgba(220, 215, 200, 0.78)';
        }
        // Road-specific falloff: feather only the LEFT/RIGHT sides so the
        // road blends into the surrounding ground sideways. Top and bottom
        // (gate end and rim end) stay fully opaque so the road runs
        // gate-to-rim without fading at either tip.
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.18, 'rgba(255,255,255,1)');
        grad.addColorStop(0.82, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    });
    return groundPad(w, d, featheredPadMat(tex));
});

// Shared materials for hellscape props — bone (off-white-yellowed),
// flesh (rotten greyish-green), char (near-black), rust, dried-blood-brown.
const _boneMat = new THREE.MeshStandardMaterial({ color: 0xc8bfa3, roughness: 0.95 });
const _fleshRotMat = new THREE.MeshStandardMaterial({ color: 0x5a5b42, roughness: 0.95 });
const _clothRotMat = new THREE.MeshStandardMaterial({ color: 0x3a3128, roughness: 1.0 });
const _dryBloodMat = new THREE.MeshStandardMaterial({ color: 0x4a1a12, roughness: 0.9 });
const _charMat = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1.0 });
const _rustMat = new THREE.MeshStandardMaterial({ color: 0x5a3220, roughness: 0.85, metalness: 0.35 });
const _concreteMat = new THREE.MeshStandardMaterial({ color: 0x787470, roughness: 0.95 });
const _socketMat = new THREE.MeshStandardMaterial({ color: 0x0a0807 });

// Build a per-instance lumpy skull by jittering an icosahedron.
function buildSkull(radius = 0.22) {
    const g = new THREE.Group();
    const skullGeo = jitterGeo(new THREE.IcosahedronGeometry(radius, 1), radius * 0.18);
    const skull = new THREE.Mesh(skullGeo, _boneMat);
    skull.scale.set(1, 0.95, 1.15);
    skull.castShadow = true;
    g.add(skull);
    // jaw — tiny irregular box
    const jawGeo = jitterGeo(new THREE.BoxGeometry(radius * 1.2, radius * 0.35, radius * 0.9), radius * 0.1);
    const jaw = new THREE.Mesh(jawGeo, _boneMat);
    jaw.position.set(0, -radius * 0.55, radius * 0.1);
    jaw.rotation.z = (Math.random() - 0.5) * 0.3;
    g.add(jaw);
    // eye sockets
    for (const ex of [-radius * 0.32, radius * 0.32]) {
        const socket = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 0.22, 6, 5),
            _socketMat
        );
        socket.position.set(ex, radius * 0.15, radius * 0.85);
        g.add(socket);
    }
    // nasal cavity
    const nose = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 0.18, radius * 0.25, radius * 0.15),
        _socketMat
    );
    nose.position.set(0, -radius * 0.05, radius * 0.95);
    g.add(nose);
    return g;
}

// Irregular dried-blood decal — no perfect circle, multi-blob composition.
MeshPresets.register('dio-blood-pool', () => {
    const tex = makeTex('dio-blood-pool', (ctx) => {
        ctx.clearRect(0, 0, 128, 128);
        // 3-4 overlapping irregular blobs in muted oxidized tones
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = `rgba(${50 + Math.random() * 25}, ${18 + Math.random() * 10}, ${10 + Math.random() * 8}, ${0.6 + Math.random() * 0.25})`;
            const cx = 48 + Math.random() * 32;
            const cy = 48 + Math.random() * 32;
            blobPath(ctx, cx, cy, 18 + Math.random() * 14, 0.6, 16);
            ctx.fill();
        }
        // dark center
        ctx.fillStyle = 'rgba(20, 6, 4, 0.7)';
        blobPath(ctx, 64, 64, 14, 0.5, 14);
        ctx.fill();
        // splatter fingers — small irregular dots
        ctx.fillStyle = 'rgba(40, 14, 8, 0.7)';
        for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 32 + Math.random() * 26;
            blobPath(ctx, 64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1.5 + Math.random() * 3, 0.7, 8);
            ctx.fill();
        }
        // a few drag streaks
        ctx.strokeStyle = 'rgba(40, 14, 8, 0.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            const sx = 50 + Math.random() * 30, sy = 50 + Math.random() * 30;
            ctx.moveTo(sx, sy);
            ctx.bezierCurveTo(
                sx + Math.random() * 20, sy + Math.random() * 8,
                sx + 10 + Math.random() * 20, sy - 4 + Math.random() * 8,
                sx + 20 + Math.random() * 25, sy + (Math.random() - 0.5) * 12
            );
            ctx.stroke();
        }
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.0 + Math.random() * 0.8, 1.6 + Math.random() * 0.8), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI;
    mesh.position.y = 0.04;
    mesh.renderOrder = 1;
    return mesh;
});

// Scorch crater — dim charred decal, no glowing rim.
MeshPresets.register('dio-scorch-mark', () => {
    const tex = makeTex('dio-scorch-mark', (ctx) => {
        ctx.clearRect(0, 0, 128, 128);
        // irregular charred blob, not radial-symmetric
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = `rgba(${10 + Math.random() * 12}, ${8 + Math.random() * 8}, ${6 + Math.random() * 6}, ${0.55 + Math.random() * 0.3})`;
            blobPath(ctx, 48 + Math.random() * 32, 48 + Math.random() * 32, 16 + Math.random() * 18, 0.65, 14);
            ctx.fill();
        }
        // dark core
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        blobPath(ctx, 64, 64, 18, 0.5, 14);
        ctx.fill();
        // ash specks scattered around
        ctx.fillStyle = 'rgba(170, 160, 150, 0.5)';
        for (let i = 0; i < 22; i++) {
            ctx.fillRect(15 + Math.random() * 98, 15 + Math.random() * 98, 1, 1.2);
        }
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(2.6 + Math.random() * 0.6, 2.6 + Math.random() * 0.6), mat);
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = Math.random() * Math.PI;
    decal.position.y = 0.04;
    decal.renderOrder = 1;
    return decal;
});

// Bone pile — irregular ribs, jittered spine, lumpy skull
MeshPresets.register('dio-bone-pile', () => {
    const group = new THREE.Group();
    // ribs — varied counts/angles, some broken
    const ribCount = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < ribCount; i++) {
        const rad = 0.14 + Math.random() * 0.08;
        const arc = Math.PI * (0.6 + Math.random() * 0.5);
        const ribGeo = jitterGeo(new THREE.TorusGeometry(rad, 0.035, 4, 8, arc), 0.015);
        const rib = new THREE.Mesh(ribGeo, _boneMat);
        rib.position.set(
            (i - ribCount / 2) * 0.11 + (Math.random() - 0.5) * 0.05,
            0.12 + Math.random() * 0.06,
            (Math.random() - 0.5) * 0.08
        );
        rib.rotation.set(
            Math.PI / 2 + (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 0.5
        );
        rib.castShadow = true;
        group.add(rib);
    }
    // spine fragments — uneven scatter
    for (let i = 0; i < 4; i++) {
        const segGeo = jitterGeo(new THREE.IcosahedronGeometry(0.06 + Math.random() * 0.025, 0), 0.02);
        const seg = new THREE.Mesh(segGeo, _boneMat);
        seg.position.set(
            (i - 1.5) * 0.13 + (Math.random() - 0.5) * 0.04,
            0.07 + Math.random() * 0.04,
            -0.05 + Math.random() * 0.1
        );
        seg.rotation.set(Math.random(), Math.random(), Math.random());
        group.add(seg);
    }
    // skull lying on its side
    const skull = buildSkull(0.18);
    skull.position.set(0.45 + Math.random() * 0.1, 0.16, 0.05);
    skull.rotation.set(0.3, Math.random() * Math.PI, 0.2);
    group.add(skull);
    // a stray long-bone (femur fragment)
    const femurGeo = jitterGeo(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6), 0.012);
    const femur = new THREE.Mesh(femurGeo, _boneMat);
    femur.position.set(-0.3, 0.06, -0.1);
    femur.rotation.set(0.2, 0.6, Math.PI / 2 + 0.2);
    femur.castShadow = true;
    group.add(femur);
    return group;
});

// Single skull — same as buildSkull but standalone
MeshPresets.register('dio-skull', () => {
    const g = buildSkull(0.22);
    g.position.y = 0.22;
    g.rotation.y = Math.random() * Math.PI;
    return g;
});

// Half-buried skull — tilted up out of the ground at an angle
MeshPresets.register('dio-half-buried-skull', () => {
    const g = buildSkull(0.24);
    // half submerged: sit it lower, tip it back so it stares up
    g.position.y = 0.05;
    g.rotation.set(-0.7, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
    // small dirt mound around it (lumpy disc)
    const moundGeo = jitterGeo(new THREE.SphereGeometry(0.32, 10, 6), 0.04);
    const mound = new THREE.Mesh(moundGeo, new THREE.MeshStandardMaterial({ color: 0x3a322a, roughness: 1.0 }));
    mound.scale.set(1.1, 0.35, 1.1);
    mound.position.y = 0.02;
    mound.castShadow = true;
    mound.receiveShadow = true;
    g.add(mound);
    return g;
});

// Severed head — head on its side, no body
MeshPresets.register('dio-severed-head', () => {
    const g = new THREE.Group();
    const headGeo = jitterGeo(new THREE.IcosahedronGeometry(0.2, 1), 0.025);
    const head = new THREE.Mesh(headGeo, _fleshRotMat);
    head.scale.set(1, 0.9, 1.1);
    head.position.y = 0.18;
    head.rotation.set(Math.PI / 2, Math.random() * Math.PI, 0.3);
    head.castShadow = true;
    g.add(head);
    // dark eye holes
    for (const ex of [-0.07, 0.07]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 5), _socketMat);
        eye.position.set(ex, 0.2, 0.15);
        g.add(eye);
    }
    // dried blood at the neck
    const neckGeo = jitterGeo(new THREE.CylinderGeometry(0.09, 0.07, 0.06, 8), 0.01);
    const neck = new THREE.Mesh(neckGeo, _dryBloodMat);
    neck.position.set(-0.15, 0.18, 0);
    neck.rotation.z = Math.PI / 2;
    g.add(neck);
    return g;
});

// Rotten body — fully decomposed corpse, irregular and muted
MeshPresets.register('dio-corpse-pile', () => {
    const group = new THREE.Group();
    // torso — lumpy oblong
    const torsoGeo = jitterGeo(new THREE.IcosahedronGeometry(0.4, 1), 0.08);
    const torso = new THREE.Mesh(torsoGeo, _clothRotMat);
    torso.position.set(0, 0.18, 0);
    torso.scale.set(1.3, 0.5, 0.75);
    torso.rotation.set(0.1, Math.random() * Math.PI, 0.35 + (Math.random() - 0.5) * 0.3);
    torso.castShadow = true;
    group.add(torso);
    // head
    const headGeo = jitterGeo(new THREE.IcosahedronGeometry(0.18, 1), 0.03);
    const head = new THREE.Mesh(headGeo, _fleshRotMat);
    head.position.set(0.5 + (Math.random() - 0.5) * 0.1, 0.13, 0.08);
    head.scale.set(1, 0.9, 1.05);
    head.rotation.set(0.4, Math.random(), 0.6);
    head.castShadow = true;
    group.add(head);
    // arm
    const armGeo = jitterGeo(new THREE.CylinderGeometry(0.055, 0.05, 0.5, 6), 0.012);
    const arm = new THREE.Mesh(armGeo, _fleshRotMat);
    arm.position.set(0.25 + (Math.random() - 0.5) * 0.2, 0.15, -0.32);
    arm.rotation.set(0.5 + (Math.random() - 0.5) * 0.3, 0.2, Math.PI / 2 + 0.3);
    group.add(arm);
    const handGeo = jitterGeo(new THREE.IcosahedronGeometry(0.07, 0), 0.018);
    const hand = new THREE.Mesh(handGeo, _fleshRotMat);
    hand.position.set(0.3, 0.16, -0.6);
    group.add(hand);
    // leg
    const legGeo = jitterGeo(new THREE.CylinderGeometry(0.075, 0.07, 0.55, 6), 0.015);
    const leg = new THREE.Mesh(legGeo, _clothRotMat);
    leg.position.set(-0.5, 0.16, 0.08 + (Math.random() - 0.5) * 0.15);
    leg.rotation.set(0.1, 0.3, Math.PI / 2 + 0.3 + (Math.random() - 0.5) * 0.4);
    group.add(leg);
    // exposed ribcage hint — 3 small bone curves
    for (let i = 0; i < 3; i++) {
        const ribGeo = jitterGeo(new THREE.TorusGeometry(0.08, 0.02, 4, 6, Math.PI * 0.7), 0.008);
        const rib = new THREE.Mesh(ribGeo, _boneMat);
        rib.position.set(-0.05 + i * 0.08, 0.28, 0);
        rib.rotation.set(Math.PI / 2, 0, 0.3);
        group.add(rib);
    }
    return group;
});

// Rotten body variant — second flavor, more skeletal, prone face-down
MeshPresets.register('dio-rotten-body', () => {
    const group = new THREE.Group();
    // exposed spine
    for (let i = 0; i < 7; i++) {
        const segGeo = jitterGeo(new THREE.IcosahedronGeometry(0.07, 0), 0.015);
        const seg = new THREE.Mesh(segGeo, _boneMat);
        seg.position.set(-0.4 + i * 0.13 + (Math.random() - 0.5) * 0.03, 0.07 + Math.random() * 0.02, (Math.random() - 0.5) * 0.05);
        group.add(seg);
    }
    // pelvis
    const pelvisGeo = jitterGeo(new THREE.IcosahedronGeometry(0.13, 1), 0.025);
    const pelvis = new THREE.Mesh(pelvisGeo, _boneMat);
    pelvis.position.set(0.45, 0.1, 0);
    pelvis.scale.set(1.3, 0.7, 1);
    pelvis.castShadow = true;
    group.add(pelvis);
    // ribcage curves on either side
    for (let i = 0; i < 5; i++) {
        const ribGeo = jitterGeo(new THREE.TorusGeometry(0.13, 0.025, 4, 6, Math.PI), 0.012);
        const rib = new THREE.Mesh(ribGeo, _boneMat);
        rib.position.set(-0.15 + i * 0.08, 0.1, 0);
        rib.rotation.set(Math.PI / 2, 0, 0);
        rib.castShadow = true;
        group.add(rib);
    }
    // skull at the top
    const skull = buildSkull(0.16);
    skull.position.set(-0.55, 0.1, 0.02);
    skull.rotation.set(-Math.PI / 2, Math.random(), 0.1);
    group.add(skull);
    // tattered cloth scrap
    const clothGeo = jitterGeo(new THREE.PlaneGeometry(0.5, 0.3), 0.04);
    const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({
        color: 0x2a2218, roughness: 1.0, side: THREE.DoubleSide
    }));
    cloth.rotation.x = -Math.PI / 2;
    cloth.position.set(0.2, 0.05, 0.05);
    group.add(cloth);
    return group;
});

// Concrete rubble — irregular icosahedron chunks + bent rebar
MeshPresets.register('dio-concrete-rubble', () => {
    const group = new THREE.Group();
    const chunkCount = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < chunkCount; i++) {
        const r = 0.25 + Math.random() * 0.25;
        const chunkGeo = jitterGeo(new THREE.IcosahedronGeometry(r, 0), r * 0.25);
        const chunk = new THREE.Mesh(chunkGeo, _concreteMat);
        chunk.position.set(
            (Math.random() - 0.5) * 1.0,
            r * 0.5,
            (Math.random() - 0.5) * 0.5
        );
        chunk.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6);
        chunk.scale.set(1, 0.6 + Math.random() * 0.4, 1);
        chunk.castShadow = true;
        chunk.receiveShadow = true;
        group.add(chunk);
    }
    // bent rebar — multi-segment polyline (bent at random kinks)
    for (let i = 0; i < 3; i++) {
        const segCount = 2 + Math.floor(Math.random() * 2);
        let lastPos = new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.4);
        let dir = new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.7 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4).normalize();
        for (let s = 0; s < segCount; s++) {
            const len = 0.25 + Math.random() * 0.2;
            const segGeo = new THREE.CylinderGeometry(0.022, 0.022, len, 4);
            const seg = new THREE.Mesh(segGeo, _rustMat);
            const mid = lastPos.clone().addScaledVector(dir, len / 2);
            seg.position.copy(mid);
            // orient cylinder along dir
            seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone());
            group.add(seg);
            lastPos = lastPos.clone().addScaledVector(dir, len);
            // bend at the joint
            dir = new THREE.Vector3(
                dir.x + (Math.random() - 0.5) * 0.6,
                dir.y + (Math.random() - 0.5) * 0.4,
                dir.z + (Math.random() - 0.5) * 0.6
            ).normalize();
        }
    }
    return group;
});

// Spike impale — irregular wooden stake with impaled remains
MeshPresets.register('dio-spike-impale', () => {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a2614, roughness: 1.0 });
    // jagged stake — jittered cylinder
    const stakeGeo = jitterGeo(new THREE.CylinderGeometry(0.04, 0.11, 1.7 + Math.random() * 0.3, 6), 0.02);
    const stake = new THREE.Mesh(stakeGeo, woodMat);
    stake.position.y = 0.85;
    stake.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI, (Math.random() - 0.5) * 0.15);
    stake.castShadow = true;
    group.add(stake);
    // impaled lump — irregular skull-ish
    const blob = buildSkull(0.16);
    blob.position.y = 1.3;
    blob.rotation.set(0.3, Math.random() * Math.PI, 0.2);
    group.add(blob);
    // dried blood streak
    const streakGeo = jitterGeo(new THREE.CylinderGeometry(0.05, 0.04, 0.5, 6), 0.012);
    const streak = new THREE.Mesh(streakGeo, _dryBloodMat);
    streak.position.set(0.02, 0.95, 0.02);
    group.add(streak);
    return group;
});

// Ash pile — lumpy mound with charred fragments
MeshPresets.register('dio-ash-pile', () => {
    const group = new THREE.Group();
    const ashMat = new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 1.0 });
    const mainGeo = jitterGeo(new THREE.SphereGeometry(0.4, 8, 6), 0.06);
    const pile = new THREE.Mesh(mainGeo, ashMat);
    pile.scale.set(1.2, 0.4, 1.2);
    pile.position.y = 0.05;
    pile.castShadow = true;
    group.add(pile);
    // charred chunks poking out
    for (let i = 0; i < 3; i++) {
        const chunkGeo = jitterGeo(new THREE.IcosahedronGeometry(0.06 + Math.random() * 0.04, 0), 0.02);
        const chunk = new THREE.Mesh(chunkGeo, _charMat);
        chunk.position.set((Math.random() - 0.5) * 0.5, 0.08 + Math.random() * 0.05, (Math.random() - 0.5) * 0.5);
        chunk.rotation.set(Math.random(), Math.random(), Math.random());
        group.add(chunk);
    }
    return group;
});

// ---------------------------------------------------------------------------
// Urban-decay props — rust, ruin, broken civilization
// ---------------------------------------------------------------------------

// Rusted oil drum — cylinder with dent and rust streaks
MeshPresets.register('dio-rusted-barrel', () => {
    const group = new THREE.Group();
    const drumGeo = jitterGeo(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14), 0.025);
    const drum = new THREE.Mesh(drumGeo, _rustMat);
    // randomly toppled
    const toppled = Math.random() < 0.5;
    if (toppled) {
        drum.rotation.z = Math.PI / 2;
        drum.rotation.y = Math.random() * Math.PI;
        drum.position.y = 0.42;
    } else {
        drum.position.y = 0.5;
        drum.rotation.y = Math.random() * Math.PI;
        drum.rotation.z = (Math.random() - 0.5) * 0.15;
    }
    drum.castShadow = true;
    drum.receiveShadow = true;
    group.add(drum);
    // top rim band (a slightly darker ring)
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x3a2014, roughness: 0.95 });
    const bandGeo = jitterGeo(new THREE.CylinderGeometry(0.43, 0.43, 0.08, 14), 0.012);
    const band = new THREE.Mesh(bandGeo, bandMat);
    if (toppled) {
        band.position.copy(drum.position);
        band.position.x += 0.4;
        band.rotation.copy(drum.rotation);
    } else {
        band.position.set(0, 0.92, 0);
    }
    group.add(band);
    return group;
});

// Broken pipe — bent industrial pipe sticking out of the ground
MeshPresets.register('dio-broken-pipe', () => {
    const group = new THREE.Group();
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.85, metalness: 0.4 });
    // vertical segment
    const v1Geo = jitterGeo(new THREE.CylinderGeometry(0.13, 0.14, 0.7 + Math.random() * 0.3, 8), 0.018);
    const v1 = new THREE.Mesh(v1Geo, pipeMat);
    v1.position.y = 0.4;
    v1.rotation.set((Math.random() - 0.5) * 0.15, Math.random() * Math.PI, (Math.random() - 0.5) * 0.2);
    v1.castShadow = true;
    group.add(v1);
    // elbow joint
    const elbowGeo = jitterGeo(new THREE.SphereGeometry(0.16, 8, 6), 0.018);
    const elbow = new THREE.Mesh(elbowGeo, pipeMat);
    elbow.position.set(0, 0.78, 0);
    group.add(elbow);
    // horizontal sheared segment
    const h1Geo = jitterGeo(new THREE.CylinderGeometry(0.13, 0.12, 0.5 + Math.random() * 0.3, 8), 0.018);
    const h1 = new THREE.Mesh(h1Geo, pipeMat);
    h1.position.set(0.3, 0.78, 0);
    h1.rotation.z = Math.PI / 2;
    h1.rotation.y = (Math.random() - 0.5) * 0.4;
    h1.castShadow = true;
    group.add(h1);
    // small flange ring
    const flangeGeo = jitterGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 10), 0.008);
    const flange = new THREE.Mesh(flangeGeo, _rustMat);
    flange.position.y = 0.06;
    group.add(flange);
    return group;
});

// Rebar cluster — twisted rebar standing in a small concrete base
MeshPresets.register('dio-rebar-cluster', () => {
    const group = new THREE.Group();
    // concrete base
    const baseGeo = jitterGeo(new THREE.IcosahedronGeometry(0.32, 1), 0.06);
    const base = new THREE.Mesh(baseGeo, _concreteMat);
    base.scale.set(1.1, 0.55, 1.1);
    base.position.y = 0.12;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    // 4-6 bent rebar rods
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
        const segCount = 2 + Math.floor(Math.random() * 2);
        let lastPos = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            0.18,
            (Math.random() - 0.5) * 0.3
        );
        let dir = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            0.8 + Math.random() * 0.2,
            (Math.random() - 0.5) * 0.5
        ).normalize();
        for (let s = 0; s < segCount; s++) {
            const len = 0.3 + Math.random() * 0.3;
            const segGeo = new THREE.CylinderGeometry(0.025, 0.025, len, 4);
            const seg = new THREE.Mesh(segGeo, _rustMat);
            const mid = lastPos.clone().addScaledVector(dir, len / 2);
            seg.position.copy(mid);
            seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone());
            seg.castShadow = true;
            group.add(seg);
            lastPos = lastPos.clone().addScaledVector(dir, len);
            dir = new THREE.Vector3(
                dir.x + (Math.random() - 0.5) * 0.7,
                dir.y - 0.1 + (Math.random() - 0.5) * 0.3,
                dir.z + (Math.random() - 0.5) * 0.7
            ).normalize();
        }
    }
    return group;
});

// Shattered wall — chunk of broken brick wall, ruin-porn fragment
MeshPresets.register('dio-shattered-wall', () => {
    const group = new THREE.Group();
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x6e3828, roughness: 0.95 });
    const mortarMat = new THREE.MeshStandardMaterial({ color: 0x6a655c, roughness: 0.95 });
    // base mortar wedge (jagged top)
    const baseW = 1.2 + Math.random() * 0.6;
    const baseH = 0.6 + Math.random() * 0.4;
    const baseGeo = jitterGeo(new THREE.BoxGeometry(baseW, baseH, 0.3), 0.05);
    const base = new THREE.Mesh(baseGeo, mortarMat);
    base.position.y = baseH / 2;
    base.rotation.y = (Math.random() - 0.5) * 0.4;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    // brick courses on top — irregular row of small jittered boxes
    const rows = 2 + Math.floor(Math.random() * 2);
    for (let r = 0; r < rows; r++) {
        const cols = 4 + Math.floor(Math.random() * 3);
        for (let c = 0; c < cols; c++) {
            // randomly skip a brick (broken/missing)
            if (Math.random() < 0.25) continue;
            const bGeo = jitterGeo(new THREE.BoxGeometry(0.22, 0.12, 0.28), 0.02);
            const brick = new THREE.Mesh(bGeo, brickMat);
            brick.position.set(
                -baseW / 2 + 0.15 + c * 0.24 + (r % 2) * 0.12 + (Math.random() - 0.5) * 0.03,
                baseH + 0.06 + r * 0.14,
                (Math.random() - 0.5) * 0.06
            );
            brick.rotation.set(
                (Math.random() - 0.5) * 0.1,
                base.rotation.y + (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1
            );
            brick.castShadow = true;
            group.add(brick);
        }
    }
    // a fallen brick or two on the ground
    for (let i = 0; i < 2; i++) {
        const bGeo = jitterGeo(new THREE.BoxGeometry(0.22, 0.12, 0.28), 0.02);
        const brick = new THREE.Mesh(bGeo, brickMat);
        brick.position.set(
            (Math.random() - 0.5) * (baseW + 0.6),
            0.06,
            0.3 + Math.random() * 0.4
        );
        brick.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
        brick.castShadow = true;
        group.add(brick);
    }
    return group;
});

// Tire pile — stack of burned tires
MeshPresets.register('dio-tire-pile', () => {
    const group = new THREE.Group();
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18171a, roughness: 0.95 });
    const stackCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < stackCount; i++) {
        const tireGeo = jitterGeo(new THREE.TorusGeometry(0.32, 0.1, 6, 14), 0.02);
        const tire = new THREE.Mesh(tireGeo, tireMat);
        tire.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.15;
        tire.position.set(
            (Math.random() - 0.5) * 0.05,
            0.1 + i * 0.18,
            (Math.random() - 0.5) * 0.05
        );
        tire.castShadow = true;
        tire.receiveShadow = true;
        group.add(tire);
    }
    // one fallen tire on the ground beside
    const falln = new THREE.Mesh(
        jitterGeo(new THREE.TorusGeometry(0.32, 0.1, 6, 14), 0.02),
        tireMat
    );
    falln.position.set(0.6 + Math.random() * 0.2, 0.1, (Math.random() - 0.5) * 0.4);
    falln.rotation.set(Math.PI / 2, 0, (Math.random() - 0.5) * 0.4);
    group.add(falln);
    return group;
});

// Broken streetlight — bent lamppost, smashed head
MeshPresets.register('dio-broken-streetlight', () => {
    const group = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.8, metalness: 0.4 });
    // lower pole
    const lowerGeo = jitterGeo(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 8), 0.012);
    const lower = new THREE.Mesh(lowerGeo, poleMat);
    lower.position.y = 0.65;
    lower.rotation.set((Math.random() - 0.5) * 0.1, Math.random() * Math.PI, (Math.random() - 0.5) * 0.1);
    lower.castShadow = true;
    group.add(lower);
    // bent kink
    const kinkGeo = jitterGeo(new THREE.SphereGeometry(0.085, 6, 6), 0.012);
    const kink = new THREE.Mesh(kinkGeo, poleMat);
    kink.position.y = 1.3;
    group.add(kink);
    // upper pole tilted away
    const tiltDir = (Math.random() - 0.5) * 1.2;
    const upperGeo = jitterGeo(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 8), 0.012);
    const upper = new THREE.Mesh(upperGeo, poleMat);
    upper.position.set(Math.sin(tiltDir) * 0.4, 1.7, Math.cos(tiltDir) * 0.05);
    upper.rotation.z = tiltDir;
    upper.castShadow = true;
    group.add(upper);
    // smashed lamp head — broken cone
    const headGeo = jitterGeo(new THREE.IcosahedronGeometry(0.15, 0), 0.04);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9, metalness: 0.5 });
    const lampHead = new THREE.Mesh(headGeo, headMat);
    lampHead.position.set(Math.sin(tiltDir) * 0.85, 2.1, 0);
    lampHead.rotation.z = tiltDir;
    group.add(lampHead);
    return group;
});

// Burnt dead tree — charred skeletal tree
MeshPresets.register('dio-dead-tree-burnt', () => {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1.0 });
    // trunk — jittered tapered cylinder
    const trunkGeo = jitterGeo(new THREE.CylinderGeometry(0.08, 0.18, 2.0 + Math.random() * 0.5, 8), 0.025);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.0;
    trunk.rotation.set((Math.random() - 0.5) * 0.15, Math.random() * Math.PI, (Math.random() - 0.5) * 0.15);
    trunk.castShadow = true;
    group.add(trunk);
    // 3-5 charred branches
    const branchCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < branchCount; i++) {
        const a = (i / branchCount) * Math.PI * 2 + Math.random() * 0.5;
        const len = 0.5 + Math.random() * 0.4;
        const branchGeo = jitterGeo(new THREE.CylinderGeometry(0.025, 0.05, len, 5), 0.018);
        const branch = new THREE.Mesh(branchGeo, trunkMat);
        const startY = 1.4 + Math.random() * 0.6;
        branch.position.set(Math.cos(a) * 0.18, startY, Math.sin(a) * 0.18);
        // tilt outward and up
        branch.rotation.set(
            Math.sin(a) * 0.9,
            -a,
            -Math.cos(a) * 0.9 + (Math.random() - 0.5) * 0.3
        );
        // re-position so the base of the branch sits on the trunk
        branch.position.x += Math.cos(a) * (len / 2) * 0.7;
        branch.position.y += 0.2;
        branch.position.z += Math.sin(a) * (len / 2) * 0.7;
        branch.castShadow = true;
        group.add(branch);
    }
    return group;
});

// ---------------------------------------------------------------------------
// Destroyed buildings — half-ruined structures lining the SW road
// ---------------------------------------------------------------------------

const _stuccoMat = new THREE.MeshStandardMaterial({ color: 0xa89580, roughness: 0.95 });
const _brickMat = new THREE.MeshStandardMaterial({ color: 0x6e3828, roughness: 0.95 });
const _woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 1.0 });
const _stoneRuinMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.95 });

MeshPresets.register('dio-destroyed-house', () => {
    const g = new THREE.Group();
    // floor slab
    const slabGeo = jitterGeo(new THREE.BoxGeometry(3.2, 0.18, 3.2), 0.04);
    const slab = new THREE.Mesh(slabGeo, _concreteMat);
    slab.position.y = 0.09;
    slab.castShadow = true; slab.receiveShadow = true;
    g.add(slab);
    // full back wall
    const w1Geo = jitterGeo(new THREE.BoxGeometry(3.0, 2.4, 0.22), 0.05);
    const w1 = new THREE.Mesh(w1Geo, _stuccoMat);
    w1.position.set(0, 1.2, -1.5);
    w1.castShadow = true;
    g.add(w1);
    // full side wall (forms an L with back)
    const w2Geo = jitterGeo(new THREE.BoxGeometry(0.22, 2.4, 2.0), 0.05);
    const w2 = new THREE.Mesh(w2Geo, _stuccoMat);
    w2.position.set(-1.5, 1.2, -0.5);
    w2.castShadow = true;
    g.add(w2);
    // half-height wall fragment
    const w3Geo = jitterGeo(new THREE.BoxGeometry(0.22, 1.4, 1.5), 0.05);
    const w3 = new THREE.Mesh(w3Geo, _stuccoMat);
    w3.position.set(1.5, 0.7, 0.5);
    w3.rotation.y = -0.08;
    w3.castShadow = true;
    g.add(w3);
    // collapsed roof slab on the floor
    const roofGeo = jitterGeo(new THREE.BoxGeometry(2.0, 0.16, 1.6), 0.06);
    const roof = new THREE.Mesh(roofGeo, _woodDarkMat);
    roof.position.set(0.4, 0.32, 0.8);
    roof.rotation.set(0.45, 0.3, -0.22);
    roof.castShadow = true;
    g.add(roof);
    // doorway lintel hanging askew
    const lintelGeo = jitterGeo(new THREE.BoxGeometry(1.0, 0.18, 0.22), 0.03);
    const lintel = new THREE.Mesh(lintelGeo, _stuccoMat);
    lintel.position.set(0, 1.95, -1.4);
    lintel.rotation.z = -0.3;
    g.add(lintel);
    // charred patch on the floor
    const charGeo = jitterGeo(new THREE.BoxGeometry(0.9, 0.025, 0.7), 0.02);
    const char = new THREE.Mesh(charGeo, _charMat);
    char.position.set(-0.4, 0.2, 0.5);
    g.add(char);
    return g;
});

MeshPresets.register('dio-collapsed-shopfront', () => {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x968270, roughness: 0.95 });
    // floor
    const floorGeo = jitterGeo(new THREE.BoxGeometry(4.0, 0.12, 2.4), 0.03);
    const floor = new THREE.Mesh(floorGeo, _concreteMat);
    floor.position.y = 0.06;
    floor.receiveShadow = true;
    g.add(floor);
    // back wall (full)
    const backGeo = jitterGeo(new THREE.BoxGeometry(4.0, 2.6, 0.18), 0.05);
    const back = new THREE.Mesh(backGeo, wallMat);
    back.position.set(0, 1.3, -1.1);
    back.castShadow = true;
    g.add(back);
    // front wall as 2 piers + top header (the "windows" are the negative space)
    const pierGeo = jitterGeo(new THREE.BoxGeometry(0.6, 2.6, 0.18), 0.04);
    const lp = new THREE.Mesh(pierGeo, wallMat);
    lp.position.set(-1.7, 1.3, 1.1);
    lp.castShadow = true;
    g.add(lp);
    const rp = new THREE.Mesh(pierGeo, wallMat);
    rp.position.set(1.7, 1.3, 1.1);
    rp.castShadow = true;
    g.add(rp);
    // top header beam
    const headerGeo = jitterGeo(new THREE.BoxGeometry(4.0, 0.4, 0.18), 0.04);
    const header = new THREE.Mesh(headerGeo, wallMat);
    header.position.set(0, 2.4, 1.1);
    g.add(header);
    // sagging awning beam
    const awningGeo = jitterGeo(new THREE.BoxGeometry(3.6, 0.06, 0.9), 0.02);
    const awning = new THREE.Mesh(awningGeo, _woodDarkMat);
    awning.position.set(-0.3, 1.7, 1.6);
    awning.rotation.set(-0.4, 0, -0.25);
    awning.castShadow = true;
    g.add(awning);
    // counter inside
    const counterGeo = jitterGeo(new THREE.BoxGeometry(2.4, 0.7, 0.5), 0.04);
    const counter = new THREE.Mesh(counterGeo, _woodDarkMat);
    counter.position.set(0, 0.4, 0.4);
    g.add(counter);
    // fallen door
    const doorGeo = jitterGeo(new THREE.BoxGeometry(0.9, 0.1, 1.8), 0.03);
    const door = new THREE.Mesh(doorGeo, _woodDarkMat);
    door.position.set(0.6, 0.18, 1.95);
    door.rotation.y = 0.3;
    g.add(door);
    return g;
});

MeshPresets.register('dio-burnt-house-frame', () => {
    const g = new THREE.Group();
    const w = 2.6, d = 2.2, h = 2.5;
    // 4 charred corner posts (some shorter / broken)
    for (const cx of [-w / 2, w / 2]) {
        for (const cz of [-d / 2, d / 2]) {
            const ph = h * (0.75 + Math.random() * 0.4);
            const postGeo = jitterGeo(new THREE.CylinderGeometry(0.1, 0.13, ph, 6), 0.025);
            const post = new THREE.Mesh(postGeo, _charMat);
            post.position.set(cx, ph / 2, cz);
            post.rotation.set((Math.random() - 0.5) * 0.18, Math.random() * Math.PI, (Math.random() - 0.5) * 0.18);
            post.castShadow = true;
            g.add(post);
        }
    }
    // 2 top beams along X (sometimes one missing)
    for (const cz of [-d / 2, d / 2]) {
        if (cz === d / 2 && Math.random() < 0.4) continue;
        const beamGeo = jitterGeo(new THREE.BoxGeometry(w, 0.14, 0.14), 0.02);
        const beam = new THREE.Mesh(beamGeo, _charMat);
        beam.position.set(0, h - 0.2, cz);
        beam.rotation.z = (Math.random() - 0.5) * 0.1;
        beam.castShadow = true;
        g.add(beam);
    }
    // fallen broken beam on the ground
    const fallenGeo = jitterGeo(new THREE.BoxGeometry(1.8, 0.14, 0.14), 0.02);
    const fallen = new THREE.Mesh(fallenGeo, _charMat);
    fallen.position.set(0.3, 0.1, 0);
    fallen.rotation.set(0, 0.4, 0.1);
    g.add(fallen);
    // floor scorch
    const scorchGeo = jitterGeo(new THREE.BoxGeometry(w * 0.9, 0.02, d * 0.9), 0.04);
    const scorch = new THREE.Mesh(scorchGeo, _charMat);
    scorch.position.y = 0.01;
    g.add(scorch);
    return g;
});

MeshPresets.register('dio-ruined-tower-stub', () => {
    const g = new THREE.Group();
    // base cylinder
    const baseGeo = jitterGeo(new THREE.CylinderGeometry(0.95, 1.05, 2.4, 12), 0.06);
    const base = new THREE.Mesh(baseGeo, _stoneRuinMat);
    base.position.y = 1.2;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);
    // crumbling top blocks ringed around the rim
    for (let i = 0; i < 5; i++) {
        const r = 0.25 + Math.random() * 0.15;
        const blockGeo = jitterGeo(new THREE.IcosahedronGeometry(r, 0), 0.05);
        const block = new THREE.Mesh(blockGeo, _stoneRuinMat);
        const a = (i / 5) * Math.PI * 2 + Math.random() * 0.3;
        block.position.set(Math.cos(a) * 0.8, 2.5 + Math.random() * 0.2, Math.sin(a) * 0.8);
        block.rotation.set(Math.random(), Math.random(), Math.random());
        block.castShadow = true;
        g.add(block);
    }
    // 2 fallen blocks beside
    for (let i = 0; i < 2; i++) {
        const r = 0.3 + Math.random() * 0.15;
        const blockGeo = jitterGeo(new THREE.IcosahedronGeometry(r, 0), 0.06);
        const block = new THREE.Mesh(blockGeo, _stoneRuinMat);
        block.position.set(1.2 + Math.random() * 0.5, r * 0.5, (Math.random() - 0.5) * 1.4);
        block.rotation.set(Math.random(), Math.random(), Math.random());
        block.castShadow = true; block.receiveShadow = true;
        g.add(block);
    }
    return g;
});

MeshPresets.register('dio-destroyed-shack', () => {
    const g = new THREE.Group();
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 1.0 });
    const darkPlankMat = new THREE.MeshStandardMaterial({ color: 0x2e1f10, roughness: 1.0 });
    // floor
    const floorGeo = jitterGeo(new THREE.BoxGeometry(2.0, 0.1, 2.0), 0.03);
    const floor = new THREE.Mesh(floorGeo, plankMat);
    floor.position.y = 0.05;
    g.add(floor);
    // 3 wall planes (one side intentionally missing — collapsed)
    const wallSpecs = [
        { x: 0, z: -1.0, ry: 0, h: 1.8 },
        { x: -1.0, z: 0, ry: Math.PI / 2, h: 1.8 },
        { x: 1.0, z: 0, ry: Math.PI / 2, h: 1.5 }  // shorter, partially collapsed
    ];
    for (const s of wallSpecs) {
        const wGeo = jitterGeo(new THREE.BoxGeometry(2.0, s.h, 0.1), 0.04);
        const wall = new THREE.Mesh(wGeo, plankMat);
        wall.position.set(s.x, s.h / 2 + 0.1, s.z);
        wall.rotation.y = s.ry;
        wall.rotation.z = (Math.random() - 0.5) * 0.4;
        wall.castShadow = true;
        g.add(wall);
    }
    // sagging roof tipped sideways
    const roofGeo = jitterGeo(new THREE.BoxGeometry(2.4, 0.12, 2.4), 0.05);
    const roof = new THREE.Mesh(roofGeo, darkPlankMat);
    roof.position.set(0.3, 1.7, 0.2);
    roof.rotation.set(0.3, 0.1, -0.45);
    roof.castShadow = true;
    g.add(roof);
    // loose planks on the ground
    for (let i = 0; i < 3; i++) {
        const plankGeo = jitterGeo(new THREE.BoxGeometry(0.9 + Math.random() * 0.4, 0.06, 0.18), 0.015);
        const plank = new THREE.Mesh(plankGeo, plankMat);
        plank.position.set(1.5 + Math.random() * 0.6, 0.04, (Math.random() - 0.5) * 1.6);
        plank.rotation.y = Math.random() * Math.PI;
        plank.rotation.z = (Math.random() - 0.5) * 0.1;
        g.add(plank);
    }
    return g;
});

// ---------------------------------------------------------------------------
// Atmospheric pollution — drifting dust/smog particles in the zombie zone
// ---------------------------------------------------------------------------
// Place one of these every ~15 units across the zombie area. Each instance
// spawns a cluster of semi-transparent planes that drift lazily, giving the
// impression of toxic haze / bad air. Pure visual — no gameplay effect.

MeshPresets.register('dio-toxic-haze', ({ count = 25, spread = 12, height = 5 } = {}) => {
    const group = new THREE.Group();
    group.name = 'dio-toxic-haze';

    // Each particle gets its own material clone so we can vary per-particle opacity
    const baseColor = new THREE.Color(0x9a8a60);
    const particles = [];
    for (let i = 0; i < count; i++) {
        const size = 2.5 + Math.random() * 4.0;
        // Use a circular canvas texture so the quad reads as a soft cloud puff
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(160,140,100,0.7)');
        grad.addColorStop(0.5, 'rgba(140,120,80,0.3)');
        grad.addColorStop(1, 'rgba(120,100,60,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        const tex = new THREE.CanvasTexture(canvas);

        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.35 + Math.random() * 0.25,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const geo = new THREE.PlaneGeometry(size, size);
        const p = new THREE.Mesh(geo, mat);
        p.position.set(
            (Math.random() - 0.5) * spread,
            0.8 + Math.random() * height,
            (Math.random() - 0.5) * spread
        );
        // face mostly upward/camera — slight random tilt
        p.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        p.rotation.z = Math.random() * Math.PI * 2;
        p.userData.phase = Math.random() * Math.PI * 2;
        p.userData.baseX = p.position.x;
        p.userData.baseY = p.position.y;
        p.userData.baseZ = p.position.z;
        p.userData.driftSpeed = 0.08 + Math.random() * 0.15;
        p.renderOrder = 999;
        particles.push(p);
        group.add(p);
    }

    // Attach animation to the first mesh child (groups don't fire onBeforeRender)
    if (particles.length > 0) {
        particles[0].onBeforeRender = () => {
            const t = performance.now() * 0.001;
            for (const p of particles) {
                const s = p.userData.driftSpeed;
                const ph = p.userData.phase;
                p.position.x = p.userData.baseX + Math.sin(t * s + ph) * 2.0;
                p.position.y = p.userData.baseY + Math.sin(t * s * 0.5 + ph * 1.3) * 0.6;
                p.position.z = p.userData.baseZ + Math.cos(t * s * 0.4 + ph * 0.8) * 1.5;
                p.rotation.z += 0.0003;
            }
        };
    }

    return group;
});

// ---------------------------------------------------------------------------
// Compressed gas cylinders — industrial hazard prop
// ---------------------------------------------------------------------------
// A cluster of 2-3 fallen/leaning cylinders with warning stripes. Some
// have a faint green-yellow haze puff near the valve end (leak indicator).

MeshPresets.register('dio-gas-cylinder', () => {
    const g = new THREE.Group();
    g.name = 'dio-gas-cylinder';

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a6a3a, roughness: 0.6, metalness: 0.5 });
    const warnMat = new THREE.MeshStandardMaterial({ color: 0xccaa22, roughness: 0.5, metalness: 0.4 });
    const rustyMat = new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.85, metalness: 0.3 });
    const valveMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7, metalness: 0.6 });

    const cylinders = [
        { x: 0, z: 0, ry: 0.3, rz: 1.45, mat: bodyMat },
        { x: 0.8, z: 0.5, ry: 0.8, rz: 1.55, mat: rustyMat },
        { x: -0.4, z: 0.7, ry: -0.4, rz: 0.2, mat: bodyMat }
    ];

    let firstCyl = null;
    for (const c of cylinders) {
        const cylGeo = jitterGeo(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 8), 0.015);
        const cyl = new THREE.Mesh(cylGeo, c.mat);
        cyl.position.set(c.x, 0.22, c.z);
        cyl.rotation.set(0, c.ry, c.rz);
        cyl.castShadow = true;
        g.add(cyl);
        if (!firstCyl) firstCyl = cyl;

        // warning stripe bands
        const bandGeo = new THREE.CylinderGeometry(0.235, 0.235, 0.12, 8);
        const band = new THREE.Mesh(bandGeo, warnMat);
        band.position.copy(cyl.position);
        band.rotation.copy(cyl.rotation);
        g.add(band);

        // top cap
        const topGeo = new THREE.SphereGeometry(0.22, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
        const top = new THREE.Mesh(topGeo, c.mat);
        top.position.copy(cyl.position);
        top.rotation.copy(cyl.rotation);
        top.translateY(0.7);
        g.add(top);

        // valve
        const capGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.18, 6);
        const cap = new THREE.Mesh(capGeo, valveMat);
        cap.position.copy(cyl.position);
        cap.rotation.copy(cyl.rotation);
        cap.translateY(0.85);
        g.add(cap);
    }

    // leak haze puffs near the first cylinder
    const leakMat = new THREE.MeshBasicMaterial({
        color: 0xaacc44,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const leakPuffs = [];
    for (let i = 0; i < 5; i++) {
        const pGeo = new THREE.PlaneGeometry(0.4 + Math.random() * 0.3, 0.4 + Math.random() * 0.3);
        const puff = new THREE.Mesh(pGeo, leakMat);
        puff.position.set(
            0.4 + Math.random() * 0.4,
            0.4 + Math.random() * 0.5,
            (Math.random() - 0.5) * 0.4
        );
        puff.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        puff.userData.phase = Math.random() * Math.PI * 2;
        leakPuffs.push(puff);
        g.add(puff);
    }
    // Attach animation to first cylinder mesh (groups don't fire onBeforeRender)
    if (firstCyl) {
        firstCyl.onBeforeRender = () => {
            const t = performance.now() * 0.001;
            for (const p of leakPuffs) {
                p.position.y = 0.4 + Math.sin(t * 0.5 + p.userData.phase) * 0.2;
                p.rotation.y = t * 0.2 + p.userData.phase;
            }
        };
    }

    return g;
});

// ---------------------------------------------------------------------------
// Toxic water pool / polluted stream — flat puddles of nasty green-brown water
// ---------------------------------------------------------------------------
// Uses a translucent plane with animated emissive pulse to suggest toxic shimmer.
// Optional `length` param makes it oblong (stream-like) vs. square (puddle).

MeshPresets.register('dio-toxic-pool', ({ width = 4, length = 4 } = {}) => {
    const g = new THREE.Group();
    g.name = 'dio-toxic-pool';

    // Polluted water surface
    const waterMat = new THREE.MeshStandardMaterial({
        color: 0x2a3a18,
        roughness: 0.3,
        metalness: 0.2,
        transparent: true,
        opacity: 0.75,
        emissive: 0x1a2a08,
        emissiveIntensity: 0.3,
        depthWrite: false
    });

    const waterGeo = new THREE.PlaneGeometry(width, length, 8, 8);
    // slight vertex ripple so it's not a perfect rectangle
    const wPos = waterGeo.attributes.position;
    for (let i = 0; i < wPos.count; i++) {
        wPos.setZ(i, wPos.getZ(i) + (Math.random() - 0.5) * 0.06);
    }
    wPos.needsUpdate = true;
    waterGeo.computeVertexNormals();

    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.03;
    water.receiveShadow = true;
    g.add(water);

    // scum blobs on the surface — darker irregular patches
    const scumMat = new THREE.MeshStandardMaterial({
        color: 0x1a2210,
        roughness: 0.9,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
    });
    const scumCount = Math.floor(3 + Math.random() * 3);
    for (let i = 0; i < scumCount; i++) {
        const r = 0.2 + Math.random() * 0.5;
        const sGeo = jitterGeo(new THREE.CircleGeometry(r, 7), r * 0.3);
        const scum = new THREE.Mesh(sGeo, scumMat);
        scum.rotation.x = -Math.PI / 2;
        scum.position.set(
            (Math.random() - 0.5) * width * 0.7,
            0.04,
            (Math.random() - 0.5) * length * 0.7
        );
        g.add(scum);
    }

    // edge debris — small rocks/mud banks around the rim
    const mudMat = new THREE.MeshStandardMaterial({ color: 0x3a2e1a, roughness: 1.0 });
    const edgeCount = Math.floor(5 + Math.random() * 4);
    for (let i = 0; i < edgeCount; i++) {
        const angle = (i / edgeCount) * Math.PI * 2 + Math.random() * 0.5;
        const dist = (Math.min(width, length) / 2) * (0.85 + Math.random() * 0.25);
        const rSize = 0.1 + Math.random() * 0.2;
        const rockGeo = jitterGeo(new THREE.IcosahedronGeometry(rSize, 0), rSize * 0.3);
        const rock = new THREE.Mesh(rockGeo, mudMat);
        rock.position.set(
            Math.cos(angle) * dist * (width / Math.max(width, length)),
            0.02,
            Math.sin(angle) * dist * (length / Math.max(width, length))
        );
        g.add(rock);
    }

    // bubble animation — small spheres that pop up and sink
    const bubbleMat = new THREE.MeshBasicMaterial({
        color: 0x5a7a30,
        transparent: true,
        opacity: 0.4,
        depthWrite: false
    });
    const bubbles = [];
    for (let i = 0; i < 5; i++) {
        const bGeo = new THREE.SphereGeometry(0.08 + Math.random() * 0.08, 5, 5);
        const bubble = new THREE.Mesh(bGeo, bubbleMat);
        bubble.position.set(
            (Math.random() - 0.5) * width * 0.6,
            0.03,
            (Math.random() - 0.5) * length * 0.6
        );
        bubble.userData.phase = Math.random() * Math.PI * 2;
        bubble.userData.speed = 0.3 + Math.random() * 0.4;
        bubbles.push(bubble);
        g.add(bubble);
    }

    // Attach animation to the water mesh (groups don't fire onBeforeRender)
    water.onBeforeRender = () => {
        const t = performance.now() * 0.001;
        waterMat.emissiveIntensity = 0.2 + 0.15 * Math.sin(t * 0.8);
        for (const b of bubbles) {
            const cycle = (t * b.userData.speed + b.userData.phase) % (Math.PI * 2);
            b.position.y = 0.03 + Math.sin(cycle) * 0.08;
            b.visible = Math.sin(cycle) > -0.3;
        }
    };

    return g;
});

export default MeshPresets;
