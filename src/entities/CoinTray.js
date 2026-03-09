import * as THREE from 'three';
import { TRAY_CONFIG, COIN_CONFIG } from '../config/gameConfig.js';
import { ResourceStack } from '../utils/ResourceStack.js';

export class CoinTray {
    constructor(scene) {
        this.scene = scene;
        this.position = new THREE.Vector3(
            TRAY_CONFIG.position.x,
            TRAY_CONFIG.position.y,
            TRAY_CONFIG.position.z
        );

        this._stack = new ResourceStack({
            stackOffset: COIN_CONFIG.stackOffset,
            stiffness:   0.5,
            lerpFactor:  0.3
        });

        // Expose coins array for external reads (e.g. getCoinCount)
        this.coins     = this._stack.items;
        this.coinCount = 0;

        this.createVisuals();
    }

    createVisuals() {
        const trayGeo = new THREE.BoxGeometry(
            TRAY_CONFIG.size.x,
            TRAY_CONFIG.size.y,
            TRAY_CONFIG.size.z
        );
        const trayMat = new THREE.MeshStandardMaterial({
            color: TRAY_CONFIG.color,
            roughness: 0.8,
            metalness: 0.2
        });
        this.tray = new THREE.Mesh(trayGeo, trayMat);
        this.tray.position.copy(this.position);
        this.tray.position.y = TRAY_CONFIG.size.y / 2;
        this.tray.castShadow  = true;
        this.tray.receiveShadow = true;
        this.scene.add(this.tray);
    }

    addCoin() {
        const coinGeo = new THREE.CylinderGeometry(COIN_CONFIG.size, COIN_CONFIG.size, 0.05, 16);
        const coinMat = new THREE.MeshStandardMaterial({
            color:            COIN_CONFIG.color,
            roughness:        0.4,
            metalness:        0.6,
            emissive:         COIN_CONFIG.color,
            emissiveIntensity: 0.1
        });
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.castShadow    = true;
        coin.receiveShadow = true;
        coin.position.copy(this.position);
        coin.position.y = TRAY_CONFIG.size.y + 0.5;

        this.scene.add(coin);
        this._stack.add(coin, { animate: true });
        this.coinCount++;

        return coin;
    }

    removeCoin() {
        if (this._stack.getCount() === 0) return null;

        const coin = this._stack.pop();
        this.coinCount--;
        this.scene.remove(coin);
        coin.geometry.dispose();
        coin.material.dispose();

        return coin;
    }

    update(deltaTime) {
        if (this._stack.getCount() === 0) return;

        const basePos = this.position.clone();
        basePos.y = TRAY_CONFIG.size.y;

        this._stack.update(basePos);

        // Gentle wobble rotation
        const t = Date.now() * 0.001;
        for (let i = 0; i < this.coins.length; i++) {
            this.coins[i].rotation.x = Math.sin(t + i) * 0.1;
            this.coins[i].rotation.z = Math.cos(t + i) * 0.1;
        }
    }

    getCoinCount() {
        return this.coinCount;
    }
}
