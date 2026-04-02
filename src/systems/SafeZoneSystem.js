import EventBus from '../core/EventBus.js';

/**
 * SafeZoneSystem — Manages the safe zone boundary, health, and rules.
 *
 * Queries: ['SafeZone']
 *
 * Rules while zone is active (health > 0):
 *   - Player inside zone  → Shooter.enabled = false (can't fire outward)
 *   - Player outside zone → Shooter.enabled = true
 *   - Enemy on boundary cell → zone health drains (10 HP/sec per enemy)
 *   - Enemy strictly inside zone → hard push back outside
 *
 * When health reaches 0:
 *   - Fence logs hidden, fence colliders disabled
 *   - Zone deactivated permanently (until rebuilt — future feature)
 *   - Player shooter re-enabled unconditionally
 */
export class SafeZoneSystem {
    constructor(grid) {
        this._grid            = grid;
        this._playerTransform = null;
        this._playerId        = null;
        this._playerWasInside = null; // null = not yet determined
    }

    setPlayer(playerId, playerTransform) {
        this._playerId        = playerId;
        this._playerTransform = playerTransform;
    }

    update(entities, deltaTime, ecs) {
        if (!this._playerTransform) return;

        for (const zoneId of entities) {
            const zone = ecs.getComponent(zoneId, 'SafeZone');
            if (!zone || !zone.active) continue;

            this._checkPlayerTransition(zone, ecs);
            this._damageFromEnemies(zone, deltaTime, ecs);
            this._blockEnemies(zone, ecs);

            if (zone.health <= 0) {
                this._destroyZone(zone, ecs);
            }
        }
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    _checkPlayerTransition(zone, ecs) {
        const inside = this._isInside(this._playerTransform.mesh.position, zone.bounds);
        if (inside === this._playerWasInside) return; // no change
        this._playerWasInside = inside;

        const shooter = this._playerId != null
            ? ecs.getComponent(this._playerId, 'Shooter') : null;
        if (shooter) shooter.enabled = !inside; // disable shooting while inside safe zone

        EventBus.emit(inside ? 'zone:player_entered' : 'zone:player_exited');
    }

    _damageFromEnemies(zone, deltaTime, ecs) {
        const enemies = ecs.queryEntities(['Transform', 'EnemyAI']);
        for (const id of enemies) {
            const t = ecs.getComponent(id, 'Transform');
            if (!t) continue;
            if (this._isOnBoundary(t.mesh.position, zone.bounds)) {
                zone.health -= 10 * deltaTime; // 10 HP/sec per enemy on boundary
            }
        }
        zone.health = Math.max(zone.health, 0);
    }

    /** Hard push-back for any enemy that somehow enters the zone interior. */
    _blockEnemies(zone, ecs) {
        const enemies = ecs.queryEntities(['Transform', 'EnemyAI']);
        for (const id of enemies) {
            const t = ecs.getComponent(id, 'Transform');
            if (!t) continue;
            if (this._isStrictlyInside(t.mesh.position, zone.bounds)) {
                this._pushOutside(t.mesh.position, zone.bounds);
            }
        }
    }

    _destroyZone(zone, ecs) {
        zone.active = false;

        // Hide visual fence
        if (zone.fenceGroup) zone.fenceGroup.visible = false;

        // Disable all fence edge colliders
        for (const colId of zone.fenceColliderIds) {
            const col = ecs.getComponent(colId, 'Collider');
            if (col) col.disabled = true;
        }

        // Always re-enable player shooting when zone dies
        const shooter = this._playerId != null
            ? ecs.getComponent(this._playerId, 'Shooter') : null;
        if (shooter) shooter.enabled = true;

        EventBus.emit('zone:destroyed');
    }

    // ─── Grid cell helpers ───────────────────────────────────────────────────────

    _getCell(pos) {
        const col = Math.floor((pos.x - this._grid.origin.x) / this._grid.cellSize);
        const row = Math.floor((pos.z - this._grid.origin.z) / this._grid.cellSize);
        return { row, col };
    }

    /** True if pos maps to any cell within the zone boundary (inclusive). */
    _isInside(pos, b) {
        const { row, col } = this._getCell(pos);
        return row >= b.minRow && row <= b.maxRow && col >= b.minCol && col <= b.maxCol;
    }

    /** True if pos maps to a cell strictly interior (not on the boundary ring). */
    _isStrictlyInside(pos, b) {
        const { row, col } = this._getCell(pos);
        return row > b.minRow && row < b.maxRow && col > b.minCol && col < b.maxCol;
    }

    /** True if pos is inside the zone AND on the outermost ring of cells (fence cells). */
    _isOnBoundary(pos, b) {
        const { row, col } = this._getCell(pos);
        const inZone = row >= b.minRow && row <= b.maxRow && col >= b.minCol && col <= b.maxCol;
        if (!inZone) return false;
        return row === b.minRow || row === b.maxRow || col === b.minCol || col === b.maxCol;
    }

    /** Push pos to just outside the nearest zone boundary edge. */
    _pushOutside(pos, b) {
        const { origin, cellSize } = this._grid;
        const minX = origin.x + b.minCol * cellSize;
        const maxX = origin.x + (b.maxCol + 1) * cellSize;
        const minZ = origin.z + b.minRow * cellSize;
        const maxZ = origin.z + (b.maxRow + 1) * cellSize;

        const dMinX = pos.x - minX;
        const dMaxX = maxX - pos.x;
        const dMinZ = pos.z - minZ;
        const dMaxZ = maxZ - pos.z;
        const minDist = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);

        if      (minDist === dMinX) pos.x = minX - 0.1;
        else if (minDist === dMaxX) pos.x = maxX + 0.1;
        else if (minDist === dMinZ) pos.z = minZ - 0.1;
        else                        pos.z = maxZ + 0.1;
    }
}
