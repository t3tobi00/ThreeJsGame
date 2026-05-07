import * as THREE from 'three';

/**
 * OnSpawnSystem — One-shot multi-spawn helper.
 *
 * Runs every frame. For any entity with Component_OnSpawn, spawns each
 * configured child via factory.create at (anchorPos + offset), then removes
 * OnSpawn so it never fires again. Used by worker-pad-active to spawn its
 * 3 worker children on completion of the build flow.
 *
 * ORDER NOTE — must register AFTER BuildSystem in main.js. BuildSystem's
 * zone:funded handler calls factory.create('worker-pad-active') synchronously
 * inside UnlockZoneSystem's tick. If OnSpawnSystem runs before BuildSystem
 * in the registration order, we'd get a one-frame delay before children
 * appear. Currently both are registered in init() with OnSpawnSystem second.
 *
 * Queries: ['Transform', 'OnSpawn']
 */
export class OnSpawnSystem {
    constructor(factory) {
        this.factory = factory;
    }

    update(entities, deltaTime, ecs) {
        if (!entities.length) return;

        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const onSpawn = ecs.getComponent(id, 'OnSpawn');
            if (!transform || !onSpawn) continue;

            const anchor = transform.mesh.position;
            for (const child of onSpawn.children) {
                if (!child?.archetype) continue;
                const off = child.offset || [0, 0, 0];
                const pos = new THREE.Vector3(
                    anchor.x + (off[0] || 0),
                    anchor.y + (off[1] || 0),
                    anchor.z + (off[2] || 0)
                );
                this.factory.create(child.archetype, pos);
            }

            ecs.removeComponent(id, 'OnSpawn');
        }
    }
}
