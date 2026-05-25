import * as THREE from 'three';
import { buildWorkerAxe } from '../core/MeshPresets.js';

/**
 * PlayerAxe — woodsman axe attached to the player.
 *
 * Wraps MeshPresets.buildWorkerAxe() (the SAME axe the wood-worker carries)
 * so the player chops with identical visuals to the worker.
 *
 * Hidden by default — PlayerGunSystem toggles via setActive() when the
 * player walks within chop range of a tree (combat priority overrides).
 *
 * LungeAnimSystem finds the inner axe Group via mesh traversal looking for
 * `userData.isWorkerAxe`, so the chop swing animation plays automatically
 * when 'worker:chop:swing' is emitted with the player's entity ID.
 */
export class PlayerAxe extends THREE.Group {
    constructor() {
        super();
        this._axe = buildWorkerAxe(); // inner Group with userData.isWorkerAxe = true
        this.add(this._axe);
        // Scale up 1.5x — user feedback: worker-sized axe is too small to
        // read clearly on the player from the prototype's top-down camera.
        // LungeAnimSystem rotates the inner workerAxe and Three.js applies
        // parent scale to the whole transform, so the swing arc scales with
        // it (bigger axe = bigger visible swing).
        this.scale.set(1.5, 1.5, 1.5);
        this.visible = false;
    }

    /**
     * Parent this axe to the player's root mesh. Anchor matches PlayerGun's
     * position so the gun↔axe swap doesn't visually jump. Y is bumped up
     * slightly to compensate for the 1.5x scale pulling the grip lower
     * (workerAxe has a baked g.position.y = -0.36 grip offset, which becomes
     * -0.54 once scaled).
     */
    attachToPlayer(playerMesh) {
        playerMesh.add(this);
        this.position.set(0.27, 1.0, 0.1);
        this.rotation.set(0, 0, 0); // explicit reset — matches PlayerGun
    }

    setActive(active) {
        this.visible = active;
    }
}
