// Jungle Zone — mesh presets (extracted from MeshPresetsDiorama.js)
// Side-effect import: registers jungle/nature presets into MeshPresets.
//
// Includes: pad-jungle, palm-tree, fern, mossy-boulder.

import * as THREE from 'three';
import MeshPresets from '../../core/MeshPresets.js';

// ---------------------------------------------------------------------------
// Shared helpers (duplicated from MeshPresetsDiorama — kept local)
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

function groundPad(width, depth, mat) {
    const geo = new THREE.PlaneGeometry(width, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
}

// ---------------------------------------------------------------------------
// dio-pad-jungle — green grass ground
// ---------------------------------------------------------------------------

MeshPresets.register('dio-pad-jungle', ({ size = 16 } = {}) => {
    const tex = makeTex('dio-pad-jungle', (ctx) => {
        ctx.fillStyle = '#3da14a';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = 'rgba(20, 60, 20, 0.35)';
        for (let i = 0; i < 24; i++) {
            const x = Math.random() * 128, y = Math.random() * 128;
            ctx.beginPath();
            ctx.arc(x, y, 6 + Math.random() * 10, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(180, 255, 140, 0.18)';
        for (let i = 0; i < 18; i++) {
            const x = Math.random() * 128, y = Math.random() * 128;
            ctx.fillRect(x, y, 2, 2);
        }
    }, 4, 4);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.0 });
    return groundPad(size, size, mat);
});

// ---------------------------------------------------------------------------
// dio-palm-tree — curved trunk + leaf fronds
// ---------------------------------------------------------------------------

MeshPresets.register('dio-palm-tree', () => {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2db84a, roughness: 0.7 });
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

// ---------------------------------------------------------------------------
// dio-fern — small ground plant
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// dio-mossy-boulder — rock with moss cap
// ---------------------------------------------------------------------------

MeshPresets.register('dio-mossy-boulder', () => {
    const group = new THREE.Group();
    const stone = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.8, 0),
        new THREE.MeshStandardMaterial({ color: 0x787872, roughness: 0.95 })
    );
    stone.scale.set(1.2, 0.8, 1.1);
    stone.castShadow = true; stone.receiveShadow = true;
    group.add(stone);
    const moss = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x4ab84a, roughness: 0.85 })
    );
    moss.position.y = 0.55;
    moss.scale.set(1.3, 0.5, 1.2);
    group.add(moss);
    return group;
});
