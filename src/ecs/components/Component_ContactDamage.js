/**
 * ContactDamage — Entity deals damage on contact with nearby targets.
 * damage: HP removed per hit.
 * cooldown: seconds between hits.
 * range: proximity distance for contact.
 * targetFactions: which factions to damage (e.g. ["player", "structure"]).
 */
export class Component_ContactDamage {
    constructor({
        damage = 1,
        cooldown = 1.0,
        range = 1.2,
        targetFactions = ['player']
    } = {}) {
        this.damage = damage;
        this.cooldown = cooldown;
        this.range = range;
        this.targetFactions = targetFactions;
        // Runtime
        this.timeSinceLastHit = 999;
    }
}
