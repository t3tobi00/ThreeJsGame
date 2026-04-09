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
        group.rotation.y = t * 0.15;
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
    const steelMat    = new THREE.MeshStandardMaterial({ color: 0x4a4a4e, roughness: 0.45, metalness: 0.85 });
    const seamMat     = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6,  metalness: 0.7 });
    const yellowMat   = new THREE.MeshStandardMaterial({ color: 0xf4c20d, roughness: 0.7 });
    const wireMat     = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.3,  metalness: 0.85 });
    const lampMat     = new THREE.MeshStandardMaterial({
        color: 0xfff2a0, emissive: 0xffcc44, emissiveIntensity: 1.6
    });
    const signMat     = new THREE.MeshStandardMaterial({
        color: 0xf4c20d, emissive: 0x553300, emissiveIntensity: 0.4, roughness: 0.7
    });
    const rivetMat    = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.9 });

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

export default MeshPresets;
