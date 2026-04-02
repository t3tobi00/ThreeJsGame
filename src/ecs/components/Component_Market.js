/**
 * Market — Converts resources to coins when a player is nearby.
 *
 * accepts: array of resource types this market buys
 * payRate: object mapping resource type → coin value
 * range: proximity radius for interaction
 * drainRate: seconds between each resource drain
 */
export class Component_Market {
    constructor({
        accepts = ['bio-matter', 'zombie-teeth', 'mutant-core'],
        payRate = { 'bio-matter': 1, 'zombie-teeth': 5, 'mutant-core': 15 },
        range = 3.0,
        drainRate = 0.15,
        outputTag = 'market-tray'
    } = {}) {
        this.accepts = accepts;
        this.payRate = payRate;
        this.range = range;
        this.drainRate = drainRate;
        this.outputTag = outputTag;
        this.timeSinceLastDrain = 999;
    }
}
