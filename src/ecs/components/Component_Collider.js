/**
 * Component_Collider — Marks an entity as a solid or trigger collider.
 * Collision is resolved in 2D on the XZ plane only.
 */
export class Component_Collider {
    constructor({
        shape    = 'box',   // 'box' or 'circle'
        width    = 1.0,     // box half-width  (X axis)
        depth    = 1.0,     // box half-depth  (Z axis)
        radius   = 0.5,     // circle radius (shape === 'circle')
        isStatic = true,    // static colliders don't get pushed
        isTrigger = false   // triggers detect overlap but don't push
    } = {}) {
        this.shape     = shape;
        this.width     = width;
        this.depth     = depth;
        this.radius    = radius;
        this.isStatic  = isStatic;
        this.isTrigger = isTrigger;
        this.disabled  = false; // set true to skip (e.g. open gate)
    }
}
