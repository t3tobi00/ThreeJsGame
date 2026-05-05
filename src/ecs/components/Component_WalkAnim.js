/**
 * WalkAnim — Bob and tilt animation driven by movement velocity.
 * bobHeight: vertical oscillation amplitude.
 * bobFreq: oscillation frequency (cycles/sec).
 * tiltAngle: max forward-lean angle (radians) at full speed.
 * style: 'human' (default — alternating arm/leg swing) or 'zombie' (arms
 *        locked forward in reach pose, stiff-leg lurch, side-to-side sway).
 */
export class Component_WalkAnim {
    constructor({ bobHeight = 0.08, bobFreq = 8, tiltAngle = 0.06, style = 'human' } = {}) {
        this.bobHeight = bobHeight;
        this.bobFreq = bobFreq;
        this.tiltAngle = tiltAngle;
        this.style = style;
        // Runtime
        this.phase = 0;
    }
}
