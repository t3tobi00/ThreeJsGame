/**
 * Component_Shooter — Enables auto-combat for an entity.
 */
export class Component_Shooter {
    /**
     * @param {Object} options
     * @param {number} [options.range=15]
     * @param {number} [options.fireRate=0.5] Seconds between shots
     * @param {number} [options.damage=5]
     * @param {string[]} [options.targetFactions=['enemy']] Which movement factions to target
     */
    constructor({ range = 15, fireRate = 0.5, damage = 5, targetFactions = ['enemy'] } = {}) {
        this.range = range;
        this.fireRate = fireRate;
        this.damage = damage;
        this.targetFactions = targetFactions;

        // State
        this.enabled      = true;  // toggled by SafeZoneSystem
        this.lastFireTime = 0;
        this.currentTarget = null; // EntityID
    }
}
