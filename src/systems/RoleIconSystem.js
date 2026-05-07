import * as THREE from 'three';

/**
 * RoleIconSystem — 3D-parented role badge above each worker for debug
 * visibility. Per PR #3.3 advisor note: with three concurrent FSMs running
 * (wood / essence / builder), seeing role at a glance prevents misreading
 * thrash by eye.
 *
 * Each worker gets a small distinct-shape icon attached to its mesh root,
 * floating at y=2.6. Shape per role:
 *   wood      → brown horizontal cylinder (log slice)
 *   essence   → cyan emissive sphere
 *   builder   → yellow box (brick)
 *   disabled  → no icon
 *
 * Removed automatically when the worker entity is destroyed (we re-validate
 * each frame via ecs.queryEntities).
 *
 * Queries: ['Transform', 'WorkerAI']
 */
export class RoleIconSystem {
    constructor(scene) {
        this.scene = scene;
        this._icons = new Map();   // entityId → mesh
        this._t = 0;
    }

    update(entities, deltaTime, ecs) {
        this._t += deltaTime;

        // Drop icons for entities no longer present
        const live = new Set(entities);
        for (const [id, mesh] of this._icons) {
            if (!live.has(id)) {
                if (mesh.parent) mesh.parent.remove(mesh);
                this._icons.delete(id);
            }
        }

        // Create / update icons
        const yBob = Math.sin(this._t * 2.5) * 0.08;
        for (const id of entities) {
            const ai = ecs.getComponent(id, 'WorkerAI');
            if (!ai || ai.role === 'disabled') continue;
            const transform = ecs.getComponent(id, 'Transform');
            if (!transform?.mesh) continue;

            let icon = this._icons.get(id);
            if (!icon) {
                icon = this._makeIconForRole(ai.role);
                if (!icon) continue;
                icon.position.set(0, 2.6, 0);
                transform.mesh.add(icon);
                this._icons.set(id, icon);
            }
            icon.position.y = 2.6 + yBob;
            icon.rotation.y += deltaTime * 1.2;  // gentle spin so it reads
        }
    }

    _makeIconForRole(role) {
        if (role === 'wood') {
            const mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.10, 0.10, 0.18, 10),
                new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 })
            );
            mesh.rotation.z = Math.PI / 2;
            return mesh;
        }
        if (role === 'essence') {
            return new THREE.Mesh(
                new THREE.SphereGeometry(0.10, 12, 10),
                new THREE.MeshStandardMaterial({
                    color: 0x66ddff,
                    emissive: 0x33aadd,
                    emissiveIntensity: 0.9,
                    roughness: 0.3
                })
            );
        }
        if (role === 'builder') {
            return new THREE.Mesh(
                new THREE.BoxGeometry(0.16, 0.12, 0.16),
                new THREE.MeshStandardMaterial({ color: 0xddcc22, roughness: 0.5 })
            );
        }
        return null;
    }
}
