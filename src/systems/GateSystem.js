import * as THREE from 'three';

/**
 * GateSystem — Proximity-activated swinging gate.
 *
 * Queries: ['Transform', 'Gate']
 * Finds nearest player entity and swings gate open when in range.
 */
export class GateSystem {
    constructor() {
        this._playerTransform = null;
    }

    setPlayerTransform(transform) {
        this._playerTransform = transform;
    }

    update(entities, deltaTime, ecs) {
        if (!this._playerTransform) return;

        const playerPos = this._playerTransform.mesh.position;

        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const gate = ecs.getComponent(entityId, 'Gate');
            if (!transform || !gate) continue;

            const dist = transform.mesh.position.distanceTo(playerPos);
            const targetOpen = dist < gate.activationRange ? 1 : 0;

            gate.openRatio = THREE.MathUtils.lerp(
                gate.openRatio, targetOpen, deltaTime * gate.openSpeed
            );

            // Animate the doorGroup child
            const doorGroup = transform.mesh.getObjectByName('doorGroup');
            if (doorGroup) {
                doorGroup.rotation.y = gate.openRatio * (Math.PI / 2);
                const scaleVal = 1.0 + Math.sin(gate.openRatio * Math.PI) * 0.1;
                doorGroup.scale.set(1, scaleVal, 1);
            }
        }
    }
}
