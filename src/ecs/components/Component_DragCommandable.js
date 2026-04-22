/**
 * Component_DragCommandable — Tag + visual config marking an entity as
 * selectable/steerable via the drag-to-waypoint input.
 *
 * Character-agnostic: any entity with this component (plus Waypoints,
 * BehaviorState, Movement, Transform) can receive drag-drawn paths.
 */
export class Component_DragCommandable {
    constructor({
        enabled = true,
        ringColor = 0xffd700,
        trailColor = 0xffd700,
        trailWidth = 0.15,
        ringRadius = 0.7,
        pickRadius = 0.8
    } = {}) {
        if (typeof ringColor === 'string')  ringColor  = parseInt(ringColor, 16);
        if (typeof trailColor === 'string') trailColor = parseInt(trailColor, 16);

        this.enabled = enabled;
        this.ringColor = ringColor;
        this.trailColor = trailColor;
        this.trailWidth = trailWidth;
        this.ringRadius = ringRadius;
        this.pickRadius = pickRadius;

        // Runtime
        this.selected = false;
        this.ringMesh = null;
    }
}
