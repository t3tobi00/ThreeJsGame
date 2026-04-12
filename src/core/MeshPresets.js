import * as THREE from 'three';

const _presets = new Map();

const MeshPresets = {
    register(name, builderFn) {
        _presets.set(name, builderFn);
    },

    create(name, options = {}) {
        const builder = _presets.get(name);
        if (!builder) {
            console.warn(`MeshPresets: unknown preset '${name}', using fallback box`);
            const geo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
            const mat = new THREE.MeshStandardMaterial({ color: 0x999999 });
            return new THREE.Mesh(geo, mat);
        }
        return builder(options);
    },

    has(name) {
        return _presets.has(name);
    }
};

// --- Shared geometry/materials for characters (enemies, player, villagers) ---
// Cached once at module scope — all character meshes share these GPU buffers.
const _charBodyGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
const _charHeadGeo = new THREE.SphereGeometry(0.2, 8, 6);
const _charEyeGeo  = new THREE.SphereGeometry(0.05, 4, 4);
const _charLimbGeo = new THREE.CapsuleGeometry(0.08, 0.32, 4, 6);
const _charHeadMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.6 });
const _charEyeMat  = new THREE.MeshStandardMaterial({ color: 0x000000 });

// --- Built-in Presets ---

MeshPresets.register('character', ({ color = 0xaaaaaa } = {}) => {
    const group = new THREE.Group();

    // Only bodyMat is per-character (unique color)
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const body = new THREE.Mesh(_charBodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(_charHeadGeo, _charHeadMat);
    head.position.y = 1.1;
    head.castShadow = true;
    group.add(head);

    const leftEye = new THREE.Mesh(_charEyeGeo, _charEyeMat);
    leftEye.position.set(-0.08, 1.12, 0.18);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(_charEyeGeo, _charEyeMat);
    rightEye.position.set(0.08, 1.12, 0.18);
    group.add(rightEye);

    return group;
});

MeshPresets.register('character-player', ({ color = 0x3366ff } = {}) => {
    // ── Rig hierarchy ──
    //   root
    //   ├── torso  (body, head pivot, arm shoulder pivots)
    //   │    ├── body
    //   │    ├── head           ← named pivot, holds head sphere + eyes
    //   │    ├── leftArm        ← shoulder pivot
    //   │    │    ├── upper arm mesh
    //   │    │    └── leftElbow ← elbow pivot
    //   │    │         └── forearm mesh
    //   │    └── rightArm / rightElbow (mirror)
    //   ├── leftLeg             ← hip pivot
    //   │    ├── thigh mesh
    //   │    └── leftKnee       ← knee pivot
    //   │         └── shin mesh
    //   └── rightLeg / rightKnee (mirror)
    //
    // Bones AnimationSystem can target by name:
    //   torso, body, head, leftArm, rightArm, leftElbow, rightElbow,
    //   leftLeg, rightLeg, leftKnee, rightKnee
    //
    // Backward compatible: rotating leftArm still rotates the whole arm
    // (the elbow + forearm are children, so they go with it). Existing
    // animations that only mention leftArm/rightArm/leftLeg/rightLeg keep
    // working unchanged.

    const root = new THREE.Group();
    const torso = new THREE.Group();
    torso.name = 'torso';
    root.add(torso);

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const limbMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });

    // ── Body ──
    const body = new THREE.Mesh(_charBodyGeo, bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    body.name = 'body';
    torso.add(body);

    // ── Head pivot ──
    // Wraps head sphere + eyes so the whole head can turn together.
    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = 1.45;
    torso.add(head);

    const headMesh = new THREE.Mesh(_charHeadGeo, _charHeadMat);
    headMesh.castShadow = true;
    head.add(headMesh);

    const leftEye  = new THREE.Mesh(_charEyeGeo, _charEyeMat);
    leftEye.position.set(-0.08, 0.02, 0.18);
    const rightEye = new THREE.Mesh(_charEyeGeo, _charEyeMat);
    rightEye.position.set( 0.08, 0.02, 0.18);
    head.add(leftEye, rightEye);

    // ── Two-segment limb builder ──
    // Returns { root: shoulder/hip pivot, joint: elbow/knee pivot }.
    // The capsule visual mesh sits centered along its segment so rotating
    // the parent pivot rotates the limb visibly from the joint.
    const SEG_LEN = 0.32;            // length of one limb segment (cylinder portion)
    const SEG_HALF = SEG_LEN / 2;

    const makeTwoSegmentLimb = (xOrigin, yOrigin) => {
        const shoulder = new THREE.Group();
        shoulder.position.set(xOrigin, yOrigin, 0);

        // Upper segment hangs straight down from shoulder
        const upper = new THREE.Mesh(_charLimbGeo, limbMat);
        upper.position.y = -SEG_HALF;
        upper.castShadow = true;
        shoulder.add(upper);

        // Joint pivot at the bottom of the upper segment
        const joint = new THREE.Group();
        joint.position.y = -SEG_LEN;
        shoulder.add(joint);

        // Lower segment hangs from joint
        const lower = new THREE.Mesh(_charLimbGeo, limbMat);
        lower.position.y = -SEG_HALF;
        lower.castShadow = true;
        joint.add(lower);

        return { shoulder, joint };
    };

    // ── Arms ── attach to torso so they bob with the body
    const leftArmPair = makeTwoSegmentLimb(-0.32, 1.15);
    leftArmPair.shoulder.name = 'leftArm';
    leftArmPair.joint.name    = 'leftElbow';
    torso.add(leftArmPair.shoulder);

    const rightArmPair = makeTwoSegmentLimb(0.32, 1.15);
    rightArmPair.shoulder.name = 'rightArm';
    rightArmPair.joint.name    = 'rightElbow';
    torso.add(rightArmPair.shoulder);

    // ── Legs ── attach to ROOT so the body bob doesn't lift the feet
    const leftLegPair = makeTwoSegmentLimb(-0.13, 0.55);
    leftLegPair.shoulder.name = 'leftLeg';
    leftLegPair.joint.name    = 'leftKnee';
    root.add(leftLegPair.shoulder);

    const rightLegPair = makeTwoSegmentLimb(0.13, 0.55);
    rightLegPair.shoulder.name = 'rightLeg';
    rightLegPair.joint.name    = 'rightKnee';
    root.add(rightLegPair.shoulder);

    // Stash rest-Y for PlayerAnimSystem body bob
    root.userData.bodyRestY = body.position.y;

    return root;
});

