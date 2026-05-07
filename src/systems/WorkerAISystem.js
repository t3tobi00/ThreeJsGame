import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import ResourceRegistry from '../core/ResourceRegistry.js';

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
    constructor(scene, pathfinder = null, collectorSystem = null) {
        this.scene = scene;
        this.pathfinder = pathfinder;
        this.collectorSystem = collectorSystem;
    }

    update(entities, deltaTime, ecs) {
        if (!entities.length) return;
        this._ecs = ecs;   // pathfinder needs it on stuck-detect

        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const ai = ecs.getComponent(id, 'WorkerAI');
            const inventory = ecs.getComponent(id, 'InventoryStack');
            if (!transform || !ai || !inventory) continue;
            if (ai.role === 'disabled') continue;

            if (ai.role === 'wood') {
                switch (ai.fsmState) {
                    case 'IDLE':         this._idle(id, ai, transform, inventory, ecs); break;
                    case 'MOVE_TO_TREE': this._moveToTree(id, ai, transform, deltaTime, ecs); break;
                    case 'CHOP':         this._chop(id, ai, transform, deltaTime, ecs); break;
                    case 'MOVE_TO_PAD':  this._moveToPad(id, ai, transform, deltaTime, ecs); break;
                    case 'DEPOSIT':      this._deposit(id, ai, transform, inventory, ecs); break;
                    default:             ai.fsmState = 'IDLE';
                }
            } else if (ai.role === 'essence') {
                switch (ai.fsmState) {
                    case 'IDLE':            this._essenceIdle(id, ai, transform, inventory, ecs); break;
                    case 'MOVE_TO_SIPHON':  this._essenceMoveToSiphon(id, ai, transform, deltaTime, ecs); break;
                    case 'SIPHON':          this._essenceSiphon(id, ai, transform, inventory, deltaTime, ecs); break;
                    case 'MOVE_TO_PAD':     this._moveToPad(id, ai, transform, deltaTime, ecs); break;
                    case 'DEPOSIT':         this._essenceDeposit(id, ai, transform, inventory, ecs); break;
                    default:                ai.fsmState = 'IDLE';
                }
            } else if (ai.role === 'builder') {
                switch (ai.fsmState) {
                    case 'IDLE':            this._builderIdle(id, ai, transform, ecs); break;
                    case 'MOVE_TO_PAD':     this._builderMoveToPad(id, ai, transform, deltaTime, ecs); break;
                    case 'WITHDRAW':        this._builderWithdraw(id, ai, ecs); break;
                    case 'MOVE_TO_ZONE':    this._builderMoveToZone(id, ai, transform, deltaTime, ecs); break;
                    case 'DEPOSIT_ZONE':    this._builderDepositZone(id, ai, transform, ecs); break;
                    case 'BUILDING':        this._builderBuilding(id, ai, deltaTime); break;
                    default:                ai.fsmState = 'IDLE';
                }
            }
        }
    }

    // ─── IDLE ───────────────────────────────────────────────────────
    // PR #4.1: chop until full. Keep finding trees while there's room in
    // the carry stack. Only walk to the storage pad once the inventory is
    // capped (or no more trees are reachable but we still hold something).
    _idle(id, ai, transform, inventory, ecs) {
        const have = inventory.getCountByType('wood');
        const cap = inventory.slotCapacity || 10;

        if (have >= cap) {
            ai.fsmState = 'MOVE_TO_PAD';
            ai.stuckTimer = 0;
            ai.lastPos = transform.mesh.position.clone();
            return;
        }

        const treeId = this._findNearestUnclaimedTree(id, ai, transform.mesh.position, ecs);
        if (treeId == null) {
            if (have > 0) {
                // No more trees in range — drop off what we have.
                ai.fsmState = 'MOVE_TO_PAD';
                ai.stuckTimer = 0;
                ai.lastPos = transform.mesh.position.clone();
            }
            return;
        }

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
    // PR #4.0: walk to the Storage that matches the worker's resource type
    // (wood-worker → wood-storage, essence-collector → essence-storage).
    _moveToPad(id, ai, transform, deltaTime, ecs) {
        const resourceType = ai.role === 'essence' ? 'essence' : 'wood';
        const padId = this._findNearestStorage(transform.mesh.position, ecs, resourceType);
        if (padId == null) { ai.fsmState = 'IDLE'; return; }
        ai.padId = padId;

        const padTr = ecs.getComponent(padId, 'Transform');
        const myPos = transform.mesh.position;
        const padPos = padTr.mesh.position;
        const dist = myPos.distanceTo(padPos);

        if (dist <= ai.depositRange) {
            ai.fsmState = ai.role === 'essence' ? 'DEPOSIT' : 'DEPOSIT';
            return;
        }
        this._stepToward(transform, padPos, this._speedFor(id, ecs) * deltaTime, ai);
        this._tickStuck(ai, myPos, deltaTime);
    }

    // ─── DEPOSIT (wood-worker) ──────────────────────────────────────
    // Transfers each wood mesh from the worker's stack onto the storage's
    // stack via the standard 'item:collected' path. StackSystem listens
    // and re-parents/positions the mesh on the storage entity, so stacking
    // looks identical to the player's stack (uniform shape + spring physics).
    _deposit(id, ai, transform, inventory, ecs) {
        const padId = ai.padId ?? this._findNearestStorage(transform.mesh.position, ecs, 'wood');
        if (padId == null) { ai.fsmState = 'IDLE'; return; }
        const padInv = ecs.getComponent(padId, 'InventoryStack');
        if (!padInv) { ai.fsmState = 'IDLE'; return; }

        while (inventory.getCountByType('wood') > 0 && padInv.canAccept('wood')) {
            const mesh = inventory.popFromSlot('wood');
            if (!mesh) break;
            EventBus.emit('item:collected', { collectorId: padId, itemType: 'wood', mesh });
        }
        EventBus.emit('stack:changed', {
            entityId: id, type: 'wood',
            count: inventory.getCountByType('wood'),
            totalCount: inventory.getTotalCount()
        });
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

    /**
     * Find the nearest Storage entity matching a resource type. Storage
     * entities are tagged 'storage' and have an InventoryStack whose
     * acceptsTypes includes the requested type. PR #4.0 (revised) drops the
     * old Component_Storage in favor of using the standard InventoryStack
     * pipeline so visuals match the player's stack exactly.
     */
    _findNearestStorage(pos, ecs, type) {
        let bestId = null, bestDist = Infinity;
        for (const id of ecs.queryEntities(['Transform', 'InventoryStack', 'Tag'])) {
            const tag = ecs.getComponent(id, 'Tag');
            if (!tag?.has?.('storage')) continue;
            const inv = ecs.getComponent(id, 'InventoryStack');
            if (!inv?.acceptsTypes?.includes?.(type)) continue;
            const tr = ecs.getComponent(id, 'Transform');
            if (!tr?.mesh?.visible) continue;
            const d = tr.mesh.position.distanceTo(pos);
            if (d < bestDist) { bestDist = d; bestId = id; }
        }
        return bestId;
    }

    /** Back-compat alias — wood-worker pad lookups now route to wood storage. */
    _findNearestPad(pos, ecs, type = 'wood') {
        return this._findNearestStorage(pos, ecs, type);
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
        let goal = null;
        const ignore = [];
        if (ai.fsmState === 'MOVE_TO_TREE' && ai.currentTarget != null) {
            const tr = this._ecs.getComponent(ai.currentTarget, 'Transform');
            if (tr?.mesh) { goal = tr.mesh.position; ignore.push(ai.currentTarget); }
        } else if (ai.fsmState === 'MOVE_TO_PAD') {
            // Builder caches its specific storage in ai.padId; wood/essence
            // workers re-resolve by role.
            let padId = ai.padId;
            if (padId == null) {
                const t = ai.role === 'essence' ? 'essence'
                        : ai.role === 'wood'    ? 'wood'
                        : null;
                if (t) padId = this._findNearestStorage(myPos, this._ecs, t);
            }
            const tr = padId != null ? this._ecs.getComponent(padId, 'Transform') : null;
            if (tr?.mesh) { goal = tr.mesh.position; if (padId != null) ignore.push(padId); }
        } else if (ai.fsmState === 'MOVE_TO_ZONE' && ai.currentTarget != null) {
            const tr = this._ecs.getComponent(ai.currentTarget, 'Transform');
            if (tr?.mesh) { goal = tr.mesh.position; ignore.push(ai.currentTarget); }
        }
        if (!goal) return false;
        const path = this.pathfinder.findPath(this._ecs, myPos, goal, ignore);
        if (!path || path.length === 0) return false;
        ai.path = path;
        ai.pathIdx = 0;
        return true;
    }

    // ════════════════════════════════════════════════════════════════
    // ESSENCE-COLLECTOR — Siphon Beam pulls disks from a safe distance.
    // ════════════════════════════════════════════════════════════════

    _SIPHON_RANGE = 12;        // siphon arrives at within 6u of a target disk
    _SIPHON_STAND_DIST = 6;    // worker stops this far from the target disk
    _SIPHON_PULL_TIME = 0.55;  // seconds for one disk to slide along the tether
    _ESSENCE_TETHER_COLOR = 0x66ddff;

    _essenceIdle(id, ai, transform, inventory, ecs) {
        // Carrying essence? Drop it off.
        if (inventory.getCountByType('essence') > 0) {
            ai.fsmState = 'MOVE_TO_PAD';
            ai.stuckTimer = 0;
            ai.lastPos = transform.mesh.position.clone();
            return;
        }
        // Find the nearest essence drop on the ground (claimed by peers? skip).
        const disk = this._findUnclaimedDisk(id, transform.mesh.position, ecs, 'essence');
        if (!disk) return; // nothing to collect, retry next tick
        ai.currentTarget = disk;   // stash the disk mesh on the AI (not an ECS id)
        ai.fsmState = 'MOVE_TO_SIPHON';
        ai.stuckTimer = 0;
        ai.lastPos = transform.mesh.position.clone();
    }

    _essenceMoveToSiphon(id, ai, transform, deltaTime, ecs) {
        const disk = ai.currentTarget;
        if (!disk || disk.collected || disk.isFlying) {
            ai.currentTarget = null;
            ai.fsmState = 'IDLE';
            return;
        }
        const myPos = transform.mesh.position;
        const dist = myPos.distanceTo(disk.position);
        if (dist <= this._SIPHON_STAND_DIST) {
            ai.fsmState = 'SIPHON';
            return;
        }
        this._stepToward(transform, disk.position, this._speedFor(id, ecs) * deltaTime, ai);
        this._tickStuck(ai, myPos, deltaTime);
    }

    _essenceSiphon(id, ai, transform, inventory, deltaTime, ecs) {
        // Lazy-init the active beam tracking the current disk
        if (!ai.siphon) {
            const disk = ai.currentTarget;
            if (!disk || disk.collected) {
                ai.currentTarget = null;
                ai.fsmState = inventory.getCountByType('essence') > 0 ? 'MOVE_TO_PAD' : 'IDLE';
                return;
            }
            // Claim the disk so the magnet pass skips it while the beam owns it
            this.collectorSystem?.claimDisk(disk);
            ai.siphon = {
                disk,
                tether: this._makeTetherMesh(),
                t: 0,
                startPos: disk.position.clone()
            };
            this.scene.add(ai.siphon.tether);
        }

        const jarPos = this._jarWorldPos(transform);
        ai.siphon.t = Math.min(1, ai.siphon.t + deltaTime / this._SIPHON_PULL_TIME);

        // Lerp disk along an arc from groundPos → jar (mid raised by 1.5u for swoosh)
        const t = ai.siphon.t;
        const start = ai.siphon.startPos;
        const end = jarPos;
        const mid = start.clone().lerp(end, 0.5);
        mid.y += 1.5;
        const a = start.clone().lerp(mid, t);
        const b = mid.clone().lerp(end, t);
        ai.siphon.disk.position.copy(a.lerp(b, t));

        this._updateTether(ai.siphon.tether, jarPos, ai.siphon.disk.position);

        if (ai.siphon.t >= 1) {
            // Disk has reached the jar — credit it to the worker's inventory
            // and recycle the disk mesh.
            this.collectorSystem?.consumeDisk(ai.siphon.disk);
            this._creditInventory(inventory, 'essence', 1, id);
            this.scene.remove(ai.siphon.tether);
            ai.siphon = null;
            ai.currentTarget = null;
            // Pull next nearby disk if there is one and we still have room
            if (inventory.getCountByType('essence') < (inventory.slotCapacity ?? 10)) {
                const myPos = transform.mesh.position;
                const next = this._findUnclaimedDisk(id, myPos, ecs, 'essence', this._SIPHON_RANGE);
                if (next && next.position.distanceTo(myPos) <= this._SIPHON_RANGE) {
                    ai.currentTarget = next;
                    return; // re-enter SIPHON next tick
                }
            }
            ai.fsmState = inventory.getCountByType('essence') > 0 ? 'MOVE_TO_PAD' : 'IDLE';
        }
    }

    _essenceDeposit(id, ai, transform, inventory, ecs) {
        const padId = ai.padId ?? this._findNearestStorage(transform.mesh.position, ecs, 'essence');
        if (padId == null) { ai.fsmState = 'IDLE'; return; }
        const padInv = ecs.getComponent(padId, 'InventoryStack');
        if (!padInv) { ai.fsmState = 'IDLE'; return; }

        while (inventory.getCountByType('essence') > 0 && padInv.canAccept('essence')) {
            const mesh = inventory.popFromSlot('essence');
            if (!mesh) break;
            EventBus.emit('item:collected', { collectorId: padId, itemType: 'essence', mesh });
        }
        EventBus.emit('stack:changed', {
            entityId: id, type: 'essence',
            count: inventory.getCountByType('essence'),
            totalCount: inventory.getTotalCount()
        });
        ai.fsmState = 'IDLE';
        ai.padId = null;
    }

    // ── Siphon helpers ───────────────────────────────────────────────

    _findUnclaimedDisk(selfId, pos, ecs, type, maxDist = 30) {
        if (!this.collectorSystem) return null;
        // Build set of disks already claimed by other essence workers
        const claimed = new Set();
        for (const peerId of ecs.queryEntities(['WorkerAI'])) {
            if (peerId === selfId) continue;
            const peer = ecs.getComponent(peerId, 'WorkerAI');
            if (peer?.siphon?.disk) claimed.add(peer.siphon.disk);
            if (peer?.currentTarget && typeof peer.currentTarget === 'object') {
                claimed.add(peer.currentTarget);
            }
        }
        // Walk the disk list (small) and find nearest non-claimed
        let best = null;
        let bestDsq = maxDist * maxDist;
        for (const disk of this.collectorSystem._disks) {
            if (disk.collected || disk.isFlying) continue;
            if (disk.userData?.resourceType !== type) continue;
            if (claimed.has(disk)) continue;
            const dsq = disk.position.distanceToSquared(pos);
            if (dsq < bestDsq) { bestDsq = dsq; best = disk; }
        }
        return best;
    }

    _jarWorldPos(transform) {
        // Jar is parented to the worker's `rightElbow` group at offset (0.04, -0.30, 0.04).
        // Use mesh.getObjectByName + getWorldPosition for an exact world coord.
        const elbow = transform.mesh.getObjectByName?.('rightElbow');
        const out = new THREE.Vector3();
        if (elbow) {
            elbow.getWorldPosition(out);
            // shift to roughly where the jar mesh sits relative to the elbow joint
            out.y -= 0.20;
        } else {
            // Fallback approximation
            out.copy(transform.mesh.position).add(new THREE.Vector3(0.4, 1.0, 0));
        }
        return out;
    }

    _makeTetherMesh() {
        // Thin cyan emissive cylinder, oriented later via _updateTether
        const geo = new THREE.CylinderGeometry(0.04, 0.04, 1, 8, 1, true);
        const mat = new THREE.MeshBasicMaterial({
            color: this._ESSENCE_TETHER_COLOR,
            transparent: true,
            opacity: 0.85
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        return mesh;
    }

    _updateTether(mesh, a, b) {
        // Position at midpoint, scale Y to length, rotate to align +Y with (b-a)
        const dir = b.clone().sub(a);
        const len = dir.length();
        if (len < 1e-3) { mesh.visible = false; return; }
        mesh.visible = true;
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mesh.position.copy(mid);
        mesh.scale.set(1, len, 1);
        // Build a quaternion that takes (0,1,0) → dir.normalized()
        const up = new THREE.Vector3(0, 1, 0);
        const target = dir.clone().normalize();
        mesh.quaternion.setFromUnitVectors(up, target);
    }

    _creditInventory(inventory, type, n, ownerId) {
        // Use real ResourceRegistry stacked meshes (same as the player's
        // magnet pickup path) and route through the standard 'item:collected'
        // event so StackSystem re-parents + positions them on the worker's
        // back. PR #4.1 will land SpringStackAnim on workers; for now the
        // mesh sits at the worker's anchor offset without spring physics,
        // but it's the correct shape/scale.
        for (let i = 0; i < n; i++) {
            const mesh = ResourceRegistry.createMesh(type, 'stacked');
            EventBus.emit('item:collected', { collectorId: ownerId, itemType: type, mesh });
        }
    }

    // ════════════════════════════════════════════════════════════════
    // BUILDER — Pulls from pad's stockpile, ferries to active ghost zones.
    // ════════════════════════════════════════════════════════════════

    _BUILDER_RETRY_S = 1.0;

    // PR #4.0: Builder ferries one resource type per trip. The carrying ledger
    // tracks what we picked up; ai._tripType records which storage we visit
    // this trip ('wood' or 'essence'). Multiple trips per zone are normal.
    _builderIdle(id, ai, transform, ecs) {
        const target = this._findFundableZone(id, transform.mesh.position, ecs);
        if (!target) return;

        const tripType = (target.need.wood || 0) > 0 ? 'wood' : 'essence';
        const storageId = this._findNearestStorage(transform.mesh.position, ecs, tripType);
        if (storageId == null) return;
        const inv = ecs.getComponent(storageId, 'InventoryStack');
        if (!inv || inv.getCountByType(tripType) <= 0) return;

        ai.currentTarget = target.zoneId;
        ai.padId = storageId;
        ai._tripType = tripType;
        ai.fsmState = 'MOVE_TO_PAD';
        ai.lastPos = transform.mesh.position.clone();
        ai.stuckTimer = 0;
        ai.carrying = { wood: 0, essence: 0, _need: target.need };
    }

    _builderMoveToPad(id, ai, transform, deltaTime, ecs) {
        const padId = ai.padId;
        if (padId == null) { ai.fsmState = 'IDLE'; return; }
        const padTr = ecs.getComponent(padId, 'Transform');
        if (!padTr) { ai.fsmState = 'IDLE'; return; }
        const myPos = transform.mesh.position;
        if (myPos.distanceTo(padTr.mesh.position) <= ai.depositRange) {
            ai.fsmState = 'WITHDRAW';
            return;
        }
        this._stepToward(transform, padTr.mesh.position, this._speedFor(id, ecs) * deltaTime, ai);
        this._tickStuck(ai, myPos, deltaTime);
    }

    _builderWithdraw(id, ai, ecs) {
        const inv = ai.padId != null ? ecs.getComponent(ai.padId, 'InventoryStack') : null;
        const need = ai.carrying?._need;
        const tripType = ai._tripType;
        if (!inv || !need || !tripType) { ai.fsmState = 'IDLE'; return; }

        // Pop one mesh per resource the builder intends to carry. Meshes
        // are discarded — the builder represents the carry abstractly via
        // ai.carrying counts. Visible "carrying" beyond this is PR #4.1.
        const want = need[tripType] || 0;
        let got = 0;
        for (let i = 0; i < want; i++) {
            const mesh = inv.popFromSlot(tripType);
            if (!mesh) break;
            if (mesh.parent) mesh.parent.remove(mesh);
            got++;
        }
        ai.carrying[tripType] += got;

        if ((ai.carrying.wood + ai.carrying.essence) <= 0) {
            ai.fsmState = 'IDLE';
            return;
        }
        ai.fsmState = 'MOVE_TO_ZONE';
        ai.stuckTimer = 0;
    }

    _builderMoveToZone(id, ai, transform, deltaTime, ecs) {
        const zoneId = ai.currentTarget;
        if (zoneId == null || !ecs.hasComponents(zoneId, ['Transform', 'UnlockZone'])) {
            // Zone got built/destroyed mid-walk — return whatever we hold
            this._builderReturnLeftovers(ai, ecs);
            ai.fsmState = 'IDLE';
            return;
        }
        const zoneTr = ecs.getComponent(zoneId, 'Transform');
        const zone = ecs.getComponent(zoneId, 'UnlockZone');
        if (!zoneTr.mesh.visible || this._zoneIsFunded(zone)) {
            this._builderReturnLeftovers(ai, ecs);
            ai.fsmState = 'IDLE';
            return;
        }
        const myPos = transform.mesh.position;
        if (myPos.distanceTo(zoneTr.mesh.position) <= zone.range) {
            ai.fsmState = 'DEPOSIT_ZONE';
            return;
        }
        this._stepToward(transform, zoneTr.mesh.position, this._speedFor(id, ecs) * deltaTime, ai);
        this._tickStuck(ai, myPos, deltaTime);
    }

    _builderDepositZone(id, ai, transform, ecs) {
        const zoneId = ai.currentTarget;
        if (zoneId == null) { ai.fsmState = 'IDLE'; return; }
        const zone = ecs.getComponent(zoneId, 'UnlockZone');
        if (!zone) { ai.fsmState = 'IDLE'; return; }

        for (const t of ['wood', 'essence']) {
            const need = (zone.cost?.[t] ?? 0) - (zone.progress?.[t] ?? 0);
            const give = Math.min(ai.carrying[t] || 0, Math.max(0, need));
            if (give > 0) {
                zone.progress[t] = (zone.progress[t] ?? 0) + give;
                ai.carrying[t] -= give;
            }
        }

        // If this deposit completed the zone, fire zone:funded (BuildSystem
        // turns this into zone:built which the level-side fence-reveal
        // listener picks up and animates over 6s — see main.js). Builder
        // stays at the site for the same duration, in BUILDING state, so
        // the visual reads as "the worker is constructing the wall."
        const fundedNow = this._zoneIsFunded(zone);
        this._builderReturnLeftovers(ai, ecs);

        if (fundedNow) {
            const tagComp = ecs.getComponent(zoneId, 'Tag');
            EventBus.emit('zone:funded', {
                zoneId, carrierId: id, type: zone.type,
                builds: zone.builds, spawns: zone.spawns,
                spawnCount: zone.spawnCount, tags: tagComp?.tags
            });
            ai.fsmState = 'BUILDING';
            ai.buildTimer = 6.0;
        } else {
            ai.fsmState = 'IDLE';
        }
        ai.currentTarget = null;
    }

    _builderBuilding(id, ai, deltaTime) {
        ai.buildTimer -= deltaTime;
        if (ai.buildTimer <= 0) {
            ai.buildTimer = 0;
            ai.fsmState = 'IDLE';
        }
    }

    _builderReturnLeftovers(ai, ecs) {
        for (const t of ['wood', 'essence']) {
            const n = ai.carrying[t] || 0;
            if (n <= 0) continue;
            const sid = this._findNearestStorage(new THREE.Vector3(), ecs, t);
            if (sid == null) continue;
            // Push N fresh stacked meshes back into the storage via the
            // standard collected-event path so they appear in the visible stack.
            for (let i = 0; i < n; i++) {
                const mesh = ResourceRegistry.createMesh(t, 'stacked');
                EventBus.emit('item:collected', { collectorId: sid, itemType: t, mesh });
            }
            ai.carrying[t] = 0;
        }
        ai.carrying = { wood: 0, essence: 0 };
    }

    _findFundableZone(selfId, pos, ecs) {
        const claimed = new Set();
        for (const peerId of ecs.queryEntities(['WorkerAI'])) {
            if (peerId === selfId) continue;
            const peer = ecs.getComponent(peerId, 'WorkerAI');
            if (peer?.role === 'builder' && peer.currentTarget != null) {
                claimed.add(peer.currentTarget);
            }
        }
        const stockTotals = { wood: 0, essence: 0 };
        for (const sid of ecs.queryEntities(['Transform', 'InventoryStack', 'Tag'])) {
            const tag = ecs.getComponent(sid, 'Tag');
            if (!tag?.has?.('storage')) continue;
            const inv = ecs.getComponent(sid, 'InventoryStack');
            if (!inv?.acceptsTypes) continue;
            for (const t of inv.acceptsTypes) {
                if (t === 'wood' || t === 'essence') {
                    stockTotals[t] += inv.getCountByType(t);
                }
            }
        }

        let best = null, bestDist = Infinity;
        for (const zoneId of ecs.queryEntities(['Transform', 'UnlockZone'])) {
            if (claimed.has(zoneId)) continue;
            const zone = ecs.getComponent(zoneId, 'UnlockZone');
            const tr = ecs.getComponent(zoneId, 'Transform');
            if (!tr?.mesh?.visible) continue;
            if (this._zoneIsFunded(zone)) continue;

            const need = {};
            let canAny = false;
            for (const t of ['wood', 'essence']) {
                const remaining = (zone.cost?.[t] ?? 0) - (zone.progress?.[t] ?? 0);
                if (remaining <= 0) continue;
                const have = stockTotals[t] || 0;
                if (have <= 0) continue;
                need[t] = Math.min(remaining, have);
                canAny = true;
            }
            if (!canAny) continue;

            const d = tr.mesh.position.distanceTo(pos);
            if (d < bestDist) { bestDist = d; best = { zoneId, need }; }
        }
        return best;
    }

    _zoneIsFunded(zone) {
        if (!zone?.cost) return false;
        for (const [t, c] of Object.entries(zone.cost)) {
            if ((zone.progress?.[t] ?? 0) < c) return false;
        }
        return true;
    }
}
