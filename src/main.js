import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { Camera } from './core/Camera.js';
import { Scene } from './core/Scene.js';
import { SceneDiorama } from './core/SceneDiorama.js';
import { Lighting } from './core/Lighting.js';
import { LightingDiorama } from './core/LightingDiorama.js';
import EventBus from './core/EventBus.js';
import { loadArchetypes, getArchetype } from './core/ArchetypeLoader.js';
import ResourceRegistry from './core/ResourceRegistry.js';
import SkillRegistry from './core/SkillRegistry.js';
import StackConfigRegistry from './core/StackConfigRegistry.js';
import { SceneLoader } from './core/SceneLoader.js';
import { SceneLoaderDiorama } from './core/SceneLoaderDiorama.js';
import { isDioramaMode } from './core/SceneMode.js';
import { Joystick } from './ui/Joystick.js';
import { KeyboardInput } from './ui/KeyboardInput.js';
import { HUD } from './ui/HUD.js';
import { HeroBar } from './ui/HeroBar.js';
import { GameOverUI } from './ui/GameOverUI.js';
import { FloatingUI } from './ui/FloatingUI.js';
import { WorldHealthBar } from './ui/WorldHealthBar.js';
import { DamagePopupUI } from './ui/DamagePopupUI.js';

// --- ECS Framework ---
import { ECSManager } from './ecs/ECSManager.js';
import { EntityFactory } from './entities/EntityFactory.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { PlayerAnimSystem } from './systems/PlayerAnimSystem.js';
import { AnimationSystem } from './systems/AnimationSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { SkillSystem } from './systems/SkillSystem.js';
// DISABLED: physical arm meshes replaced by SkillEffectSystem. Keep import
// commented so we can re-enable quickly if we want arms back.
// import { ArmAnimSystem } from './systems/ArmAnimSystem.js';
import { SkillEffectSystem } from './systems/SkillEffectSystem.js';
import { HarvestNodeSystem } from './systems/HarvestNodeSystem.js';
import { StackSystem } from './systems/StackSystem.js';
import { CameraSystem } from './systems/CameraSystem.js';
import { EnemySystem } from './systems/EnemySystem.js';
import { HeroAISystem } from './systems/HeroAISystem.js';
import { WaypointFollowSystem } from './systems/WaypointFollowSystem.js';
import { DragInputSystem } from './systems/DragInputSystem.js';
import { CollectorSystem } from './systems/CollectorSystem.js';
import { AgentAISystem } from './systems/AgentAISystem.js';
import { TraderSystem } from './systems/TraderSystem.js';
import { StallSystem } from './systems/StallSystem.js';
import { CustomerAISystem } from './systems/CustomerAISystem.js';
import { createMarket } from './zones/market/MarketZone.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { HealthSystem } from './systems/HealthSystem.js';
import { UnlockZoneSystem } from './systems/UnlockZoneSystem.js';
import { MachineSystem } from './systems/MachineSystem.js';
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
import { InstancedCharacterPool } from './rendering/InstancedCharacterPool.js';
import { ResourceWell } from './zones/basecamp/ResourceWell.js';

class Game {
    constructor() {
        this.clock = new THREE.Clock();
        this._hitstopLeft = 0; // seconds of frozen gameplay (finisher impact)
        EventBus.on('game:hitstop', ({ duration = 0.06 } = {}) => {
            this._hitstopLeft = Math.max(this._hitstopLeft, duration);
        });
        this.init();
    }

