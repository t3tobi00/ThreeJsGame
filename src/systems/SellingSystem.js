import * as THREE from 'three';
import { SELLING_CONFIG } from '../config/gameConfig.js';

export class SellingSystem {
    constructor(scene, stackSystem, storageNode) {
        this.scene = scene;
        this.stackSystem = stackSystem;
        this.tablePosition = storageNode.position.clone();
        this.detectionRange = SELLING_CONFIG.detectionRange;
        this.transferSpeed = SELLING_CONFIG.transferSpeed;

        this.storageNode = storageNode;
        this.lastTransferTime = 0;
        this.isPlayerNear = false;
    }

    update(deltaTime, playerPosition) {
        // Check if player is near the selling table
        const distance = playerPosition.distanceTo(this.tablePosition);
        this.isPlayerNear = distance < this.detectionRange;

        // Update storage node animations
        this.storageNode.update(deltaTime);

        // Transfer meat from player to table if player is near and has meat
        if (this.isPlayerNear && this.stackSystem.getCount() > 0) {
            this.lastTransferTime += deltaTime;

            if (this.lastTransferTime >= this.transferSpeed) {
                // Pop meat from player's stack
                const disk = this.stackSystem.popDisk();

                if (disk) {
                    // Start transfer animation to table using the physical popped disk
                    const startPos = disk.position.clone();
                    this.storageNode.transferMesh(disk, startPos, 2.5, true);

                    this.lastTransferTime = 0;
                }
            }
        }
    }

    getMeatOnTable() {
        return this.storageNode.getMeshCount();
    }

    removeMeatFromTable(count) {
        return this.storageNode.removeMeshes(count);
    }

    popMeatMeshFromTable() {
        return this.storageNode.popMesh();
    }

    dispose() {
        this.storageNode.dispose();
    }
}
