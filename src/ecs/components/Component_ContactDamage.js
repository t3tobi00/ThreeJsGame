/**
 * ContactDamage — Entity deals damage on contact with nearby targets.
 * damage: HP removed per hit.
 * cooldown: seconds between hits.
 * range: proximity distance for contact.
 * targetFactions: which factions to damage (e.g. ["player", "structure"]).
 * coneAngle: optional. If set (degrees, e.g. 60), damage is cone-AOE —
 *   filtered by attacker's forward facing direction × halfAngle, and
 *   ALL enemies inside the cone get hit per cooldown (instead of one).
 *   Used by Bruiser magma breath. Omit for default single-target melee.
 * applyBurning: optional { duration, dotPerSec }. If set, ContactDamageSystem
 *   emits an entity:ignited event for each target hit, which BurningSystem
 *   converts into a Component_Burning attachment (orange emissive tint +
 *   body embers + DoT). Used by Bruiser magma breath.
 */
export class Component_ContactDamage {
    constructor({
        damage = 1,
        cooldown = 1.0,
        range = 1.2,
        targetFactions = ['player'],
        coneAngle = null,
        applyBurning = null
    } = {}) {
        this.damage = damage;
        this.cooldown = cooldown;
        this.range = range;
        this.targetFactions = targetFactions;
        this.coneAngle = coneAngle;
        this.applyBurning = applyBurning;
        // Runtime
        this.timeSinceLastHit = 999;
    }
}
