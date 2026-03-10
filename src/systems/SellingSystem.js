import * as THREE from 'three';
import { MeatTable } from '../entities/MeatTable.js';
import { SELLING_CONFIG } from '../config/gameConfig.js';

export class SellingSystem {
    constructor(scene, stackSystem, tablePosition) {
        this.scene = scene;
        this.stackSystem = stackSystem;
        this.tablePosition = tablePosition;
        this.detectionRange = SELLING_CONFIG.detectionRange;
        this.transferSpeed = SELLING_CONFIG.transferSpeed;

        this.meatTable = new MeatTable(scene, tablePosition);
        this.lastTransferTime = 0;
        this.isPlayerNear = false;
    }

    update(deltaTime, playerPosition) {
        // Check if player is near the selling table
        const distance = playerPosition.distanceTo(this.tablePosition);
        this.isPlayerNear = distance < this.detectionRange;

        // Update meat table animations
        this.meatTable.update(deltaTime);

        // Transfer meat from player to table if player is near and has meat
        if (this.isPlayerNear && this.stackSystem.getCount() > 0) {
            this.lastTransferTime += deltaTime;

            if (this.lastTransferTime >= this.transferSpeed) {
                // Pop meat from player's stack
                const disk = this.stackSystem.popDisk();

                if (disk) {
                    // Start transfer animation to table using the physical popped disk
                    const startPos = disk.position.clone();
                    this.meatTable.transferMeat(disk, startPos);

                    this.lastTransferTime = 0;
                }
            }
        }
    }

    getMeatOnTable() {
        return this.meatTable.getMeatCount();
    }

    removeMeatFromTable(count) {
        return this.meatTable.removeMeatFromTable(count);
    }

    popMeatMeshFromTable() {
        return this.meatTable.popMeatMesh();
    }

    dispose() {
        this.meatTable.dispose();
    }
}
