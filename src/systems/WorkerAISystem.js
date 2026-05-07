import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * WorkerAISystem — Per-worker FSM driving the Act 3 automation loop.
 *
 * PR #3.2 implements the WOOD role only:
 *   IDLE  →  MOVE_TO_TREE  →  CHOP  →  MOVE_TO_PAD  →  DEPOSIT  →  IDLE
 *
 * Essence / Builder roles are NO-OPs until PR #3.3 (their archetypes carry
 * `role: 'disabled'` so they appear visually but do nothing here).
 *
 * Conflict resolution: each worker writes its claimed tree to
 * `currentTarget`; peers skip claimed trees during SCAN.
 *
 * Stuck detection: if the worker barely moves for 2s while in a MOVE state,
 * we drop the target and re-IDLE. PR #3.2 uses direct steering only (no
 * A*); the Pathfinder is reserved for the stuck-fallback in a future PR.
 *
 * Workers are non-combatants — they have Health and take damage from
 * zombies but do not attack zombies and do not respawn (matches the
 * permanent-death rule for soldiers).
 *
 * Queries: ['Transform', 'WorkerAI', 'InventoryStack']
 */

const EPSILON_PER_FRAME = 0.05; // <5cm of movement per ~16ms tick reads as "stuck"
const STUCK_THRESHOLD_S = 2.0;

export class WorkerAISystem {
    constructor(scene, pathfinder = null) {
        this.scene = scene;
        this.pathfinder = pathfinder;
    }

