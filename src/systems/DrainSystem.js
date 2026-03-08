import * as THREE from 'three';
import { ZONE_CONFIG } from '../config/gameConfig.js';

export class DrainSystem {
    constructor(scene, player, stackSystem, floatingUI) {
        this.scene = scene;
        this.player = player;
        this.stackSystem = stackSystem;
        this.floatingUI = floatingUI;
        this.zones = [];
        this.drainTimer = 0;
    }

    addZone(zone) {
        this.zones.push(zone);
    }

    update(deltaTime) {
        this.drainTimer += deltaTime;

        for (const zone of this.zones) {
            if (zone.isCompleted) {
                continue;
            }

            zone.update(deltaTime);

            const dist = this.player.position.distanceTo(zone.position);
            // Use size for collision check (simple radius check is usually fine even for squares)
            if (dist < ZONE_CONFIG.size * 0.7) {
                this.handleDrain(zone);
            }
        }
    }

    handleDrain(zone) {
        if (this.drainTimer >= ZONE_CONFIG.drainRate) {
            const disk = this.stackSystem.popDisk();
            if (disk) {
                this.drainTimer = 0;
                this.animateDiskToZone(disk, zone);

                zone.drain(1);
            }
        }
    }

    animateDiskToZone(disk, zone) {
        const startPos = disk.position.clone();
        const targetPos = zone.position.clone();
        targetPos.y = 0;

        const duration = 0.5;
        let time = 0;

        const animate = () => {
            time += 0.016; // Approx 60fps
            const t = Math.min(time / duration, 1);

            // Parabolic path
            const currentPos = new THREE.Vector3().lerpVectors(startPos, targetPos, t);
            const height = Math.sin(t * Math.PI) * 3.0;
            currentPos.y += height;

            disk.position.copy(currentPos);

            // Spin and shrink
            disk.rotation.x += 0.2;
            disk.rotation.y += 0.2;
            const scale = 1.0 - (t * 0.8);
            disk.scale.set(scale, scale, scale);

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(disk);
                if (disk.geometry) disk.geometry.dispose();
                if (disk.material) disk.material.dispose();
            }
        };

        animate();
    }
}
