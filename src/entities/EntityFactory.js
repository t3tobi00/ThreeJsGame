import * as THREE from 'three';
import { getArchetype } from '../core/ArchetypeLoader.js';
import { Component_Transform } from '../ecs/components/Component_Transform.js';
import { Component_Movement } from '../ecs/components/Component_Movement.js';
import { Component_InventoryStack } from '../ecs/components/Component_InventoryStack.js';
import { Component_Shooter } from '../ecs/components/Component_Shooter.js';
import { Component_Health } from '../ecs/components/Component_Health.js';
import { Component_Collector } from '../ecs/components/Component_Collector.js';
import { Component_Depositor } from '../ecs/components/Component_Depositor.js';
import { Component_Trader } from '../ecs/components/Component_Trader.js';
import { Component_AgentAI } from '../ecs/components/Component_AgentAI.js';
import { Component_Tag } from '../ecs/components/Component_Tag.js';
import { Component_FlyToAnim } from '../ecs/components/Component_FlyToAnim.js';
import { Component_SpringStackAnim } from '../ecs/components/Component_SpringStackAnim.js';
import { Component_WalkAnim } from '../ecs/components/Component_WalkAnim.js';
import { Component_FlashAnim } from '../ecs/components/Component_FlashAnim.js';
import { Component_SquashStretch } from '../ecs/components/Component_SquashStretch.js';
import { Component_SpawnAnim } from '../ecs/components/Component_SpawnAnim.js';
import { Component_UnlockZone } from '../ecs/components/Component_UnlockZone.js';
import { Component_Gate } from '../ecs/components/Component_Gate.js';
import { Component_ContactDamage } from '../ecs/components/Component_ContactDamage.js';
import { Component_Spitter } from '../ecs/components/Component_Spitter.js';
import { Component_Drops } from '../ecs/components/Component_Drops.js';
import { Component_EnemyAI } from '../ecs/components/Component_EnemyAI.js';
import { Component_HeroAI } from '../ecs/components/Component_HeroAI.js';
import { Component_Collider } from '../ecs/components/Component_Collider.js';
import { Component_ZoneStatus } from '../ecs/components/Component_ZoneStatus.js';
import { Component_InstanceRef } from '../ecs/components/Component_InstanceRef.js';
import { Component_SkillLoadout } from '../ecs/components/Component_SkillLoadout.js';
import { Component_SkillState } from '../ecs/components/Component_SkillState.js';
import { Component_Arms } from '../ecs/components/Component_Arms.js';
import { Component_Animator } from '../ecs/components/Component_Animator.js';
import { Component_Harvestable } from '../ecs/components/Component_Harvestable.js';
import { Component_Machine } from '../ecs/components/Component_Machine.js';
import { Component_Stall } from '../ecs/components/Component_Stall.js';
import { Component_Customer } from '../ecs/components/Component_Customer.js';
import { Component_RoadPath } from '../ecs/components/Component_RoadPath.js';
import { Component_DragCommandable } from '../ecs/components/Component_DragCommandable.js';
import { Component_Waypoints } from '../ecs/components/Component_Waypoints.js';
import { Component_BehaviorState } from '../ecs/components/Component_BehaviorState.js';
import { Component_OnSpawn } from '../ecs/components/Component_OnSpawn.js';
import { Component_Stockpile } from '../ecs/components/Component_Stockpile.js';
import { Component_WorkerAI } from '../ecs/components/Component_WorkerAI.js';
import MeshPresets from '../core/MeshPresets.js';
import ResourceRegistry from '../core/ResourceRegistry.js';
import EventBus from '../core/EventBus.js';

