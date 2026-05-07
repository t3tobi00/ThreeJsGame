import EventBus from '../core/EventBus.js';

/**
 * PalisadeGateSystem — auto-sink logs when the player approaches the wall.
 *
 * Per fence side, tracks each edge's collider + the logs that sit along it.
 * Each frame: if the player is within trigger range AND moving along the
 * edge's outward axis (|velocity · normal| > threshold), open the gate —
 * sink the logs Y-down + disable the edge collider. When the player walks
 * away (or stops, or moves parallel), close the gate — raise logs and
 * re-enable the collider.
 *
 * Why velocity-gated:
 *   - Standing near the wall doesn't open it (no idle false-positives).
 *   - Walking parallel doesn't pop holes along the entire side.
 *   - Zombies/allies are never the trigger, so they don't open the wall.
 *     If a zombie chases the player through a fresh opening, the fast
 *     re-close (~0.13s once dot test fails) bounds the leak window.
 */

const SIDE_OUTWARD_NORMAL = {
    north: { x:  0, z: -1 },
    south: { x:  0, z:  1 },
    west:  { x: -1, z:  0 },
    east:  { x:  1, z:  0 },
    _all:  { x:  0, z:  0 }
};

export class PalisadeGateSystem {
    constructor(ecs) {
        this.ecs = ecs;
        this.playerId = null;
        this.fenceSides = null;

        // [{ sideName, colliderId, midX, midZ, normal, logs:[{group, baseY}], openness, holdTimer }]
        this._edges = [];

        this.triggerDist        = 1.1;   // mid-range trigger needs intent (heading at wall)
        this.closeRangeDist     = 0.7;   // touching distance — open regardless of direction
        this.minSpeed           = 0.4;   // and moving at least this fast
        this.minDot             = 0.30;  // velocity-direction threshold for the mid-range trigger
        this.holdDuration       = 1.0;   // once triggered, stay open this many seconds even if player stops
        this.sinkSpeed          = 8.0;   // openness 0 → 1 in ~0.125s
        this.sinkDepth          = 2.5;   // world units a log drops at full open
        this.colliderHysteresis = 0.45;  // disable collider when openness > this

        // Player velocity isn't reliably set on Movement.velocity in the
        // prototype (joystick/waypoint paths bypass it). Derive locally from
        // position deltas instead.
        this._lastPx = null;
        this._lastPz = null;
    }

    setPlayer(id)              { this.playerId = id; }
    setFenceSides(fenceSides)  { this.fenceSides = fenceSides; }

