// Market Zone — mesh presets (extracted from MeshPresetsDiorama.js)
// Side-effect import: registers dio-market-* presets into MeshPresets.

import * as THREE from 'three';
import MeshPresets from '../../core/MeshPresets.js';
// Billboard3D helpers are used by createMarket() to yaw the whole stall
// toward the camera. The sign itself stays vertical (in the stall's local
// frame) so it spans the two posts cleanly and inherits the parent yaw.

// ---------------------------------------------------------------------------
// Shared helpers (duplicated from MeshPresetsDiorama — kept local to avoid
// coupling this zone back to the monolith)
// ---------------------------------------------------------------------------

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

function groundPad(width, depth, mat) {
    const geo = new THREE.PlaneGeometry(width, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
}

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

// ---------------------------------------------------------------------------
// dio-market-ground — terracotta/clay ground pad for the market square
// (was: dio-pad-market)
// ---------------------------------------------------------------------------

MeshPresets.register('dio-market-ground', ({ size, width = 14, depth = 12 } = {}) => {
    const w = size ?? width;
    const d = size ?? depth;
    const tex = makePadTex('dio-market-ground', 256, 256, (ctx, W, H) => {
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

// ---------------------------------------------------------------------------
// dio-market-entrance-gate — wooden posts + cross-beam + hanging sign
// (was: dio-market-arch)
// ---------------------------------------------------------------------------

MeshPresets.register('dio-market-entrance-gate', () => {
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

// ---------------------------------------------------------------------------
// mkt-price-sign — flat plank with a canvas-texture face (price + product
// label). Created blank; PriceSignUI.bind() repaints the canvas after the
// stall entity is built so multiple stalls can show different products.
// ---------------------------------------------------------------------------

MeshPresets.register('mkt-price-sign', ({ width = 1.4, height = 0.7 } = {}) => {
    // 2× density: PriceSignUI.bind uses ctx.scale(2,2) so the same logical
    // drawing code fills this canvas at higher pixel density for sharper
    // text under the isometric camera.
    const canvas = document.createElement('canvas');
    canvas.width  = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fffbe6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 28;
    ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const mat = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.65, metalness: 0.0, side: THREE.DoubleSide
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    sign.userData.canvas  = canvas;
    sign.userData.texture = tex;
    return sign;
});

// ---------------------------------------------------------------------------
// mkt-stall — OPEN-TOP design. No roof / awning / overhang — products on
// the counter are always visible to the isometric camera. The sign lives
// up high on a back-mounted billboard frame, well clear of the product
// stack. Front of the counter wraps in a colored apron for brand weight.
//
// userData anchors (read by createMarket / EntityFactory):
//   stackAnchor   — Object3D where products visually pile on the counter
//   signAnchor    — Object3D location above the billboard sign
//   trayAnchor    — local-space offset where the linked coin tray should sit
//   counterAnchor — anchor for the overhead "×N" stack-count UI bubble
//   priceSignMesh — the price-sign mesh, so PriceSignUI can repaint it
// ---------------------------------------------------------------------------

MeshPresets.register('mkt-stall', ({
    awningColor  = 0xE05050,   // reused as apron + bunting accent color
    counterColor = 0x9c6b3a,
    postColor    = 0x6b4523,
    width        = 3.5,
    depth        = 1.4
} = {}) => {
    const group = new THREE.Group();

    // ── Counter body ────────────────────────────────────────────────────
    const counterH = 0.95;
    const counter = new THREE.Mesh(
        new THREE.BoxGeometry(width, counterH, depth),
        new THREE.MeshStandardMaterial({ color: counterColor, roughness: 0.75, metalness: 0.05 })
    );
    counter.position.y = counterH / 2;
    counter.castShadow = true;
    counter.receiveShadow = true;
    group.add(counter);

    // Counter top plank — slightly lighter for visual separation
    const top = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.1, 0.08, depth + 0.1),
        new THREE.MeshStandardMaterial({ color: 0xc89464, roughness: 0.6, metalness: 0.05 })
    );
    top.position.y = counterH + 0.04;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // ── Front apron (colored panel hanging off the customer-facing side) ─
    // Adds brand color without occluding anything above the counter.
    const apronH = 0.75;
    const apronT = 0.05;
    const apron = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.2, apronH, apronT),
        new THREE.MeshStandardMaterial({
            color: awningColor, roughness: 0.85, metalness: 0.0
        })
    );
    apron.position.set(0, counterH - apronH / 2 - 0.05, depth / 2 + apronT / 2 + 0.005);
    apron.castShadow = true;
    group.add(apron);

    // ── Two tall back-corner posts (billboard frame, NOT a roof) ────────
    const postH = 3.8;
    const postR = 0.08;
    const postMat = new THREE.MeshStandardMaterial({
        color: postColor, roughness: 0.85, metalness: 0.0
    });
    const postZ = -depth / 2 + 0.05;       // flush with back face of counter
    const postX1 = -width / 2 + 0.1;
    const postX2 =  width / 2 - 0.1;
    for (const px of [postX1, postX2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, postH, 10), postMat);
        post.position.set(px, postH / 2, postZ);
        post.castShadow = true;
        group.add(post);
    }

    // ── Horizontal rail connecting the posts (billboard cross-bar) ──────
    const railY = 3.35;
    const rail = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.05, 0.12, 0.14),
        postMat
    );
    rail.position.set(0, railY, postZ);
    rail.castShadow = true;
    group.add(rail);

    // ── Billboard — stretches post-to-post as a full-width banner. No
    // local rotation: the sign inherits the parent stall's camera yaw and
    // stays vertical inside its own frame, so it visually "spans" the two
    // posts as if nailed to the rail.
    //
    // Width matches the rail so the sign clears the two posts at its
    // edges; height is big enough to carry a single bold headline.
    const signW = width - 0.05;
    const signH = 0.85;
    const sign  = MeshPresets.create('mkt-price-sign', { width: signW, height: signH });
    const signY = 2.9;
    sign.position.set(0, signY, postZ + 0.08);
    group.add(sign);

    // ── Pennant bunting along the rail (SIDEWAYS — doesn't hang over products) ──
    // Each pennant is a thin triangle fixed to the rail facing +Z, arranged
    // in a left→right row at the rail height. Purely decorative; sits at
    // y≈railY, z=postZ (deep behind the products), so it never intrudes on
    // the stack volume in front.
    const pennantColors = [0xffd34d, 0xff6b6b, 0x6ec4ff, 0x8ee06e, 0xf28cf2];
    const pennantCount  = 7;
    for (let i = 0; i < pennantCount; i++) {
        const px = -width / 2 + 0.25 + i * (width - 0.5) / (pennantCount - 1);
        const shape = new THREE.Shape();
        shape.moveTo(-0.11, 0);
        shape.lineTo( 0.11, 0);
        shape.lineTo( 0,   -0.2);
        shape.closePath();
        const pennant = new THREE.Mesh(
            new THREE.ShapeGeometry(shape),
            new THREE.MeshStandardMaterial({
                color: pennantColors[i % pennantColors.length],
                roughness: 0.85,
                side: THREE.DoubleSide
            })
        );
        pennant.position.set(px, railY - 0.02, postZ + 0.08);
        group.add(pennant);
    }

    // ── Anchors ─────────────────────────────────────────────────────────
    const stackAnchor = new THREE.Object3D();
    stackAnchor.position.set(0, counterH + 0.12, 0);
    group.add(stackAnchor);

    const signAnchor = new THREE.Object3D();
    signAnchor.position.copy(sign.position).add(new THREE.Vector3(0, 0.55, 0));
    group.add(signAnchor);

    const trayAnchor = new THREE.Object3D();
    trayAnchor.position.set(width / 2 + 0.9, 0, -depth / 2 + 0.1);
    group.add(trayAnchor);

    // Counter-bubble anchor — kept LOW-TO-MID so the stack ×N floats just
    // above the pile and never crashes into the billboard sign.
    const counterAnchor = new THREE.Object3D();
    counterAnchor.position.set(0, counterH + 0.55, 0);
    group.add(counterAnchor);

    group.userData.stackAnchor   = stackAnchor;
    group.userData.signAnchor    = signAnchor;
    group.userData.trayAnchor    = trayAnchor;
    group.userData.counterAnchor = counterAnchor;
    group.userData.priceSignMesh = sign;

    return group;
});