MeshPresets.register('table', ({ color = 0x8B4513, width = 2, depth = 2, height = 0.6 } = {}) => {
    const group = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(width, height, depth);
    const boxMat = new THREE.MeshStandardMaterial({ color });
    const top = new THREE.Mesh(boxGeo, boxMat);
    top.position.y = height / 2;
    top.castShadow = true;
    group.add(top);
    return group;
});

MeshPresets.register('disk', ({ color = 0xff3333, radius = 0.3, height = 0.1 } = {}) => {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 12);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
});

MeshPresets.register('coin', ({ color = 0xffdd00, radius = 0.15, height = 0.05 } = {}) => {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 12);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
    return new THREE.Mesh(geo, mat);
});

MeshPresets.register('rock', ({ color = 0x999999, scale = 1.0 } = {}) => {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(
        (0.5 + Math.random()) * scale,
        (0.3 + Math.random() * 0.5) * scale,
        (0.5 + Math.random()) * scale
    );
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
});

MeshPresets.register('dead-tree', ({ color = 0x5d4037 } = {}) => {
    const trunkMat = new THREE.MeshStandardMaterial({ color, roughness: 1.0 });
    const tree = new THREE.Group();

    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.2, 3, 6);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5;
    trunk.rotation.x = (Math.random() - 0.5) * 0.2;
    trunk.rotation.z = (Math.random() - 0.5) * 0.2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    for (let j = 0; j < 3; j++) {
        const branch = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.1, 1.5, 4),
            trunkMat
        );
        branch.position.y = 1.5 + j * 0.5;
        branch.rotation.z = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random());
        branch.rotation.y = Math.random() * Math.PI * 2;
        tree.add(branch);
    }

    return tree;
});

