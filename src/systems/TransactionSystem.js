import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';

/**
 * ECS TransactionSystem — Handles all resource trades between entities.
 * 
 * Replaces: SellingSystem, CoinSystem interaction logic.
 */
export class TransactionSystem {
    constructor(scene) {
        this.scene = scene;
        this.transfer = new ResourceTransfer();
        this.lastTransferTime = 0;
    }

    /**
     * @param {number[]} storageIds IDs of entities with ['Transform', 'TransactionLogic', 'InventoryStack']
     */
    update(storageIds, deltaTime, ecs) {
        this.transfer.update(deltaTime);
        this.lastTransferTime += deltaTime;

        const allEntities = ecs.queryEntities(['Transform', 'InventoryStack', 'Tag']);

        // Update all active visual stacks EVERY frame for smooth physics (Lego wobble)
        for (const entityId of allEntities) {
            const inv = ecs.getComponent(entityId, 'InventoryStack');
            const transform = ecs.getComponent(entityId, 'Transform');

            // Set the anchor relative to the entity's current world position
            const anchor = transform.mesh.position.clone().add(new THREE.Vector3(
                inv.anchorOffset.x,
                inv.anchorOffset.y,
                inv.anchorOffset.z
            ));

            // Also rotate the stack base to match the entity (so it wobbles when character turns)
            const forward = new THREE.Vector3(0, 0, 1).applyEuler(transform.mesh.rotation);
            // We pass position and forward direction to ResourceStack if supported, but just basePos for now
            inv.stack.update(anchor);

            // Apply rotation trick so the lowest resources orient correctly
            for (let i = 0; i < inv.stack.items.length; i++) {
                // Keep upright but rotate to match holder
                inv.stack.items[i].rotation.y = transform.mesh.rotation.y;
            }
        }

        if (this.lastTransferTime < 0.15) return; // limit transfer speed globally

        for (const storageId of storageIds) {
            const storageTransform = ecs.getComponent(storageId, 'Transform');
            const storageLogic = ecs.getComponent(storageId, 'TransactionLogic');

            // Skip if this entity has an inventory but no transaction logic (e.g. the Player)
            if (!storageLogic) continue;

            // Find eligible traders nearby
            for (const traderId of allEntities) {
                if (traderId === storageId) continue;

                const traderTransform = ecs.getComponent(traderId, 'Transform');
                const traderTag = ecs.getComponent(traderId, 'Tag');

                const dist = storageTransform.mesh.position.distanceTo(traderTransform.mesh.position);
                if (dist > storageLogic.interactionRange) continue;

                // A. TRADER GIVING RESOURCE TO STORAGE
                if (storageLogic.receivesResource && storageLogic.receivedFromTags.includes(traderTag)) {
                    this.executeTransfer(traderId, storageId, storageLogic.receivesResource, ecs);
                }

                // B. STORAGE GIVING RESOURCE TO TRADER
                if (storageLogic.givesResource && storageLogic.givenToTags.includes(traderTag)) {
                    this.executeTransfer(storageId, traderId, storageLogic.givesResource, ecs);
                }
            }
        }

        this.lastTransferTime = 0;
    }

    executeTransfer(fromId, toId, resourceType, ecs) {
        const fromInv = ecs.getComponent(fromId, 'InventoryStack');
        const toInv = ecs.getComponent(toId, 'InventoryStack');

        if (!fromInv || !toInv) return;
        if (fromInv.stack.getCount() === 0) return;
        if (toInv.stack.getCount() >= toInv.maxCapacity) return;

        // Extract physical mesh from the 'from' stack
        const mesh = fromInv.stack.pop();
        if (!mesh) return;

        const fromPos = new THREE.Vector3();
        mesh.getWorldPosition(fromPos);

        const toTransform = ecs.getComponent(toId, 'Transform');
        const toPos = toTransform.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));

        // Start Flight
        this.scene.attach(mesh);
        this.transfer.send(mesh, fromPos, toPos, {
            arcHeight: 2,
            duration: 0.5,
            onArrive: (m) => {
                const holder = ecs.getComponent(toId, 'Transform').mesh;
                holder.attach(m);
                toInv.stack.add(m, { animate: true });
            }
        });
    }
}