// Map component name strings (from JSON) → constructor functions
const COMPONENT_MAP = {
    Movement:        (d) => new Component_Movement(d),
    Shooter:         (d) => new Component_Shooter(d),
    Health:          (d) => new Component_Health(d),
    Collector:       (d) => new Component_Collector(d),
    InventoryStack:  (d) => new Component_InventoryStack(d),
    Depositor:       (d) => new Component_Depositor(d),
    Trader:          (d) => new Component_Trader(d),
    AgentAI:         (d) => new Component_AgentAI(d),
    Tag:             (d) => new Component_Tag(d),
    FlyToAnim:       (d) => new Component_FlyToAnim(d),
    SpringStackAnim: (d) => new Component_SpringStackAnim(d),
    WalkAnim:        (d) => new Component_WalkAnim(d),
    FlashAnim:       (d) => new Component_FlashAnim(d),
    SquashStretch:   (d) => new Component_SquashStretch(d),
    SpawnAnim:       (d) => new Component_SpawnAnim(d),
    UnlockZone:      (d) => new Component_UnlockZone(d),
    Gate:            (d) => new Component_Gate(d),
    ContactDamage:   (d) => new Component_ContactDamage(d),
    Spitter:         (d) => new Component_Spitter(d),
    Drops:           (d) => new Component_Drops(d),
    EnemyAI:         (d) => new Component_EnemyAI(d),
    HeroAI:          (d) => new Component_HeroAI(d),
    Collider:        (d) => new Component_Collider(d),
    ZoneStatus:      ()  => new Component_ZoneStatus(),
    SkillLoadout:    (d) => new Component_SkillLoadout(d),
    SkillState:      ()  => new Component_SkillState(),
    Arms:            ()  => new Component_Arms(),
    Animator:        ()  => new Component_Animator(),
    Harvestable:     (d) => new Component_Harvestable(d),
    Machine:         (d) => new Component_Machine(d),
    Stall:           (d) => new Component_Stall(d),
    Customer:        (d) => new Component_Customer(d),
    RoadPath:        (d) => new Component_RoadPath(d),
    DragCommandable: (d) => new Component_DragCommandable(d),
    Waypoints:       (d) => new Component_Waypoints(d),
    BehaviorState:   (d) => new Component_BehaviorState(d),
    OnSpawn:         (d) => new Component_OnSpawn(d),
    Stockpile:       (d) => new Component_Stockpile(d),
    WorkerAI:        (d) => new Component_WorkerAI(d),
};


export class EntityFactory {
    constructor(scene, ecs) {
        this.scene = scene;
        this.ecs = ecs;
        this._instancePools = {};  // archetype type → InstancedCharacterPool
    }

    /**
     * Register instanced pools for character types.
     * @param {Object} pools Map of archetype type (lowercase) → InstancedCharacterPool
     */
    setInstancePools(pools) {
        this._instancePools = pools;
    }

