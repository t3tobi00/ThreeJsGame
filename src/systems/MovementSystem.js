import * as THREE from 'three';
import { PLAYER_CONFIG } from '../config/gameConfig.js';

export class MovementSystem {
    constructor(player) {
        this.player = player;
        this.velocity = new THREE.Vector3();
    }

    update(deltaTime, inputVector) {
        const targetVelocity = inputVector.clone().multiplyScalar(PLAYER_CONFIG.speed);

        // Pick acceleration or deceleration factor
        const isMoving = inputVector.lengthSq() > 0.001;
        const factor = isMoving ? PLAYER_CONFIG.acceleration : PLAYER_CONFIG.deceleration;

        // Frame-rate independent lerp
        const smoothing = 1 - Math.pow(1 - factor, deltaTime * 60);
        this.velocity.lerp(targetVelocity, smoothing);

        // Snap to zero if below deadzone to prevent sliding/drifting
        if (!isMoving && this.velocity.length() < PLAYER_CONFIG.velocityDeadzone) {
            this.velocity.set(0, 0, 0);
        }

        // Move player
        const frameVelocity = this.velocity.clone().multiplyScalar(deltaTime);
        this.player.group.position.add(frameVelocity);

        // Let player entity handle internal animations (squash/rotation)
        this.player.update(deltaTime, this.velocity);
    }
}