MeshPresets.register('fence-log', ({ color = 0x8b4513 } = {}) => {
    const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const log = new THREE.Mesh(geo, mat);
    log.scale.y = 0.8 + Math.random() * 0.4;
    log.rotation.y = Math.random() * Math.PI;
    log.rotation.x = (Math.random() - 0.5) * 0.1;
    log.rotation.z = (Math.random() - 0.5) * 0.1;
    log.castShadow = true;
    log.receiveShadow = true;
    return log;
});

MeshPresets.register('wall', ({ color = 0x888888, size = { x: 2, y: 1.5, z: 0.8 } } = {}) => {
    const group = new THREE.Group();

    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = size.y / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const capGeo = new THREE.BoxGeometry(size.x + 0.2, 0.2, size.z + 0.2);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = size.y;
    group.add(cap);

    return group;
});

MeshPresets.register('turret', ({ color = 0xaaaaaa } = {}) => {
    const group = new THREE.Group();

    const baseGeo = new THREE.BoxGeometry(1.5, 0.4, 1.5);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const towerGeo = new THREE.CylinderGeometry(0.5, 0.7, 1.2, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const head = new THREE.Mesh(towerGeo, towerMat);
    head.position.y = 1.0;
    head.castShadow = true;
    group.add(head);

    const cannonGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const cannon = new THREE.Mesh(cannonGeo, cannonMat);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.z = 0.5;
    cannon.position.y = 0.2;
    head.add(cannon);

    return group;
});

MeshPresets.register('gate', ({ width = 8.0 } = {}) => {
    const group = new THREE.Group();

    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });

    const postLeft = new THREE.Mesh(postGeo, postMat);
    postLeft.position.set(-width / 2, 0.4, 0);
    postLeft.castShadow = true;
    group.add(postLeft);

    const postRight = new THREE.Mesh(postGeo, postMat);
    postRight.position.set(width / 2, 0.4, 0);
    postRight.castShadow = true;
    group.add(postRight);

    const doorGeo = new THREE.BoxGeometry(width, 0.15, 0.08);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xac7339 });
    const door = new THREE.Mesh(doorGeo, doorMat);

    const doorGroup = new THREE.Group();
    doorGroup.name = 'doorGroup';
    doorGroup.position.set(-width / 2, 0.5, 0);
    door.position.set(width / 2, 0, 0);

    const plankGeo = new THREE.BoxGeometry(0.1, 0.4, 0.05);
    for (let i = 0; i < 3; i++) {
        const plank = new THREE.Mesh(plankGeo, doorMat);
        plank.position.set((i * (width / 2)) - (width / 2) + 0.1, -0.1, 0.05);
        door.add(plank);
    }

    doorGroup.add(door);
    group.add(doorGroup);

    return group;
});

