/**
 * SpringStackAnim — Parameters for the jelly-stack spring physics.
 * wobble: lateral sway intensity on direction change.
 * squash: vertical squash amount on item add/remove.
 * lag: follow delay per item in the stack (seconds).
 */
export class Component_SpringStackAnim {
    constructor({ wobble = 0.3, squash = 0.15, lag = 0.15 } = {}) {
        this.wobble = wobble;
        this.squash = squash;
        this.lag = lag;
    }
}
