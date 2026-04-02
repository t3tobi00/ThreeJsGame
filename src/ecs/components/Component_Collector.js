/**
 * Collector — Entity pulls nearby resource items into its InventoryStack.
 *
 * radius: distance at which resources start flying to this entity.
 * resourceTypes: which resource type tags to collect (e.g. ['meat', 'coin']).
 * pullForce: speed multiplier for the fly-to animation (higher = faster pull).
 * collectFromTags: pull items from nearby entities with these tags (e.g. ['tray']).
 */
export class Component_Collector {
    constructor({
        radius = 5,
        resourceTypes = ['meat'],
        pullForce = 1.0,
        collectFromTags = [],
        pickupRate = 0.25
    } = {}) {
        this.radius = radius;
        this.resourceTypes = resourceTypes;
        this.pullForce = pullForce;
        this.collectFromTags = collectFromTags;
        this.pickupRate = pickupRate;
        // Runtime state
        this.inFlightCount = 0;
        this.pickupTimer = 0;
    }
}
