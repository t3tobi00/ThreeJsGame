import { COIN_CONFIG } from '../config/gameConfig.js';

export class CoinSystem {
    constructor(coinTray) {
        this.coinTray = coinTray;
        this.totalCoins = 0;
        this.pendingCoins = []; // Coins in transit (from villager to tray)
    }

    addCoin() {
        this.totalCoins++;
        this.coinTray.addCoin();
    }

    removeCoin() {
        if (this.totalCoins > 0) {
            this.totalCoins--;
            return this.coinTray.removeCoin();
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
        // Update the coin tray stack animation
        this.coinTray.update(deltaTime);
    }
}