    init() {
        // 1. Core Engine
        // Scene mode is resolved once at boot. Diorama uses parallel
        // SceneDiorama + LightingDiorama; legacy stays untouched.
        const diorama = isDioramaMode();
        this.renderer = new Renderer();
        this.scene = diorama ? new SceneDiorama() : new Scene();
        this.camera = new Camera();
        this.lighting = diorama
            ? new LightingDiorama(this.scene.instance)
            : new Lighting(this.scene.instance);

        // 2. UI
        // Manual player control DISABLED — drag-to-waypoint now drives the
        // player (same gesture as the hero). To re-enable keyboard + joystick
        // movement, uncomment the two `new` lines below and remove the null
        // assignments. The MovementSystem + DragInputSystem both accept null
        // here, so flipping this back on is a one-line change.
        // this.joystick = new Joystick();
        // this.keyboard = new KeyboardInput();
        this.joystick = null;
        this.keyboard = null;
        this.floatingUI = new FloatingUI(this.camera.instance);

        // 3. ECS
        this.ecs = new ECSManager();
        this.factory = new EntityFactory(this.scene.instance, this.ecs);

        // 4. Shared pools
        this.projectilePool = new ObjectPool(() => new Projectile(), 50, 'ProjectilePool');

        // 5. Register all systems (entity creation happens in loadLevel)
        this.movementSystem = new MovementSystem(this.joystick, this.keyboard);
        this.ecs.registerSystem(this.movementSystem, ['Transform', 'Movement']);

        // Hero steering — runs after MovementSystem so player input wins
        // if both update the same frame. Heroes don't use MovementSystem
        // (their controller is 'hero_ai', which MovementSystem ignores).
        this.heroAISystem = new HeroAISystem();
        this.ecs.registerSystem(this.heroAISystem, ['Transform', 'Movement', 'HeroAI']);

        // WaypointFollowSystem — walks any entity with a Waypoints + BehaviorState
        // along a drag-drawn path. Runs AFTER HeroAISystem so combat claims win
        // the frame and walk-path yields; resumes automatically when combat
        // releases. Character-agnostic: any entity with the right components.
        this.waypointFollowSystem = new WaypointFollowSystem();
        this.ecs.registerSystem(this.waypointFollowSystem, ['Transform', 'Movement', 'Waypoints', 'BehaviorState']);

        // DragInputSystem — pointer-driven tap-select + drag-to-waypoint input.
        // Registered here without entity requirements; canvas/camera/joystick
        // refs are supplied inside loadLevel() once the player mesh and
        // camera are ready. The update() hook pulses the selection ring.
        this.dragInputSystem = null;

        // PlayerAnimSystem — procedural walk/idle anims for hero-tier characters
        // (those whose mesh exposes named limb pivots, e.g. 'character-player').
        // Runs after MovementSystem so it sees the latest position; runs before
        // StackSystem so the body bob is in place when the stack anchor is read.
        this.playerAnimSystem = new PlayerAnimSystem();
        this.ecs.registerSystem(this.playerAnimSystem, ['Transform', 'Movement', 'WalkAnim']);

        // AnimationSystem — keyframe animation player for hero-tier characters.
        // Runs AFTER PlayerAnimSystem so action animations (sword swing, jump,
        // etc.) override walk results on the bones they touch — additive
        // layer, no-op when no clip is active. Triggered by 'skill:fired'
        // (looks up skill.animation) and 'animation:play' events. Clips live
        // in src/config/animations.json.
        this.animationSystem = new AnimationSystem();
        this.ecs.registerSystem(this.animationSystem, ['Transform', 'Animator']);

        // SkillSystem — new unified combat/harvest dispatcher. Runs before CombatSystem
        // so skill-driven entities (player) use it, while legacy Shooter entities
        // (turrets) keep using CombatSystem until they're migrated.
        this.skillSystem = new SkillSystem(this.scene.instance, this.projectilePool);
        this.ecs.registerSystem(this.skillSystem, ['Transform', 'SkillLoadout', 'SkillState']);

        // DISABLED: physical arm animations replaced by SkillEffectSystem.
        // this.armAnimSystem = new ArmAnimSystem();
        // this.ecs.registerSystem(this.armAnimSystem, ['Arms']);

        // SkillEffectSystem — spawns per-skill visual effects (bow draw, muzzle
        // flash, melee slash, etc.) in response to skill:windup_start / skill:fired.
        // Non-ECS: update() is called from the animate loop below.
        this.skillEffectSystem = new SkillEffectSystem(this.scene.instance);
        this.skillEffectSystem.setECS(this.ecs);

        // Damage popups (floating numbers over hit enemies)
        this.damagePopupUI = new DamagePopupUI(this.camera.instance);

        // HarvestNodeSystem — respawns trees/rocks after they're mined.
        // Non-ECS: update(dt) is called from the animate loop below.
        this.harvestNodeSystem = new HarvestNodeSystem(this.factory, this.ecs);

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

        this.machineSystem = new MachineSystem(this.scene.instance);
        this.ecs.registerSystem(this.machineSystem, ['Transform', 'Machine']);

        this.particleSystem = new ParticleSystem(this.scene.instance);

        this.buildSystem = new BuildSystem(this.scene.instance, this.factory, this.particleSystem);
        this.buildSystem.setECS(this.ecs);
        this.ecs.registerSystem(this.buildSystem, ['Transform', 'Tag']);

        this.gateSystem = new GateSystem();
        this.ecs.registerSystem(this.gateSystem, ['Transform', 'Gate']);

        // Market zone — selling stalls + walking customers. StallSystem
        // listens for purchase requests; CustomerAISystem owns the road
        // state machine and spawn cadence. Both are stateless w.r.t. the
        // player, so they live in init() rather than loadLevel().
        this.stallSystem = new StallSystem(this.scene.instance);
        this.stallSystem.setECS(this.ecs);
        this.ecs.registerSystem(this.stallSystem, ['Transform', 'Stall', 'InventoryStack']);

        this.customerAISystem = new CustomerAISystem(this.factory, this.scene.instance);
        this.customerAISystem.setECS(this.ecs);
        this.ecs.registerSystem(this.customerAISystem, ['Transform', 'Customer', 'RoadPath', 'Movement']);
    }