    /**
     * Create an entity from a named archetype.
     * @param {string} archetypeName e.g. 'player', 'enemy', 'villager'
     * @param {THREE.Vector3} pos Initial world position
     * @param {object} [overrides] Optional component overrides (merged on top of archetype)
     * @returns {number} ECS entity ID
     */
    create(archetypeName, pos, overrides = {}) {
        const archetype = getArchetype(archetypeName);
        const id = this.ecs.createEntity();

        // Extract _meshOpts (extra options passed to MeshPresets.create, not a component)
        const meshOpts = overrides._meshOpts || null;
        if (overrides._meshOpts) {
            overrides = { ...overrides };
            delete overrides._meshOpts;
        }

        // Try instanced pool for character-preset archetypes
        const poolKey = archetype.type?.toLowerCase();
        const pool = (archetype.mesh?.preset === 'character') ? this._instancePools[poolKey] : null;
        let instanceRef = null;

        let mesh;
        if (pool && pool.hasFreeSlots) {
            // Use instanced pool — proxy Object3D, no scene.add needed
            const slot = pool.allocate(pos);
            mesh = slot.proxy;
            instanceRef = new Component_InstanceRef(pool, slot.index);
        } else {
            // Fallback to individual mesh (player, gates, or pool full)
            mesh = this._createMesh(archetype, pos, meshOpts);
            // Optional resource-icon attached above the mesh (e.g. wood/essence
            // storage pads use this to show what they hold even when empty).
            if (archetype.iconResource) this._attachResourceIcon(mesh, archetype.iconResource);
        }

        // Always add Transform (works with both real mesh and proxy)
        this.ecs.addComponent(id, 'Transform', new Component_Transform(mesh));

        // Add InstanceRef if this entity is instanced
        if (instanceRef) {
            this.ecs.addComponent(id, 'InstanceRef', instanceRef);
        }

        // Add all components defined in the archetype
        const components = { ...archetype.components, ...overrides };
        for (const [name, data] of Object.entries(components)) {
            if (name === 'Transform') continue; // already handled
            const factory = COMPONENT_MAP[name];
            if (!factory) {
                console.warn(`EntityFactory: unknown component '${name}' in archetype '${archetypeName}'`);
                continue;
            }
            this.ecs.addComponent(id, name, factory(data));
        }

        // Populate Harvestable with archetype name + spawn position so
        // HarvestNodeSystem can respawn this node after it dies.
        const harvestable = this.ecs.getComponent(id, 'Harvestable');
        if (harvestable) {
            harvestable.archetypeName = archetypeName;
            harvestable.spawnPos = pos.clone();
        }

        // Wire Component_Arms to the named limb pivots built into the mesh preset
        // (e.g. 'character-player'). PlayerAnimSystem reads these refs to swing arms.
        if (!instanceRef && this.ecs.getComponent(id, 'Arms')) {
            const armsComp = this.ecs.getComponent(id, 'Arms');
            armsComp.leftArm  = mesh.getObjectByName('leftArm')  || null;
            armsComp.rightArm = mesh.getObjectByName('rightArm') || null;
        }

        // Wire Component_Machine — populate from mesh.userData, create proxy
        // at pad position for proximity detection.
        const machineComp = this.ecs.getComponent(id, 'Machine');
        if (machineComp && mesh.userData) {
            const ud = mesh.userData;
            machineComp.machineMesh = mesh;
            machineComp.inputCounters = ud.inputCounters || [];
            machineComp.outputLocalCenter = ud.outputLocalCenter || null;
            machineComp.outputDisplayGroup = ud.outputDisplayGroup || null;

            // Create proxy Object3D at standing pad's world position
            // so UnlockZoneSystem proximity checks work at the pad, not mesh center.
            if (ud.padLocalCenter) {
                const padWorld = new THREE.Vector3(ud.padLocalCenter.x, 0, ud.padLocalCenter.z);
                mesh.localToWorld(padWorld);

                const proxy = new THREE.Object3D();
                proxy.position.copy(padWorld);
                this.scene.add(proxy);

                // Swap Transform to use proxy for proximity detection
                const transform = this.ecs.getComponent(id, 'Transform');
                transform.mesh = proxy;
                transform.position = proxy.position;
                transform.rotation = proxy.rotation;
                transform.scale = proxy.scale;
            }
        }

        // Emit spawn event
        EventBus.emit('entity:spawned', { entityId: id, type: archetype.type });

        return id;
    }

    /** Convenience aliases kept for backward compatibility during migration */
    createPlayer(pos) { return this.create('player', pos); }
    createEnemy(pos)  { return this.create('enemy', pos); }
    createVillager(pos) { return this.create('villager', pos); }

    /**
     * Create a static storage node (meat table or coin tray).
     * Returns the ECS entity ID.
     */
    createTable(pos, archetypeName = 'meat-table') {
        return this.create(archetypeName, pos);
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    _createMesh(archetype, pos, meshOpts = null) {
        let mesh;
        if (archetype.mesh && archetype.mesh.preset) {
            const opts = { ...archetype.mesh, ...(meshOpts || {}) };
            if (typeof opts.color === 'string') {
                opts.color = parseInt(opts.color, 16);
            }
            mesh = MeshPresets.create(opts.preset, opts);
        } else {
            const geo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
            const mat = new THREE.MeshStandardMaterial({ color: 0x999999 });
            mesh = new THREE.Mesh(geo, mat);
        }

        mesh.position.copy(pos);
        if (meshOpts && meshOpts.rotY) {
            mesh.rotation.y = meshOpts.rotY;
        }
        this.scene.add(mesh);
        return mesh;
    }

    /**
     * Clone the actual resource mesh (the same wood-log / essence-tube the
     * player carries) and float it above the parent mesh as a labeling icon.
     * Driven by archetype.iconResource: { type, height?, scale?, state? }.
     */
    _attachResourceIcon(parentMesh, spec) {
        const type   = spec.type;
        const height = spec.height ?? 1.6;
        const scale  = spec.scale  ?? 2.0;
        const state  = spec.state  ?? 'stacked';
        if (!type) return;

        const icon = ResourceRegistry.createMesh(type, state);
        if (!icon) return;

        icon.position.set(0, height, 0);
        icon.scale.set(scale, scale, scale);
        icon.name = 'resourceIcon';
        // Skip raycast so clicks/hovers fall through to the underlying pad.
        icon.traverse(c => { c.raycast = () => {}; });
        parentMesh.add(icon);
    }
}
