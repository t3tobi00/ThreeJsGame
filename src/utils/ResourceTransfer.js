/**
 * ResourceTransfer — reusable Bezier-arc flight animation.
 *
 * The caller is responsible for creating the mesh, adding it to the scene,
 * and deciding what to do when it arrives (via onArrive callback).
 * ResourceTransfer only handles the flight path and timing.
 *
 * @example — meat from player stack to selling table
 *   const transfer = new ResourceTransfer();
 *   transfer.send(meatMesh, playerPos, tablePos, {
 *       arcHeight: 3,
 *       duration:  0.5,
 *       onArrive: (mesh) => meatTable.receiveArrival(mesh)
 *   });
 *   // each frame:
 *   transfer.update(deltaTime);
 *
 * @example — coins from villager to coin tray
 *   transfer.send(coinMesh, villagerPos, trayPos, {
 *       arcHeight: 2,
 *       spin: false,
 *       onArrive: (mesh) => coinTray.receiveArrival(mesh)
 *   });
 */
import * as THREE from 'three';

export class ResourceTransfer {
    constructor() {
        /** @type {Array<FlightRecord>} */
        this.flights = [];
    }

    /**
     * Launch a mesh on a Bezier arc from fromPos to toPos.
     *
     * @param {THREE.Object3D} mesh       Already in the scene
     * @param {THREE.Vector3}  fromPos    Start world position
     * @param {THREE.Vector3}  toPos      End world position
     * @param {Object}  [options]
     * @param {number}  [options.arcHeight=3]   Peak height above the higher endpoint
     * @param {number}  [options.duration=0.5]  Seconds to complete flight
     * @param {boolean} [options.spin=true]     Spin mesh on Y-axis during flight
     * @param {Function}[options.onArrive]      Called with (mesh) on arrival
     */
    send(mesh, fromPos, toPos, options = {}) {
        const { arcHeight = 3, duration = 0.5, spin = true, onArrive = null } = options;

        const start   = fromPos.clone();
        const end     = toPos.clone();
        const control = new THREE.Vector3(
            (start.x + end.x) / 2,
            Math.max(start.y, end.y) + arcHeight,
            (start.z + end.z) / 2
        );

        this.flights.push({
            mesh,
            start, control, end,
            time: 0,
            duration,
            spin,
            spinSpeed: (Math.random() - 0.5) * 10,
            onArrive
        });
    }

    /**
     * Advance all in-flight animations. Call once per frame.
     * @param {number} deltaTime  Seconds since last frame
     */
    update(deltaTime) {
        this.flights = this.flights.filter(f => {
            f.time += deltaTime;
            const t  = Math.min(f.time / f.duration, 1);
            const mt = 1 - t;

            // Quadratic Bezier interpolation
            f.mesh.position.set(
                mt * mt * f.start.x   + 2 * mt * t * f.control.x   + t * t * f.end.x,
                mt * mt * f.start.y   + 2 * mt * t * f.control.y   + t * t * f.end.y,
                mt * mt * f.start.z   + 2 * mt * t * f.control.z   + t * t * f.end.z
            );

            if (f.spin) f.mesh.rotation.y += f.spinSpeed * deltaTime;

            if (t >= 1) {
                if (f.onArrive) f.onArrive(f.mesh);
                return false;
            }
            return true;
        });
    }

    /** Number of meshes currently in flight. */
    getInFlightCount() {
        return this.flights.length;
    }

    /** Cancel all in-flight animations (does NOT remove meshes from scene). */
    dispose() {
        this.flights = [];
    }
}
