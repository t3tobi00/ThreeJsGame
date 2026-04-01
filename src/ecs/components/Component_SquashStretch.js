/**
 * SquashStretch — Squash/stretch mesh scale based on movement speed.
 * intensity: max scale distortion (0 = none, 0.2 = subtle).
 * frequency: oscillation rate during movement.
 * trigger: what drives the effect ('move', 'jump', 'land').
 */
export class Component_SquashStretch {
    constructor({ intensity = 0.2, frequency = 8, trigger = 'move' } = {}) {
        this.intensity = intensity;
        this.frequency = frequency;
        this.trigger = trigger;
        // Runtime
        this.phase = 0;
    }
}