MeshPresets.register('unlock-zone', ({ color = 0x00aaff, size = 4.0 } = {}) => {
    const group = new THREE.Group();

    const baseGeo = new THREE.PlaneGeometry(size, size);
    const baseMat = new THREE.MeshBasicMaterial({
        color: 0x224422,
        transparent: true,
        opacity: 0.25
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.01;
    group.add(base);

    return group;
});

MeshPresets.register('stall', ({ color = 0x8b6914, width = 2.5, depth = 1.5 } = {}) => {
    const group = new THREE.Group();

    // Counter
    const counterGeo = new THREE.BoxGeometry(width, 0.6, depth);
    const counterMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.y = 0.3;
    counter.castShadow = true;
    counter.receiveShadow = true;
    group.add(counter);

    // Awning posts (4 corners)
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const positions = [
        [-width / 2 + 0.1, 0.9, -depth / 2 + 0.1],
        [width / 2 - 0.1, 0.9, -depth / 2 + 0.1],
        [-width / 2 + 0.1, 0.9, depth / 2 - 0.1],
        [width / 2 - 0.1, 0.9, depth / 2 - 0.1]
    ];
    for (const [x, y, z] of positions) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, y, z);
        post.castShadow = true;
        group.add(post);
    }

    // Awning (flat roof)
    const awningGeo = new THREE.BoxGeometry(width + 0.4, 0.08, depth + 0.4);
    const awningMat = new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.9 });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.y = 1.8;
    awning.castShadow = true;
    awning.receiveShadow = true;
    group.add(awning);

    return group;
});

// --- Essence resource presets (ported from resources-preview.html) ---
const ESSENCE_GREEN    = 0x6dff28; // body color
const ESSENCE_EMISSIVE = 0x44cc15; // glow
const ESSENCE_BUBBLE   = 0xddffdd; // bubble color (unused but kept for parity)

MeshPresets.register('essence-puddle', () => {
    const group = new THREE.Group();

    // Irregular blob outline using multi-frequency wobble — organic splat
    const shape = new THREE.Shape();
    const N = 64;
    const baseR = 0.95;
    const pts = [];
    for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const wobble =
            Math.sin(a * 3 + 1.2) * 0.18 +
            Math.sin(a * 5 + 0.4) * 0.10 +
            Math.sin(a * 7 + 2.1) * 0.06 +
            Math.sin(a * 11 + 3.3) * 0.03;
        const r = baseR + wobble;
        pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    shape.setFromPoints(pts);

    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.06,
        bevelEnabled: true,
        bevelSegments: 5,
        bevelSize: 0.05,
        bevelThickness: 0.05,
        curveSegments: 32,
        steps: 1
    });
    geo.center();
    geo.rotateX(-Math.PI / 2); // lay flat on the ground

    const puddleMat = new THREE.MeshPhysicalMaterial({
        color: ESSENCE_GREEN,
        emissive: ESSENCE_EMISSIVE,
        emissiveIntensity: 0.55,
        metalness: 0.0,
        roughness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        transmission: 0.35,
        thickness: 0.25,
        transparent: true,
        opacity: 0.92
    });
    const puddle = new THREE.Mesh(geo, puddleMat);
    puddle.position.y = 0.02; // sit just above the ground plane
    puddle.castShadow = true;
    group.add(puddle);

    // Half-buried bubble bumps on top of the puddle
    const bubbleMat = new THREE.MeshPhysicalMaterial({
        color: 0x9dff60,
        emissive: ESSENCE_EMISSIVE,
        emissiveIntensity: 0.5,
        metalness: 0.0,
        roughness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        transmission: 0.4,
        transparent: true,
        opacity: 0.9
    });
    const bumps = [
        { x:  0.22, z: -0.12, r: 0.10 },
        { x: -0.32, z:  0.18, r: 0.07 },
        { x:  0.05, z:  0.28, r: 0.06 },
        { x: -0.18, z: -0.22, r: 0.08 },
        { x:  0.40, z:  0.05, r: 0.05 }
    ];
    for (const b of bumps) {
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(b.r, 16, 12), bubbleMat);
        bubble.position.set(b.x, 0.06 + b.r * 0.4, b.z);
        bubble.scale.y = 0.55;
        group.add(bubble);
    }

    // Tiny drip "tail"
    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), puddleMat);
    drip.position.set(-1.05, 0.03, 0.12);
    drip.scale.set(1.1, 0.35, 0.7);
    group.add(drip);

    // Scale the puddle down so its footprint matches a meat disk's pickup feel
    group.scale.setScalar(0.45);

    return group;
});

