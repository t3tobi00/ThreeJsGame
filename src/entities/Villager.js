import * as THREE from 'three';
import { VILLAGER_CONFIG, COIN_CONFIG } from '../config/gameConfig.js';
import { ResourceStack } from '../utils/ResourceStack.js';

export class Villager {
    constructor(scene, queuePosition) {
        this.scene = scene;
        this.coinsHeld = this._randomCoins();
        this.meatHeld = 0;
        this.state = 'in_queue'; // 'in_queue'|'approaching_table'|'buying'|'exiting'
        this.queuePosition = queuePosition;

        this.position = this._getQueuePosition();
        this.targetPosition = null;
        this.exitTraveled = 0;

        // Meat carried on back — local space of this.group
        this._meatStack = new ResourceStack({
            stackOffset: 0.1,
            stiffness: 0.8,
            lerpFactor: 0.4
        });

        // Coins carried on head — local space of this.group
        this._coinStack = new ResourceStack({
            stackOffset: 0.05,
            stiffness: 0.9,
            lerpFactor: 0.4
        });

        this._createVisuals();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    _randomCoins() {
        return Math.floor(
            Math.random() * (VILLAGER_CONFIG.maxCoins - VILLAGER_CONFIG.minCoins + 1)
        ) + VILLAGER_CONFIG.minCoins;
    }

    _getQueuePosition() {
        // Queue spreads along Z-axis (along the road, away from table)
        return new THREE.Vector3(
            VILLAGER_CONFIG.queueStart.x,
            0,
            VILLAGER_CONFIG.queueStart.z - (this.queuePosition * 2)
        );
    }

    // ── Visuals ────────────────────────────────────────────────────────────────

    _createVisuals() {
        this.group = new THREE.Group();
        this.group.position.copy(this.position);

        // Body
        const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: VILLAGER_CONFIG.color, roughness: 0.7 });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 0.5;
        this.body.castShadow = true;
        this.group.add(this.body);

        // Head
        const headGeo = new THREE.SphereGeometry(0.2, 8, 6);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.6 });
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

        // Coins on head
        const coinGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.03, 8);
        const coinMat = new THREE.MeshStandardMaterial({
            color: COIN_CONFIG.color,
            roughness: 0.4,
            metalness: 0.6
        });

        for (let i = 0; i < this.coinsHeld; i++) {
            const coin = new THREE.Mesh(coinGeo, coinMat);
            coin.rotation.x = Math.PI / 2;
            coin.castShadow = true;
            this.group.add(coin);
            this._coinStack.add(coin);
        }

        this.scene.add(this.group);
    }

    // ── Meat stack ─────────────────────────────────────────────────────────────

    receiveMeatMesh(mesh) {
        this.group.attach(mesh);
        this._meatStack.add(mesh, { animate: true });
        this.meatHeld++;
    }

    // ── Movement ───────────────────────────────────────────────────────────────

    moveTo(target, deltaTime) {
        const direction = new THREE.Vector3().subVectors(target, this.group.position);
        const distance = direction.length();

        if (distance > 0.1) {
            direction.normalize();
            const step = VILLAGER_CONFIG.speed * deltaTime;
            const newPos = this.group.position.clone().add(direction.multiplyScalar(Math.min(step, distance)));

            if (distance > 0.5) {
                this.group.rotation.y = Math.atan2(direction.x, direction.z);
            }

            this.group.position.copy(newPos);
            this.position.copy(newPos);
            return false; // not arrived
        }
        return true; // arrived
    }

    // ── State transitions ─────────────────────────────────────────────────────

    popCoinMesh() {
        if (this.coinsHeld <= 0) return null;
        this.coinsHeld--;
        const mesh = this._coinStack.pop();
        if (mesh) {
            this.scene.attach(mesh);
        }
        return mesh;
    }

    moveToQueuePosition(queuePosition) {
        this.queuePosition = queuePosition;
        this.targetPosition = this._getQueuePosition();
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
        this.targetPosition = new THREE.Vector3(0, 0, -30); // walk away on road
    }

    canBuy() {
        return this.coinsHeld > 0 && this.state === 'approaching_table';
    }

    getMaxMeatCanBuy() {
        return Math.floor(this.coinsHeld / COIN_CONFIG.valuePerMeat);
    }

    // ── Per-frame update ──────────────────────────────────────────────────────

    update(deltaTime) {
        let arrived = false;
        if (this.targetPosition) {
            arrived = this.moveTo(this.targetPosition, deltaTime);
        }

        if (this.state === 'exiting') {
            this.exitTraveled += VILLAGER_CONFIG.speed * deltaTime;
        }

        // Idle bob when stationary
        if (!this.targetPosition || arrived) {
            this.group.position.y = Math.sin(Date.now() * 0.002) * 0.05;
        }

        // Update meat stack positions (local space — base on villager's back)
        if (this._meatStack.getCount() > 0) {
            const base = new THREE.Vector3(0, 1.2, -0.25);
            this._meatStack.update(base);
        }

        // Update coin stack positions (local space — base on villager's head)
        if (this._coinStack.getCount() > 0) {
            const base = new THREE.Vector3(0, 1.4, 0);
            this._coinStack.update(base);
        }

        return {
            arrived,
            canExit: this.exitTraveled >= VILLAGER_CONFIG.exitDistance
        };
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    dispose() {
        this._meatStack.clear(this.group);
        this._coinStack.clear(this.group);
        this.scene.remove(this.group);
    }
}
