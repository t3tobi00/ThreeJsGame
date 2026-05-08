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
import { isDioramaMode, isPrototypeMode } from './core/SceneMode.js';
import { Joystick } from './ui/Joystick.js';
import { KeyboardInput } from './ui/KeyboardInput.js';
import { HUD } from './ui/HUD.js';
import { HeroBar } from './ui/HeroBar.js';
import { GameOverUI } from './ui/GameOverUI.js';
import { FloatingUI } from './ui/FloatingUI.js';
import { WorldHealthBar } from './ui/WorldHealthBar.js';
import { DamagePopupUI } from './ui/DamagePopupUI.js';
import { PrototypeEndUI } from './ui/PrototypeEndUI.js';
import { AudioManager } from './core/AudioManager.js';
import { PrototypeStats } from './state/PrototypeStats.js';
import { PrototypeStateMachine } from './systems/PrototypeStateMachine.js';
import { NextStepIndicator } from './systems/NextStepIndicator.js';
import { PalisadeGateSystem } from './systems/PalisadeGateSystem.js';

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
import { LungeAnimSystem } from './systems/LungeAnimSystem.js';
import { SpitterSystem } from './systems/SpitterSystem.js';
import { PoisonCloudSystem } from './systems/PoisonCloudSystem.js';
import { SeparationSystem } from './systems/SeparationSystem.js';
import { CombatVFXSystem } from './systems/CombatVFXSystem.js';
import { HealthSystem } from './systems/HealthSystem.js';
import { UnlockZoneSystem } from './systems/UnlockZoneSystem.js';
import { MachineSystem } from './systems/MachineSystem.js';
import { BuildSystem } from './systems/BuildSystem.js';
import { OnSpawnSystem } from './systems/OnSpawnSystem.js';
import { WorkerAISystem } from './systems/WorkerAISystem.js';
import { RoleIconSystem } from './systems/RoleIconSystem.js';
import { Pathfinder } from './utils/Pathfinder.js';
import { GateSystem } from './systems/GateSystem.js';
import { DepositorSystem } from './systems/DepositorSystem.js';
import { ContactDamageSystem } from './systems/ContactDamageSystem.js';
import { BurningSystem } from './systems/BurningSystem.js';
import { BleedingSystem } from './systems/BleedingSystem.js';
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
        // Joystick — re-enabled in ?prototype mode for fine player control;
        // legacy/diorama keep it null (drag-to-waypoint drives the player there).
        // In prototype: joystick handles short presses; drag-to-waypoint handles
        // longer paths + commanding ally soldiers.
        this.joystick = isPrototypeMode() ? new Joystick() : null;
        this.keyboard = null;
        this.floatingUI = new FloatingUI(this.camera.instance);

        // 3. ECS
        this.ecs = new ECSManager();
        this.factory = new EntityFactory(this.scene.instance, this.ecs);

        // 3b. Prototype-mode singletons (audio + counters + state machine).
        // Only instantiated under ?prototype to keep legacy/diorama identical.
        // AudioManager subscribes to entity:damaged/died, zone:built, audio:cue,
        // essence:fading, boss:killed, player:died. PrototypeStats aggregates
        // end-of-run counters (zombiesKilled, peak essence/wood, time, etc.).
        // PrototypeStateMachine + PrototypeEndUI are instantiated later in
        // loadLevel() — they need the player entity ID and the level scene.
        this._prototype = isPrototypeMode();
        if (this._prototype) {
            // body class enables CSS overrides — currently keeps the joystick
            // visible on desktops (the legacy media query hides it otherwise).
            document.body.classList.add('prototype-mode');
            this.audio = new AudioManager(this.ecs);
            this.prototypeStats = new PrototypeStats();
            this.prototypeStats.setECS(this.ecs);
            // 3D-parented "go here next" pointer. Reads `hints` array from the
            // active state and resolves a target each frame. Player + state
            // machine refs are wired in loadLevel() once both exist.
            this.nextStepIndicator = new NextStepIndicator(this.scene.instance, this.ecs);
            // Auto-sink palisade logs when the player approaches a wall.
            // FenceSides + player + per-side collider IDs are wired in
            // loadLevel() (after the level is loaded and each side reveals).
            this.palisadeGateSystem = new PalisadeGateSystem(this.ecs);
        } else {
            this.audio = null;
            this.prototypeStats = null;
            this.nextStepIndicator = null;
            this.palisadeGateSystem = null;
        }
        this.prototypeStateMachine = null;
        this.prototypeEndUI = null;

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

        this.combatVFXSystem = new CombatVFXSystem(this.scene.instance);

        this.lungeAnimSystem = new LungeAnimSystem(this.particleSystem, this.combatVFXSystem);
        this.lungeAnimSystem.setECS(this.ecs);

        // BurningSystem — Magma-breath fire DoT + emissive tint + body
        // embers on burning entities. Listens to entity:ignited from
        // ContactDamageSystem (when ContactDamage.applyBurning is set).
        this.burningSystem = new BurningSystem(this.ecs, this.combatVFXSystem);
        this.ecs.registerSystem(this.burningSystem, ['Transform', 'Burning']);

        // BleedingSystem — Sharpshooter pierce DoT + crimson emissive
        // tint. Listens to entity:bled from ContactDamageSystem (when
        // ContactDamage.applyBleeding is set on a pierce attack).
        this.bleedingSystem = new BleedingSystem(this.ecs);
        this.ecs.registerSystem(this.bleedingSystem, ['Transform', 'Bleeding']);

        this.spitterSystem = new SpitterSystem(this.scene.instance, this.particleSystem);
        this.spitterSystem.setECS(this.ecs);
        this.ecs.registerSystem(this.spitterSystem, ['Transform', 'Spitter']);

        this.poisonCloudSystem = new PoisonCloudSystem(this.scene.instance, this.particleSystem);
        this.poisonCloudSystem.setECS(this.ecs);

        // Blood splatter on any combatant hit — zombies bleed when struck,
        // player/allies bleed when bitten. Skips inert targets (trees, walls,
        // rocks) and silent damage (poison gas ticks).
        EventBus.on('entity:damaged', ({ entityId, silent }) => {
            if (silent) return;
            const movement = this.ecs.getComponent(entityId, 'Movement');
            if (!movement) return;
            const f = movement.faction;
            if (f !== 'enemy' && f !== 'player' && f !== 'ally') return;
            const tr = this.ecs.getComponent(entityId, 'Transform');
            if (tr?.mesh) this.particleSystem.createBloodSplatter(tr.mesh.position);
        });

        this.buildSystem = new BuildSystem(this.scene.instance, this.factory, this.particleSystem);
        this.buildSystem.setECS(this.ecs);
        this.ecs.registerSystem(this.buildSystem, ['Transform', 'Tag']);

        // OnSpawn — one-shot helper that lets a freshly-built anchor entity
        // (e.g. worker-pad-active) spawn N child entities at offsets and then
        // detach itself. Cheap when no entity has the component, so registered
        // globally rather than gated on prototype mode.
        this.onSpawnSystem = new OnSpawnSystem(this.factory);
        this.ecs.registerSystem(this.onSpawnSystem, ['Transform', 'OnSpawn']);

        // Pathfinder — A* utility reserved for stuck-fallback in WorkerAISystem.
        // PR #3.2 keeps direct steering as the primary path; the pathfinder
        // is wired up so a future PR can flip the switch without touching
        // the AI's main loop.
        this.pathfinder = new Pathfinder({ minX: -16, maxX: 16, minZ: -16, maxZ: 16, cell: 1 });

        // WorkerAISystem — Act 3 automation FSM (wood / essence / builder).
        // Needs the CollectorSystem reference so the essence-collector can
        // discover ground disks for its siphon-beam targeting.
        this.workerAISystem = new WorkerAISystem(this.scene.instance, this.pathfinder, this.collectorSystem);
        this.ecs.registerSystem(this.workerAISystem, ['Transform', 'WorkerAI', 'InventoryStack']);

        // RoleIconSystem — small floating icons above each worker for
        // role-at-a-glance debug visibility (3 concurrent FSMs).
        this.roleIconSystem = new RoleIconSystem(this.scene.instance);
        this.ecs.registerSystem(this.roleIconSystem, ['Transform', 'WorkerAI']);

        // Storage visuals — drop-in via the standard StackSystem (already
        // registered for the player). Storage props get InventoryStack so
        // their visible stack renders identically to the player's.

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
        const { grid, levelData, gridOverlay, fenceGroup, fenceEdges, fenceSides, propEntities, machines } =
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
        // Use the prototype-tuned player (HP 100) under ?prototype; legacy
        // and diorama keep the unmodified player.json (HP 10).
        this.playerId = this._prototype
            ? this.factory.create('player-prototype', this.playerSpawnPos.clone())
            : this.factory.createPlayer(this.playerSpawnPos.clone());
        const playerTransform = this.ecs.getComponent(this.playerId, 'Transform');

        // Prototype counters need the player ID for stack:changed filter.
        if (this.prototypeStats) this.prototypeStats.setPlayer(this.playerId);
        if (this.nextStepIndicator) this.nextStepIndicator.setPlayerId(this.playerId);
        if (this.palisadeGateSystem) this.palisadeGateSystem.setPlayer(this.playerId);

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

        // Crowd separation — runs AFTER all AI movement so it nudges
        // post-AI positions apart instead of fighting steering. Same-faction
        // only; cross-faction spacing is handled separately at attack range.
        this.separationSystem = new SeparationSystem();
        this.ecs.registerSystem(this.separationSystem, ['Transform', 'Movement']);

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
                // Skip inline string docs (matches the diorama loader pattern).
                if (typeof def === 'string') continue;
                const pos = new THREE.Vector3(def.position.x, def.position.y, def.position.z);

                // Optional rotationY (radians). When ~±π/2, swap the
                // box collider's width/depth so the AABB still hugs the
                // rotated mesh. Used by the prototype's W/E wall segments.
                let overrides = {};
                if (def.rotationY != null) {
                    const quarter = Math.abs(Math.abs(def.rotationY) - Math.PI / 2) < 0.05;
                    if (quarter) {
                        const arch = getArchetype(def.archetype);
                        const c = arch?.components?.Collider;
                        if (c?.shape === 'box') {
                            overrides.Collider = {
                                shape: 'box',
                                width: c.depth,
                                depth: c.width,
                                isStatic: c.isStatic
                            };
                        }
                    }
                }

                const id = this.factory.create(def.archetype, pos, overrides);

                if (def.rotationY != null) {
                    const tr = this.ecs.getComponent(id, 'Transform');
                    if (tr?.mesh) tr.mesh.rotation.y = def.rotationY;
                }

                // If the entity has HeroAI, plant homePosition at the spawn
                // pos so it guards from where it was placed (not the
                // default (0,0,0) which would point everyone at the origin).
                const heroAI = this.ecs.getComponent(id, 'HeroAI');
                if (heroAI) heroAI.homePosition.copy(pos);
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

                // PR #4.4 — per-zone mesh override. Default = generic
                // unlock-turret look; military bases (scout/bruiser pads)
                // pass `meshArchetype` to swap in a proper building mesh
                // while still using UnlockZoneSystem for the spawn drain.
                const zoneArchetype = zoneDef.meshArchetype
                    || (this._prototype ? 'unlock-turret-prototype' : 'unlock-turret');
                const zoneEntityId = this.factory.create(zoneArchetype, pos, {
                    UnlockZone: {
                        type: zoneDef.type,
                        cost: zoneDef.cost,
                        builds: zoneDef.builds || null,
                        spawns: zoneDef.spawns || null,
                        spawnCount: zoneDef.count || zoneDef.spawnCount || 1,
                        // Optional drain tuning per-zone (PR #4.4 military bases
                        // override default 0.15 → 0.05 for snappy auto-drop feel).
                        drainRate: zoneDef.drainRate,
                        range: zoneDef.range,
                        output: zoneDef.output || null,
                        outputTag: zoneDef.outputTag || null,
                        outputTarget,
                        outputCount: zoneDef.outputCount || 1,
                        buildsAt,
                        spawnsAt
                    }
                });

                // Optional: tag for state-machine-driven activation.
                // PrototypeStateMachine action `factory.activateGhost <tag>`
                // queries entities by Tag and toggles mesh.visible.
                if (zoneDef.tag) {
                    const tagComp = this.ecs.getComponent(zoneEntityId, 'Tag');
                    if (tagComp) tagComp.tags.push(zoneDef.tag);
                }

                // Optional: pre-hide the zone (and its ghost mesh + UI).
                // UnlockZoneSystem skips hidden zones in its per-frame loop,
                // so they don't drain or render until the state machine
                // toggles visible=true via factory.activateGhost.
                if (zoneDef.hidden) {
                    const transform = this.ecs.getComponent(zoneEntityId, 'Transform');
                    if (transform?.mesh) transform.mesh.visible = false;
                }
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
        // Two paths:
        //   • Legacy fence (fence.cells) → bulk-create all colliders at boot.
        //   • Staged fence (fence.sides with named sides) → hide all sides
        //     at boot, defer collider creation until each side's
        //     `fence:revealSide` event fires (driven by zone:built tags).
        const sideNames = fenceSides ? Object.keys(fenceSides) : [];
        const useStagedFence = sideNames.length > 0 && !sideNames.every(n => n === '_all');

        const fenceColliderIds = [];
        const makeEdgeColliders = (edges) => {
            const ids = [];
            for (const edge of edges) {
                const obj = new THREE.Object3D();
                obj.position.set(edge.x, 0, edge.z);
                const id = this.ecs.createEntity();
                this.ecs.addComponent(id, 'Transform', new Component_Transform(obj));
                this.ecs.addComponent(id, 'Collider', new Component_Collider({
                    shape: 'box', width: edge.width, depth: edge.depth, isStatic: true
                }));
                ids.push(id);
                fenceColliderIds.push(id);
            }
            return ids;
        };

        if (useStagedFence) {
            // Hide every named side at boot. Each side's group + colliders
            // are revealed lazily by 'fence:revealSide' (fired from
            // zone:built tag listeners below).
            this._fenceSideColliders = new Map(); // sideName → [colliderId, ...]
            this._fenceSides = fenceSides;
            for (const [name, data] of Object.entries(fenceSides)) {
                if (data?.group) data.group.visible = false;
            }
            if (this.palisadeGateSystem) this.palisadeGateSystem.setFenceSides(fenceSides);

            // PR #4.3 — wall reveals are now animated. Logs start sunk
            // 1.8u below ground and rise to y=0 over 6 seconds while the
            // builder stands at the site (BUILDING state). Tweens are
            // ticked from animate() via _tickWallRise.
            this._risingWalls = new Map();   // side → { startMs, duration }
            const SINK_DEPTH = 1.8;
            const RISE_SECONDS = 6.0;

            const revealSide = (side) => {
                const data = this._fenceSides?.[side];
                if (!data || data.group.visible) return;
                data.group.visible = true;
                data.group.position.y = -SINK_DEPTH;
                this._risingWalls.set(side, { startMs: performance.now(), duration: RISE_SECONDS });
                const ids = makeEdgeColliders(data.edges || []);
                this._fenceSideColliders.set(side, ids);
                if (this.palisadeGateSystem) this.palisadeGateSystem.registerSide(side, ids);
            };

            EventBus.on('fence:revealSide', ({ side }) => revealSide(side));
            EventBus.on('zone:built', ({ tags }) => {
                if (!Array.isArray(tags)) return;
                if (tags.includes('north_wall_zone')) revealSide('north');
                if (tags.includes('south_wall_zone')) revealSide('south');
                if (tags.includes('east_wall_zone'))  revealSide('east');
                if (tags.includes('west_wall_zone'))  revealSide('west');
            });
        } else {
            // Legacy path — all edges become colliders immediately.
            makeEdgeColliders(fenceEdges);
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

        // --- Prototype state machine (only in ?prototype mode) ---
        // Loaded last so it can reference enemySystem, factory, and the
        // already-created player. JSON config drives 15-state FSM per
        // newGameDesign/PROTOTYPE_PLAN.md §4 (foundation stub: 2-state demo).
        if (this._prototype) {
            const cfgRes = await fetch('./src/config/prototypeStates.json');
            const cfg = await cfgRes.json();
            this.prototypeStateMachine = new PrototypeStateMachine({
                ecs: this.ecs,
                factory: this.factory,
                enemySystem: this.enemySystem,
                audio: this.audio,
                scene: this.scene.instance,
                camera: this.camera.instance,
                playerId: this.playerId,
                indicator: this.nextStepIndicator
            }, cfg);
            this.prototypeEndUI = new PrototypeEndUI(this.prototypeStats);
            // Wire indicator BEFORE start() so it captures the first state:entered emit.
            if (this.nextStepIndicator) this.nextStepIndicator.setStateMachine(this.prototypeStateMachine);
            this.prototypeStateMachine.start();
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

        // 1b. Wall rise animation — logs lerp from y=-1.8 to y=0 over 6s
        // after their zone gets funded. Eased (cubic-out) so they settle
        // smoothly into place rather than slamming up.
        this._tickWallRise(deltaTime);

        // 2. Non-ECS visual systems — camera shake still runs (we want the
        // shake visible during freeze); particles/effects pause with gameplay.
        this.cameraSystem.update(realDt);
        this.particleSystem.update(deltaTime);
        this.lungeAnimSystem.update(deltaTime);
        this.combatVFXSystem.update(deltaTime);
        this.poisonCloudSystem.update(deltaTime);
        this.skillEffectSystem.update(deltaTime);
        this.harvestNodeSystem.update(deltaTime);
        if (this.prototypeStateMachine) this.prototypeStateMachine.update(deltaTime);
        if (this.nextStepIndicator) this.nextStepIndicator.update(deltaTime);
        if (this.palisadeGateSystem) this.palisadeGateSystem.update(deltaTime);
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

    _tickWallRise(_dt) {
        if (!this._risingWalls || this._risingWalls.size === 0) return;
        const now = performance.now();
        for (const [side, info] of this._risingWalls) {
            const data = this._fenceSides?.[side];
            if (!data?.group) { this._risingWalls.delete(side); continue; }
            const t = Math.min(1, (now - info.startMs) / (info.duration * 1000));
            // Ease-out cubic for a satisfying settle
            const eased = 1 - Math.pow(1 - t, 3);
            data.group.position.y = -1.8 * (1 - eased);
            if (t >= 1) {
                data.group.position.y = 0;
                this._risingWalls.delete(side);
            }
        }
    }

    _updateDebugOverlay() {
        // Hidden in ?prototype mode — would cover the joystick (both pinned to bottom-left).
        if (this._prototype) return;
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
    const levelPath = isPrototypeMode()
        ? './src/config/levels/level-prototype.json'
        : isDioramaMode()
            ? './src/config/levels/level-1-diorama.json'
            : './src/config/levels/level-1.json';
    await game.loadLevel(levelPath);
    game.animate();
});
