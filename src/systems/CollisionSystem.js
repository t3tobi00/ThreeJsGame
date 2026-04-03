import { SpatialHash } from '../utils/SpatialHash.js';

/**
 * CollisionSystem — Resolves solid collisions on the XZ plane.
 *
 * Queries: ['Transform', 'Collider']
 *
 * Each frame:
 *   - Partitions entities into static and dynamic lists.
 *   - Inserts statics into a SpatialHash for fast neighbor lookups.
 *   - Pushes each dynamic entity out of any overlapping nearby static entity.
 *   - Supports box-box (AABB) and circle-box shapes.
 *   - Skips colliders with disabled === true (used by GateSystem).
 */
export class CollisionSystem {
    constructor() {
        this._hash = new SpatialHash(4);
        this._statics = [];       // cached static data
        this._staticsDirty = true; // rebuild hash when statics change
    }

    update(entities, deltaTime, ecs) {
        const dynamics = [];

        // Rebuild static list + hash only when entity set changes
        // (statics don't move, so we can cache between frames)
        if (this._staticsDirty || this._lastEntityCount !== entities.length) {
            this._statics = [];
            this._hash.clear();
            for (const id of entities) {
                const transform = ecs.getComponent(id, 'Transform');
                const collider  = ecs.getComponent(id, 'Collider');
                if (!transform || !collider || collider.disabled || collider.isTrigger) continue;

                if (collider.isStatic) {
                    const pos = transform.mesh.position;
                    this._statics.push({ transform, collider, id });
                    this._hash.insert(this._statics.length - 1, pos.x, pos.z);
                }
            }
            this._lastEntityCount = entities.length;
            this._staticsDirty = false;
        }

        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const collider  = ecs.getComponent(id, 'Collider');
            if (!transform || !collider || collider.disabled || collider.isTrigger) continue;
            if (!collider.isStatic) {
                dynamics.push({ transform, collider });
            }
        }

        // For each dynamic, check only nearby statics via spatial hash
        for (const dyn of dynamics) {
            const dp = dyn.transform.mesh.position;
            const nearbyIndices = this._hash.query(dp.x, dp.z, 4);

            for (const idx of nearbyIndices) {
                const sta = this._statics[idx];
                if (!sta || sta.collider.disabled) continue;
                this._resolve(dp, dyn.collider, sta.transform.mesh.position, sta.collider);
            }
        }
    }

    /** Mark statics as dirty (call when entities are added/removed). */
    invalidateStatics() {
        this._staticsDirty = true;
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    _resolve(dp, dc, sp, sc) {
        if (dc.shape === 'circle' && sc.shape === 'box') {
            this._resolveCircleBox(dp, dc.radius, sp, sc.width, sc.depth);
        } else if (dc.shape === 'box' && sc.shape === 'box') {
            this._resolveBoxBox(dp, dc.width, dc.depth, sp, sc.width, sc.depth);
        }
        // circle-circle not needed for current content
    }

    /** Push a circle center out of an AABB. */
    _resolveCircleBox(cp, radius, bp, bw, bd) {
        // Nearest point on box to circle center
        const nearX = Math.max(bp.x - bw, Math.min(cp.x, bp.x + bw));
        const nearZ = Math.max(bp.z - bd, Math.min(cp.z, bp.z + bd));
        const dx = cp.x - nearX;
        const dz = cp.z - nearZ;
        const distSq = dx * dx + dz * dz;

        if (distSq >= radius * radius) return;

        if (distSq < 1e-8) {
            // Center is exactly inside box — push out on shortest axis
            const overlapX = bw + radius - Math.abs(cp.x - bp.x);
            const overlapZ = bd + radius - Math.abs(cp.z - bp.z);
            if (overlapX <= overlapZ) {
                cp.x += cp.x < bp.x ? -overlapX : overlapX;
            } else {
                cp.z += cp.z < bp.z ? -overlapZ : overlapZ;
            }
            return;
        }

        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        cp.x += (dx / dist) * push;
        cp.z += (dz / dist) * push;
    }

    /** Push a box out of another box (AABB). */
    _resolveBoxBox(ap, aw, ad, bp, bw, bd) {
        const overlapX = (aw + bw) - Math.abs(ap.x - bp.x);
        const overlapZ = (ad + bd) - Math.abs(ap.z - bp.z);
        if (overlapX <= 0 || overlapZ <= 0) return;

        if (overlapX <= overlapZ) {
            ap.x += ap.x < bp.x ? -overlapX : overlapX;
        } else {
            ap.z += ap.z < bp.z ? -overlapZ : overlapZ;
        }
    }
}
