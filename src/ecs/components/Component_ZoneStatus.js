/**
 * Component_ZoneStatus — Tracks whether an entity is inside an active safe zone.
 *
 * Set each frame by SafeZoneSystem. Read by:
 *   - EnemySystem    → redirect chase target to zone boundary
 *   - ContactDamageSystem → skip damage across zone wall
 *
 * zoneBoundsWorld is the precomputed world-space AABB of the zone, populated by
 * SafeZoneSystem so consumers (e.g. EnemySystem) never need a grid reference.
 */
export class Component_ZoneStatus {
    constructor() {
        this.insideZone      = false;
        this.zoneBoundsWorld = null; // { minX, maxX, minZ, maxZ } — set by SafeZoneSystem
    }
}
