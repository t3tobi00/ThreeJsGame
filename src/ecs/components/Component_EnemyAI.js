/**
 * Component_EnemyAI — Data-driven enemy AI behavior.
 *
 * Controls wander/chase state machine parameters.
 * Add to any enemy archetype JSON to customize AI per enemy type.
 *
 * `permanentChase` (default false) makes a zombie commit to chasing the
 * nearest aggro target from anywhere on the map, ignoring aggroRadius and
 * the wander/chase transition logic. Used for the pre-placed marchers
 * that walk south from the spawn area at game start.
 */
export class Component_EnemyAI {
    constructor({
        aggroRadius = 10,
        herdRadius = 5,
        wanderSpeed = 0.4,
        wanderRadius = 8,
        wanderPauseMin = 1.0,
        wanderPauseMax = 3.0,
        permanentChase = false
    } = {}) {
        this.aggroRadius = aggroRadius;
        this.herdRadius = herdRadius;
        this.wanderSpeed = wanderSpeed;         // multiplier of Movement.speed
        this.wanderRadius = wanderRadius;
        this.wanderPauseMin = wanderPauseMin;
        this.wanderPauseMax = wanderPauseMax;
        this.permanentChase = !!permanentChase;
    }
}
