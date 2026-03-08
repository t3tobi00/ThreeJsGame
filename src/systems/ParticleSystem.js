import * as THREE from 'three';
import { COLORS_P3, PARTICLE_CONFIG } from '../config/gameConfig.js';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.activeSystems = [];
    }

    createBurst(position, count = PARTICLE_CONFIG.burstCount) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = [];

        for (let i = 0; i < count; i++) {
            // Initial position relative to points mesh
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                Math.random() * 10 + 2,
                (Math.random() - 0.5) * 8
            );
            velocities.push(vel);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: COLORS_P3.particle,
            size: PARTICLE_CONFIG.size,
            transparent: true,
            opacity: 1.0,
            sizeAttenuation: true
        });

        const points = new THREE.Points(geometry, material);
        points.position.copy(position);
        points.position.y += 0.5; // Start slightly above floor
        this.scene.add(points);

        this.activeSystems.push({
            points,
            velocities,
            time: 0,
            duration: PARTICLE_CONFIG.duration
        });
    }

    update(deltaTime) {
        for (let i = this.activeSystems.length - 1; i >= 0; i--) {
            const sys = this.activeSystems[i];
            sys.time += deltaTime;

            const posAttr = sys.points.geometry.attributes.position;
            const positions = posAttr.array;

            for (let j = 0; j < sys.velocities.length; j++) {
                const v = sys.velocities[j];

                positions[j * 3] += v.x * deltaTime;
                positions[j * 3 + 1] += v.y * deltaTime;
                positions[j * 3 + 2] += v.z * deltaTime;

                // Gravity
                v.y -= 25.0 * deltaTime;
                // Friction
                v.multiplyScalar(0.98);
            }

            posAttr.needsUpdate = true;

            // Fade
            sys.points.material.opacity = Math.max(0, 1.0 - (sys.time / sys.duration));

            if (sys.time >= sys.duration) {
                this.scene.remove(sys.points);
                sys.points.geometry.dispose();
                sys.points.material.dispose();
                this.activeSystems.splice(i, 1);
            }
        }
    }
}