// ---------------------------------------------------------------------------
// mkt-customer — chunky cartoon shopper. Pill body + ball head + flat shoes.
// CustomerAISystem writes transform directly so no skinning rig is needed.
// ---------------------------------------------------------------------------

MeshPresets.register('mkt-customer', ({ color = 0xFFD080 } = {}) => {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.32, 0.55, 4, 12),
        new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.0 })
    );
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xfde0c0, roughness: 0.55, metalness: 0.0 })
    );
    head.position.y = 1.32;
    head.castShadow = true;
    group.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const ex of [-0.09, 0.09]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
        eye.position.set(ex, 1.36, 0.25);
        group.add(eye);
    }

    const shoeMat = new THREE.MeshStandardMaterial({
        color: 0x3a2a1d, roughness: 0.85, metalness: 0.0
    });
    for (const fx of [-0.13, 0.13]) {
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.32), shoeMat);
        shoe.position.set(fx, 0.04, 0.04);
        shoe.castShadow = true;
        group.add(shoe);
    }

    return group;
});

// ---------------------------------------------------------------------------
// mkt-coin-tray — small wooden tray attached to a stall. Distinct silhouette
// from the basecamp coin-tray so the player can tell which tray belongs to
// which stall.
// ---------------------------------------------------------------------------

MeshPresets.register('mkt-coin-tray', ({
    color  = 0x8b5a2b,
    width  = 1.1,
    depth  = 1.1,
    height = 0.18
} = {}) => {
    const group = new THREE.Group();

    const base = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 })
    );
    base.position.y = height / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const rimT = 0.04;
    const rimH = 0.12;
    const rimMat = new THREE.MeshStandardMaterial({
        color: 0x5a3a1c, roughness: 0.85, metalness: 0.05
    });
    const rims = [
        { w: width, d: rimT, x: 0, z:  depth / 2 - rimT / 2 },
        { w: width, d: rimT, x: 0, z: -depth / 2 + rimT / 2 },
        { w: rimT, d: depth, x:  width / 2 - rimT / 2, z: 0 },
        { w: rimT, d: depth, x: -width / 2 + rimT / 2, z: 0 }
    ];
    for (const r of rims) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(r.w, rimH, r.d), rimMat);
        wall.position.set(r.x, height + rimH / 2, r.z);
        wall.castShadow = true;
        group.add(wall);
    }

    const counterAnchor = new THREE.Object3D();
    counterAnchor.position.set(0, height + 1.0, 0);
    group.add(counterAnchor);
    group.userData.counterAnchor = counterAnchor;

    return group;
});
