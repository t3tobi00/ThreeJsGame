import * as THREE from 'three';
import { STACK_CONFIG } from '../config/gameConfig.js';
import { ResourceDisk } from '../entities/ResourceDisk.js';

export class StackSystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.stack = []; // array of mesh data
        this.lastUpdateTime = 0;
    }

    update(deltaTime) {
        if (this.stack.length === 0) return;

        // The base position is the player's back
        const basePos = this.player.position.clone();
        basePos.y += 1.0;

        for (let i = 0; i < this.stack.length; i++) {
            const disk = this.stack[i];

            // The ideal, perfectly straight position of this disk
            const idealPos = basePos.clone();
            idealPos.y += (i * STACK_CONFIG.stackOffset);

            let targetPos;
            if (i === 0) {
                // First disk targets its ideal position
                targetPos = idealPos.clone();
            } else {
                // Subsequent disks follow the one below them
                const prevDisk = this.stack[i - 1];
                targetPos = prevDisk.position.clone();
                targetPos.y += STACK_CONFIG.stackOffset;

                // Blend between following the previous disk (wobble) and the ideal straight stack
                // This prevents the stack from leaning completely horizontal when moving fast
                const stiffness = 0.6; // Higher = stiffer, more vertical stack
                targetPos.lerp(idealPos, stiffness);
            }

            // Move smoothly towards the targeted position
            // Higher lerp factor = less trailing lag
            const lerpFactor = 0.35;
            disk.position.lerp(targetPos, lerpFactor);

            // Match player rotation
            disk.rotation.y = this.player.group.rotation.y;
        }
    }

    addDisk() {
        if (this.stack.length >= STACK_CONFIG.maxStackSize) {
            console.log("Stack full!");
            return;
        }

        // Create a visual copy for the stack
        // We don't use the pool's ResourceDisk mesh directly because we want it to persist on the back
        // Actually, we CAN use the pool but we need to manage its lifecycle carefully. 
        // For simplicity in Phase 2, let's just create new meshes for the stack or reuse.
        const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xff3333,
            roughness: 0.6,
            metalness: 0.1
        });
        const disk = new THREE.Mesh(geo, mat);
        disk.castShadow = true;

        // Initial position at player
        disk.position.copy(this.player.position);
        this.scene.add(disk);
        this.stack.push(disk);

        // Juice: Pop scale effect
        disk.scale.set(1.5, 1.5, 1.5);
        this.animatePop(disk);

        // Trigger UI event
        if (this.onStackCountChanged) {
            this.onStackCountChanged(this.stack.length);
        }
    }

    animatePop(mesh) {
        // Simple scale down to 1
        const animate = () => {
            if (mesh.scale.x > 1) {
                mesh.scale.multiplyScalar(0.9);
                requestAnimationFrame(animate);
            } else {
                mesh.scale.set(1, 1, 1);
            }
        };
        animate();
    }
}