    /**
     * Called from main.js once a fence side has been revealed (logs visible +
     * colliders created). Walks the side's edges, matches each to its
     * collider id by index, and harvests the logs that fall within its
     * footprint so we know which ones to sink when this edge opens.
     */
    registerSide(sideName, edgeColliderIds) {
        const sideData = this.fenceSides?.[sideName];
        if (!sideData) return;
        const edges = sideData.edges || [];
        const group = sideData.group;
        if (!group || !Array.isArray(edgeColliderIds)) return;

        const normal = SIDE_OUTWARD_NORMAL[sideName] || { x: 0, z: 0 };

        for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            const colliderId = edgeColliderIds[i];
            if (colliderId == null) continue;

            const halfW = e.width / 2;
            const halfD = e.depth / 2;
            const logs = [];
            // Logs are direct children of the side group with no extra
            // transform, so log.position is already world-space.
            for (const log of group.children) {
                const lx = log.position.x;
                const lz = log.position.z;
                if (Math.abs(lx - e.x) <= halfW + 0.05 &&
                    Math.abs(lz - e.z) <= halfD + 0.05) {
                    logs.push({ group: log, baseY: log.position.y });
                }
            }
            this._edges.push({
                sideName,
                colliderId,
                midX: e.x,
                midZ: e.z,
                halfW,
                halfD,
                normal,
                logs,
                openness: 0,
                holdTimer: 0
            });
        }
    }

    update(dt) {
        if (this.playerId == null || this._edges.length === 0) return;

        const playerTr  = this.ecs.getComponent(this.playerId, 'Transform');
        if (!playerTr?.mesh) return;

        const px = playerTr.mesh.position.x;
        const pz = playerTr.mesh.position.z;

        // Derive velocity from position delta. dt may be 0 on the very first
        // frame or during hitstop — skip the open check then.
        let vx = 0, vz = 0, speed = 0;
        if (this._lastPx != null && dt > 0.0001) {
            vx = (px - this._lastPx) / dt;
            vz = (pz - this._lastPz) / dt;
            speed = Math.hypot(vx, vz);
        }
        this._lastPx = px;
        this._lastPz = pz;

        for (const edge of this._edges) {
            // Distance from player point to the nearest point on the edge's
            // AABB (not its midpoint). 0 if inside, perpendicular distance
            // otherwise. Fixes the seam dead-zone where a player walking
            // straight at the wall sat ~1.1u from either neighboring edge
            // midpoint and triggered nothing.
            const dxBox = Math.max(0, Math.abs(px - edge.midX) - edge.halfW);
            const dzBox = Math.max(0, Math.abs(pz - edge.midZ) - edge.halfD);
            const dist = Math.hypot(dxBox, dzBox);

            // Two-tier trigger:
            //   • Close-range (dist < closeRangeDist): any movement opens it.
            //     "I'm touching the wall" is enough intent — direction-free
            //     so parallel sliding along the wall still pops the gate.
            //   • Mid-range (closeRangeDist ≤ dist < triggerDist): require
            //     velocity heading at the wall (|dot| > minDot) so casual
            //     walking past the wall doesn't open holes everywhere.
            // Once triggered, holdTimer below keeps the gate open even if
            // the player stops or turns.
            let triggered = false;
            if (speed > this.minSpeed) {
                if (dist < this.closeRangeDist) {
                    triggered = true;
                } else if (dist < this.triggerDist) {
                    const dot = (vx * edge.normal.x + vz * edge.normal.z) / speed;
                    if (Math.abs(dot) > this.minDot) triggered = true;
                }
            }

            if (triggered) {
                // Refresh / latch the hold timer. As long as the player keeps
                // approaching, this resets every frame — gate stays open.
                edge.holdTimer = this.holdDuration;
            } else if (edge.holdTimer > 0) {
                edge.holdTimer = Math.max(0, edge.holdTimer - dt);
            }

            // Open while either still triggering OR holding from a recent trigger.
            const target = (triggered || edge.holdTimer > 0) ? 1 : 0;

            // Tween openness toward target.
            if (edge.openness < target) {
                edge.openness = Math.min(target, edge.openness + this.sinkSpeed * dt);
            } else if (edge.openness > target) {
                edge.openness = Math.max(target, edge.openness - this.sinkSpeed * dt);
            }

            // Smoothstep for a softer sink/raise.
            const eased = edge.openness * edge.openness * (3 - 2 * edge.openness);
            for (const entry of edge.logs) {
                entry.group.position.y = entry.baseY - eased * this.sinkDepth;
            }

            // Hysteresis: disable when half-open, re-enable when more than
            // half-closed. Avoids flicker mid-tween.
            const col = this.ecs.getComponent(edge.colliderId, 'Collider');
            if (col) {
                const wantDisabled = edge.openness > this.colliderHysteresis;
                if (col.disabled !== wantDisabled) col.disabled = wantDisabled;
            }
        }
    }

    /** Force-close everything (e.g., on scene reset). */
    closeAll() {
        for (const edge of this._edges) {
            edge.openness = 0;
            const col = this.ecs.getComponent(edge.colliderId, 'Collider');
            if (col) col.disabled = false;
            for (const entry of edge.logs) {
                entry.group.position.y = entry.baseY;
            }
        }
    }
}

export default PalisadeGateSystem;
