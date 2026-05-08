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
 * lineWidth + pierce: optional. If both set, damage is line-pierce —
 *   a forward ray of length `range` and half-width `lineWidth` damages
 *   EVERY enemy along the line (not just the first). Used by Sharpshooter
 *   piercing arrow.
 * applyBurning: optional { duration, dotPerSec }. If set, ContactDamageSystem
 *   emits entity:ignited per hit → BurningSystem attaches Component_Burning
 *   (orange emissive + body embers + DoT). Used by Bruiser magma breath.
 * applyBleeding: optional { duration, dotPerSec }. If set, ContactDamageSystem
 *   emits entity:bled per hit → BleedingSystem attaches Component_Bleeding
 *   (crimson emissive + DoT). Used by Sharpshooter piercing arrow.
 */
export class Component_ContactDamage {
    constructor({
        damage = 1,
        cooldown = 1.0,
        range = 1.2,
        targetFactions = ['player'],
        coneAngle = null,
        lineWidth = null,
        pierce = false,
        applyBurning = null,
        applyBleeding = null
    } = {}) {
        this.damage = damage;
        this.cooldown = cooldown;
        this.range = range;
        this.targetFactions = targetFactions;
        this.coneAngle = coneAngle;
        this.lineWidth = lineWidth;
        this.pierce = pierce;
        this.applyBurning = applyBurning;
        this.applyBleeding = applyBleeding;
        // Runtime
        this.timeSinceLastHit = 999;
    }
}
