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
import { Component_Drops } from '../ecs/components/Component_Drops.js';
import { Component_Market } from '../ecs/components/Component_Market.js';
import { Component_Shop } from '../ecs/components/Component_Shop.js';
import MeshPresets from '../core/MeshPresets.js';
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
    Drops:           (d) => new Component_Drops(d),
    Market:          (d) => new Component_Market(d),
    Shop:            (d) => new Component_Shop(d),
};


export class EntityFactory {
    constructor(scene, ecs) {
        this.scene = scene;
        this.ecs = ecs;
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

        // Build the mesh
        const mesh = this._createMesh(archetype, pos);

        // Always add Transform
        this.ecs.addComponent(id, 'Transform', new Component_Transform(mesh));

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

    _createMesh(archetype, pos) {
        let mesh;
        if (archetype.mesh && archetype.mesh.preset) {
            const opts = { ...archetype.mesh };
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
        this.scene.add(mesh);
        return mesh;
    }
}
