/**
 * Component_EnemyAI — Data-driven enemy AI behavior.
 *
 * Controls wander/chase state machine parameters.
 * Add to any enemy archetype JSON to customize AI per enemy type.
 *
 * `permanentChase` (default false) makes a zombie commit to chasing the
 * nearest aggro target from anywhere on the map, ignoring senseRadius and
 * the wander/chase transition logic. Used for the pre-placed marchers
 * that walk south from the spawn area at game start.
 *
 * Sense + leash fields (V1 Shambler spec, PHASE_2_ENTITIES.md §2.5):
 *   • senseRadius   — per-zombie 8-tile sense circle. Falls back to
 *                     `aggroRadius` for legacy archetypes that haven't
 *                     migrated to the new field name yet.
 *   • wanderLeash   — wander random walk is anchored at the zombie's
 *                     spawn-point position, never drifts further than
 *                     this distance from it. Fallback: `wanderRadius`.
 *   • aggroPriority — ordered list of tie-breakers: 'closest' (always
 *                     first), 'prefer_worker_on_tie', etc.
 *
 * Runtime fields (mutated by EnemySystem; nullable defaults for archetypes):
 *   • spawnPointId      — entity id of this zombie's home cemetery.
 *   • currentTargetId   — entity id (or sentinel for player) currently
 *                         being chased; used for the 4-attacker stacking cap.
 *   • lastPackBroadcast — timestamp of the last pack-aggro signal sent;
 *                         throttle keeps a single transition from
 *                         re-broadcasting every frame.
 */
export class Component_EnemyAI {
    constructor({
        aggroRadius = 10,
        senseRadius = null,
        herdRadius = 5,
        wanderSpeed = 0.4,
        wanderRadius = 8,
        wanderLeash = null,
        wanderPauseMin = 1.0,
        wanderPauseMax = 3.0,
        permanentChase = false,
        aggroPriority = ['closest', 'prefer_worker_on_tie']
    } = {}) {
        this.aggroRadius = aggroRadius;
        this.senseRadius = senseRadius != null ? senseRadius : aggroRadius;
        this.herdRadius = herdRadius;
        this.wanderSpeed = wanderSpeed;         // multiplier of Movement.speed
        this.wanderRadius = wanderRadius;
        this.wanderLeash = wanderLeash != null ? wanderLeash : wanderRadius;
        this.wanderPauseMin = wanderPauseMin;
        this.wanderPauseMax = wanderPauseMax;
        this.permanentChase = !!permanentChase;
        this.aggroPriority = Array.isArray(aggroPriority) ? aggroPriority : [];

        // Runtime state — written by EnemySystem.
        this.spawnPointId = null;
        this.currentTargetId = null;
        this.lastPackBroadcast = 0;
    }
}
