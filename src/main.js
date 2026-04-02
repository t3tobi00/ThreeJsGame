import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { Camera } from './core/Camera.js';
import { Scene } from './core/Scene.js';
import { Lighting } from './core/Lighting.js';
import EventBus from './core/EventBus.js';
import { loadArchetypes } from './core/ArchetypeLoader.js';
import ResourceRegistry from './core/ResourceRegistry.js';
import { SceneLoader } from './core/SceneLoader.js';
import { Joystick } from './ui/Joystick.js';
import { HUD } from './ui/HUD.js';
import { GameOverUI } from './ui/GameOverUI.js';
import { FloatingUI } from './ui/FloatingUI.js';

// --- ECS Framework ---
import { ECSManager } from './ecs/ECSManager.js';
import { EntityFactory } from './entities/EntityFactory.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { StackSystem } from './systems/StackSystem.js';
import { CameraSystem } from './systems/CameraSystem.js';
import { EnemySystem } from './systems/EnemySystem.js';
import { CollectorSystem } from './systems/CollectorSystem.js';
import { AgentAISystem } from './systems/AgentAISystem.js';
import { TraderSystem } from './systems/TraderSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { HealthSystem } from './systems/HealthSystem.js';
import { UnlockZoneSystem } from './systems/UnlockZoneSystem.js';
import { BuildSystem } from './systems/BuildSystem.js';
import { GateSystem } from './systems/GateSystem.js';
import { DepositorSystem } from './systems/DepositorSystem.js';
import { ContactDamageSystem } from './systems/ContactDamageSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { SafeZoneSystem } from './systems/SafeZoneSystem.js';
import { Component_SafeZone } from './ecs/components/Component_SafeZone.js';
import { Component_Transform } from './ecs/components/Component_Transform.js';
import { Component_Collider } from './ecs/components/Component_Collider.js';
import { ObjectPool } from './utils/ObjectPool.js';
import { Projectile } from './entities/Projectile.js';

class Game {
    constructor() {
        this.clock = new THREE.Clock();
        this.init();
    }

    init() {
        // 1. Core Engine
        this.renderer = new Renderer();
        this.scene = new Scene();
        this.camera = new Camera();
        this.lighting = new Lighting(this.scene.instance);

        // 2. UI
        this.joystick = new Joystick();
        this.floatingUI = new FloatingUI(this.camera.instance);

        // 3. ECS
        this.ecs = new ECSManager();
        this.factory = new EntityFactory(this.scene.instance, this.ecs);

        // 4. Shared pools
        this.projectilePool = new ObjectPool(() => new Projectile(), 50, 'ProjectilePool');

        // 5. Register all systems (entity creation happens in loadLevel)
        this.movementSystem = new MovementSystem(this.joystick);
        this.ecs.registerSystem(this.movementSystem, ['Transform', 'Movement']);

        this.combatSystem = new CombatSystem(this.scene.instance, this.projectilePool);
        this.ecs.registerSystem(this.combatSystem, ['Transform', 'Shooter']);

        this.stackSystem = new StackSystem(this.scene.instance);
        this.stackSystem.setECS(this.ecs);
        this.ecs.registerSystem(this.stackSystem, ['Transform', 'InventoryStack']);

        this.healthSystem = new HealthSystem(this.scene.instance);
        this.ecs.registerSystem(this.healthSystem, ['Transform', 'Health']);

        this.contactDamageSystem = new ContactDamageSystem();
        this.ecs.registerSystem(this.contactDamageSystem, ['Transform', 'ContactDamage']);

        this.collectorSystem = new CollectorSystem(this.scene.instance);
        this.ecs.registerSystem(this.collectorSystem, ['Transform', 'Collector', 'InventoryStack']);

        this.depositorSystem = new DepositorSystem(this.scene.instance);
        this.ecs.registerSystem(this.depositorSystem, ['Transform', 'Depositor', 'InventoryStack']);

        this.unlockZoneSystem = new UnlockZoneSystem(this.scene.instance);
        this.ecs.registerSystem(this.unlockZoneSystem, ['Transform', 'UnlockZone']);

        this.particleSystem = new ParticleSystem(this.scene.instance);

        this.buildSystem = new BuildSystem(this.scene.instance, this.factory, this.particleSystem);
        this.buildSystem.setECS(this.ecs);
        this.ecs.registerSystem(this.buildSystem, ['Transform', 'Tag']);

        this.gateSystem = new GateSystem();
        this.ecs.registerSystem(this.gateSystem, ['Transform', 'Gate']);
    }

    /**
     * Load a level — creates ALL entities from level JSON.
     * No hardcoded positions or entity references in main.js.
     */
    async loadLevel(path) {
        const { grid, levelData, gridOverlay, fenceGroup, fenceEdges } =
            await SceneLoader.load(path, this.scene.instance);
        this.grid = grid;

        // --- Grid toggle ---
        if (gridOverlay) this._createGridToggle(gridOverlay);

        // --- Player ---
        const playerPos = levelData.spawners?.player?.position || { x: 0, y: 0, z: 0 };
        this.playerId = this.factory.createPlayer(new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z));
        const playerTransform = this.ecs.getComponent(this.playerId, 'Transform');

        // Systems that need player reference
        this.cameraSystem = new CameraSystem(this.camera, playerTransform.mesh);
        this.enemySystem = new EnemySystem(this.scene.instance, this.factory, playerTransform);
        this.enemySystem.setECS(this.ecs);
        this.enemySystem.setPlayerEntityId(this.playerId);
        if (levelData.spawners?.enemies) {
            this.enemySystem.setSpawnConfig(levelData.spawners.enemies);
        }
        this.ecs.registerSystem(this.enemySystem, ['Transform', 'Movement', 'Health']);
        this.gateSystem.setPlayerTransform(playerTransform);

