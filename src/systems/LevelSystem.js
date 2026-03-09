import * as THREE from 'three';
import { UnlockZone } from '../entities/UnlockZone.js';
import { Turret } from '../entities/Turret.js';
import { Wall } from '../entities/Wall.js';
import { Gate } from '../entities/Gate.js';
import { TURRET_CONFIG, WALL_CONFIG } from '../config/gameConfig.js';

export class LevelSystem {
    constructor(scene, drainSystem, particleSystem, combatSystem, player) {
        this.scene = scene;
        this.drainSystem = drainSystem;
        this.particleSystem = particleSystem;
        this.combatSystem = combatSystem;
        this.player = player;
        this.activeStructures = [];
        this.gates = [];
    }

    initLevel(level = 1) {
        if (level === 1) {
            // New 20-coin zone perfectly inside the bottom-left dirt notch
            this.createZone(new THREE.Vector3(-5, 0, 7), 'Turret', 20);

            // Animated Gate exactly in the front fence gap
            const gate = new Gate(this.scene, new THREE.Vector3(3.6, 0, 9), 2.4);
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

        let structure;
        if (type === 'Turret') {
            structure = new Turret(this.scene, position);
            // Connect turret fire to combat system projectile pooling
            structure.onFire = (pos, dir) => {
                this.combatSystem.fireProjectile(pos, dir);
            };
        } else {
            structure = new Wall(this.scene, position);
        }

        this.activeStructures.push(structure);
    }

    update(deltaTime, enemies) {
        for (const struct of this.activeStructures) {
            if (struct.update) {
                struct.update(deltaTime, enemies);
            }
        }

        for (const gate of this.gates) {
            gate.update(deltaTime, this.player.position);
        }
    }
}
