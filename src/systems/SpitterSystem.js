import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * SpitterSystem — Ranged poison-spit attack flow.
 *
 * Per attacker (Spitter component):
 *   1. Tick cooldown.
 *   2. When ready and a valid target sits within range, emit
 *      'zombie:spit:windup' (LungeAnimSystem plays head recoil + thrust)
 *      and schedule a projectile launch after windupDuration seconds.
 *   3. Spawn an arcing green spit ball from the attacker's head toward the
 *      target's chest. Track each projectile's parametric flight (linear
 *      lerp + sin-curve Y arc).
 *   4. On arrival: emit entity:damaged on the target, fire splat audio,
 *      spawn poison particle splatter.
 *
 * Targets are re-resolved at projectile spawn (not at windup) so a moving
 * player still gets hit, but the attacker can still miss if the target
 * leaves range during windup. Projectiles travel to a fixed world position
 * captured at launch — they don't home.
 */
export class SpitterSystem {
    constructor(scene, particleSystem) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this._ecs = null;
        this._projectiles = [];
        this._pending = [];
        this._now = 0;
    }

    setECS(ecs) { this._ecs = ecs; }

    update(entities, deltaTime, ecs) {
        this._ecs = ecs;
        this._now += deltaTime;

        for (const id of entities) {
            const tr = ecs.getComponent(id, 'Transform');
            const spitter = ecs.getComponent(id, 'Spitter');
            if (!tr || !spitter) continue;

            spitter.timeSinceLastSpit += deltaTime;
            if (spitter._isWindingUp) continue;
            if (spitter.timeSinceLastSpit < spitter.cooldown) continue;

            const targetId = this._findTarget(id, tr.mesh.position, spitter, ecs);
            if (targetId == null) continue;

            spitter._isWindingUp = true;
            spitter.timeSinceLastSpit = 0;
            EventBus.emit('zombie:spit:windup', { attackerId: id, targetId });
            EventBus.emit('audio:cue', { name: 'spit_hiss' });

            this._pending.push({
                attackerId: id,
                targetId,
                releaseAt: this._now + spitter.windupDuration
            });
        }

        for (let i = this._pending.length - 1; i >= 0; i--) {
            const p = this._pending[i];
            if (this._now < p.releaseAt) continue;

            this._launchProjectile(p.attackerId, p.targetId, ecs);
            const spitter = ecs.getComponent(p.attackerId, 'Spitter');
            if (spitter) spitter._isWindingUp = false;
            this._pending.splice(i, 1);
        }

        for (let i = this._projectiles.length - 1; i >= 0; i--) {
            const proj = this._projectiles[i];
            proj.t += deltaTime;
            const ratio = Math.min(1, proj.t / proj.duration);

            const x = proj.from.x + (proj.to.x - proj.from.x) * ratio;
            const z = proj.from.z + (proj.to.z - proj.from.z) * ratio;
            const yLine = proj.from.y + (proj.to.y - proj.from.y) * ratio;
            const y = yLine + Math.sin(ratio * Math.PI) * proj.arcHeight;
            proj.mesh.position.set(x, y, z);
            proj.mesh.rotation.x += deltaTime * 6;
            proj.mesh.rotation.y += deltaTime * 4;

            if (ratio >= 1) {
                this._impact(proj);
                this.scene.remove(proj.mesh);
                proj.geo.dispose();
                proj.mat.dispose();
                this._projectiles.splice(i, 1);
            }
        }
    }

    _findTarget(attackerId, attackerPos, spitter, ecs) {
        const candidates = ecs.queryEntities(['Transform', 'Health', 'Movement']);
        let bestId = null;
        let bestDist = Infinity;
        for (const tId of candidates) {
            if (tId === attackerId) continue;
            const mov = ecs.getComponent(tId, 'Movement');
            const tag = ecs.getComponent(tId, 'Tag');
            const matches = spitter.targetFactions.some(f =>
                f === mov?.faction || (tag && tag.has?.(f))
            );
            if (!matches) continue;
            const t = ecs.getComponent(tId, 'Transform');
            if (!t) continue;
            const d = attackerPos.distanceTo(t.mesh.position);
            if (d > spitter.range) continue;
            if (d < bestDist) {
                bestDist = d;
                bestId = tId;
            }
        }
        return bestId;
    }

    _launchProjectile(attackerId, targetId, ecs) {
        const spitter = ecs.getComponent(attackerId, 'Spitter');
        const aT = ecs.getComponent(attackerId, 'Transform');
        const tT = ecs.getComponent(targetId, 'Transform');
        if (!spitter || !aT || !tT) return;

        const fromPos = aT.mesh.position.clone();
        fromPos.y += 1.5; // mouth height on rigged characters
        const toPos = tT.mesh.position.clone();
        toPos.y += 0.7;   // chest height

        const distance = fromPos.distanceTo(toPos);
        const duration = Math.max(0.15, distance / spitter.projectileSpeed);

        const geo = new THREE.SphereGeometry(0.16, 10, 8);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x88ff44,
            emissive: 0x224400,
            emissiveIntensity: 0.5,
            roughness: 0.4
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(fromPos);
        this.scene.add(mesh);

        this._projectiles.push({
            mesh, geo, mat,
            from: fromPos,
            to: toPos,
            targetId,
            damage: spitter.damage,
            arcHeight: spitter.arcHeight,
            duration,
            t: 0
        });
    }

    _impact(proj) {
        EventBus.emit('audio:cue', { name: 'spit_splat' });
        // Spawn a lingering poison cloud at the landing position. Damage is
        // applied by PoisonCloudSystem over the cloud's lifetime, NOT as a
        // direct hit on the targeted entity — the player can dodge by moving
        // out of the gas. Multiple clouds stack.
        EventBus.emit('poison:cloud:spawn', {
            position: proj.mesh.position.clone()
        });
    }
}
