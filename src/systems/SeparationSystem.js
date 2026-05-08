import { SpatialHash } from '../utils/SpatialHash.js';

/**
 * SeparationSystem — Personal-space repulsion between same-faction units.
 *
 * Without this, AI steering happily stacks 8 zombies into a single
 * silhouette, and ally soldiers merge into the same pile. Each frame, for
 * every Transform+Movement entity, finds nearby same-faction entities via
 * a spatial hash and applies a repulsion offset scaled by overlap.
 *
 * Per-entity personal radius comes from Component_Collider.radius (else a
 * default), inflated by GAP_MULTIPLIER so units sit visibly apart.
 *
 * Different factions are NOT pushed apart here — combat distance is
 * handled by Step B (stop-at-range) so soldiers can still close on
 * zombies for melee. Static entities (no Movement) are ignored.
 *
 * Should run AFTER all movement systems each frame so it nudges the
 * post-AI positions rather than fighting steering.
 */
const DEFAULT_PERSONAL_RADIUS = 0.45;
const GAP_MULTIPLIER          = 1.85;   // desired centre-to-centre gap = (rA+rB) * mul
const PUSH_STRENGTH           = 5.5;    // units/sec at full overlap
const MAX_PUSH_PER_FRAME      = 0.45;   // cap to avoid teleport-y nudges
const SEARCH_RADIUS           = 2.4;

export class SeparationSystem {
    constructor() {
        this._hash = new SpatialHash(2);
    }

    update(entities, deltaTime, ecs) {
        if (deltaTime <= 0) return;

        // Build hash of every mover for proximity queries
        this._hash.clear();
        for (const id of entities) {
            const t = ecs.getComponent(id, 'Transform');
            const m = ecs.getComponent(id, 'Movement');
            if (!t?.mesh || !m) continue;
            this._hash.insert(id, t.mesh.position.x, t.mesh.position.z);
        }

        for (const id of entities) {
            const t = ecs.getComponent(id, 'Transform');
            const m = ecs.getComponent(id, 'Movement');
            if (!t?.mesh || !m) continue;
            const myFaction = m.faction;
            if (!myFaction) continue;

            // Combat-engaged units ignore inbound personal-space push so
            // slow archetypes (e.g., bruiser at speed 2 ≈ 0.033u/frame at
            // 60fps) can traverse ally clusters to reach their target.
            // Without this, separation force (~0.05u/frame typical, capped
            // 0.45u/frame) overpowers the slow pursue, pinning the unit
            // in place while the walk animation still cycles ("hanging").
            // Other entities still push themselves AWAY from this one in
            // their own loop iterations — only the inbound push is skipped.
            const myBs = ecs.getComponent(id, 'BehaviorState');
            if (myBs && myBs.tag === 'combat') continue;

            const myPos = t.mesh.position;
            const myCol = ecs.getComponent(id, 'Collider');
            const myR = myCol?.radius ?? DEFAULT_PERSONAL_RADIUS;

            const nearby = this._hash.query(myPos.x, myPos.z, SEARCH_RADIUS);
            let pushX = 0, pushZ = 0;

            for (const otherId of nearby) {
                if (otherId === id) continue;
                const otherM = ecs.getComponent(otherId, 'Movement');
                if (!otherM || otherM.faction !== myFaction) continue;
                const otherT = ecs.getComponent(otherId, 'Transform');
                if (!otherT?.mesh) continue;
                const otherCol = ecs.getComponent(otherId, 'Collider');
                const otherR = otherCol?.radius ?? DEFAULT_PERSONAL_RADIUS;

                const dx = myPos.x - otherT.mesh.position.x;
                const dz = myPos.z - otherT.mesh.position.z;
                const distSq = dx * dx + dz * dz;
                const desiredGap = (myR + otherR) * GAP_MULTIPLIER;

                if (distSq >= desiredGap * desiredGap) continue;

                if (distSq < 0.0001) {
                    // Exact overlap — break symmetry by pushing in a random direction
                    const angle = Math.random() * Math.PI * 2;
                    pushX += Math.cos(angle);
                    pushZ += Math.sin(angle);
                    continue;
                }

                const dist = Math.sqrt(distSq);
                const overlap = (desiredGap - dist) / desiredGap;
                pushX += (dx / dist) * overlap;
                pushZ += (dz / dist) * overlap;
            }

            if (pushX === 0 && pushZ === 0) continue;

            let dx = pushX * PUSH_STRENGTH * deltaTime;
            let dz = pushZ * PUSH_STRENGTH * deltaTime;
            const mag = Math.sqrt(dx * dx + dz * dz);
            if (mag > MAX_PUSH_PER_FRAME) {
                const k = MAX_PUSH_PER_FRAME / mag;
                dx *= k;
                dz *= k;
            }
            myPos.x += dx;
            myPos.z += dz;
        }
    }
}
