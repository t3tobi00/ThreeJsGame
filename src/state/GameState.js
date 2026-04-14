export class GameState {
    constructor() {
        this.level = 1;
        this.structures = [];
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
