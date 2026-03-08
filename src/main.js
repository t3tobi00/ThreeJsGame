import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { Camera } from './core/Camera.js';
import { Scene } from './core/Scene.js';
import { Lighting } from './core/Lighting.js';
import { Environment } from './entities/Environment.js';
import { Player } from './entities/Player.js';
import { Joystick } from './ui/Joystick.js';
import { InputSystem } from './systems/InputSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CameraSystem } from './systems/CameraSystem.js';
import { EnemySystem } from './systems/EnemySystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { HarvestSystem } from './systems/HarvestSystem.js';
import { StackSystem } from './systems/StackSystem.js';
import { HUD } from './ui/HUD.js';

class Game {
    constructor() {
        this.clock = new THREE.Clock();
        this.init();
    }

    init() {
        // Core
        this.renderer = new Renderer();
        this.scene = new Scene();
        this.camera = new Camera();
        this.lighting = new Lighting(this.scene.instance);

        // Entities
        this.environment = new Environment(this.scene.instance);
        this.player = new Player(this.scene.instance);

        // UI
        this.joystick = new Joystick();
        this.hud = new HUD();

        // Systems
        this.inputSystem = new InputSystem(this.joystick);
        this.movementSystem = new MovementSystem(this.player);
        this.cameraSystem = new CameraSystem(this.camera, this.player);

        // Phase 2 Systems
        this.enemySystem = new EnemySystem(this.scene.instance, this.player);
        this.combatSystem = new CombatSystem(this.scene.instance, this.player, this.enemySystem);
        this.harvestSystem = new HarvestSystem(this.scene.instance, this.player, this.enemySystem);
        this.stackSystem = new StackSystem(this.scene.instance, this.player);

        // Connect Systems
        this.harvestSystem.onCollected = () => this.stackSystem.addDisk();
        this.stackSystem.onStackCountChanged = (count) => this.hud.updateMeatCount(count);

        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        const deltaTime = Math.min(this.clock.getDelta(), 0.1); // Cap delta to avoid jumps

        // Update Systems
        this.inputSystem.update();
        const inputVector = this.inputSystem.getMovementVector();

        this.movementSystem.update(deltaTime, inputVector);
        this.cameraSystem.update();

        // Phase 2 Updates
        this.enemySystem.update(deltaTime);
        this.combatSystem.update(deltaTime);
        this.harvestSystem.update(deltaTime);
        this.stackSystem.update(deltaTime);

        // Render
        this.renderer.render(this.scene.instance, this.camera.instance);
    }
}

// Start Game
window.addEventListener('load', () => {
    new Game();
});