MeshPresets.register('essence-tube', () => {
    const group = new THREE.Group();

    const tubeLen = 1.6;
    const tubeR = 0.24;

    // "lite" glass — cheap MeshStandardMaterial; full transmission is too
    // expensive when 30+ tubes are stacked on the player's back.
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xddffe5,
        roughness: 0.08,
        metalness: 0.0,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    // Body — open-ended cylinder
    const bodyGeo = new THREE.CylinderGeometry(tubeR, tubeR, tubeLen, 32, 1, true);
    const body = new THREE.Mesh(bodyGeo, glassMat);
    body.rotation.z = Math.PI / 2;
    group.add(body);

    // Closed (rounded) bottom hemisphere
    const bottomGeo = new THREE.SphereGeometry(tubeR, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const bottom = new THREE.Mesh(bottomGeo, glassMat);
    bottom.rotation.z = Math.PI / 2;
    bottom.position.x = -tubeLen / 2;
    group.add(bottom);

    // Open-end lip
    const lipGeo = new THREE.TorusGeometry(tubeR + 0.012, 0.018, 12, 32);
    const lip = new THREE.Mesh(lipGeo, glassMat);
    lip.rotation.y = Math.PI / 2;
    lip.position.x = tubeLen / 2;
    group.add(lip);

    // ===== Essence liquid inside =====
    const liquidR = tubeR - 0.025;
    const liquidLen = tubeLen * 0.9;
    const cylPortion = Math.max(0.01, liquidLen - 2 * liquidR);

    const liquidMat = new THREE.MeshStandardMaterial({
        color: ESSENCE_GREEN,
        emissive: ESSENCE_EMISSIVE,
        emissiveIntensity: 0.8,
        metalness: 0.0,
        roughness: 0.22
    });

    const liquidGeo = new THREE.CapsuleGeometry(liquidR, cylPortion, 8, 16);
    const liquid = new THREE.Mesh(liquidGeo, liquidMat);
    liquid.rotation.z = Math.PI / 2;
    liquid.position.x = -tubeLen / 2 + liquidLen / 2;
    group.add(liquid);

    // ===== Bubbles trapped in the liquid =====
    const liquidBubbleMat = new THREE.MeshStandardMaterial({
        color: ESSENCE_BUBBLE,
        emissive: 0xaaffaa,
        emissiveIntensity: 0.5,
        metalness: 0.0,
        roughness: 0.15
    });

    const bubbles = [
        { x: -0.55, y:  0.06, z:  0.04, r: 0.05  },
        { x: -0.20, y: -0.08, z: -0.04, r: 0.065 },
        { x:  0.15, y:  0.05, z:  0.06, r: 0.045 },
        { x:  0.45, y: -0.04, z:  0.03, r: 0.04  }
    ];
    for (const b of bubbles) {
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(b.r, 16, 12), liquidBubbleMat);
        bubble.position.set(b.x, b.y, b.z);
        group.add(bubble);
    }

    // ===== Black rubber stopper =====
    const stopperMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.85,
        metalness: 0.0
    });

    const plug = new THREE.Mesh(
        new THREE.CylinderGeometry(tubeR - 0.008, tubeR - 0.022, 0.11, 24),
        stopperMat
    );
    plug.rotation.z = -Math.PI / 2;
    plug.position.x = tubeLen / 2 - 0.04;
    group.add(plug);

    const flange = new THREE.Mesh(
        new THREE.CylinderGeometry(tubeR + 0.03, tubeR + 0.03, 0.05, 24),
        stopperMat
    );
    flange.rotation.z = Math.PI / 2;
    flange.position.x = tubeLen / 2 + 0.045;
    group.add(flange);

    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), stopperMat);
    knob.position.x = tubeLen / 2 + 0.095;
    knob.scale.y = 0.85;
    group.add(knob);

    // Scale so a single tube reads at roughly the same volume as a meat disk
    group.scale.setScalar(0.45);

    return group;
});

export default MeshPresets;
