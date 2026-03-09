import * as THREE from 'three';
import { Villager } from '../entities/Villager.js';
import { VILLAGER_CONFIG, COIN_CONFIG, SELLING_CONFIG } from '../config/gameConfig.js';

export class VillagerSystem {
    constructor(scene, coinTray, sellingSystem) {
        this.scene = scene;
        this.coinTray = coinTray;
        this.sellingSystem = sellingSystem;
        this.villagers = [];
        this.villagerIdCounter = 0;

        this.spawnInitialVillagers();
    }

    spawnInitialVillagers() {
        for (let i = 0; i < VILLAGER_CONFIG.initialCount; i++) {
            this.spawnVillager(i);
        }
    }

    spawnVillager(queuePosition) {
        const villager = new Villager(this.scene, queuePosition);
        this.villagers.push(villager);
        this.villagerIdCounter++;
        return villager;
    }

    spawnNewVillagerAtBack() {
        // Spawn new villager at the back of the queue
        const queuePosition = this.villagers.length;
        this.spawnVillager(queuePosition);
        this.updateQueuePositions();
    }

    updateQueuePositions() {
        // Reassign queue positions to all villagers
        for (let i = 0; i < this.villagers.length; i++) {
            const villager = this.villagers[i];
            if (villager.state === 'in_queue') {
                villager.moveToQueuePosition(i);
            }
        }
    }

    getVillagerAtFront() {
        return this.villagers.find(v => v.state === 'approaching_table' || v.state === 'buying');
    }

    getVillagerInQueue() {
        // Get first villager in queue (closest to front)
        return this.villagers.find(v => v.state === 'in_queue');
    }

    getNextInQueue() {
        // Get first villager in queue (at position 0)
        return this.villagers.find(v => v.state === 'in_queue' && v.queuePosition === 0);
    }

    advanceQueue() {
        // Move all in_queue villagers forward
        const inQueue = this.villagers.filter(v => v.state === 'in_queue');
        inQueue.forEach(v => {
            v.queuePosition--;
            if (v.queuePosition >= 0) {
                v.moveToQueuePosition(v.queuePosition);
            }
        });
    }

    update(deltaTime) {
        const toRemove = [];

        // Get meat on table from selling system
        const meatOnTable = this.sellingSystem.getMeatOnTable();

        // Check if villager at front should approach
        const villagerAtFront = this.getVillagerAtFront();
        const nextInQueue = this.getNextInQueue();

        // No one at front and there's meat, move next villager to table
        if (!villagerAtFront && nextInQueue && meatOnTable > 0 && nextInQueue.coinsHeld > 0) {
            nextInQueue.setApproachingTable();
            this.advanceQueue();
        }

        // Update each villager
        for (const villager of this.villagers) {
            const result = villager.update(deltaTime);

            // Handle villager arriving at table
            if (villager.state === 'approaching_table' && result.arrived) {
                this.handleTransaction(villager);
            }

            // Handle villager exit
            if (villager.state === 'exiting' && result.canExit) {
                toRemove.push(villager);
            }
        }

        // Remove exited villagers and spawn new ones
        for (const villager of toRemove) {
            this.removeVillager(villager);
        }

        // Spawn new villager to replace exited one
        if (toRemove.length > 0) {
            this.spawnNewVillagerAtBack();
        }
    }

    handleTransaction(villager) {
        villager.state = 'buying';

        // Calculate how much meat villager can buy
        const meatToBuy = Math.min(
            villager.getMaxMeatCanBuy(),
            this.sellingSystem.getMeatOnTable()
        );

        if (meatToBuy > 0) {
            // Transfer meat from table to villager
            this.sellingSystem.removeMeatFromTable(meatToBuy);
            villager.receiveMeat(meatToBuy);

            // Calculate coins to give
            const coinsToGive = Math.ceil(meatToBuy * COIN_CONFIG.valuePerMeat);
            villager.giveCoins(coinsToGive);

            // Add coins to tray
            for (let i = 0; i < coinsToGive; i++) {
                this.coinTray.addCoin();
            }
        }

        // Villager exits after transaction
        setTimeout(() => {
            villager.setExiting();
            this.advanceQueue();
        }, 500);
    }

    removeVillager(villager) {
        const index = this.villagers.indexOf(villager);
        if (index > -1) {
            this.villagers.splice(index, 1);
            villager.dispose();
        }
    }

    getVillagerCount() {
        return this.villagers.length;
    }
}
