import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { Camera } from './core/Camera.js';
import { Scene } from './core/Scene.js';
import { Lighting } from './core/Lighting.js';
import EventBus from './core/EventBus.js';
import { loadArchetypes } from './core/ArchetypeLoader.js';
import ResourceRegistry from './core/ResourceRegistry.js';
import { Environment } from './entities/Environment.js';
import { Road } from './entities/Road.js';
import { Joystick } from './ui/Joystick.js';
import { HUD } from './ui/HUD.js';
import { FloatingUI } from './ui/FloatingUI.js';

// --- ECS Framework ---
import { ECSManager } from './ecs/ECSManager.js';
import { EntityFactory } from './entities/EntityFactory.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { StackSystem } from './systems/StackSystem.js';

// --- Existing Juiced Systems ---
import { CameraSystem } from './systems/CameraSystem.js';
import { EnemySystem } from './systems/EnemySystem.js';
import { CollectorSystem } from './systems/CollectorSystem.js';
import { AgentAISystem } from './systems/AgentAISystem.js';
import { TraderSystem } from './systems/TraderSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { DrainSystem } from './systems/DrainSystem.js';
import { LevelSystem } from './systems/LevelSystem.js';
import { DepositorSystem } from './systems/DepositorSystem.js';
import { ObjectPool } from './utils/ObjectPool.js';
import { Projectile } from './entities/Projectile.js';
import { SELLING_TABLE_POSITION, TRAY_CONFIG } from './config/gameConfig.js';

class Game {
    constructor() {
        this.clock = new THREE.Clock();
        this.init();
    }

    init() {
        // 1. Core Engine Boilerplate
        this.renderer = new Renderer();
        this.scene = new Scene();
        this.camera = new Camera();
        this.lighting = new Lighting(this.scene.instance);

        // 2. Global UI
        this.joystick = new Joystick();
        this.hud = new HUD();
        this.floatingUI = new FloatingUI(this.camera.instance);

        // 3. Initialize ECS
        this.ecs = new ECSManager();
        this.factory = new EntityFactory(this.scene.instance, this.ecs);

        // 4. World Environment
        this.environment = new Environment(this.scene.instance);
        this.road = new Road(this.scene.instance);

        // 5. Spawn Entities via Factory
        this.playerId = this.factory.createPlayer(new THREE.Vector3(0, 0, 0));

        // Get player transform for camera following
        const playerTransform = this.ecs.getComponent(this.playerId, 'Transform');
        const playerInventory = this.ecs.getComponent(this.playerId, 'InventoryStack');

        // 6. Define Systems
        // --- Shared Pools ---
        this.projectilePool = new ObjectPool(() => new Projectile(), 50, 'ProjectilePool');

        // --- Active ECS Systems ---
        this.movementSystem = new MovementSystem(this.joystick);

        this.enemySystem = new EnemySystem(this.scene.instance, this.factory, playerTransform);
        this.enemySystem.setECS(this.ecs);
        this.ecs.registerSystem(this.enemySystem, ['Transform', 'Movement', 'Health']);

        this.combatSystem = new CombatSystem(this.scene.instance, this.projectilePool);

        // Register ECS Systems
        this.ecs.registerSystem(this.movementSystem, ['Transform', 'Movement']);
        this.ecs.registerSystem(this.combatSystem, ['Transform', 'Shooter']);

        // StackSystem — ECS driven, no player reference
        this.stackSystem = new StackSystem(this.scene.instance);
        this.stackSystem.setECS(this.ecs);
        this.ecs.registerSystem(this.stackSystem, ['Transform', 'InventoryStack']);

        // --- Utility Systems ---
        this.cameraSystem = new CameraSystem(this.camera, playerTransform.mesh);
        this.particleSystem = new ParticleSystem(this.scene.instance);
        // Utility Systems
        this.collectorSystem = new CollectorSystem(this.scene.instance);
        this.ecs.registerSystem(this.collectorSystem, ['Transform', 'Collector', 'InventoryStack']);

        // Mock StackSystem interface for DrainSystem
        const mockStackSystem = {
            stack: playerInventory.stack.items,
            popDisk: () => this.stackSystem.popDisk(this.playerId)
        };
        this.drainSystem = new DrainSystem(this.scene.instance, { position: playerTransform.mesh.position, group: playerTransform.mesh }, mockStackSystem, this.floatingUI);
        this.levelSystem = new LevelSystem(this.scene.instance, this.drainSystem, this.particleSystem, this.combatSystem, { position: playerTransform.mesh.position, group: playerTransform.mesh });

        // 7. Initialize Storage Nodes (ECS-driven)
        const tablePos3 = new THREE.Vector3(SELLING_TABLE_POSITION.x, SELLING_TABLE_POSITION.y, SELLING_TABLE_POSITION.z);
        this.meatTableEntityId = this.factory.create('meat-table', tablePos3);

        // Create and register DepositorSystem
        this.depositorSystem = new DepositorSystem(this.scene.instance);
        this.ecs.registerSystem(this.depositorSystem, ['Transform', 'Depositor', 'InventoryStack']);

        // Create coin tray ECS entity
        this.coinTrayEntityId = this.factory.create('coin-tray',
            new THREE.Vector3(TRAY_CONFIG.position.x, TRAY_CONFIG.position.y, TRAY_CONFIG.position.z));

        // Create AgentAISystem + TraderSystem
        this.agentAISystem = new AgentAISystem(this.factory, this.scene.instance);
        this.agentAISystem.setECS(this.ecs);
        this.traderSystem = new TraderSystem(this.scene.instance, this.agentAISystem, this.coinTrayEntityId);
        this.traderSystem.setECS(this.ecs);

        // Register with ECS
        this.ecs.registerSystem(this.agentAISystem, ['Transform', 'Movement', 'AgentAI']);
        this.ecs.registerSystem(this.traderSystem, ['Transform', 'InventoryStack', 'Trader']);

        // Spawn initial villagers (4 in queue)
        for (let i = 0; i < 4; i++) {
            const spawnPos = new THREE.Vector3(0, 0, -24 + i * 0.5);
            const villagerId = this.factory.create('villager', spawnPos);
            this.agentAISystem.register(villagerId, i);
        }

        // ECS meat-table entity provides Tag+InventoryStack for DepositorSystem.

        // Connect Systems
        EventBus.on('stack:changed', ({ entityId, count }) => {
            if (entityId === this.playerId) this.hud.updateMeatCount(count);
        });

        // Init Level 1 elements (Gates, Unlock Zones)
        this.levelSystem.initLevel(1);

        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        const deltaTime = Math.min(this.clock.getDelta(), 0.1);

        // 1. Update Core ECS Loop
        this.ecs.update(deltaTime);

        // 2. Update Legacy/Visual Systems
        this.cameraSystem.update(deltaTime);
        this.particleSystem.update(deltaTime);
        this.floatingUI.update();
        this.levelSystem.update(deltaTime, []);

        // 3. Render
        this.renderer.render(this.scene.instance, this.camera.instance);
    }
}

// Start Game
window.addEventListener('load', async () => {
    await loadArchetypes();
    await ResourceRegistry.load();
    new Game();
});
