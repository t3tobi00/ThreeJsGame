/**
 * Shop — Repeatable purchase zone. Player spends coins, receives an effect.
 *
 * cost: number of coins per purchase
 * effect: string key — what happens on purchase ("heal", "speed_boost", etc.)
 * effectValue: numeric value for the effect (e.g. HP to restore)
 * range: proximity radius for interaction
 * drainRate: seconds between each coin drain
 * cooldown: seconds after purchase before next purchase allowed
 * label: display name for the shop
 */
export class Component_Shop {
    constructor({
        cost = 5,
        effect = 'heal',
        effectValue = 10,
        range = 3.0,
        drainRate = 0.25,
        cooldown = 2.0,
        label = 'Health'
    } = {}) {
        this.cost = cost;
        this.effect = effect;
        this.effectValue = effectValue;
        this.range = range;
        this.drainRate = drainRate;
        this.cooldown = cooldown;
        this.label = label;

        // Runtime state
        this.coinsDrained = 0;
        this.timeSinceLastDrain = 999;
        this.cooldownTimer = 0;
    }
}
