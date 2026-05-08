/**
 * Bleeding — DoT status effect attached by BleedingSystem.
 *
 * Mirrors Component_Burning but with a red/crimson tint and no body
 * embers. Attached via 'entity:bled' event when a piercing-arrow attack
 * hits a target. Decays over `duration` seconds, dealing `dotPerSec`
 * HP per second. Refreshing on a still-bleeding target takes the max of
 * each field.
 */
export class Component_Bleeding {
    constructor({ duration = 3.0, dotPerSec = 4 } = {}) {
        this.duration = duration;
        this.dotPerSec = dotPerSec;
        // Runtime — accumulates fractional damage per frame so that
        // dotPerSec values < 1/frameRate still apply over time.
        this.dotAccumulator = 0;
        // Lazy-cached emissive state for restore-on-expire.
        this._origMaterials = null;
    }
}
