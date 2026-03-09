import * as THREE from 'three';
import { UnlockZone } from '../entities/UnlockZone.js';
import { Turret } from '../entities/Turret.js';
import { Wall } from '../entities/Wall.js';
import { TURRET_CONFIG, WALL_CONFIG } from '../config/gameConfig.js';

export class LevelSystem {
    constructor(scene, drainSystem, particleSystem, combatSystem) {
        this.scene = scene;
        this.drainSystem = drainSystem;
        this.particleSystem = particleSystem;
        this.combatSystem = combatSystem;
        this.activeStructures = [];
    }

    initLevel(level = 1) {
        if (level === 1) {
            // First Turret Zone — inside base, right-center
            this.createZone(new THREE.Vector3(4, 0, -3), 'Turret', TURRET_CONFIG.cost);

            // Wall Zones — inside base, near back edge
            this.createZone(new THREE.Vector3(-4, 0, 6), 'Wall', WALL_CONFIG.cost);
            this.createZone(new THREE.Vector3(0, 0, 6), 'Wall', WALL_CONFIG.cost);
            this.createZone(new THREE.Vector3(4, 0, 6), 'Wall', WALL_CONFIG.cost);
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
    }
}
