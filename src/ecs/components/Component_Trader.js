/**
 * Trader — Entity participates in resource transactions.
 * accepts: resource type this entity receives ('meat', 'coin').
 * gives: resource type this entity provides in exchange.
 * rate: how many 'gives' per 1 'accepts' (e.g. rate:2 = 2 coins per 1 meat).
 * minStock: minimum 'accepts' stock required before trade activates.
 */
export class Component_Trader {
    constructor({ accepts = 'meat', gives = 'coin', rate = 1, minStock = 1 } = {}) {
        this.accepts = accepts;
        this.gives = gives;
        this.rate = rate;
        this.minStock = minStock;
        // Runtime state
        this.pendingTransaction = false;
    }
}
