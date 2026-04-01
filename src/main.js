import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { Camera } from './core/Camera.js';
import { Scene } from './core/Scene.js';
import { Lighting } from './core/Lighting.js';
import EventBus from './core/EventBus.js';
import { loadArchetypes } from './core/ArchetypeLoader.js';
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
import { TransactionSystem } from './systems/TransactionSystem.js';
import { StackSystem } from './systems/StackSystem.js';

// --- Existing Juiced Systems ---
import { CameraSystem } from './systems/CameraSystem.js';
import { EnemySystem } from './systems/EnemySystem.js';
import { CollectorSystem } from './systems/CollectorSystem.js';
import { VillagerSystem } from './systems/VillagerSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { DrainSystem } from './systems/DrainSystem.js';
import { LevelSystem } from './systems/LevelSystem.js';
import { DepositorSystem } from './systems/DepositorSystem.js';
import { CoinSystem } from './systems/CoinSystem.js';
import { StorageNode } from './entities/StorageNode.js';
import { ObjectPool } from './utils/ObjectPool.js';
import { Projectile } from './entities/Projectile.js';
import { SELLING_TABLE_POSITION, SELLING_CONFIG, TRAY_CONFIG, COIN_CONFIG } from './config/gameConfig.js';

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

        // --- Legacy Bridges (To be refactored next) ---
        // Note: These still expect "Player" class instance, so we pass a bridge object
        this.playerBridge = {
            position: playerTransform.mesh.position,
            group: playerTransform.mesh,
            mesh: playerTransform.mesh,
            _meatStack: playerInventory.stack,
            get meatStackLength() { return playerInventory.stack.getCount(); },
            maxCapacity: playerInventory.maxCapacity,
            popFromStack: () => playerInventory.stack.pop()
        };

        this.enemySystem = new EnemySystem(this.scene.instance, this.playerBridge);
        this.combatSystem = new CombatSystem(this.scene.instance, this.projectilePool, this.enemySystem);

        // TransactionSystem is needed for the Visual Stack Wobble physics!
        this.transactionSystem = new TransactionSystem(this.scene.instance);

        // Register ECS Systems
        this.ecs.registerSystem(this.movementSystem, ['Transform', 'Movement']);
        this.ecs.registerSystem(this.combatSystem, ['Transform', 'Shooter']);
        this.ecs.registerSystem(this.transactionSystem, ['Transform', 'InventoryStack', 'Tag']);

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
        this.drainSystem = new DrainSystem(this.scene.instance, this.playerBridge, mockStackSystem, this.floatingUI);
        this.levelSystem = new LevelSystem(this.scene.instance, this.drainSystem, this.particleSystem, this.combatSystem, this.playerBridge);

        // 7. Initialize Storage Nodes
        const tablePos = new THREE.Vector3(SELLING_TABLE_POSITION.x, SELLING_TABLE_POSITION.y, SELLING_TABLE_POSITION.z);
        this.meatTableNode = new StorageNode(this.scene.instance, tablePos, {
            size: new THREE.Vector3(2, 0.6, 1),
            color: 0x8B4513,
            maxCapacity: SELLING_CONFIG.tableCapacity || 50,
            stackOffset: 0.12,
            stiffness: 0.8,
            lerpFactor: 0.4,
            idleWobble: false
        });

        const trayPos = new THREE.Vector3(TRAY_CONFIG.position.x, TRAY_CONFIG.position.y, TRAY_CONFIG.position.z);
        const coinTrayNode = new StorageNode(this.scene.instance, trayPos, {
            size: new THREE.Vector3(TRAY_CONFIG.size.x, TRAY_CONFIG.size.y, TRAY_CONFIG.size.z),
            color: TRAY_CONFIG.color,
            maxCapacity: 100,
            stackOffset: COIN_CONFIG.stackOffset,
            stiffness: 0.5,
            lerpFactor: 0.3,
            idleWobble: true
        });

        this.coinSystem = new CoinSystem(coinTrayNode);

        // Create ECS table entity so DepositorSystem can find it by Tag
        const tablePos3 = new THREE.Vector3(SELLING_TABLE_POSITION.x, SELLING_TABLE_POSITION.y, SELLING_TABLE_POSITION.z);
        this.meatTableEntityId = this.factory.create('meat-table', tablePos3);

        // Create and register DepositorSystem
        this.depositorSystem = new DepositorSystem(this.scene.instance);
        this.ecs.registerSystem(this.depositorSystem, ['Transform', 'Depositor', 'InventoryStack']);

        // Temporary shim: VillagerSystem still needs table inventory access
        this.sellingSystemShim = {
            getMeatOnTable: () => {
                const inv = this.ecs.getComponent(this.meatTableEntityId, 'InventoryStack');
                return inv ? inv.stack.getCount() : 0;
            },
            popMeatMeshFromTable: () => {
                const inv = this.ecs.getComponent(this.meatTableEntityId, 'InventoryStack');
                return inv ? inv.stack.pop() : null;
            }
        };

        this.villagerSystem = new VillagerSystem(this.scene.instance, this.coinSystem, this.sellingSystemShim);

        // Note: ECS meat-table entity (meatTableEntityId) provides Tag+InventoryStack for DepositorSystem.
        // meatTableNode (StorageNode) provides the visual table mesh. Two visual objects co-exist at same position.

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
        this.enemySystem.update(deltaTime);
        this.particleSystem.update(deltaTime);
        this.floatingUI.update();
        this.levelSystem.update(deltaTime, this.enemySystem.enemies);
        this.meatTableNode.update(deltaTime);
        this.villagerSystem.update(deltaTime);
        this.coinSystem.update(deltaTime);

        // 3. Render
        this.renderer.render(this.scene.instance, this.camera.instance);
    }
}

// Start Game
window.addEventListener('load', async () => {
    await loadArchetypes();
    new Game();
});
