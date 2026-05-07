/**
 * Burning — Status effect applied to entities hit by fire-type attacks
 * (currently only the Bruiser's magma breath via ContactDamage.applyBurning).
 *
 * Carries:
 *   duration       — seconds remaining; expires when ≤ 0
 *   dotPerSec      — fire damage per second (HP/sec)
 *   dotAccumulator — fractional damage accumulator; emits 1 dmg events whenever ≥ 1
 *   _origMaterials — lazy-cached snapshot of materials' emissive state, for restoration on expiry
 *   _particleTimer — countdown for the next body-rising fire-ember spawn
 */
export class Component_Burning {
    constructor({ duration = 2, dotPerSec = 1 } = {}) {
        this.duration = duration;
        this.dotPerSec = dotPerSec;
        this.dotAccumulator = 0;
        this._origMaterials = null;
        this._particleTimer = 0;
    }
}
