import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * StackSystem — ECS-driven multi-slot stacking.
 *
 * Queries all entities with Transform + InventoryStack.
 * For each entity, updates every slot's spring physics.
 * Multi-slot entities get side-by-side stacks.
 *
 * Stack visuals (scale, offset per resource) are applied by
 * Component_InventoryStack.addToSlot via StackConfigRegistry — this system
 * is now responsible only for per-frame positioning and the
 * 'item:collected' → addToSlot bridge.
 *
 * Listens:  'item:collected' → addToSlot(collectorId, resourceType, mesh)
 * Emits:    'stack:changed' → { entityId, type, count, totalCount }
 */
export class StackSystem {
    constructor(scene) {
        this.scene = scene;
        this._ecs = null;

        EventBus.on('item:collected', ({ collectorId, itemType, mesh }) => {
            this._addToSlot(collectorId, itemType || 'meat', mesh);
        });
    }

    update(entities, deltaTime, ecs) {
        this._ecs = ecs;

        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const inventory = ecs.getComponent(entityId, 'InventoryStack');
            if (!transform || !inventory) continue;

            const anchor = inventory.anchorOffset;
            const entityPos = transform.mesh.position;
            const numSlots = inventory.slots.length;
            const angle = transform.mesh.rotation.y;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            for (let i = 0; i < numSlots; i++) {
                const slot = inventory.slots[i];
                // Side-by-side offset: centered around the anchor
                const xOffset = (i - (numSlots - 1) / 2) * inventory.slotSpacing;
                // Rotate local offset by player facing so stack stays behind
                const localX = anchor.x + xOffset;
                const localZ = anchor.z;
                const basePos = new THREE.Vector3(
                    entityPos.x + localX * cosA + localZ * sinA,
                    entityPos.y + anchor.y,
                    entityPos.z - localX * sinA + localZ * cosA
                );
                slot.stack.update(basePos, angle);
            }
        }
    }

    _addToSlot(entityId, resourceType, mesh) {
        if (!this._ecs) return;
        const inventory = this._ecs.getComponent(entityId, 'InventoryStack');
        if (!inventory) return;

        this.scene.add(mesh);
        // InventoryStack.addToSlot applies stack scale + per-resource offset.
        const added = inventory.addToSlot(resourceType, mesh, { animate: true });
        if (added) {
            EventBus.emit('stack:changed', {
                entityId,
                type: resourceType,
                count: inventory.getCountByType(resourceType),
                totalCount: inventory.getTotalCount()
            });
        }
    }

    /**
     * Pop one item of a specific type from an entity's inventory.
     * @returns {THREE.Mesh|null}
     */
    popFromSlot(entityId, resourceType) {
        if (!this._ecs) return null;
        const inventory = this._ecs.getComponent(entityId, 'InventoryStack');
        if (!inventory) return null;

        const mesh = inventory.popFromSlot(resourceType);
        if (mesh) {
            EventBus.emit('stack:changed', {
                entityId,
                type: resourceType,
                count: inventory.getCountByType(resourceType),
                totalCount: inventory.getTotalCount()
            });
        }
        return mesh;
    }

    /**
     * Pop any item from an entity's inventory.
     * @returns {THREE.Mesh|null}
     */
    popAny(entityId) {
        if (!this._ecs) return null;
        const inventory = this._ecs.getComponent(entityId, 'InventoryStack');
        if (!inventory) return null;

        const mesh = inventory.popAny();
        if (mesh) {
            EventBus.emit('stack:changed', {
                entityId,
                totalCount: inventory.getTotalCount()
            });
        }
        return mesh;
    }

    setECS(ecs) {
        this._ecs = ecs;
    }
}
