/**
 * Depositor — Entity transfers items from its InventoryStack to a tagged target entity.
 * range: proximity distance at which transfer starts.
 * targetTag: Tag value to look for on the destination entity (e.g. 'table').
 * transferRate: seconds between each item transfer.
 */
export class Component_Depositor {
    constructor({ range = 4, targetTag = 'table', transferRate = 0.3 } = {}) {
        this.range = range;
        this.targetTag = targetTag;
        this.transferRate = transferRate;
        // Runtime state
        this.timeSinceLastTransfer = 0;
        this.isInRange = false;
    }
}