    /**
     * Load a level — creates ALL entities from level JSON.
     * No hardcoded positions or entity references in main.js.
     */
    async loadLevel(path) {
        // In diorama mode, use the wrapping loader so the dioramaWorld
        // block in the level JSON is built on top of the legacy ground.
        const Loader = isDioramaMode() ? SceneLoaderDiorama : SceneLoader;
        const { grid, levelData, gridOverlay, fenceGroup, fenceEdges, propEntities, machines } =
            await Loader.load(path, this.scene.instance);
        this.grid = grid;

        // --- Grid toggle ---
        if (gridOverlay) this._createGridToggle(gridOverlay);

        // --- Instanced character pools (GPU batching for crowds) ---
        this._characterPools = [
            new InstancedCharacterPool(this.scene.instance, 0xff3333, 120),  // enemy
            new InstancedCharacterPool(this.scene.instance, 0x44bb44, 60),   // villager
            new InstancedCharacterPool(this.scene.instance, 0xff6600, 30),   // speeder
            new InstancedCharacterPool(this.scene.instance, 0x880000, 30),   // tank
        ];
        this.factory.setInstancePools({
            enemy:    this._characterPools[0],
            villager: this._characterPools[1],
            speeder:  this._characterPools[2],
            tank:     this._characterPools[3],
        });

        // --- Player (NOT instanced — needs real mesh for camera follow + health bar) ---
        // Prefer cell-based spawn via GridSystem (see design/logic-flow/grid-system.md).
        // Falls back to explicit position for legacy level JSONs.
        const playerSpawn = levelData.spawners?.player;
        if (playerSpawn?.cell) {
            this.playerSpawnPos = this.grid.toWorld({
                row: playerSpawn.cell[0],
                col: playerSpawn.cell[1],
                anchor: playerSpawn.anchor || 'center',
                y: playerSpawn.position?.y ?? 0,
            });
        } else {
            const p = playerSpawn?.position || { x: 0, y: 0, z: 0 };
            this.playerSpawnPos = new THREE.Vector3(p.x, p.y, p.z);
        }
        this.playerId = this.factory.createPlayer(this.playerSpawnPos.clone());
        const playerTransform = this.ecs.getComponent(this.playerId, 'Transform');

        // Systems that need player reference
        this.cameraSystem = new CameraSystem(this.camera, playerTransform.mesh);

        // DragInputSystem — wired here because it needs the renderer canvas
        // and the already-constructed camera/scene/joystick/cameraSystem.
        // Registered with no component requirements (entities arg is unused);
        // it drives single-unit commands, marquee group selection, group
        // moves, and two-finger camera pan through pointer events.
        this.dragInputSystem = new DragInputSystem(
            this.ecs,
            this.camera.instance,
            this.scene.instance,
            this.renderer.threeRenderer.domElement,
            this.joystick,
            this.cameraSystem
        );
        this.ecs.registerSystem(this.dragInputSystem, []);
        this.enemySystem = new EnemySystem(this.scene.instance, this.factory, playerTransform);
        this.enemySystem.setECS(this.ecs);
        this.enemySystem.setPlayerEntityId(this.playerId);
        const enemyArchetype = getArchetype('enemy');
        if (enemyArchetype.spawn) this.enemySystem.setConfig(enemyArchetype.spawn);
        this.ecs.registerSystem(this.enemySystem, ['Transform', 'Movement', 'Health', 'EnemyAI']);
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
        this.heroBar = new HeroBar(this.ecs, this.scene.instance, this.factory, this.playerId, this.playerSpawnPos, this.camera.instance);
        this.gameOverUI = new GameOverUI();

        // Floating HP bar above player's head — follows mesh in world space
        this.playerHealthBar = new WorldHealthBar(
            this.camera.instance,
            playerTransform.mesh,
            this.playerId
        );

        // --- Entities from level JSON ---
        if (levelData.entities) {
            for (const def of levelData.entities) {
                const pos = new THREE.Vector3(def.position.x, def.position.y, def.position.z);
                this.factory.create(def.archetype, pos);
            }
        }

        // --- Scattered harvestable props (all procedurally-placed rocks/trees
        //     are now real ECS entities so every one is minable) ---
        if (propEntities && propEntities.length > 0) {
            for (const def of propEntities) {
                const pos = new THREE.Vector3(def.position.x, def.position.y, def.position.z);
                this.factory.create(def.archetype, pos);
            }
        }

        // --- Unlock zones ---
        if (levelData.unlockZones) {
            // Resolve a cell-shaped field that is either [row, col] (legacy) or
            // { cell:[row,col], span?, anchor? } (new). All routes through GridSystem.
            const resolveCell = (field, defaults = {}) => {
                if (!field) return null;
                const isArray = Array.isArray(field);
                const cell = isArray ? field : field.cell;
                if (!cell) return null;
                return this.grid.toWorld({
                    row: cell[0],
                    col: cell[1],
                    span: (isArray ? null : field.span) || defaults.span || [1, 1],
                    anchor: (isArray ? null : field.anchor) || defaults.anchor || 'center',
                });
            };

            for (const zoneDef of levelData.unlockZones) {
                // Resolve position: cell-based (cell = top-left of footprint,
                // gridSpan = extent, anchor = where in the footprint the origin sits)
                // or legacy world coordinates.
                let pos;
                if (zoneDef.cell) {
                    pos = this.grid.toWorld({
                        row: zoneDef.cell[0],
                        col: zoneDef.cell[1],
                        span: zoneDef.gridSpan || [2, 2],
                        anchor: zoneDef.anchor || 'center',
                    });
                } else {
                    pos = new THREE.Vector3(zoneDef.position.x, zoneDef.position.y, zoneDef.position.z);
                }

                // Pre-resolve optional cell overrides to world positions
                const buildsAt = resolveCell(zoneDef.buildsAt);
                const spawnsAt = resolveCell(zoneDef.spawnsAt);

                // Resolve outputTarget — cell form gets pre-resolved to worldPos
                let outputTarget = zoneDef.outputTarget || null;
                if (outputTarget && outputTarget.cell) {
                    outputTarget = {
                        ...outputTarget,
                        worldPos: this.grid.toWorld({
                            row: outputTarget.cell[0],
                            col: outputTarget.cell[1],
                            span: outputTarget.span || [1, 1],
                            anchor: outputTarget.anchor || 'center',
                        })
                    };
                }
                // Legacy fallback
                if (!outputTarget && zoneDef.outputTag) {
                    outputTarget = { tag: zoneDef.outputTag };
                }

                const zoneEntityId = this.factory.create('unlock-turret', pos, {
                    UnlockZone: {
                        type: zoneDef.type,
                        cost: zoneDef.cost,
                        builds: zoneDef.builds || null,
                        spawns: zoneDef.spawns || null,
                        spawnCount: zoneDef.count || zoneDef.spawnCount || 1,
                        output: zoneDef.output || null,
                        outputTag: zoneDef.outputTag || null,
                        outputTarget,
                        outputCount: zoneDef.outputCount || 1,
                        buildsAt,
                        spawnsAt
                    }
                });

            }
        }

        // --- Gearworks machines (diorama only) ---
        if (Array.isArray(machines)) {
            for (const { config } of machines) {
                // Prefer grid-based placement (cell/anchor/offset) when present.
                // Falls back to raw x/y/z for legacy entries.
                const pos = config.cell
                    ? this.grid.toWorld({
                        row:    config.cell[0],
                        col:    config.cell[1],
                        span:   config.span   || [1, 1],
                        anchor: config.anchor || 'center',
                        offset: config.offset || null,
                        y:      config.y ?? 0,
                      })
                    : new THREE.Vector3(config.x || 0, config.y || 0, config.z || 0);
                this.factory.create('gearworks-machine', pos, {
                    _meshOpts: { ...config },
                    Machine: {
                        cost: config.cost || { essence: 10 },
                        output: config.output || 'coin',
                        outputCount: config.outputCount || 1,
                        drainRate: 0.15,
                        range: 3.5
                    }
                });
            }
        }

        // --- Gates (one per side) ---
        this._gateBarFills = new Map(); // entityId → fill mesh
        if (levelData.gates) {
            for (const gateDef of levelData.gates) {
                const pos = new THREE.Vector3(gateDef.position.x, gateDef.position.y, gateDef.position.z);
                const isRotated = Math.abs(gateDef.rotationY || 0) > 0.01;

                // For rotated gates (W/E), swap collider width/depth since CollisionSystem uses AABB
                const overrides = isRotated ? {
                    Collider: { shape: 'box', width: 0.25, depth: 3.0, isStatic: true }
                } : {};

                const gateId = this.factory.create('gate', pos, overrides);
                const gateTransform = this.ecs.getComponent(gateId, 'Transform');

                // Apply mesh rotation for visual alignment
                if (isRotated && gateTransform?.mesh) {
                    gateTransform.mesh.rotation.y = gateDef.rotationY;
                }

                // 3D health bar — parented to gate mesh so it aligns with gate direction
                if (gateTransform?.mesh) {
                    const barWidth = 2.0;
                    const barHeight = 0.18;

                    const bgGeo = new THREE.PlaneGeometry(barWidth, barHeight);
                    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
                    const bg = new THREE.Mesh(bgGeo, bgMat);

                    const fillGeo = new THREE.PlaneGeometry(barWidth, barHeight);
                    const fillMat = new THREE.MeshBasicMaterial({ color: 0x44cc44, side: THREE.DoubleSide });
                    const fill = new THREE.Mesh(fillGeo, fillMat);

                    const barGroup = new THREE.Group();
                    barGroup.add(bg);
                    barGroup.add(fill);
                    fill.position.z = 0.01; // slight offset so fill renders in front of bg
                    barGroup.position.y = 1.5;
                    barGroup.rotation.x = -Math.PI / 4; // tilt toward camera

                    gateTransform.mesh.add(barGroup);
                    this._gateBarFills.set(gateId, { fill, barWidth });
                }
            }
        }

        // Update gate 3D health bars on HP change + clean up on death
        EventBus.on('entity:hp_changed', ({ entityId, hp, maxHp }) => {
            const entry = this._gateBarFills.get(entityId);
            if (!entry) return;
            const pct = Math.max(0, Math.min(1, hp / maxHp));
            entry.fill.scale.x = pct;
            entry.fill.position.x = -(entry.barWidth * (1 - pct)) / 2;
            entry.fill.material.color.setHex(
                pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xffaa00 : 0xff4444
            );
        });

        EventBus.on('entity:died', ({ entityId }) => {
            this._gateBarFills.delete(entityId);
        });

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

        // --- Market zone (loaded only when level JSON declares a `market` block) ---
        this._market = null;
        if (levelData.market) {
            this._market = createMarket(
                {
                    factory: this.factory,
                    ecs: this.ecs,
                    scene: this.scene.instance,
                    camera: this.camera.instance,
                    customerAISystem: this.customerAISystem
                },
                levelData.market
            );
        }

        // --- Resource Wells (diorama basecamp testing) ---
        this._resourceWells = [];
        if (isDioramaMode()) {
            // Grid 11/20 → world x=-7, z=11  (essence,       SW)
            // Grid 18/19 → world x=7,  z=9   (essenceCandy,  SE)
            // Grid 10/11 → world x=-9, z=-7  (coin,          NW)
            // Grid 19/11 → world x=9,  z=-7  (wood,          NE)
            const essenceWell = new ResourceWell('essence',      { x: -7, z: 11 });
            const candyWell   = new ResourceWell('essenceCandy', { x:  7, z:  9 });
            const coinWell    = new ResourceWell('coin',         { x: -9, z: -7 });
            const woodWell    = new ResourceWell('wood',         { x:  9, z: -7 });
            essenceWell.init();
            candyWell.init();
            coinWell.init();
            woodWell.init();
            this._resourceWells.push(essenceWell, candyWell, coinWell, woodWell);
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
        const realDt = Math.min(this.clock.getDelta(), 0.1);

        // Hitstop — freeze gameplay updates for a few ms on finisher impact.
        // Rendering keeps running so the screen doesn't go stale.
        if (this._hitstopLeft > 0) {
            this._hitstopLeft = Math.max(0, this._hitstopLeft - realDt);
        }
        const frozen = this._hitstopLeft > 0;
        const deltaTime = frozen ? 0 : realDt;

        // 1. ECS update (all registered systems) — paused during hitstop
        this.ecs.update(deltaTime);

        // 2. Non-ECS visual systems — camera shake still runs (we want the
        // shake visible during freeze); particles/effects pause with gameplay.
        this.cameraSystem.update(realDt);
        this.particleSystem.update(deltaTime);
        this.skillEffectSystem.update(deltaTime);
        this.harvestNodeSystem.update(deltaTime);
        for (const well of this._resourceWells) well.update(deltaTime, this.scene.instance);
        this.damagePopupUI.update(realDt);
        this.floatingUI.update();
        this.playerHealthBar.update();
        if (this.heroBar) this.heroBar.update();
        if (this._market) this._market.update();

        // 3. Sync instanced character pools (proxy → GPU matrices)
        for (const pool of this._characterPools) pool.sync();

        // 4. Render
        this.renderer.render(this.scene.instance, this.camera.instance);

        // 5. Debug overlay
        this._updateDebugOverlay();
    }

    _updateDebugOverlay() {
        if (!this._debugEl) {
            this._debugEl = document.createElement('div');
            this._debugEl.id = 'debug-overlay';
            this._debugEl.style.cssText = `
                position: fixed; bottom: 10px; left: 10px; z-index: 9999;
                padding: 8px 12px; border-radius: 6px;
                background: rgba(0,0,0,0.75); color: #0f0;
                font: bold 12px monospace; line-height: 1.6;
                pointer-events: none;
            `;
            document.body.appendChild(this._debugEl);
            this._debugFrames = 0;
            this._debugFPS = 0;
            this._debugLastTime = performance.now();
        }

        // FPS counter (update every 30 frames to avoid flicker)
        this._debugFrames++;
        const now = performance.now();
        if (now - this._debugLastTime >= 500) {
            this._debugFPS = Math.round(this._debugFrames / ((now - this._debugLastTime) / 1000));
            this._debugFrames = 0;
            this._debugLastTime = now;
        }

        const ri = this.renderer.threeRenderer.info.render;
        const enemies = this._characterPools[0].activeCount;
        const villagers = this._characterPools[1].activeCount;
        const totalEntities = this.ecs.entities.size;

        this._debugEl.innerHTML =
            `FPS: ${this._debugFPS}<br>` +
            `Draw calls: ${ri.calls}<br>` +
            `Triangles: ${ri.triangles}<br>` +
            `Enemies: ${enemies}<br>` +
            `Villagers: ${villagers}<br>` +
            `Total entities: ${totalEntities}`;
    }
}

// Start Game
window.addEventListener('load', async () => {
    await loadArchetypes();
    await ResourceRegistry.load();
    await SkillRegistry.load();
    await StackConfigRegistry.load();
    const game = new Game();
    const levelPath = isDioramaMode()
        ? './src/config/levels/level-1-diorama.json'
        : './src/config/levels/level-1.json';
    await game.loadLevel(levelPath);
    game.animate();
});
