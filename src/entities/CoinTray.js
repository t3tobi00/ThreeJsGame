import * as THREE from 'three';
import { TRAY_CONFIG, COIN_CONFIG } from '../config/gameConfig.js';

export class CoinTray {
    constructor(scene) {
        this.scene = scene;
        this.position = new THREE.Vector3(
            TRAY_CONFIG.position.x,
            TRAY_CONFIG.position.y,
            TRAY_CONFIG.position.z
        );
        this.coins = []; // Array of coin meshes
        this.coinCount = 0;

        this.createVisuals();
    }

    createVisuals() {
        // Create tray mesh (flat box)
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
        this.tray.castShadow = true;
        this.tray.receiveShadow = true;
        this.scene.add(this.tray);
    }

    addCoin() {
        // Create coin mesh
        const coinGeo = new THREE.CylinderGeometry(COIN_CONFIG.size, COIN_CONFIG.size, 0.05, 16);
        const coinMat = new THREE.MeshStandardMaterial({
            color: COIN_CONFIG.color,
            roughness: 0.4,
            metalness: 0.6,
            emissive: COIN_CONFIG.color,
            emissiveIntensity: 0.1
        });
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.castShadow = true;
        coin.receiveShadow = true;

        // Start position at tray center
        coin.position.copy(this.position);
        coin.position.y = TRAY_CONFIG.size.y + 0.5;

        this.scene.add(coin);
        this.coins.push(coin);
        this.coinCount++;

        // Juice: Pop scale effect
        coin.scale.set(1.5, 1.5, 1.5);
        this.animatePop(coin);

        return coin;
    }

    removeCoin() {
        if (this.coins.length === 0) return null;

        const coin = this.coins.pop();
        this.coinCount--;
        this.scene.remove(coin);
        coin.geometry.dispose();
        coin.material.dispose();

        return coin;
    }

    update(deltaTime) {
        if (this.coins.length === 0) return;

        // Stack coins vertically with jelly-like wobble animation
        const basePos = this.position.clone();
        basePos.y = TRAY_CONFIG.size.y;

        for (let i = 0; i < this.coins.length; i++) {
            const coin = this.coins[i];

            // The ideal, perfectly straight position of this coin
            const idealPos = basePos.clone();
            idealPos.y += ((i + 1) * COIN_CONFIG.stackOffset);

            let targetPos;
            if (i === 0) {
                // First coin targets its ideal position
                targetPos = idealPos.clone();
            } else {
                // Subsequent coins follow to one below them
                const prevCoin = this.coins[i - 1];
                targetPos = prevCoin.position.clone();
                targetPos.y += COIN_CONFIG.stackOffset;

                // Blend between following previous coin (wobble) and ideal straight stack
                const stiffness = 0.5; // Slightly more wobbly than player stack
                targetPos.lerp(idealPos, stiffness);
            }

            // Move smoothly towards targeted position
            const lerpFactor = 0.3;
            coin.position.lerp(targetPos, lerpFactor);

            // Random slight rotation for visual interest
            coin.rotation.x = Math.sin(Date.now() * 0.001 + i) * 0.1;
            coin.rotation.z = Math.cos(Date.now() * 0.001 + i) * 0.1;
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

    getCoinCount() {
        return this.coinCount;
    }
}
