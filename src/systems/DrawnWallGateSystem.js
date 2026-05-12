import EventBus from '../core/EventBus.js';

/**
 * DrawnWallGateSystem — auto-sink the player-drawn palisade walls when an
 * ally approaches them, mirroring PalisadeGateSystem's behavior for the
 * pre-placed N/S/E/W walls. Drawn walls have arbitrary curvature, so the
 * "side" abstraction doesn't apply — instead each LOG carries its own
 * outward normal (perpendicular to the path tangent at draw time) and is
 * grouped with its drag-mates via a shared groupId.
 *
 * Trigger filter (identical to PalisadeGateSystem):
 *   - Movement.faction === 'ally'  → workers + soldiers
 *   - Movement.faction === 'player' → the player capsule
 *   - Anything else (zombies, neutrals) is ignored.
 *
 * Two-tier trigger:
 *   - Close-range (dist < closeRangeDist): any ally movement opens.
 *   - Mid-range (dist < triggerDist): require |velocity · normal| > minDot
 *     so walking parallel along a wall doesn't pop holes.
 *
 * Once a log triggers, its neighbors-along-the-path open too (so the gate
 * is wide enough for an ally body), the hold timer latches for ~1s, the
 * mesh sinks 2.5u down with smoothstep easing, and the collider is
 * disabled at 45% openness (hysteresis to avoid flicker).
 *
 * Lifecycle:
 *   - DrawWallSystem emits 'draw:wallGroupRegistered' on each commit with
 *     { groupId, logs: [{entityId, normalX, normalZ}, …] }. We snapshot
 *     each log's baseY at registration so opens/closes return to ground.
 *   - 'entity:died' for any tracked log → drop it from its group; if the
 *     group empties, remove the group entirely.
 */
export class DrawnWallGateSystem {
    constructor(ecs) {
        this.ecs = ecs;

        // Map<groupId, Array<{entityId, normalX, normalZ, baseY, openness, holdTimer}>>
        this._groups = new Map();

        // Per-candidate position memory for finite-difference velocity. Same
        // pattern as PalisadeGateSystem — Movement.velocity is unreliable
        // across the prototype's controllers.
        this._lastPos = new Map();

        // Tunables — kept identical to PalisadeGateSystem so drawn walls
        // FEEL the same as the N/S/E/W walls.
        this.triggerDist        = 1.1;
        this.closeRangeDist     = 0.7;
        this.minSpeed           = 0.4;
        this.minDot             = 0.30;
        this.holdDuration       = 1.0;
        this.sinkSpeed          = 8.0;
        this.sinkDepth          = 2.5;
        this.colliderHysteresis = 0.45;

        // When one log triggers, also open its N neighbors on each side
        // along the path. Logs are spaced 0.30u apart, so neighborSpan=3
        // gives a ~2.1u-wide opening — wide enough for any ally.
        this.neighborSpan = 3;

        EventBus.on('draw:wallGroupRegistered', ({ groupId, logs }) => {
            this._registerGroup(groupId, logs);
        });
        EventBus.on('entity:died', ({ entityId }) => {
            this._removeLog(entityId);
        });
    }

