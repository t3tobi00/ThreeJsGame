import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * PoisonCloudSystem — Lingering poison gas left by zombie spits.
 *
 * Subscribes to 'poison:cloud:spawn' { position, radius?, dps?, lifeMax? }
 * (emitted by SpitterSystem on projectile impact).
 *
 * Each cloud:
 *   - Adds a translucent green sphere mesh at the landing point.
 *   - Periodically emits small poison particle bursts (visual smoke).
 *   - Each frame, finds player/ally entities inside its radius and
 *     accumulates damage at `dps`. When the accumulator reaches >=1, emits
 *     entity:damaged with `silent: true` so flash/shake/snarl don't fire
 *     per tick. Cloud-on-cloud overlap stacks naturally — each cloud applies
 *     damage independently, so an entity standing in N overlapping clouds
 *     takes N × dps damage per second.
 *   - Fades opacity + lifetime over `lifeMax` seconds, then is removed.
 *
 * Standalone (no ECS query). Must be ticked from main.js animate loop and
 * given an ECS reference via setECS so it can resolve targets each tick.
 */
const POISON_DAMAGE_FACTIONS = ['player', 'ally'];
const PUFF_INTERVAL = 0.20;        // light particle accent
const PUFFS_PER_TICK = 2;
const VISUAL_RADIUS_MUL = 1.55;    // smoke spreads wider than damage radius
const BLOBS_PER_CLOUD  = 7;        // scattered translucent puffs forming an irregular shape
const BLOB_OPACITY     = 0.1;     // each blob — combined cluster reads as cloudy but see-through
const FADE_OUT_FRAC    = 0.30;     // fade opacity to 0 across the final 30% of lifetime

export class PoisonCloudSystem {
    constructor(scene, particleSystem) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this._ecs = null;
        this._clouds = [];

        EventBus.on('poison:cloud:spawn', (data) => this._spawn(data));
    }

    setECS(ecs) { this._ecs = ecs; }

    _spawn({ position, radius = 1.6, dps = 2.0, lifeMax = 10.0 } = {}) {
        if (!position) return;

        const groundPos = new THREE.Vector3(position.x, 0.5, position.z);
        const visualRadius = radius * VISUAL_RADIUS_MUL;

        // Build the cloud out of N scattered translucent blobs (varied size +
        // squashed Y) to read as an irregular ground-hugging gas pocket.
        const blobs = [];
        const baseScales = [];
        for (let i = 0; i < BLOBS_PER_CLOUD; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist  = Math.sqrt(Math.random()) * visualRadius;
            const size  = 0.55 + Math.random() * 0.55;   // 0.55 .. 1.10

            const geo = new THREE.SphereGeometry(size, 12, 8);
            const mat = new THREE.MeshStandardMaterial({
                color: 0x66dd44,
                emissive: 0x224400,
                emissiveIntensity: 0.30,
                transparent: true,
                opacity: BLOB_OPACITY,
                roughness: 0.95,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                groundPos.x + Math.cos(angle) * dist,
                0.35 + Math.random() * 0.55,
                groundPos.z + Math.sin(angle) * dist
            );
            // Squash Y so blobs hug the ground like settled gas
            const sy = 0.55 + Math.random() * 0.30;
            mesh.scale.set(1, sy, 1);
            this.scene.add(mesh);

            blobs.push({ mesh, mat, geo, spinSpeed: (Math.random() - 0.5) * 0.5 });
            baseScales.push(sy);
        }

        // Initial impact accent (one-shot)
        if (this.particleSystem) {
            this.particleSystem.createPoisonSplatter(groundPos.clone(), 12);
        }

        this._clouds.push({
            position: groundPos,
            radius,
            visualRadius,
            dps,
            life: lifeMax,
            lifeMax,
            damageAccum: 0,
            particleAccum: 0,
            blobs,
            baseScales
        });
    }

    update(deltaTime) {
        if (!this._ecs) return;

        for (let i = this._clouds.length - 1; i >= 0; i--) {
            const c = this._clouds[i];
            c.life -= deltaTime;
            if (c.life <= 0) {
                for (const b of c.blobs) {
                    this.scene.remove(b.mesh);
                    b.geo.dispose();
                    b.mat.dispose();
                }
                this._clouds.splice(i, 1);
                continue;
            }

            const lifeRatio = c.life / c.lifeMax;
            const fadeOut = lifeRatio < FADE_OUT_FRAC ? lifeRatio / FADE_OUT_FRAC : 1.0;

            // Animate blobs: gentle rotate + pulse + opacity fade in final stretch
            for (let k = 0; k < c.blobs.length; k++) {
                const b = c.blobs[k];
                b.mat.opacity = BLOB_OPACITY * fadeOut;
                b.mesh.rotation.y += deltaTime * b.spinSpeed;
                const pulse = 1 + Math.sin(c.life * 2 + k * 1.7) * 0.06;
                b.mesh.scale.set(pulse, c.baseScales[k] * pulse, pulse);
            }

            // Light continuous particle accent for sense of motion
            c.particleAccum += deltaTime;
            if (c.particleAccum >= PUFF_INTERVAL && this.particleSystem) {
                c.particleAccum = 0;
                const puffs = Math.max(1, Math.round(PUFFS_PER_TICK * fadeOut));
                for (let k = 0; k < puffs; k++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist  = Math.sqrt(Math.random()) * c.visualRadius;
                    const offset = new THREE.Vector3(
                        Math.cos(angle) * dist,
                        Math.random() * 0.3,
                        Math.sin(angle) * dist
                    );
                    const emitPos = c.position.clone().add(offset);
                    this.particleSystem.createPoisonPuff(emitPos, 3);
                }
            }

            // Damage tick (radius unchanged — only the visual is wider)
            c.damageAccum += c.dps * deltaTime;
            if (c.damageAccum >= 1) {
                const dmg = Math.floor(c.damageAccum);
                c.damageAccum -= dmg;
                this._applyDamage(c.position, c.radius, dmg);
            }
        }
    }

    _applyDamage(pos, radius, damage) {
        const ecs = this._ecs;
        const candidates = ecs.queryEntities(['Transform', 'Health', 'Movement']);
        const r2 = radius * radius;
        for (const id of candidates) {
            const m = ecs.getComponent(id, 'Movement');
            if (!POISON_DAMAGE_FACTIONS.includes(m?.faction)) continue;
            const t = ecs.getComponent(id, 'Transform');
            if (!t?.mesh) continue;
            const dx = t.mesh.position.x - pos.x;
            const dz = t.mesh.position.z - pos.z;
            if (dx * dx + dz * dz > r2) continue;
            EventBus.emit('entity:damaged', { entityId: id, damage, silent: true });
        }
    }
}
