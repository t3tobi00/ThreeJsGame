/**
 * Component_Gate — Data for proximity-activated swinging gate.
 */
export class Component_Gate {
    constructor({
        activationRange = 5.0,
        openSpeed = 8.0
    } = {}) {
        this.activationRange = activationRange;
        this.openSpeed = openSpeed;
        // Runtime state
        this.openRatio = 0;
    }
}
