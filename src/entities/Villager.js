import * as THREE from 'three';
import { VILLAGER_CONFIG, COIN_CONFIG, STACK_CONFIG } from '../config/gameConfig.js';

export class Villager {
    constructor(scene, queuePosition) {
        this.scene = scene;
        this.coinsHeld = this.randomCoins();
        this.meatHeld = 0;
        this.state = 'in_queue'; // 'in_queue' | 'approaching_table' | 'buying' | 'exiting'
        this.queuePosition = queuePosition; // 0 = front of line

        this.position = this.getQueuePosition();
        this.targetPosition = null;
        this.exitTraveled = 0;

        this.createVisuals();
    }

    randomCoins() {
        return Math.floor(Math.random() * (VILLAGER_CONFIG.maxCoins - VILLAGER_CONFIG.minCoins + 1)) + VILLAGER_CONFIG.minCoins;
    }

    getQueuePosition() {
        // Queue spreads along Z-axis (along the road, away from table)
        const x = VILLAGER_CONFIG.queueStart.x;
        const z = VILLAGER_CONFIG.queueStart.z - (this.queuePosition * 2);
        return new THREE.Vector3(x, 0, z);
    }

    createVisuals() {
        this.group = new THREE.Group();
        this.group.position.copy(this.position);

        // Body (capsule)
        const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: VILLAGER_CONFIG.color,
            roughness: 0.7
        });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 0.5;
        this.body.castShadow = true;
        this.group.add(this.body);

        // Head (sphere)
        const headGeo = new THREE.SphereGeometry(0.2, 8, 6);
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xffcc99, // Skin tone
            roughness: 0.6
        });
        this.head = new THREE.Mesh(headGeo, headMat);
        this.head.position.y = 1.1;
        this.head.castShadow = true;
        this.group.add(this.head);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.05, 4, 4);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.08, 1.12, 0.18);
        this.group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.08, 1.12, 0.18);
        this.group.add(rightEye);

        // Coin display (visual indicator of coins held)
        this.coinDisplay = this.createCoinDisplay();
        this.group.add(this.coinDisplay);

        // Meat stack (will be added when meat is held)
        this.meatStack = [];

        this.scene.add(this.group);
    }

    createCoinDisplay() {
        const coinGroup = new THREE.Group();

        // Create small coin indicator on back
        const coinGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.03, 8);
        const coinMat = new THREE.MeshStandardMaterial({
            color: COIN_CONFIG.color,
            roughness: 0.4,
            metalness: 0.6
        });

        for (let i = 0; i < Math.min(3, this.coinsHeld); i++) {
            const coin = new THREE.Mesh(coinGeo, coinMat);
            coin.position.set(0, 1.2 + (i * 0.05), -0.2);
            coin.rotation.x = Math.PI / 2;
            coinGroup.add(coin);
        }

        return coinGroup;
    }

    updateCoinDisplay() {
        // Remove old display
        this.group.remove(this.coinDisplay);

        // Create new display
        this.coinDisplay = this.createCoinDisplay();
        this.group.add(this.coinDisplay);
    }

    moveTo(target, deltaTime) {
        const direction = new THREE.Vector3().subVectors(target, this.group.position);
        const distance = direction.length();

        if (distance > 0.1) {
            direction.normalize();
            const moveDistance = VILLAGER_CONFIG.speed * deltaTime;
            const newPos = this.group.position.clone().add(direction.multiplyScalar(Math.min(moveDistance, distance)));

            // Rotate to face movement direction
            if (distance > 0.5) {
                const angle = Math.atan2(direction.x, direction.z);
                this.group.rotation.y = angle;
            }

            this.group.position.copy(newPos);
            this.position.copy(newPos);

            return false; // Not at target yet
        }

        return true; // Arrived at target
    }

    receiveMeat(count) {
        this.meatHeld += count;
        this.updateMeatStack();
    }

    updateMeatStack() {
        // Clear old meat stack
        this.meatStack.forEach(meat => {
            this.group.remove(meat);
            meat.geometry.dispose();
            meat.material.dispose();
        });
        this.meatStack = [];

        // Create new meat stack on villager's back
        const meatGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 8);
        const meatMat = new THREE.MeshStandardMaterial({
            color: 0xff3333,
            roughness: 0.6,
            metalness: 0.1
        });

        for (let i = 0; i < this.meatHeld; i++) {
            const meat = new THREE.Mesh(meatGeo, meatMat);
            meat.position.set(0, 1.2 + (i * 0.1), -0.25);
            meat.castShadow = true;
            this.group.add(meat);
            this.meatStack.push(meat);
        }
    }

    giveCoins(amount) {
        const coinsToGive = Math.min(amount, this.coinsHeld);
        this.coinsHeld -= coinsToGive;
        this.updateCoinDisplay();
        return coinsToGive;
    }

    moveToQueuePosition(queuePosition) {
        this.queuePosition = queuePosition;
        this.targetPosition = this.getQueuePosition();
    }

    setApproachingTable() {
        this.state = 'approaching_table';
        this.targetPosition = new THREE.Vector3(
            VILLAGER_CONFIG.tablePosition.x,
            0,
            VILLAGER_CONFIG.tablePosition.z
        );
    }

    setExiting() {
        this.state = 'exiting';
        this.exitTraveled = 0;
        this.targetPosition = new THREE.Vector3(0, 0, -30); // Walk away along road
    }

    update(deltaTime) {
        let arrived = false;

        if (this.targetPosition) {
            arrived = this.moveTo(this.targetPosition, deltaTime);
        }

        if (this.state === 'exiting') {
            // Track distance traveled
            this.exitTraveled += VILLAGER_CONFIG.speed * deltaTime;
        }

        // Simple idle animation
        if (!this.targetPosition || arrived) {
            const time = Date.now() * 0.002;
            this.group.position.y = Math.sin(time) * 0.05;
        }

        return {
            arrived,
            canExit: this.exitTraveled >= VILLAGER_CONFIG.exitDistance
        };
    }

    canBuy() {
        return this.coinsHeld > 0 && this.state === 'approaching_table';
    }

    getMaxMeatCanBuy() {
        return Math.floor(this.coinsHeld / COIN_CONFIG.valuePerMeat);
    }

    dispose() {
        this.meatStack.forEach(meat => {
            this.group.remove(meat);
            meat.geometry.dispose();
            meat.material.dispose();
        });
        this.scene.remove(this.group);
    }
}
