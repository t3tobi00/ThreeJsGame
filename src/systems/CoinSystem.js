import { COIN_CONFIG } from '../config/gameConfig.js';

export class CoinSystem {
    constructor(storageNode) {
        this.storageNode = storageNode;
        this.totalCoins = 0;
        this.pendingCoins = []; // Coins in transit (from villager to tray)
    }

    addCoin() {
        this.totalCoins++;
        this.coinTray.addCoin();
    }

    receiveCoinMesh(mesh) {
        this.totalCoins++;
        this.storageNode.addMesh(mesh);
    }

    removeCoin() {
        if (this.totalCoins > 0) {
            this.totalCoins--;
            return this.storageNode.popMesh();
        }
        return null;
    }

    addCoins(count) {
        for (let i = 0; i < count; i++) {
            this.addCoin();
        }
    }

    getCoinCount() {
        return this.totalCoins;
    }

    update(deltaTime) {
        // Update the storage node stack animation
        this.storageNode.update(deltaTime);
    }
}