        // SafeZoneSystem — after enemies move, before collision resolution
        this.safeZoneSystem = new SafeZoneSystem(this.grid);
        this.safeZoneSystem.setPlayer(this.playerId);
        this.ecs.registerSystem(this.safeZoneSystem, ['SafeZone']);

        // CollisionSystem — runs last, after all movement and zone logic
        this.collisionSystem = new CollisionSystem();
        this.ecs.registerSystem(this.collisionSystem, ['Transform', 'Collider']);

        // HUD — self-wired via EventBus
        this.hud = new HUD(this.ecs, this.playerId);
        this.gameOverUI = new GameOverUI();

        // --- Entities from level JSON ---
        if (levelData.entities) {
            for (const def of levelData.entities) {
                const pos = new THREE.Vector3(def.position.x, def.position.y, def.position.z);
                this.factory.create(def.archetype, pos);
            }
        }

        // --- Unlock zones ---
        if (levelData.unlockZones) {
            for (const zoneDef of levelData.unlockZones) {
                const pos = new THREE.Vector3(zoneDef.position.x, zoneDef.position.y, zoneDef.position.z);
                this.factory.create('unlock-turret', pos, {
                    UnlockZone: {
                        type: zoneDef.type,
                        cost: zoneDef.cost,
                        builds: zoneDef.builds || null,
                        spawns: zoneDef.spawns || null,
                        spawnCount: zoneDef.count || 1,
                        output: zoneDef.output || null,
                        outputTag: zoneDef.outputTag || null,
                        outputCount: zoneDef.outputCount || 1
                    }
                });
            }
        }

        // --- Gate (ECS entity) ---
        if (levelData.gate) {
            const gatePos = levelData.gate.position;
            this.factory.create('gate', new THREE.Vector3(gatePos.x, gatePos.y, gatePos.z), {
                Gate: {
                    activationRange: levelData.gate.activationRange || 5.0,
                    openSpeed: levelData.gate.openSpeed || 8.0
                }
            });
        }

        // --- Fence collider entities (created here, not in SceneLoader) ---
        // SceneLoader returns plain edge data; main.js turns it into ECS entities.
        const fenceColliderIds = [];
        for (const edge of fenceEdges) {
            const obj = new THREE.Object3D();
            obj.position.set(edge.x, 0, edge.z);
            const id = this.ecs.createEntity();
            this.ecs.addComponent(id, 'Transform', new Component_Transform(obj));
            this.ecs.addComponent(id, 'Collider', new Component_Collider({
                shape: 'box', width: edge.width, depth: edge.depth, isStatic: true
            }));
            fenceColliderIds.push(id);
        }

        // --- Safe Zone ---
        if (levelData.safeZone) {
            const szId = this.ecs.createEntity();
            const zone = new Component_SafeZone(levelData.safeZone);
            zone.fenceColliderIds = fenceColliderIds;
            this.ecs.addComponent(szId, 'SafeZone', zone);

            this.safeZoneSystem.setFenceGroup(fenceGroup); // rendering ref lives in the system, not the component
        }

        // --- Villager trading systems (discover targets by tag, no IDs needed) ---
        this.agentAISystem = new AgentAISystem(this.factory, this.scene.instance);
        this.agentAISystem.setECS(this.ecs);
        this.traderSystem = new TraderSystem(this.scene.instance, this.agentAISystem);
        this.traderSystem.setECS(this.ecs);
        this.ecs.registerSystem(this.agentAISystem, ['Transform', 'Movement', 'AgentAI']);
        this.ecs.registerSystem(this.traderSystem, ['Transform', 'InventoryStack', 'Trader']);

        // --- Villagers ---
        const villagerConfig = levelData.spawners?.villagers;
        if (villagerConfig) {
            const count = villagerConfig.initialCount || 4;
            const spawnZ = villagerConfig.spawnPoint?.z || -24;
            for (let i = 0; i < count; i++) {
                const spawnPos = new THREE.Vector3(0, 0, spawnZ + i * 0.5);
                const villagerId = this.factory.create('villager', spawnPos);
                this.agentAISystem.register(villagerId, i);
            }
        }
    }

    _createGridToggle(overlay) {
        const btn = document.createElement('button');
        btn.id = 'grid-toggle';
        btn.textContent = overlay.visible ? 'Grid: ON' : 'Grid: OFF';
        btn.style.cssText = `
            position: fixed; top: 10px; right: 10px; z-index: 1000;
            padding: 8px 16px; border: none; border-radius: 6px;
            background: rgba(0,0,0,0.6); color: #fff;
            font: bold 14px Arial, sans-serif; cursor: pointer;
            touch-action: manipulation;
        `;
        btn.addEventListener('click', () => {
            overlay.visible = !overlay.visible;
            btn.textContent = overlay.visible ? 'Grid: ON' : 'Grid: OFF';
        });
        document.body.appendChild(btn);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const deltaTime = Math.min(this.clock.getDelta(), 0.1);

        // 1. ECS update (all registered systems)
        this.ecs.update(deltaTime);

        // 2. Non-ECS visual systems
        this.cameraSystem.update(deltaTime);
        this.particleSystem.update(deltaTime);
        this.floatingUI.update();

        // 3. Render
        this.renderer.render(this.scene.instance, this.camera.instance);
    }
}

// Start Game
window.addEventListener('load', async () => {
    await loadArchetypes();
    await ResourceRegistry.load();
    const game = new Game();
    await game.loadLevel('./src/config/levels/level-1.json');
    game.animate();
});
