/**
 * WalkAnim — Bob and tilt animation driven by movement velocity.
 * bobHeight: vertical oscillation amplitude.
 * bobFreq: oscillation frequency (cycles/sec).
 * tiltAngle: max forward-lean angle (radians) at full speed.
 */
export class Component_WalkAnim {
    constructor({ bobHeight = 0.08, bobFreq = 8, tiltAngle = 0.06 } = {}) {
        this.bobHeight = bobHeight;
        this.bobFreq = bobFreq;
        this.tiltAngle = tiltAngle;
        // Runtime
        this.phase = 0;
    }
}
