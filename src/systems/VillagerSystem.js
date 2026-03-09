import * as THREE from 'three';
import { Villager } from '../entities/Villager.js';
import { VILLAGER_CONFIG, COIN_CONFIG, SELLING_CONFIG } from '../config/gameConfig.js';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';

export class VillagerSystem {
    constructor(scene, coinSystem, sellingSystem) {
        this.scene = scene;
        this.coinSystem = coinSystem;
        this.sellingSystem = sellingSystem;
        this.villagers = [];
        this.villagerIdCounter = 0;
        this.transfer = new ResourceTransfer();

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
        this.transfer.update(deltaTime);
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
            // Transfer meat from table to villager smoothly
            for (let i = 0; i < meatToBuy; i++) {
                const meatMesh = this.sellingSystem.popMeatMeshFromTable();
                if (meatMesh) {
                    const fromPos = meatMesh.position.clone();
                    const toPos = villager.group.position.clone().add(new THREE.Vector3(0, 1.2, -0.25));

                    this.transfer.send(meatMesh, fromPos, toPos, {
                        arcHeight: 2,
                        duration: 0.5,
                        spin: true,
                        onArrive: (m) => villager.receiveMeatMesh(m)
                    });
                }
            }

            // Calculate coins to give
            const coinsToGive = Math.ceil(meatToBuy * COIN_CONFIG.valuePerMeat);

            // Transfer coins to tray smoothly
            for (let i = 0; i < coinsToGive; i++) {
                const coinMesh = villager.popCoinMesh();
                if (coinMesh) {
                    const fromPos = coinMesh.position.clone();
                    const toPos = this.coinSystem.coinTray.position.clone().setY(0.4);

                    this.transfer.send(coinMesh, fromPos, toPos, {
                        arcHeight: 2,
                        duration: 0.5,
                        spin: false,
                        onArrive: (m) => this.coinSystem.receiveCoinMesh(m)
                    });
                }
            }
        }

        // Wait for animations to complete before exiting
        setTimeout(() => {
            villager.setExiting();
            this.advanceQueue();
        }, 1000);
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
