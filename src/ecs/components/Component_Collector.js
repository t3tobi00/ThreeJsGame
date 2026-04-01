/**
 * Collector — Entity pulls nearby resource items into its InventoryStack.
 * radius: distance at which resources start flying to this entity.
 * resourceTypes: which resource type tags to collect (e.g. ['meat']).
 * pullForce: speed multiplier for the fly-to animation (higher = faster pull).
 */
export class Component_Collector {
    constructor({ radius = 5, resourceTypes = ['meat'], pullForce = 1.0 } = {}) {
        this.radius = radius;
        this.resourceTypes = resourceTypes;
        this.pullForce = pullForce;
        // Runtime state
        this.inFlightCount = 0;
    }
}
