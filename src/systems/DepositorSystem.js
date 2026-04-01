import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import EventBus from '../core/EventBus.js';

/**
 * DepositorSystem — ECS-driven replacement for SellingSystem.
 *
 * Queries depositor entities: ['Transform', 'Depositor', 'InventoryStack'].
 * Queries target entities:    ['Transform', 'Tag', 'InventoryStack'].
 *
 * Each frame: if a depositor is within range of a target with matching tag,
 * and the depositor has items, transfer one item on interval via arc animation.
 *
 * Uses ResourceTransfer utility for the Bezier-arc animation.
 * Emits: 'item:deposited' { depositorId, targetId, itemType }
 */
export class DepositorSystem {
    constructor(scene) {
        this.scene = scene;
        this._transfer = new ResourceTransfer();
    }

    /** Called by ECS every frame. */
    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);

        for (const depositorId of entities) {
            const transform = ecs.getComponent(depositorId, 'Transform');
            const depositor = ecs.getComponent(depositorId, 'Depositor');
            const inventory = ecs.getComponent(depositorId, 'InventoryStack');
            if (!transform || !depositor || !inventory) continue;

            depositor.timeSinceLastTransfer += deltaTime;

            // Find the closest target entity with the matching tag
            const target = this._findTarget(depositorId, depositor.targetTag, transform.mesh.position, ecs);
            if (!target) { depositor.isInRange = false; continue; }

            const { entityId: targetId, transform: targetTransform, inventory: targetInventory } = target;
            const dist = transform.mesh.position.distanceTo(targetTransform.mesh.position);
            depositor.isInRange = dist < depositor.range;

            if (!depositor.isInRange) continue;
            if (inventory.stack.getCount() === 0) continue;
            if (depositor.timeSinceLastTransfer < depositor.transferRate) continue;
            if (targetInventory && targetInventory.stack.getCount() >= targetInventory.maxCapacity) continue;

            // Pop one item and arc it to the target
            const mesh = inventory.stack.pop();
            if (!mesh) continue;

            depositor.timeSinceLastTransfer = 0;
            EventBus.emit('stack:changed', { entityId: depositorId, count: inventory.stack.getCount() });

            const fromPos = mesh.position.clone();
            const toPos = targetTransform.mesh.position.clone().add(new THREE.Vector3(0, 0.6, 0));

            this._transfer.send(mesh, fromPos, toPos, {
                arcHeight: 2.5,
                duration: 0.4,
                spin: false,
                onArrive: (m) => {
                    targetInventory.stack.add(m, { animate: false });
                    EventBus.emit('item:deposited', {
                        depositorId,
                        targetId,
                        itemType: 'meat'
                    });
                }
            });
        }
    }

    _findTarget(depositorId, targetTag, fromPos, ecs) {
        const candidates = ecs.queryEntities(['Transform', 'Tag', 'InventoryStack']);
        let best = null;
        let bestDist = Infinity;

        for (const entityId of candidates) {
            if (entityId === depositorId) continue;
            const tag = ecs.getComponent(entityId, 'Tag');
            if (!tag || !tag.has(targetTag)) continue;

            const t = ecs.getComponent(entityId, 'Transform');
            const inv = ecs.getComponent(entityId, 'InventoryStack');
            const d = fromPos.distanceTo(t.mesh.position);
            if (d < bestDist) {
                bestDist = d;
                best = { entityId, transform: t, inventory: inv };
            }
        }
        return best;
    }
}
