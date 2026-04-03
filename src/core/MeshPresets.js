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

export default MeshPresets;