    update(entities, deltaTime, ecs) {
        if (!entities.length) return;
        this._ecs = ecs;   // pathfinder needs it on stuck-detect

        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const ai = ecs.getComponent(id, 'WorkerAI');
            const inventory = ecs.getComponent(id, 'InventoryStack');
            if (!transform || !ai || !inventory) continue;
            if (ai.role !== 'wood') continue;   // PR #3.2 wood only

            switch (ai.fsmState) {
                case 'IDLE':         this._idle(id, ai, transform, inventory, ecs); break;
                case 'MOVE_TO_TREE': this._moveToTree(id, ai, transform, deltaTime, ecs); break;
                case 'CHOP':         this._chop(id, ai, transform, deltaTime, ecs); break;
                case 'MOVE_TO_PAD':  this._moveToPad(id, ai, transform, deltaTime, ecs); break;
                case 'DEPOSIT':      this._deposit(id, ai, transform, inventory, ecs); break;
                default:             ai.fsmState = 'IDLE';
            }
        }
    }

    // ─── IDLE ───────────────────────────────────────────────────────
    // If we already carry wood, head for the pad. Otherwise scan trees.
    _idle(id, ai, transform, inventory, ecs) {
        if (inventory.getCountByType('wood') > 0) {
            ai.fsmState = 'MOVE_TO_PAD';
            ai.stuckTimer = 0;
            ai.lastPos = transform.mesh.position.clone();
            return;
        }

        const treeId = this._findNearestUnclaimedTree(id, ai, transform.mesh.position, ecs);
        if (treeId == null) return; // stay in IDLE; rescan next tick

        ai.currentTarget = treeId;
        ai.fsmState = 'MOVE_TO_TREE';
        ai.stuckTimer = 0;
        ai.lastPos = transform.mesh.position.clone();
    }

    // ─── MOVE_TO_TREE ────────────────────────────────────────────────
    _moveToTree(id, ai, transform, deltaTime, ecs) {
        // Tree died mid-walk (someone else got it / it expired) → re-IDLE
        if (ai.currentTarget == null
            || !ecs.hasComponents(ai.currentTarget, ['Transform', 'Health'])) {
            ai.currentTarget = null;
            ai.fsmState = 'IDLE';
            return;
        }
        const treeTr = ecs.getComponent(ai.currentTarget, 'Transform');
        const treeHp = ecs.getComponent(ai.currentTarget, 'Health');
        if (!treeTr.mesh.visible || treeHp.hp <= 0) {
            ai.currentTarget = null;
            ai.fsmState = 'IDLE';
            return;
        }

        const myPos = transform.mesh.position;
        const targetPos = treeTr.mesh.position;
        const dist = myPos.distanceTo(targetPos);

        if (dist <= ai.attackRange) {
            ai.fsmState = 'CHOP';
            ai.attackTimer = 0;
            return;
        }

        this._stepToward(transform, targetPos, this._speedFor(id, ecs) * deltaTime, ai);
        this._tickStuck(ai, myPos, deltaTime);
    }

    // ─── CHOP ────────────────────────────────────────────────────────
    // Damage + death are owned by HealthSystem — we just emit
    // entity:damaged with the correctly-named `damage` field (NOT `amount`)
    // and let HealthSystem mutate hp, fire entity:died with drops, and
    // destroy the entity. CollectorSystem spawns the wood disks; the
    // worker's own Collector magnets them in while we walk to the pad.
    _chop(id, ai, transform, deltaTime, ecs) {
        // Target was destroyed last tick (HealthSystem.destroyEntity) →
        // start walking to the pad; disks finish their magnet flight en route.
        if (ai.currentTarget == null
            || !ecs.hasComponents(ai.currentTarget, ['Transform', 'Health'])) {
            ai.currentTarget = null;
            ai.fsmState = 'MOVE_TO_PAD';
            ai.stuckTimer = 0;
            return;
        }
        const treeHp = ecs.getComponent(ai.currentTarget, 'Health');
        if (treeHp.hp <= 0) {
            // hp reached zero this tick; HealthSystem will destroy the entity
            // on its next update. Move on without waiting another frame.
            ai.currentTarget = null;
            ai.fsmState = 'MOVE_TO_PAD';
            ai.stuckTimer = 0;
            return;
        }

        ai.attackTimer += deltaTime;
        if (ai.attackTimer < ai.attackCooldown) return;
        ai.attackTimer = 0;

        EventBus.emit('entity:damaged', {
            entityId: ai.currentTarget,
            damage: ai.attackDamage
        });
    }

    // ─── MOVE_TO_PAD ─────────────────────────────────────────────────
    _moveToPad(id, ai, transform, deltaTime, ecs) {
        const padId = this._findNearestPad(transform.mesh.position, ecs);
        if (padId == null) { ai.fsmState = 'IDLE'; return; }
        ai.padId = padId;

        const padTr = ecs.getComponent(padId, 'Transform');
        const myPos = transform.mesh.position;
        const padPos = padTr.mesh.position;
        const dist = myPos.distanceTo(padPos);

        if (dist <= ai.depositRange) {
            ai.fsmState = 'DEPOSIT';
            return;
        }
        this._stepToward(transform, padPos, this._speedFor(id, ecs) * deltaTime, ai);
        this._tickStuck(ai, myPos, deltaTime);
    }

    // ─── DEPOSIT ─────────────────────────────────────────────────────
    // PR #3.2 dumps the whole inventory at once. PR #3.3 will add a per-item
    // drain visual (item flies from worker to pad over ~0.4s).
    _deposit(id, ai, transform, inventory, ecs) {
        const padId = ai.padId ?? this._findNearestPad(transform.mesh.position, ecs);
        if (padId == null) { ai.fsmState = 'IDLE'; return; }
        const stockpile = ecs.getComponent(padId, 'Stockpile');
        if (!stockpile) { ai.fsmState = 'IDLE'; return; }

        const woodCount = inventory.getCountByType('wood');
        if (woodCount > 0) {
            stockpile.increment('wood', woodCount);
            // Drain the inventory slot
            while (inventory.getCountByType('wood') > 0) {
                const popped = inventory.popFromSlot('wood');
                if (popped?.parent) popped.parent.remove(popped);
                if (popped?._pool) popped._pool.release(popped);
            }
            EventBus.emit('stack:changed', {
                entityId: id, type: 'wood',
                count: 0, totalCount: inventory.getTotalCount()
            });
        }
        ai.fsmState = 'IDLE';
        ai.padId = null;
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    _findNearestUnclaimedTree(selfId, ai, pos, ecs) {
        const claimed = new Set();
        for (const peerId of ecs.queryEntities(['WorkerAI'])) {
            if (peerId === selfId) continue;
            const peer = ecs.getComponent(peerId, 'WorkerAI');
            if (peer?.currentTarget != null) claimed.add(peer.currentTarget);
        }
        let bestId = null, bestDist = ai.scanRadius;
        for (const treeId of ecs.queryEntities(['Transform', 'Tag', 'Health'])) {
            if (claimed.has(treeId)) continue;
            const tag = ecs.getComponent(treeId, 'Tag');
            if (!tag?.has?.('tree')) continue;
            const tr = ecs.getComponent(treeId, 'Transform');
            if (!tr?.mesh?.visible) continue;
            const hp = ecs.getComponent(treeId, 'Health');
            if (!hp || hp.hp <= 0) continue;
            const d = tr.mesh.position.distanceTo(pos);
            if (d < bestDist) { bestDist = d; bestId = treeId; }
        }
        return bestId;
    }

    _findNearestPad(pos, ecs) {
        let bestId = null, bestDist = Infinity;
        for (const padId of ecs.queryEntities(['Transform', 'Stockpile'])) {
            const tr = ecs.getComponent(padId, 'Transform');
            if (!tr?.mesh?.visible) continue;
            const d = tr.mesh.position.distanceTo(pos);
            if (d < bestDist) { bestDist = d; bestId = padId; }
        }
        return bestId;
    }

    /**
     * Walk one frame's worth of distance toward `targetPos`. If `ai.path`
     * has waypoints (set by stuck recovery), follow the path instead and
     * advance the waypoint index when a waypoint is reached. Path is
     * cleared once the worker is within `step` of the final waypoint.
     */
    _stepToward(transform, targetPos, step, ai = null) {
        const myPos = transform.mesh.position;
        let goal = targetPos;

        if (ai?.path && ai.path.length > 0) {
            // Follow the next waypoint; advance when within ~0.4u
            const wp = ai.path[ai.pathIdx];
            if (wp && myPos.distanceTo(wp) < 0.4) {
                ai.pathIdx++;
                if (ai.pathIdx >= ai.path.length) {
                    ai.path = null;
                    ai.pathIdx = 0;
                }
            }
            if (ai.path && ai.path[ai.pathIdx]) goal = ai.path[ai.pathIdx];
        }

        const dx = goal.x - myPos.x;
        const dz = goal.z - myPos.z;
        const len = Math.hypot(dx, dz);
        if (len < 1e-4) return;
        myPos.x += (dx / len) * step;
        myPos.z += (dz / len) * step;
        transform.mesh.rotation.y = Math.atan2(dx, dz);
    }

    _speedFor(id, ecs) {
        const m = ecs.getComponent(id, 'Movement');
        return m?.speed ?? 3;
    }

    _tickStuck(ai, myPos, deltaTime) {
        if (!ai.lastPos) ai.lastPos = myPos.clone();
        const moved = myPos.distanceTo(ai.lastPos);
        // Convert the ~5cm/16ms threshold into ~3 m/s — anything under that
        // counts as "barely moving" and ticks the stuck timer.
        if (moved < EPSILON_PER_FRAME * (deltaTime * 60)) {
            ai.stuckTimer += deltaTime;
            if (ai.stuckTimer > STUCK_THRESHOLD_S) {
                ai.stuckTimer = 0;
                // Stuck recovery: ask Pathfinder for an A* path around the
                // obstacle. If a path is found the worker walks it instead
                // of bee-lining; otherwise reset to IDLE so we re-pick a
                // target next tick.
                if (this._tryRepath(ai, myPos)) return;
                ai.currentTarget = null;
                ai.padId = null;
                ai.fsmState = 'IDLE';
            }
        } else {
            ai.stuckTimer = 0;
        }
        ai.lastPos.copy(myPos);
    }

    _tryRepath(ai, myPos) {
        if (!this.pathfinder || !this._ecs) return false;
        // Determine the goal position based on current state.
        let goal = null;
        const ignore = [];
        if (ai.fsmState === 'MOVE_TO_TREE' && ai.currentTarget != null) {
            const tr = this._ecs.getComponent(ai.currentTarget, 'Transform');
            if (tr?.mesh) { goal = tr.mesh.position; ignore.push(ai.currentTarget); }
        } else if (ai.fsmState === 'MOVE_TO_PAD') {
            const padId = this._findNearestPad(myPos, this._ecs);
            const tr = padId != null ? this._ecs.getComponent(padId, 'Transform') : null;
            if (tr?.mesh) { goal = tr.mesh.position; if (padId != null) ignore.push(padId); }
        }
        if (!goal) return false;
        const path = this.pathfinder.findPath(this._ecs, myPos, goal, ignore);
        if (!path || path.length === 0) return false;
        ai.path = path;
        ai.pathIdx = 0;
        return true;
    }
}
