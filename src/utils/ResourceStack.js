import * as THREE from 'three';

/**
 * ResourceStack — reusable vertical stacking with spring/wobble physics.
 *
 * Works in both world space (items added to scene) and local space (items
 * added to a Group). The caller is responsible for adding/removing meshes
 * from the scene or parent group. ResourceStack only handles positioning.
 *
 * @example — player meat stack
 *   const stack = new ResourceStack({ stackOffset: 0.22, stiffness: 0.6, lerpFactor: 0.35 });
 *   stack.add(mesh, { animate: true });
 *   stack.update(playerBasePosition);   // call each frame
 *   const top = stack.pop();
 *   stack.clear(scene);                 // removes + disposes all
 *
 * @example — villager carried meat (local space)
 *   const stack = new ResourceStack({ stackOffset: 0.1 });
 *   stack.add(mesh);                    // mesh is a child of villager.group
 *   stack.update(new THREE.Vector3(0, 1.2, -0.25)); // local-space base
 *   stack.clear(villager.group);
 */
export class ResourceStack {
    /**
     * @param {Object} options
     * @param {number} [options.stackOffset=0.22]  Height gap between items
     * @param {number} [options.stiffness=0.6]     0=noodle, 1=rigid column
     * @param {number} [options.lerpFactor=0.35]   Smoothing speed per frame
     * @param {number} [options.maxSize=Infinity]  Maximum items allowed
     */
    constructor({
        stackOffset = 0.22,
        stiffness = 0.6,
        lerpFactor = 0.35,
        maxSize = Infinity
    } = {}) {
        this.stackOffset = stackOffset;
        this.stiffness = stiffness;
        this.lerpFactor = lerpFactor;
        this.maxSize = maxSize;
        this.items = [];
    }

    /**
     * Add a mesh to the top of the stack.
     * @param {THREE.Object3D} mesh
     * @param {Object}  [options]
     * @param {boolean} [options.animate=false]  Play pop-in scale animation
     * @returns {boolean} true if added, false if stack is full
     */
    add(mesh, { animate = false } = {}) {
        if (this.items.length >= this.maxSize) return false;
        this.items.push(mesh);
        if (animate) ResourceStack._pop(mesh);
        return true;
    }

    /** Remove and return the top mesh, or null if empty. */
    pop() {
        return this.items.pop() ?? null;
    }

    /** Return the top mesh without removing it. */
    peek() {
        return this.items[this.items.length - 1] ?? null;
    }

    /** Number of items currently in the stack. */
    getCount() {
        return this.items.length;
    }

    /**
     * Update stack positions each frame.
     * @param {THREE.Vector3} basePosition  Bottom-of-stack position (world or local)
     */
    update(basePosition) {
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];

            // Perfect straight-column position for this index
            const idealPos = basePosition.clone();
            idealPos.y += i * this.stackOffset;

            let targetPos;
            if (i === 0) {
                targetPos = idealPos;
            } else {
                // Follow item below, blended with ideal column (prevents noodling)
                const prev = this.items[i - 1];
                targetPos = prev.position.clone();
                targetPos.y += this.stackOffset;
                targetPos.lerp(idealPos, this.stiffness);
            }

            item.position.lerp(targetPos, this.lerpFactor);
        }
    }

    /**
     * Remove all items from a parent (scene or Group) and dispose GPU resources.
     * @param {THREE.Object3D|null} [parent]  Pass scene or group; omit to skip removal
     */
    clear(parent = null) {
        for (const item of this.items) {
            if (parent) parent.remove(item);
            if (item.geometry) item.geometry.dispose();
            if (item.material) item.material.dispose();
        }
        this.items = [];
    }

    /** Scale-pop animation on a mesh (scales down from 1.5× to 1×). */
    static _pop(mesh) {
        mesh.scale.set(1.5, 1.5, 1.5);
        const tick = () => {
            if (mesh.scale.x > 1.0) {
                mesh.scale.multiplyScalar(0.9);
                requestAnimationFrame(tick);
            } else {
                mesh.scale.set(1, 1, 1);
            }
        };
        tick();
    }
}
