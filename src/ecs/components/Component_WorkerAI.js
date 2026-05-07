/**
 * WorkerAI — Per-worker FSM state for Act 3 automation.
 *
 * role:           'wood' | 'essence' | 'builder' | 'disabled'
 *                 PR #3.2 implements wood only; essence/builder use 'disabled'
 *                 (visual only, no logic) until PR #3.3.
 * scanRadius:     how far the worker scans for targets (trees, drops, zones).
 * attackRange:    distance at which the worker stops walking and starts
 *                 chopping a tree. Also used for deposit-range check at pad.
 * attackDamage:   damage dealt per attackCooldown tick to a tree's Health.
 * attackCooldown: seconds between chops.
 * depositRange:   distance at which the worker stops at the pad to deposit.
 *
 * Runtime fields (mutated by WorkerAISystem):
 *   fsmState     'IDLE' | 'MOVE_TO_TREE' | 'CHOP' | 'MOVE_TO_PAD' | 'DEPOSIT'
 *   currentTarget  entity id of the resource the worker is chasing
 *   padId          entity id of the deposit target (cached after deposit start)
 *   attackTimer    counts up to attackCooldown
 *   stuckTimer     seconds the worker has barely moved while in a MOVE state
 *   lastPos        last frame position (Vector3) for stuck detection
 */
export class Component_WorkerAI {
    constructor({
        role = 'wood',
        scanRadius = 15,
        attackRange = 1.6,
        attackDamage = 1,
        attackCooldown = 0.6,
        depositRange = 2.0
    } = {}) {
        this.role = role;
        this.scanRadius = scanRadius;
        this.attackRange = attackRange;
        this.attackDamage = attackDamage;
        this.attackCooldown = attackCooldown;
        this.depositRange = depositRange;
        // Runtime
        this.fsmState = 'IDLE';
        this.currentTarget = null;
        this.padId = null;
        this.attackTimer = 0;
        this.stuckTimer = 0;
        this.lastPos = null;
        // Pathfinder fallback — populated by WorkerAISystem on stuck-detect.
        // While `path` is non-empty the worker walks the waypoints instead
        // of direct steering. Cleared once the final waypoint is reached.
        this.path = null;
        this.pathIdx = 0;
        // Essence-Collector siphon state — set while a beam is active.
        // siphon.disk: the disk mesh being pulled
        // siphon.tether: the tether mesh (cylinder)
        // siphon.t: progress 0→1 along the pull arc
        // siphon.startPos: where the disk lifted off (cloned)
        this.siphon = null;
        // Builder runtime — small inventory ledger (avoids InventoryStack
        // mesh juggling; deposit logic mutates zone.progress directly).
        this.carrying = { wood: 0, essence: 0 };
    }
}
