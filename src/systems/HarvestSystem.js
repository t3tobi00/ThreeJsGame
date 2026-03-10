import * as THREE from 'three';
import { STACK_CONFIG, COLORS_P2 } from '../config/gameConfig.js';
import { Resource } from '../entities/Resource.js';
import { ObjectPool } from '../utils/ObjectPool.js';

export class HarvestSystem {
    constructor(scene, player, enemySystem) {
        this.scene = scene;
        this.player = player;
        this.disks = [];

        this.pool = new ObjectPool(() => new Resource('meat', COLORS_P2.meatDisk), 50, 'DiskPool');

        // Track how many disks are currently in-flight to prevent over-collecting
        this.inFlightCount = 0;

        // Listen to enemy deaths
        enemySystem.onEnemyDeath = (pos) => this.spawnDisks(pos);
    }

    update(deltaTime) {
        const playerPos = this.player.position;

        for (let i = this.disks.length - 1; i >= 0; i--) {
            const disk = this.disks[i];

            if (disk.isBeingHarvested) {
                this.animateHarvest(disk, deltaTime, i);
                continue;
            }

            // Magnetic Pull check
            const dist = disk.position.distanceTo(playerPos);

            // Check if player has room (current stack + ones already flying towards player)
            const currentStackSize = this.player.meatStackLength || 0;
            const hasRoom = (currentStackSize + this.inFlightCount) < (this.player.maxCapacity || STACK_CONFIG.maxStackSize);

            if (dist < STACK_CONFIG.pullRange && hasRoom) {
                disk.isBeingHarvested = true;
                this.inFlightCount++; // Increment in-flight tracker
                disk.harvestStartTime = Date.now() * 0.001;
                // Create parabolic curve (start, mid, end)
                const start = disk.position.clone();
                const end = playerPos.clone().add(new THREE.Vector3(0, 1, 0));
                const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 5, 0)); // High arc
                disk.curve = new THREE.QuadraticBezierCurve3(start, mid, end);
            }
        }
    }

    spawnDisks(pos) {
        const count = 3 + Math.floor(Math.random() * 3);
        const radius = 1.5;

        for (let i = 0; i < count; i++) {
            const disk = this.pool.get();
            const angle = Math.random() * Math.PI * 2;
            const dist = radius * Math.sqrt(Math.random());
            const dropPos = pos.clone().add(new THREE.Vector3(
                Math.cos(angle) * dist,
                0.05,
                Math.sin(angle) * dist
            ));

            disk.reset(dropPos);
            this.scene.add(disk);
            this.disks.push(disk);
        }
    }

    animateHarvest(disk, deltaTime, index) {
        const elapsed = (Date.now() * 0.001) - disk.harvestStartTime;
        const duration = 0.5; // Seconds to fly
        const t = Math.min(elapsed / duration, 1);

        // Update target slightly in case player moves
        disk.curve.v2.copy(this.player.position).add(new THREE.Vector3(0, 1, 0));

        const newPos = disk.curve.getPoint(t);
        disk.position.copy(newPos);

        if (t >= 1) {
            // Reached player, add to stack
            if (this.onCollected) {
                this.onCollected(disk);
            }
            this.inFlightCount = Math.max(0, this.inFlightCount - 1); // Decrement tracker
            this.removeDisk(disk, index);
        }
    }

    removeDisk(disk, index) {
        this.pool.release(disk);
        this.scene.remove(disk);
        this.disks.splice(index, 1);
    }
}
