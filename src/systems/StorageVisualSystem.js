import * as THREE from 'three';

/**
 * StorageVisualSystem — Renders a visible stack of items on top of each
 * Storage prop, so the player can see how full it is at a glance.
 *
 * Per-storage stack visual:
 *   wood    → small brown log meshes stacked in a 4×N grid
 *   essence → small cyan glowing orbs stacked in a 4×N grid
 *
 * The rendered count is capped at `storage.visualMax` (default 24) so a
 * storage with 100 items doesn't grow into a comically tall tower. The
 * actual count is preserved in the component.
 *
 * Re-builds the stack only when the count changes (Storage._renderedCount).
 *
 * Queries: ['Transform', 'Storage']
 */
export class StorageVisualSystem {
    constructor(scene) {
        this.scene = scene;
        this._stackGroups = new Map();   // entityId → THREE.Group on prop top
    }

    update(entities, deltaTime, ecs) {
        const live = new Set(entities);
        for (const [id, group] of this._stackGroups) {
            if (!live.has(id)) {
                if (group.parent) group.parent.remove(group);
                this._stackGroups.delete(id);
            }
        }

        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const storage = ecs.getComponent(id, 'Storage');
            if (!transform?.mesh || !storage) continue;

            let group = this._stackGroups.get(id);
            if (!group) {
                group = new THREE.Group();
                group.position.set(0, 0.5, 0);  // sits on top of the storage base
                transform.mesh.add(group);
                this._stackGroups.set(id, group);
            }

            const target = Math.min(storage.count, storage.visualMax);
            if (storage._renderedCount === target) continue;

            // Wipe and rebuild — cheap for small visualMax
            while (group.children.length > 0) {
                const c = group.children.pop();
                if (c.geometry) c.geometry.dispose?.();
                if (c.material) c.material.dispose?.();
            }
            for (let i = 0; i < target; i++) {
                group.add(this._makeItemMesh(storage.type, i));
            }
            storage._renderedCount = target;
        }
    }

    _makeItemMesh(type, index) {
        // Stacked in a 4-wide × N-deep × M-tall arrangement
        const COLS = 4;
        const ROWS = 4;
        const col = index % COLS;
        const row = Math.floor(index / COLS) % ROWS;
        const layer = Math.floor(index / (COLS * ROWS));

        if (type === 'wood') {
            const m = new THREE.Mesh(
                new THREE.CylinderGeometry(0.10, 0.10, 0.45, 8),
                new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 })
            );
            // Logs lay on their side
            m.rotation.z = Math.PI / 2;
            m.position.set(
                -0.45 + col * 0.30,
                0.10 + layer * 0.22,
                -0.45 + row * 0.30
            );
            return m;
        }
        if (type === 'essence') {
            const m = new THREE.Mesh(
                new THREE.SphereGeometry(0.13, 12, 10),
                new THREE.MeshStandardMaterial({
                    color: 0x66ddff,
                    emissive: 0x33aadd,
                    emissiveIntensity: 0.85,
                    roughness: 0.3,
                    metalness: 0.1
                })
            );
            m.position.set(
                -0.45 + col * 0.30,
                0.15 + layer * 0.30,
                -0.45 + row * 0.30
            );
            return m;
        }
        // Fallback grey block
        return new THREE.Mesh(
            new THREE.BoxGeometry(0.20, 0.20, 0.20),
            new THREE.MeshStandardMaterial({ color: 0x999999 })
        );
    }
}
