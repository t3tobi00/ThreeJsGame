import * as THREE from 'three';

/**
 * ECS MovementSystem — Universal physics and steering for ALL entities.
 */
export class MovementSystem {
    constructor(joystick, keyboard = null) {
        this.joystick = joystick;
        this.keyboard = keyboard;
    }

    /**
     * @param {number[]} entities IDs of entities with ['Transform', 'Movement']
     * @param {number} deltaTime
     * @param {ECSManager} ecs
     */
    update(entities, deltaTime, ecs) {
        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const movement = ecs.getComponent(id, 'Movement');

            if (!transform || !movement) continue;

            const mesh = transform.mesh;
            const velocity = new THREE.Vector3();

            // Handle Input/Controller Types
            if (movement.controller === 'joystick') {
                // Player-controlled: sum keyboard + joystick, clamp to length 1.
                // Either input source drives the player; both can contribute
                // on devices that have both (e.g. laptop with touchscreen).
                const kb = this.keyboard ? this.keyboard.getVector() : { x: 0, y: 0 };
                const js = this.joystick ? this.joystick.getVector() : { x: 0, y: 0 };
                let ix = kb.x + js.x;
                let iy = kb.y + js.y;
                const mag = Math.hypot(ix, iy);
                if (mag > 1) { ix /= mag; iy /= mag; }
                velocity.set(ix, 0, iy);
            }
            else if (movement.controller === 'simple_steering' && movement.targetPoint) {
                // Point A to B steering
                const direction = new THREE.Vector3().subVectors(movement.targetPoint, mesh.position);
                if (direction.length() > 0.1) {
                    velocity.copy(direction.normalize());
                }
            }

            // Apply Movement
            if (velocity.length() > 0.1) {
                const step = movement.speed * deltaTime;
                mesh.position.add(velocity.multiplyScalar(step));

                // Snappy rotation toward movement direction
                const angle = Math.atan2(velocity.x, velocity.z);
                mesh.rotation.y = angle;
            }
        }
    }
}
