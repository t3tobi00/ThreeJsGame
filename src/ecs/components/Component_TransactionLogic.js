/**
 * Component_TransactionLogic — Defines how storage nodes give/receive resources.
 */
export class Component_TransactionLogic {
    /**
     * @param {Object} options
     * @param {string|null} [options.receivesResource=null] e.g. 'meat'
     * @param {string|null} [options.givesResource=null] e.g. 'coin'
     * @param {string[]} [options.receivedFromTags=['player']] Entity tags Allowed to give to this
     * @param {string[]} [options.givenToTags=['villager']] Entity tags allowed to take from this
     * @param {number} [options.exchangeRate=1] For every 1 received, give X
     * @param {number} [options.interactionRange=4] Radius for detection
     */
    constructor({
        receivesResource = null,
        givesResource = null,
        receivedFromTags = ['player'],
        givenToTags = ['villager'],
        exchangeRate = 1,
        interactionRange = 4
    } = {}) {
        this.receivesResource = receivesResource;
        this.givesResource = givesResource;
        this.receivedFromTags = receivedFromTags;
        this.givenToTags = givenToTags;
        this.exchangeRate = exchangeRate;
        this.interactionRange = interactionRange;

        // Internal state
        this.transferTimer = 0;
    }
}
