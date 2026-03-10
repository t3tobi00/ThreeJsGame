import * as THREE from 'three';
import { Component_Transform } from '../ecs/components/Component_Transform.js';
import { Component_Movement } from '../ecs/components/Component_Movement.js';
import { Component_InventoryStack } from '../ecs/components/Component_InventoryStack.js';
import { Component_Shooter } from '../ecs/components/Component_Shooter.js';
import { Component_TransactionLogic } from '../ecs/components/Component_TransactionLogic.js';
import { VILLAGER_CONFIG, COIN_CONFIG, SELLING_TABLE_POSITION } from '../config/gameConfig.js';

/**
 * EntityFactory — The central generator for all game objects.
 * 
 * Instead of separate classes, we define "Entity Archetypes" here.
 */
export class EntityFactory {
    constructor(scene, ecs) {
        this.scene = scene;
        this.ecs = ecs;
    }

    /** Helper to create a basic chunky capsule mesh (our standard character look). */
    _createCharacterMesh(color) {
        const group = new THREE.Group();

        // Body (Capsule)
        const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.5;
        body.castShadow = true;
        group.add(body);

        // Head (Sphere)
        const headGeo = new THREE.SphereGeometry(0.2, 8, 6);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.6 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.1;
        head.castShadow = true;
        group.add(head);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.05, 4, 4);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.08, 1.12, 0.18);
        group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.08, 1.12, 0.18);
        group.add(rightEye);

        this.scene.add(group);
        return group;
    }

    /** 
     * Archetype: Player
     * Blue, joystick-movable, shooter, wobbly stack.
     */
    createPlayer(pos) {
        const id = this.ecs.createEntity();
        const mesh = this._createCharacterMesh(0x3366ff);
        mesh.position.copy(pos);

        this.ecs.addComponent(id, 'Tag', 'player');
        this.ecs.addComponent(id, 'Transform', new Component_Transform(mesh));
        this.ecs.addComponent(id, 'Movement', new Component_Movement({
            speed: 10,
            controller: 'joystick',
            faction: 'player'
        }));
        this.ecs.addComponent(id, 'InventoryStack', new Component_InventoryStack({
            maxCapacity: 20,
            anchorOffset: { x: 0, y: 1.2, z: -0.25 },
            style: 'wobble'
        }));
        this.ecs.addComponent(id, 'Shooter', new Component_Shooter({
            targetFactions: ['enemy']
        }));

        return id;
    }

    /** 
     * Archetype: Enemy
     * Red, AI-steering toward player, hostile.
     */
    createEnemy(pos) {
        const id = this.ecs.createEntity();
        const mesh = this._createCharacterMesh(0xff3333);
        mesh.position.copy(pos);

        this.ecs.addComponent(id, 'Tag', 'enemy');
        this.ecs.addComponent(id, 'Transform', new Component_Transform(mesh));
        this.ecs.addComponent(id, 'Movement', new Component_Movement({
            speed: 4,
            controller: 'simple_steering',
            faction: 'enemy'
        }));

        return id;
    }

    /** 
     * Archetype: Villager
     * Green, AI-steering toward table, trades meat for coins.
     */
    createVillager(pos) {
        const id = this.ecs.createEntity();
        const mesh = this._createCharacterMesh(VILLAGER_CONFIG.color);
        mesh.position.copy(pos);

        this.ecs.addComponent(id, 'Tag', 'villager');
        this.ecs.addComponent(id, 'Transform', new Component_Transform(mesh));
        this.ecs.addComponent(id, 'Movement', new Component_Movement({
            speed: VILLAGER_CONFIG.speed,
            controller: 'simple_steering',
            faction: 'neutral'
        }));
        // Villagers start with coins on their head
        this.ecs.addComponent(id, 'InventoryStack', new Component_InventoryStack({
            maxCapacity: 10,
            anchorOffset: { x: 0, y: 1.4, z: 0 },
            style: 'wobble',
            acceptsTypes: ['coin', 'meat']
        }));

        return id;
    }

    /** 
     * Archetype: Storage Node (Meat Table / Coin Tray)
     * Static box that listens for transactions.
     */
    createTable(pos, type = 'meat') {
        const id = this.ecs.createEntity();

        // Simple visual table
        const group = new THREE.Group();
        const boxGeo = new THREE.BoxGeometry(2, 0.6, 1);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const tableTop = new THREE.Mesh(boxGeo, boxMat);
        tableTop.position.y = 0.3;
        group.add(tableTop);
        group.position.copy(pos);
        this.scene.add(group);

        this.ecs.addComponent(id, 'Tag', 'storage');
        this.ecs.addComponent(id, 'Transform', new Component_Transform(group));

        if (type === 'meat') {
            this.ecs.addComponent(id, 'InventoryStack', new Component_InventoryStack({
                maxCapacity: 50,
                anchorOffset: { x: 0, y: 0.6, z: 0 },
                style: 'rigid',
                acceptsTypes: ['meat']
            }));
            this.ecs.addComponent(id, 'TransactionLogic', new Component_TransactionLogic({
                receivesResource: 'meat',
                receivedFromTags: ['player'],
                givesResource: 'meat',
                givenToTags: ['villager']
            }));
        } else if (type === 'coin') {
            this.ecs.addComponent(id, 'InventoryStack', new Component_InventoryStack({
                maxCapacity: 100,
                anchorOffset: { x: 0, y: 0.05, z: 0 },
                style: 'rigid',
                acceptsTypes: ['coin']
            }));
            this.ecs.addComponent(id, 'TransactionLogic', new Component_TransactionLogic({
                receivesResource: 'coin',
                receivedFromTags: ['villager'],
                givesResource: 'coin',
                givenToTags: ['player']
            }));
        }

        return id;
    }
}
