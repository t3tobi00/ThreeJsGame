import * as THREE from 'three';
import { COLORS_P3, PARTICLE_CONFIG } from '../config/gameConfig.js';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.activeSystems = [];
    }

    createBurst(position, count = PARTICLE_CONFIG.burstCount) {
        this._spawnBurst(position, {
            count,
            color: COLORS_P3.particle,
            size: PARTICLE_CONFIG.size,
            duration: PARTICLE_CONFIG.duration,
            yOffset: 0.5,
            velSpreadXZ: 8,
            velUpMin: 2,
            velUpRange: 10
        });
    }

    createBloodSplatter(position, count = 14) {
        this._spawnBurst(position, {
            count,
            color: 0xb40000,
            size: PARTICLE_CONFIG.size * 0.7,
            duration: 0.55,
            yOffset: 0.7,
            velSpreadXZ: 4.5,
            velUpMin: 1.0,
            velUpRange: 3.5
        });
    }

    createPoisonSplatter(position, count = 18) {
        this._spawnBurst(position, {
            count,
            color: 0x88ff44,
            size: PARTICLE_CONFIG.size * 0.85,
            duration: 0.7,
            yOffset: 0.6,
            velSpreadXZ: 5.0,
            velUpMin: 1.2,
            velUpRange: 4.0
        });
    }

    /**
     * Quick fan of bright sparks for a Scout slash hit (cyan default).
     * Light, snappy — sideways spread, almost no Y velocity.
     */
    createSlashSpark(position, color = 0x44eeff, count = 8) {
        this._spawnBurst(position, {
            count,
            color,
            size: PARTICLE_CONFIG.size * 1.2,
            duration: 0.30,
            yOffset: 0.0,
            velSpreadXZ: 6.0,
            velUpMin: 0.2,
            velUpRange: 1.2,
            gravity: 0
        });
    }

    /**
     * Bigger impact burst for a Bruiser smash (red/orange default).
     * Wider spread, heavier, lingers a bit longer.
     */
    createImpactBurst(position, color = 0xff5522, count = 16) {
        this._spawnBurst(position, {
            count,
            color,
            size: PARTICLE_CONFIG.size * 1.6,
            duration: 0.45,
            yOffset: 0.1,
            velSpreadXZ: 7.5,
            velUpMin: 0.4,
            velUpRange: 2.4,
            gravity: 0
        });
    }

    /**
     * Drifting poison puff — large, low-opacity, no gravity. Spawned
     * continuously by PoisonCloudSystem to build up a spreading gas cloud
     * that the player can still see through.
     */
    createPoisonPuff(position, count = 6) {
        this._spawnBurst(position, {
            count,
            color: 0x88ee55,
            size: PARTICLE_CONFIG.size * 2.4,
            duration: 1.6,
            yOffset: 0.4,
            velSpreadXZ: 1.4,
            velUpMin: 0.15,
            velUpRange: 0.6,
            opacity: 0.55,
            gravity: 0
        });
    }

    /**
     * Wood chips spraying off a chopped tree. Two-layer burst:
     *   - Mid-tone brown chunks (heavier, longer-lived) — the main mass.
     *   - Lighter splinters (smaller, faster, shorter-lived) — accents.
     * Both arc up and outward, fall under gravity, fade over their lifetime.
     */
    createWoodChips(position, count = 10) {
        const chunks    = Math.max(1, Math.ceil(count * 0.7));
        const splinters = Math.max(1, Math.ceil(count * 0.4));

        // Heavy chunks — mid-brown, slower, larger, lingers ~0.65s
        this._spawnBurst(position, {
            count: chunks,
            color: 0x6b3a17,
            size: PARTICLE_CONFIG.size * 1.6,
            duration: 0.65,
            yOffset: 0.0,
            velSpreadXZ: 4.5,
            velUpMin: 1.6,
            velUpRange: 2.4,
            gravity: 18.0
        });

        // Light splinters — warmer brown, faster, smaller, fades quickly
        this._spawnBurst(position, {
            count: splinters,
            color: 0xa67340,
            size: PARTICLE_CONFIG.size * 1.0,
            duration: 0.42,
            yOffset: 0.05,
            velSpreadXZ: 5.5,
            velUpMin: 2.2,
            velUpRange: 3.0,
            gravity: 22.0
        });
    }

    _spawnBurst(position, opts) {
        const {
            count, color, size, duration,
            yOffset, velSpreadXZ, velUpMin, velUpRange,
            opacity = 1.0,
            gravity = 25.0
        } = opts;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = [];

        for (let i = 0; i < count; i++) {
            positions[i * 3]     = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;

            velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * velSpreadXZ,
                Math.random() * velUpRange + velUpMin,
                (Math.random() - 0.5) * velSpreadXZ
            ));
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color,
            size,
            transparent: true,
            opacity,
            sizeAttenuation: true,
            depthWrite: false
        });

        const points = new THREE.Points(geometry, material);
        points.position.copy(position);
        points.position.y += yOffset;
        this.scene.add(points);

        this.activeSystems.push({
            points,
            velocities,
            time: 0,
            duration,
            startOpacity: opacity,
            gravity
        });
    }

    update(deltaTime) {
        for (let i = this.activeSystems.length - 1; i >= 0; i--) {
            const sys = this.activeSystems[i];
            sys.time += deltaTime;

            const posAttr = sys.points.geometry.attributes.position;
            const positions = posAttr.array;

            const gravity = sys.gravity ?? 25.0;
            for (let j = 0; j < sys.velocities.length; j++) {
                const v = sys.velocities[j];

                positions[j * 3] += v.x * deltaTime;
                positions[j * 3 + 1] += v.y * deltaTime;
                positions[j * 3 + 2] += v.z * deltaTime;

                if (gravity) v.y -= gravity * deltaTime;
                v.multiplyScalar(0.98);
            }

            posAttr.needsUpdate = true;

            // Fade — scale from startOpacity to 0 over duration
            const start = sys.startOpacity ?? 1.0;
            sys.points.material.opacity = Math.max(0, start * (1 - sys.time / sys.duration));

            if (sys.time >= sys.duration) {
                this.scene.remove(sys.points);
                sys.points.geometry.dispose();
                sys.points.material.dispose();
                this.activeSystems.splice(i, 1);
            }
        }
    }
}
