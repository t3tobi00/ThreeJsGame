import * as THREE from 'three';
import ResourceRegistry from '../core/ResourceRegistry.js';

/**
 * ResourceIconBaker — renders a resource's actual 3D mesh to a transparent
 * PNG data URL so the HTML menu can show the same shape/material the player
 * carries on their back, instead of a generic emoji.
 *
 * Usage:
 *   const dataURL = bakeResourceIcon('essence', 64);
 *   img.src = dataURL;
 *
 * Implementation notes:
 *   - Uses a one-shot offscreen WebGLRenderer (size × size canvas, alpha
 *     enabled). After capture we dispose the renderer to free GL state;
 *     this runs at boot so the cost is paid once.
 *   - The mesh is centered on the origin, then a perspective camera frames
 *     it with a slight 3/4 angle so the silhouette reads.
 *   - Two lights (ambient + key) keep the shape readable without muddying
 *     bright resources like essence (which is emissive).
 */
export function bakeResourceIcon(type, size = 96) {
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
        console.warn('[ResourceIconBaker] failed to create renderer for', type, e);
        return null;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();

    // Lights — soft ambient so dark sides stay readable, plus a strong key
    // from camera-up-right for shape definition.
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(2, 3.5, 2.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffd9a0, 0.35);
    fill.position.set(-2, 1, -1);
    scene.add(fill);

    let mesh = null;
    try {
        mesh = ResourceRegistry.createMesh(type, 'stacked');
    } catch (e) { /* fall through */ }
    if (!mesh) {
        renderer.dispose();
        return null;
    }

    // Center on origin (the resource meshes have varied pivots) so framing
    // is consistent across resource types.
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    const sz = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(sz);
    mesh.position.sub(center);
    scene.add(mesh);

    // Frame: pick camera distance from the largest mesh dimension so the
    // resource fills ~75 % of the canvas regardless of its real size.
    const maxDim = Math.max(sz.x, sz.y, sz.z, 0.4);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
    const dist = maxDim * 3.0;
    camera.position.set(dist * 0.85, dist * 0.95, dist * 1.10);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    let dataURL = null;
    try {
        dataURL = renderer.domElement.toDataURL('image/png');
    } catch (e) {
        console.warn('[ResourceIconBaker] toDataURL failed for', type, e);
    }

    // Dispose
    scene.remove(mesh);
    mesh.traverse?.(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    });
    renderer.dispose();

    return dataURL;
}

/**
 * Bake a batch of resources up-front and return a { type → dataURL } map.
 */
export function bakeResourceIconSet(types, size = 96) {
    const out = {};
    for (const t of types) {
        const url = bakeResourceIcon(t, size);
        if (url) out[t] = url;
    }
    return out;
}
