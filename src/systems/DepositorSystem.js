import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import EventBus from '../core/EventBus.js';

/**
 * DepositorSystem — Transfers items from carrier to nearby tagged target.
 *
 * Queries: ['Transform', 'Depositor', 'InventoryStack']
 * Smart type matching: pops the resource type that the target accepts.
 *
 * Emits: 'item:deposited' { depositorId, targetId, itemType }
 *        'stack:changed' { entityId, type, count, totalCount }
 */
export class DepositorSystem {
    constructor(scene) {
        this.scene = scene;
        this._transfer = new ResourceTransfer();
    }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);

        for (const depositorId of entities) {
            const transform = ecs.getComponent(depositorId, 'Transform');
            const depositor = ecs.getComponent(depositorId, 'Depositor');
            const inventory = ecs.getComponent(depositorId, 'InventoryStack');
            if (!transform || !depositor || !inventory) continue;

            depositor.timeSinceLastTransfer += deltaTime;

            const target = this._findTarget(depositorId, depositor.targetTag, transform.mesh.position, ecs);
            if (!target) { depositor.isInRange = false; continue; }

            const { entityId: targetId, transform: targetTransform, inventory: targetInventory } = target;
            const dist = transform.mesh.position.distanceTo(targetTransform.mesh.position);
            depositor.isInRange = dist < depositor.range;

            if (!depositor.isInRange) continue;
            if (inventory.getTotalCount() === 0) continue;
            if (depositor.timeSinceLastTransfer < depositor.transferRate) continue;
            if (targetInventory && targetInventory.getTotalCount() >= targetInventory.slotCapacity * targetInventory.maxSlots) continue;

            // Find a matching resource type: what does the target accept?
            const mesh = this._popMatchingResource(inventory, targetInventory);
            if (!mesh) continue;

            const itemType = (mesh.userData && mesh.userData.resourceType) || 'any';

            depositor.timeSinceLastTransfer = 0;
            EventBus.emit('stack:changed', {
                entityId: depositorId,
                type: itemType,
                count: inventory.getCountByType(itemType),
                totalCount: inventory.getTotalCount()
            });

            const fromPos = mesh.position.clone();
            const toPos = targetTransform.mesh.position.clone().add(new THREE.Vector3(0, 0.6, 0));

            this._transfer.send(mesh, fromPos, toPos, {
                arcHeight: 2.5,
                duration: 0.4,
                spin: false,
                onArrive: (m) => {
                    const rType = (m.userData && m.userData.resourceType) || itemType;
                    targetInventory.addToSlot(rType, m, { animate: false });
                    EventBus.emit('item:deposited', {
                        depositorId,
                        targetId,
                        itemType: rType
                    });
                }
            });
        }
    }

    /**
     * Pop a resource from the carrier that the target will accept.
     * Prioritizes types the target explicitly accepts.
     */
    _popMatchingResource(carrierInv, targetInv) {
        if (!targetInv) return carrierInv.popAny();

        const targetAccepts = targetInv.acceptsTypes;

        // If target accepts specific types, find one we have
        if (targetAccepts && !targetAccepts.includes('any')) {
            for (const type of targetAccepts) {
                if (carrierInv.getCountByType(type) > 0 && targetInv.canAccept(type)) {
                    return carrierInv.popFromSlot(type);
                }
            }
            return null; // target doesn't accept anything we have
        }

        // Target accepts anything — pop whatever we have
        return carrierInv.popAny();
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
