/**
 * Component_Waypoints — Runtime path state for any entity walking a
 * drag-drawn route. Populated by DragInputSystem, consumed by
 * WaypointFollowSystem.
 *
 * onInterruptResume policy:
 *   'destination' — after a higher-priority task (combat) releases,
 *                   resume walking from current position toward the
 *                   remaining waypoints. (Launch default.)
 *   'idle'        — after an interrupt, abandon the path. (Parked TODO.)
 */
export class Component_Waypoints {
    constructor({
        onInterruptResume = 'destination',
        arrivalThreshold = 0.25
    } = {}) {
        this.onInterruptResume = onInterruptResume;
        this.arrivalThreshold = arrivalThreshold;

        // Runtime
        this.list = [];
        this.currentIdx = 0;
        this.finalDestination = null;
        this.active = false;
    }
}
