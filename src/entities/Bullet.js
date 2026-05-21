import * as THREE from 'three';

/**
 * Bullet — pinpoint tracer for the player's auto-aim gun.
 *
 * Slice 2 redesign: tiny streak (0.25u long, 0.025u radius) instead of the
 * fat slice-1 cylinder. PUBG-style — visible but minimal, so the eye reads
 * the trajectory without the bullet itself dominating the screen.
 *
 * Mesh local +Z runs along the bullet's length; reset() aligns it to velocity.
 */
export class Bullet extends THREE.Mesh {
    constructor() {
        const geo = new THREE.CylinderGeometry(0.025, 0.025, 0.25, 6);
        geo.rotateX(Math.PI / 2); // length now runs along local Z
        const mat = new THREE.MeshBasicMaterial({
            color: 0xfff8d8,
            transparent: true,
            opacity: 0.95
        });
        super(geo, mat);

        this.velocity = new THREE.Vector3();
        this.elapsed = 0;
        this.distanceTraveled = 0;
        this.damage = 1;
        this.maxLifetime = 1.5;
        this.maxRange = 16;
        this._origin = new THREE.Vector3();
        this._lookAtTmp = new THREE.Vector3();
    }

    reset(origin, direction, speed, damage, maxRange) {
        this.position.copy(origin);
        this._origin.copy(origin);
        this.velocity.copy(direction).multiplyScalar(speed);
        this.elapsed = 0;
        this.distanceTraveled = 0;
        this.damage = damage;
        this.maxRange = maxRange;
        this.visible = true;

        // Aim local +Z along velocity. lookAt orients local -Z toward the
        // target, so feed it a point *behind* the bullet on the velocity
        // line to get +Z forward.
        this._lookAtTmp.copy(origin).sub(direction);
        this.lookAt(this._lookAtTmp);
    }

    update(deltaTime) {
        const stepLen = this.velocity.length() * deltaTime;
        this.position.addScaledVector(this.velocity, deltaTime);
        this.distanceTraveled += stepLen;
        this.elapsed += deltaTime;
    }
}
