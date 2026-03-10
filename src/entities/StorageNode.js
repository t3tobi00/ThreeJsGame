import * as THREE from 'three';
import { ResourceStack } from '../utils/ResourceStack.js';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';

export class StorageNode {
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Vector3} position
     * @param {Object} config
     * @param {THREE.Vector3} config.size Box dimensions
     * @param {number} config.color Hex color
     * @param {number} config.maxCapacity Max items to store
     * @param {number} config.stackOffset Vertical offset per item
     * @param {number} config.stiffness Spring stiffness (0-1)
     * @param {number} config.lerpFactor Spring lerp speed (0-1)
     * @param {boolean} [config.idleWobble=false] Whether stored items slowly wobble/rotate (like coins)
     */
    constructor(scene, position, config) {
        this.scene = scene;
        this.position = position.clone();
        this.config = Object.assign({ idleWobble: false }, config);

        // Calculate stack base (top surface of the storage box)
        this._stackBase = new THREE.Vector3(
            this.position.x,
            this.config.size.y, // Since box is anchored at y=size.y/2, top is size.y
            this.position.z
        );

        this._stack = new ResourceStack({
            stackOffset: this.config.stackOffset,
            stiffness: this.config.stiffness,
            lerpFactor: this.config.lerpFactor,
            maxSize: this.config.maxCapacity
        });

        this._transfer = new ResourceTransfer();

        this.createVisuals();
    }

    createVisuals() {
        this.group = new THREE.Group();
        this.group.position.copy(this.position);

        const boxGeo = new THREE.BoxGeometry(
            this.config.size.x,
            this.config.size.y,
            this.config.size.z
        );
        const boxMat = new THREE.MeshStandardMaterial({
            color: this.config.color,
            roughness: 0.8,
            metalness: 0.2
        });

        this.box = new THREE.Mesh(boxGeo, boxMat);
        // Anchor the box so its base sits on the ground (0), or at whatever relative height needed. 
        // We ensure the mesh visually respects its own dimensions.
        this.box.position.y = this.config.size.y / 2;

        this.box.castShadow = true;
        this.box.receiveShadow = true;
        this.group.add(this.box);

        this.scene.add(this.group);
    }

    /**
     * Start a flight animation transferring a physical mesh to this node's stack.
     */
    transferMesh(mesh, startPos, arcHeight = 2.5, spin = true) {
        if (!mesh) return false;
        if (this._stack.getCount() >= this.config.maxCapacity) {
            return false;
        }

        const endPos = this._stackBase.clone();

        this._transfer.send(mesh, startPos, endPos, {
            arcHeight: arcHeight,
            duration: 0.5,
            spin: spin,
            onArrive: (m) => this._stack.add(m, { animate: true })
        });

        return true;
    }

    /** Add a mesh directly to the stack without flight animation */
    addMesh(mesh) {
        this._stack.add(mesh, { animate: true });
    }

    /** Pops a mesh off the top of the stack and returns it */
    popMesh() {
        if (this._stack.getCount() > 0) {
            return this._stack.pop();
        }
        return null;
    }

    /** Pops and permanently deletes 'count' meshes */
    removeMeshes(count) {
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

    getMeshCount() {
        return this._stack.getCount();
    }

    update(deltaTime) {
        this._transfer.update(deltaTime);

        if (this._stack.getCount() > 0) {
            this._stack.update(this._stackBase);

            if (this.config.idleWobble) {
                const t = Date.now() * 0.001;
                const items = this._stack.items;
                for (let i = 0; i < items.length; i++) {
                    items[i].rotation.x = Math.sin(t + i) * 0.1;
                    items[i].rotation.z = Math.cos(t + i) * 0.1;
                }
            }
        }
    }

    dispose() {
        this._transfer.dispose();
        this._stack.clear(this.scene);
        this.scene.remove(this.group);
    }
}
