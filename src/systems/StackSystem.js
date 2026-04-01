import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * StackSystem — ECS-driven.
 * Queries all entities with Transform + InventoryStack.
 * For each, calls stack.update(basePos) every frame to drive spring physics.
 * Also provides addDisk(entityId) and popDisk(entityId) for other systems.
 *
 * Listens to:  'item:collected' → addDisk(collectorId, mesh)
 * Emits:       'stack:changed' → { entityId, count }
 */
export class StackSystem {
    constructor(scene) {
        this.scene = scene;
        this._ecs = null;

        // Listen for items arriving at a collector entity
        EventBus.on('item:collected', ({ collectorId, mesh }) => {
            this._addMeshToStack(collectorId, mesh);
        });
    }

    /**
     * Called by ECS every frame.
     * @param {number[]} entities IDs with ['Transform', 'InventoryStack']
     */
    update(entities, deltaTime, ecs) {
        this._ecs = ecs;

        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const inventory = ecs.getComponent(entityId, 'InventoryStack');
            if (!transform || !inventory) continue;

            const anchor = inventory.anchorOffset;
            const basePos = new THREE.Vector3(
                transform.mesh.position.x + anchor.x,
                transform.mesh.position.y + anchor.y,
                transform.mesh.position.z + anchor.z
            );
            inventory.stack.update(basePos);
        }
    }

    /**
     * Add a pre-existing mesh to an entity's inventory stack.
     * @param {number} entityId
     * @param {THREE.Mesh} mesh
     */
    _addMeshToStack(entityId, mesh) {
        if (!this._ecs) return;
        const inventory = this._ecs.getComponent(entityId, 'InventoryStack');
        if (!inventory) return;

        this.scene.add(mesh);
        inventory.stack.add(mesh, { animate: true });
        EventBus.emit('stack:changed', { entityId, count: inventory.stack.getCount() });
    }

    /**
     * Exposed for DepositorSystem: pop the top item from an entity's stack.
     * @param {number} entityId
     * @returns {THREE.Mesh|null}
     */
    popDisk(entityId) {
        if (!this._ecs) return null;
        const inventory = this._ecs.getComponent(entityId, 'InventoryStack');
        if (!inventory || inventory.stack.getCount() === 0) return null;
        const disk = inventory.stack.pop();
        EventBus.emit('stack:changed', { entityId, count: inventory.stack.getCount() });
        return disk;
    }

    /**
     * main.js must call this after creating StackSystem so it can access ECS.
     */
    setECS(ecs) {
        this._ecs = ecs;
    }
}
