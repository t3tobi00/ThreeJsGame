/**
 * FlyToAnim — Parameters for Bezier arc flight animations.
 * Reused by CollectorSystem (items fly to entity) and DepositorSystem (items fly away).
 * arcHeight: peak height of the arc above the midpoint.
 * speed: base flight speed (units/sec at t=0.5).
 * easing: easing function name ('quadOut', 'linear').
 */
export class Component_FlyToAnim {
    constructor({ arcHeight = 2.5, speed = 8, easing = 'quadOut' } = {}) {
        this.arcHeight = arcHeight;
        this.speed = speed;
        this.easing = easing;
    }
}
