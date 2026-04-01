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
};

// Mesh colors per archetype type
const MESH_COLORS = {
    Player:    0x3366ff,
    Enemy:     0xff3333,
    Speeder:   0xff6600,
    Tank:      0x880000,
    Villager:  0x44bb44,
    Turret:    0x888888,
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
        const mesh = this._createMesh(archetype.type, pos);

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

    _createMesh(type, pos) {
        const isCharacter = ['Player', 'Enemy', 'Speeder', 'Tank', 'Villager'].includes(type);
        const isTable = ['MeatTable', 'CoinTray'].includes(type);

        let mesh;
        if (isCharacter) {
            mesh = this._createCharacterMesh(MESH_COLORS[type] ?? 0xaaaaaa);
        } else if (isTable) {
            mesh = this._createTableMesh();
        } else {
            // Generic box fallback for Turret, Wall, etc.
            const geo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
            const mat = new THREE.MeshStandardMaterial({ color: MESH_COLORS[type] ?? 0x999999 });
            mesh = new THREE.Mesh(geo, mat);
        }

        mesh.position.copy(pos);
        this.scene.add(mesh);
        return mesh;
    }

    _createCharacterMesh(color) {
        const group = new THREE.Group();

        const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.5;
        body.castShadow = true;
        group.add(body);

        const headGeo = new THREE.SphereGeometry(0.2, 8, 6);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.6 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.1;
        head.castShadow = true;
        group.add(head);

        const eyeGeo = new THREE.SphereGeometry(0.05, 4, 4);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.08, 1.12, 0.18);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.08, 1.12, 0.18);
        group.add(rightEye);

        return group;
    }

    _createTableMesh() {
        const group = new THREE.Group();
        const boxGeo = new THREE.BoxGeometry(2, 0.6, 1);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const top = new THREE.Mesh(boxGeo, boxMat);
        top.position.y = 0.3;
        group.add(top);
        return group;
    }
}
