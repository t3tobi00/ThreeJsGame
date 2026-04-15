/**
 * Stall — Selling-stall configuration. Pure data; runtime state lives on the
 * stall's InventoryStack (current product count) and is computed from there.
 *
 * productType:  Resource id this stall sells (e.g. 'essenceCandy').
 * productLabel: Display name shown on the price sign / counter UI.
 * price:        Coins paid by a customer per one product purchased.
 * trayId:       ECS entity id of the linked coin tray (set at spawn time
 *               by createMarket(); not present in the JSON archetype).
 */
export class Component_Stall {
    constructor({
        productType  = 'essenceCandy',
        productLabel = 'Product',
        price        = 3,
        trayId       = null
    } = {}) {
        this.productType  = productType;
        this.productLabel = productLabel;
        this.price        = price;
        this.trayId       = trayId;
    }
}
