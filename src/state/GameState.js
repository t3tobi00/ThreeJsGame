export class GameState {
    constructor() {
        this.level = 1;
        this.meatCount = 0;
        this.structures = [];
        this.onMeatCountChanged = null;
    }

    setMeatCount(count) {
        this.meatCount = count;
        if (this.onMeatCountChanged) {
            this.onMeatCountChanged(this.meatCount);
        }
    }

    addStructure(structure) {
        this.structures.push(structure);
    }

    levelUp() {
        this.level++;
        console.log(`Level Up! Current Level: ${this.level}`);
    }
}

export const gameState = new GameState();
