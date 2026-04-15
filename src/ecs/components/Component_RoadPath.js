/**
 * RoadPath — Reference into the RoadPathRegistry plus current spline param.
 * The actual THREE.CatmullRomCurve3 is owned by RoadPathRegistry so multiple
 * customers can share one road definition.
 *
 * pathId:    Key into RoadPathRegistry (e.g. 'market-road-1').
 * t:         Position along the spline, 0..1.
 * direction: +1 walks t→1, -1 walks t→0. Customer faces tangent * direction.
 */
export class Component_RoadPath {
    constructor({ pathId = '', t = 0, direction = 1 } = {}) {
        this.pathId    = pathId;
        this.t         = t;
        this.direction = direction;
    }
}