    update(dt) {
        if (this._groups.size === 0) return;

        // Gather every ally + player as a candidate trigger this frame.
        const candidateIds = this.ecs.queryEntities(['Movement', 'Transform']);
        const candidates = [];
        const liveIds = new Set();
        for (const id of candidateIds) {
            const mv = this.ecs.getComponent(id, 'Movement');
            if (!mv || (mv.faction !== 'ally' && mv.faction !== 'player')) continue;
            const tr = this.ecs.getComponent(id, 'Transform');
            if (!tr?.mesh) continue;

            const x = tr.mesh.position.x;
            const z = tr.mesh.position.z;

            let vx = 0, vz = 0, speed = 0;
            const last = this._lastPos.get(id);
            if (last && dt > 0.0001) {
                vx = (x - last.x) / dt;
                vz = (z - last.z) / dt;
                speed = Math.hypot(vx, vz);
            }
            this._lastPos.set(id, { x, z });
            liveIds.add(id);
            candidates.push({ x, z, vx, vz, speed });
        }
        // Drop last-pos entries for despawned candidates.
        if (this._lastPos.size > liveIds.size) {
            for (const id of this._lastPos.keys()) {
                if (!liveIds.has(id)) this._lastPos.delete(id);
            }
        }

        for (const [, logs] of this._groups) {
            const n = logs.length;
            if (n === 0) continue;

            // Pass 1 — per-log trigger detection.
            const triggers = new Array(n).fill(false);
            for (let i = 0; i < n; i++) {
                const log = logs[i];
                const tr = this.ecs.getComponent(log.entityId, 'Transform');
                if (!tr?.mesh) continue;
                const lx = tr.mesh.position.x;
                const lz = tr.mesh.position.z;

                for (const c of candidates) {
                    if (c.speed <= this.minSpeed) continue;
                    const dx = c.x - lx;
                    const dz = c.z - lz;
                    const dist = Math.hypot(dx, dz);

                    if (dist < this.closeRangeDist) {
                        triggers[i] = true;
                        break;
                    }
                    if (dist < this.triggerDist) {
                        const dot = (c.vx * log.normalX + c.vz * log.normalZ) / c.speed;
                        if (Math.abs(dot) > this.minDot) {
                            triggers[i] = true;
                            break;
                        }
                    }
                }
            }

            // Pass 2 — spread each trigger to neighbors along the path so
            // the gate is wide enough for an ally body.
            const expanded = triggers.slice();
            for (let i = 0; i < n; i++) {
                if (!triggers[i]) continue;
                const lo = Math.max(0, i - this.neighborSpan);
                const hi = Math.min(n - 1, i + this.neighborSpan);
                for (let j = lo; j <= hi; j++) expanded[j] = true;
            }

            // Pass 3 — per-log hold-timer + tween + apply.
            for (let i = 0; i < n; i++) {
                const log = logs[i];

                if (expanded[i]) {
                    log.holdTimer = this.holdDuration;
                } else if (log.holdTimer > 0) {
                    log.holdTimer = Math.max(0, log.holdTimer - dt);
                }

                const target = (expanded[i] || log.holdTimer > 0) ? 1 : 0;
                if (log.openness < target) {
                    log.openness = Math.min(target, log.openness + this.sinkSpeed * dt);
                } else if (log.openness > target) {
                    log.openness = Math.max(target, log.openness - this.sinkSpeed * dt);
                }

                const tr = this.ecs.getComponent(log.entityId, 'Transform');
                if (!tr?.mesh) continue;
                const eased = log.openness * log.openness * (3 - 2 * log.openness);
                tr.mesh.position.y = log.baseY - eased * this.sinkDepth;

                const col = this.ecs.getComponent(log.entityId, 'Collider');
                if (col) {
                    const wantDisabled = log.openness > this.colliderHysteresis;
                    if (col.disabled !== wantDisabled) col.disabled = wantDisabled;
                }
            }
        }
    }

    // ─── Private ───────────────────────────────────────────────────────────

    _registerGroup(groupId, logEntries) {
        const records = [];
        for (const e of logEntries) {
            const tr = this.ecs.getComponent(e.entityId, 'Transform');
            const baseY = tr?.mesh?.position.y ?? 0;
            records.push({
                entityId: e.entityId,
                normalX:  e.normalX,
                normalZ:  e.normalZ,
                baseY,
                openness:  0,
                holdTimer: 0
            });
        }
        this._groups.set(groupId, records);
    }

    _removeLog(entityId) {
        for (const [groupId, logs] of this._groups) {
            const idx = logs.findIndex((l) => l.entityId === entityId);
            if (idx >= 0) {
                logs.splice(idx, 1);
                if (logs.length === 0) this._groups.delete(groupId);
                return;
            }
        }
    }
}

export default DrawnWallGateSystem;
