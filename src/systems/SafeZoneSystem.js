import EventBus from '../core/EventBus.js';

/**
 * SafeZoneSystem — Single source of truth for safe zone state.
 *
 * Queries: ['SafeZone']
 *
 * Each frame (while zone active):
 *   1. Computes world-space bounds from grid + zone.bounds (once per frame).
 *   2. Updates ZoneStatus component on every zone-aware entity (player, enemies).
 *      — ZoneStatus.insideZone      true/false
 *      — ZoneStatus.zoneBoundsWorld { minX, maxX, minZ, maxZ }
 *   3. Reads player's ZoneStatus to toggle Shooter.enabled on transition.
 *   4. Drains zone health while enemies are on the boundary.
 *   5. Hard-pushes any enemy that somehow enters the interior back outside.
 *   6. Destroys zone when health reaches 0.
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
        this._lastHealth      = null; // tracks last emitted health to avoid redundant events
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

            if (!zone.active) {
                // Zone is dead — make sure all statuses are cleared
                this._clearZoneStatuses(zoneAware, ecs);
                continue;
            }

            const wb = this._worldBounds(zone.bounds);

            this._updateZoneStatuses(wb, zoneAware, ecs);
            this._checkPlayerTransition(ecs);
            this._damageFromEnemies(zone, wb, zoneAware, deltaTime, ecs);
            this._blockEnemies(wb, zoneAware, ecs);

            // Emit only when health actually changes (enemies on boundary drain continuously)
            if (zone.health !== this._lastHealth) {
                this._lastHealth = zone.health;
                EventBus.emit('zone:health_changed', {
                    health: zone.health,
                    maxHealth: zone.maxHealth
                });
            }

            if (zone.health <= 0) {
                this._destroyZone(zone, ecs);
            }
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

    /** Drain zone health while hostile entities are pressing against the fence from outside. */
    _damageFromEnemies(zone, wb, zoneAware, deltaTime, ecs) {
        for (const id of zoneAware) {
            const movement = ecs.getComponent(id, 'Movement');
            if (!movement || movement.faction !== 'enemy') continue;

            const t = ecs.getComponent(id, 'Transform');
            if (!t) continue;

            if (this._isNearBoundaryFromOutside(t.mesh.position, wb)) {
                zone.health -= 10 * deltaTime; // 10 HP/sec per enemy pressing the fence
            }
        }
        zone.health = Math.max(zone.health, 0);
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

        EventBus.emit('zone:destroyed');
    }

    // ─── Grid helpers (internal — not exposed to other systems) ─────────────────

    /**
     * True if pos is outside the zone and within REACH units of the nearest fence edge.
     * Uses world-space distance — works correctly because enemies are always pushed
     * outside the zone boundary by CollisionSystem before this check runs.
     */
    _isNearBoundaryFromOutside(pos, wb) {
        const REACH = 1.5; // world units — covers fence thickness + enemy radius with margin
        const inside = pos.x >= wb.minX && pos.x <= wb.maxX
                    && pos.z >= wb.minZ && pos.z <= wb.maxZ;
        if (inside) return false; // enemy somehow inside — don't double-count damage

        // Distance from pos to nearest point on the zone rectangle
        const dx = Math.max(wb.minX - pos.x, 0, pos.x - wb.maxX);
        const dz = Math.max(wb.minZ - pos.z, 0, pos.z - wb.maxZ);
        return (dx * dx + dz * dz) <= REACH * REACH;
    }

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
