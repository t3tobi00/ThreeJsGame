/**
 * CollisionSystem — Resolves solid collisions on the XZ plane.
 *
 * Queries: ['Transform', 'Collider']
 *
 * Each frame:
 *   - Partitions entities into static and dynamic lists.
 *   - Pushes each dynamic entity out of any overlapping static entity.
 *   - Supports box-box (AABB) and circle-box shapes.
 *   - Skips colliders with disabled === true (used by GateSystem).
 */
export class CollisionSystem {
    update(entities, deltaTime, ecs) {
        const statics  = [];
        const dynamics = [];

        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const collider  = ecs.getComponent(id, 'Collider');
            if (!transform || !collider || collider.disabled || collider.isTrigger) continue;

            if (collider.isStatic) {
                statics.push({ transform, collider });
            } else {
                dynamics.push({ transform, collider });
            }
        }

        for (const dyn of dynamics) {
            const dp = dyn.transform.mesh.position;
            for (const sta of statics) {
                if (sta.collider.disabled) continue;
                this._resolve(dp, dyn.collider, sta.transform.mesh.position, sta.collider);
            }
        }
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
