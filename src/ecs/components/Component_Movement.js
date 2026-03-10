/**
 * Component_Movement — Data for physics and steering.
 */
export class Component_Movement {
    /**
     * @param {Object} options
     * @param {number} [options.speed=5] Max speed in units/sec
     * @param {string} [options.controller='none'] 'joystick', 'simple_steering', 'none'
     * @param {string} [options.faction='neutral'] 'player', 'enemy', 'neutral'
     */
    constructor({ speed = 5, controller = 'none', faction = 'neutral' } = {}) {
        this.speed = speed;
        this.controller = controller;
        this.faction = faction;

        // Dynamic state
        this.velocity = { x: 0, y: 0, z: 0 };
        this.targetPoint = null; // THREE.Vector3 if steering
    }
}
