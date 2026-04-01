import * as THREE from 'three';
import { UnlockZone } from '../entities/UnlockZone.js';
import { Gate } from '../entities/Gate.js';
import { TURRET_CONFIG, WALL_CONFIG, GATE_CONFIG } from '../config/gameConfig.js';

export class LevelSystem {
    constructor(scene, drainSystem, particleSystem, combatSystem, player, factory) {
        this.scene = scene;
        this.drainSystem = drainSystem;
        this.particleSystem = particleSystem;
        this.combatSystem = combatSystem;
        this.player = player;
        this.factory = factory;
        this.gates = [];
    }

    initLevel(level = 1) {
        if (level === 1) {
            // New 20-coin zone perfectly inside the bottom-left dirt notch
            this.createZone(new THREE.Vector3(-5, 0, 7), 'Turret', 20);

            // Animated Gate in the center of the front fence gap
            const gate = new Gate(
                this.scene,
                new THREE.Vector3(GATE_CONFIG.position.x, GATE_CONFIG.position.y, GATE_CONFIG.position.z),
                GATE_CONFIG.width
            );
            this.gates.push(gate);

            // First Turret Zone — inside base, right-center
            // this.createZone(new THREE.Vector3(4, 0, -3), 'Turret', TURRET_CONFIG.cost);

            // Wall Zones — inside base, near back edge
            // this.createZone(new THREE.Vector3(-4, 0, 6), 'Wall', WALL_CONFIG.cost);
            // this.createZone(new THREE.Vector3(0, 0, 6), 'Wall', WALL_CONFIG.cost);
            // this.createZone(new THREE.Vector3(4, 0, 6), 'Wall', WALL_CONFIG.cost);
        }
    }

    createZone(position, type, cost) {
        const zone = new UnlockZone(this.scene, position, type, cost, () => {
            this.onStructureBuilt(position, type);
        });
        this.drainSystem.addZone(zone);
    }

    onStructureBuilt(position, type) {
        this.particleSystem.createBurst(position);
        if (type === 'Turret') {
            this.factory.create('turret', position);
        } else if (type === 'Wall') {
            this.factory.create('wall', position);
        }
    }

    update(deltaTime, enemies) {
        for (const gate of this.gates) {
            gate.update(deltaTime, this.player.position);
        }
    }
}
