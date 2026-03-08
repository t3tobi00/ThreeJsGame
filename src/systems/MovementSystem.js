import * as THREE from 'three';
import { PLAYER_CONFIG } from '../config/gameConfig.js';

export class MovementSystem {
    constructor(player) {
        this.player = player;
        this.velocity = new THREE.Vector3();
    }

    update(deltaTime, inputVector) {
        // Apply acceleration
        const targetVelocity = inputVector.clone().multiplyScalar(PLAYER_CONFIG.speed);
        this.velocity.lerp(targetVelocity, PLAYER_CONFIG.acceleration);

        // Move player
        const frameVelocity = this.velocity.clone().multiplyScalar(deltaTime);
        this.player.group.position.add(frameVelocity);

        // Let player entity handle internal animations (squash/rotation)
        this.player.update(deltaTime, this.velocity);
    }
}
