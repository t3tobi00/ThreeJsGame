import EventBus from '../core/EventBus.js';

/**
 * SafeZoneSystem — Single source of truth for safe zone state.
 *
 * Queries: ['SafeZone']
 *
 * Zone is active when all requiredGateCount gates are alive.
 * When any gate dies (HealthSystem destroys it), the gate count drops
 * and the zone deactivates — clearing ZoneStatus flags, disabling
 * fence colliders, and re-enabling player shooting.
 *
 * Other systems (EnemySystem, ContactDamageSystem) read ZoneStatus only —
 * they have zero direct knowledge of zones, grids, or bounds.
 */
export class SafeZoneSystem {
    constructor(grid) {
        this._grid            = grid;
        this._playerId        = null;
        this._playerWasInside = null;
        this._fenceGroup      = null; // THREE.Group — set via setFenceGroup()
    }

    setPlayer(playerId) {
        this._playerId = playerId;
    }

    /** Called from main.js after SceneLoader returns the fence group. */
    setFenceGroup(group) {
        this._fenceGroup = group;
    }

    update(entities, deltaTime, ecs) {
        // All entities that participate in zone status tracking
        const zoneAware = ecs.queryEntities(['Transform', 'ZoneStatus']);

        for (const zoneId of entities) {
            const zone = ecs.getComponent(zoneId, 'SafeZone');
            if (!zone) continue;

            // Count living gates
            const gateEntities = ecs.queryEntities(['Gate', 'Health']);
            const gateCount = gateEntities.length;
            const shouldBeActive = gateCount >= zone.requiredGateCount;

            if (zone.active && !shouldBeActive) {
                this._destroyZone(zone, ecs);
            } else if (!zone.active && shouldBeActive) {
                this._reactivateZone(zone);
            }

            if (!zone.active) {
                this._clearZoneStatuses(zoneAware, ecs);
                continue;
            }

            const wb = this._worldBounds(zone.bounds);

            this._updateZoneStatuses(wb, zoneAware, ecs);
            this._checkPlayerTransition(ecs);
            this._blockEnemies(wb, zoneAware, ecs);
        }
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    /** Compute world-space AABB of zone bounds. Called once per frame. */
    _worldBounds(bounds) {
        const { origin, cellSize } = this._grid;
        return {
            minX: origin.x + bounds.minCol * cellSize,
            maxX: origin.x + (bounds.maxCol + 1) * cellSize,
            minZ: origin.z + bounds.minRow * cellSize,
            maxZ: origin.z + (bounds.maxRow + 1) * cellSize,
        };
    }

    /**
     * Set ZoneStatus.insideZone and ZoneStatus.zoneBoundsWorld for every
     * zone-aware entity. Consumers (EnemySystem, ContactDamageSystem) read these.
     */
    _updateZoneStatuses(wb, zoneAware, ecs) {
        for (const id of zoneAware) {
            const t      = ecs.getComponent(id, 'Transform');
            const status = ecs.getComponent(id, 'ZoneStatus');
            if (!t || !status) continue;
            const p = t.mesh.position;
            status.insideZone      = p.x >= wb.minX && p.x <= wb.maxX
                                  && p.z >= wb.minZ && p.z <= wb.maxZ;
            status.zoneBoundsWorld = wb; // same object — consumers should not mutate it
        }
    }

    _clearZoneStatuses(zoneAware, ecs) {
        for (const id of zoneAware) {
            const status = ecs.getComponent(id, 'ZoneStatus');
            if (status) { status.insideZone = false; status.zoneBoundsWorld = null; }
        }
    }

    /** Toggle player Shooter.enabled on zone entry/exit transitions. */
    _checkPlayerTransition(ecs) {
        if (this._playerId == null) return;
        const status = ecs.getComponent(this._playerId, 'ZoneStatus');
        if (!status) return;

        const inside = status.insideZone;
        if (inside === this._playerWasInside) return;
        this._playerWasInside = inside;

        const shooter = ecs.getComponent(this._playerId, 'Shooter');
        if (shooter) shooter.enabled = !inside;

        EventBus.emit(inside ? 'zone:player_entered' : 'zone:player_exited');
    }

    /** Hard push-back for hostile entities that breach the zone interior. */
    _blockEnemies(wb, zoneAware, ecs) {
        for (const id of zoneAware) {
            const movement = ecs.getComponent(id, 'Movement');
            if (!movement || movement.faction !== 'enemy') continue;

            const t = ecs.getComponent(id, 'Transform');
            if (!t) continue;

            const status = ecs.getComponent(id, 'ZoneStatus');
            if (status?.insideZone) {
                this._pushOutside(t.mesh.position, wb);
            }
        }
    }

    _destroyZone(zone, ecs) {
        zone.active = false;

        if (this._fenceGroup) this._fenceGroup.visible = false;

        for (const colId of zone.fenceColliderIds) {
            const col = ecs.getComponent(colId, 'Collider');
            if (col) col.disabled = true;
        }

        // Re-enable player shooting unconditionally
        if (this._playerId != null) {
            const shooter = ecs.getComponent(this._playerId, 'Shooter');
            if (shooter) shooter.enabled = true;
        }

        this._playerWasInside = null;
        EventBus.emit('zone:destroyed');
    }

    _reactivateZone(zone) {
        zone.active = true;

        if (this._fenceGroup) this._fenceGroup.visible = true;

        for (const colId of zone.fenceColliderIds) {
            // Note: collider entities may have been destroyed — check existence
        }

        this._playerWasInside = null;
        EventBus.emit('zone:reactivated');
    }

    // ─── Grid helpers (internal — not exposed to other systems) ─────────────────

    _pushOutside(pos, wb) {
        const dMinX = pos.x - wb.minX;
        const dMaxX = wb.maxX - pos.x;
        const dMinZ = pos.z - wb.minZ;
        const dMaxZ = wb.maxZ - pos.z;
        const min   = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);

        if      (min === dMinX) pos.x = wb.minX - 0.1;
        else if (min === dMaxX) pos.x = wb.maxX + 0.1;
        else if (min === dMinZ) pos.z = wb.minZ - 0.1;
        else                    pos.z = wb.maxZ + 0.1;
    }
}
