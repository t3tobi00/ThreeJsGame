/**
 * Regen — Out-of-combat HP regeneration. Currently attached only to the
 * prototype player (player-prototype.json). RegenSystem ticks the rate
 * after the entity has been undamaged for `oocThreshold` seconds.
 *
 * Why a component (and not part of HealthSystem): keeps regen opt-in
 * per-entity and trivially extensible to King-only / apple-tree-driven /
 * structure regen later. Allies + workers do NOT get this in the prototype
 * (locked input #4: damage is permanent for non-player units).
 *
 * Carries:
 *   ratePerSec    — HP per second to add while ticking
 *   oocThreshold  — seconds since last damage before regen kicks in
 *   _lastDamageAt — runtime stamp (seconds since boot); RegenSystem mutates
 *   _accumulator  — fractional HP buffer; emits +1 HP events each whole HP
 */
export class Component_Regen {
    constructor({ ratePerSec = 1, oocThreshold = 5 } = {}) {
        this.ratePerSec = ratePerSec;
        this.oocThreshold = oocThreshold;
        this._lastDamageAt = 0;
        this._accumulator = 0;
    }
}
