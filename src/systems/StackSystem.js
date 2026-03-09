import * as THREE from 'three';
import { STACK_CONFIG } from '../config/gameConfig.js';
import { ResourceStack } from '../utils/ResourceStack.js';

export class StackSystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;

        this._resourceStack = new ResourceStack({
            stackOffset: STACK_CONFIG.stackOffset,
            stiffness:   0.6,
            lerpFactor:  0.35,
            maxSize:     STACK_CONFIG.maxStackSize
        });

        // Keep this.stack as a direct reference to the items array
        // so external code (e.g. SellingSystem) can read .stack.length
        this.stack = this._resourceStack.items;
    }

    update(deltaTime) {
        if (this.stack.length === 0) return;

        const basePos = this.player.position.clone();
        basePos.y += 1.0;

        this._resourceStack.update(basePos);

        // Sync all disks to face the same direction as the player
        const playerRotY = this.player.group.rotation.y;
        for (const disk of this.stack) {
            disk.rotation.y = playerRotY;
        }
    }

    addDisk() {
        const geo  = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12);
        const mat  = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.6, metalness: 0.1 });
        const disk = new THREE.Mesh(geo, mat);
        disk.castShadow = true;
        disk.position.copy(this.player.position);
        this.scene.add(disk);

        this._resourceStack.add(disk, { animate: true });

        if (this.onStackCountChanged) this.onStackCountChanged(this.stack.length);
    }

    popDisk() {
        if (this.stack.length === 0) return null;
        const disk = this._resourceStack.pop();
        if (this.onStackCountChanged) this.onStackCountChanged(this.stack.length);
        return disk;
    }
}
