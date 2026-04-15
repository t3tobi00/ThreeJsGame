import * as THREE from 'three';

/**
 * RoadPath — A spline along which customers walk past the market.
 *
 * Wraps THREE.CatmullRomCurve3 so the customer system can sample positions
 * and tangents from a normalized t∈[0,1] parameter regardless of how many
 * waypoints the level JSON declares.
 *
 * @example
 *   const path = new RoadPath([
 *     new THREE.Vector3(-18, 0, -20),
 *     new THREE.Vector3(  0, 0, -19),
 *     new THREE.Vector3( 18, 0, -20)
 *   ]);
 *   const pos = path.pointAt(0.5);
 *   const dir = path.tangentAt(0.5);
 */
export class RoadPath {
    constructor(waypoints) {
        if (!Array.isArray(waypoints) || waypoints.length < 2) {
            throw new Error('RoadPath: needs at least 2 waypoints');
        }
        const pts = waypoints.map(w =>
            (w instanceof THREE.Vector3) ? w : new THREE.Vector3(w.x ?? 0, w.y ?? 0, w.z ?? 0)
        );
        this.curve  = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
        this.length = this.curve.getLength();
    }

    /** World position at parameter t (clamped to 0..1). */
    pointAt(t) {
        const tt = Math.max(0, Math.min(1, t));
        return this.curve.getPoint(tt);
    }

    /** Unit tangent vector at parameter t (forward direction). */
    tangentAt(t) {
        const tt = Math.max(0, Math.min(1, t));
        return this.curve.getTangent(tt).normalize();
    }
}

const _registry = new Map();

const RoadPathRegistry = {
    register(id, path) { _registry.set(id, path); },
    get(id)            { return _registry.get(id) || null; },
    has(id)            { return _registry.has(id); },
    clear()            { _registry.clear(); }
};

export default RoadPathRegistry;
