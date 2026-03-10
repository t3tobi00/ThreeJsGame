import * as THREE from 'three';
import { SELLING_CONFIG, COLORS_P2 } from '../config/gameConfig.js';
import { ResourceStack } from '../utils/ResourceStack.js';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';

export class MeatTable {
    constructor(scene, tablePosition) {
        this.scene = scene;
        this.tablePosition = tablePosition;  // THREE.Vector3
        this.maxCapacity = SELLING_CONFIG.tableCapacity;

        // Stack base: top surface of the table (table geometry height 0.6, centred at y=0.3)
        this._stackBase = new THREE.Vector3(
            tablePosition.x,
            0.65,          // table top surface
            tablePosition.z
        );

        this._stack = new ResourceStack({
            stackOffset: 0.12,
            stiffness: 0.8,  // stiffer — meat on a table shouldn't wobble much
            lerpFactor: 0.4,
            maxSize: this.maxCapacity
        });

        this._transfer = new ResourceTransfer();
    }

    /**
     * Called by SellingSystem when a disk leaves the player stack.
     * Takes an existing meat mesh and flies it to the table stack.
     * @param {THREE.Object3D} disk     The popped mesh
     * @param {THREE.Vector3} startPos  World position to launch from
     * @returns {boolean} True if successfully dispatched
     */
    transferMeat(disk, startPos) {
        if (!disk) return false;
        if (this._stack.getCount() >= this.maxCapacity) {
            // Revert deletion or ignore if full (SellingSystem handles safety)
            return false;
        }

        const endPos = this._stackBase.clone();

        this._transfer.send(disk, startPos, endPos, {
            arcHeight: 2.5,
            duration: 0.5,
            spin: true,
            onArrive: (m) => this._stack.add(m, { animate: true })
        });

        return true;
    }

    /**
     * Remove count items from the table (e.g. villager buying).
     * Disposes the meshes immediately.
     * @param {number} count
     * @returns {number} How many were actually removed
     */
    removeMeatFromTable(count) {
        let removed = 0;
        for (let i = 0; i < count && this._stack.getCount() > 0; i++) {
            const mesh = this._stack.pop();
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
            removed++;
        }
        return removed;
    }

    /**
     * Pops and returns a meat mesh from the table.
     * @returns {THREE.Object3D|null} The meat mesh or null if empty
     */
    popMeatMesh() {
        if (this._stack.getCount() > 0) {
            return this._stack.pop();
        }
        return null;
    }

    getMeatCount() {
        return this._stack.getCount();
    }

    update(deltaTime) {
        // Advance in-flight animations
        this._transfer.update(deltaTime);

        // Update on-table stack positioning
        if (this._stack.getCount() > 0) {
            this._stack.update(this._stackBase);
        }
    }

    dispose() {
        this._transfer.dispose();
        this._stack.clear(this.scene);
    }
}
