import * as THREE from 'three';

export class InputSystem {
    constructor(joystick) {
        this.joystick = joystick;
        this.movementVector = new THREE.Vector3();
    }

    update() {
        const joy = this.joystick.getVector();
        // UI Y is down, WebGL Z is "forward" (negative)
        this.movementVector.set(joy.x, 0, joy.y);
    }

    getMovementVector() {
        return this.movementVector;
    }
}
