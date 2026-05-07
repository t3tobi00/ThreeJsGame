import * as THREE from 'three';

/**
 * Pathfinder — On-demand A* over a coarse grid sampled from static colliders.
 *
 * Usage:
 *   const pf = new Pathfinder({ minX: -15, maxX: 15, minZ: -15, maxZ: 15, cell: 1 });
 *   const path = pf.findPath(ecs, startVec3, endVec3);
 *   // path is an array of THREE.Vector3 waypoints (cell centers), or null.
 *
 * Lazy by design: WorkerAISystem tries direct steering first and only calls
 * findPath() on stuck-detect. There is NO caching — callers should hold
 * onto the returned array themselves and walk it. The grid is rebuilt on
 * every call (cheap for a 30x30 prototype map).
 *
 * Hard cap: ~150 LOC. If A* turns out to be wrong for the prototype, fall
 * back in WorkerAISystem to direct + perpendicular nudge on stuck.
 */
export class Pathfinder {
    constructor({ minX = -15, maxX = 15, minZ = -15, maxZ = 15, cell = 1 } = {}) {
        this.minX = minX; this.maxX = maxX;
        this.minZ = minZ; this.maxZ = maxZ;
        this.cell = cell;
        this.cols = Math.ceil((maxX - minX) / cell);
        this.rows = Math.ceil((maxZ - minZ) / cell);
    }

    /** World (x,z) → grid (col,row). Returns null if outside bounds. */
    _toCell(x, z) {
        const c = Math.floor((x - this.minX) / this.cell);
        const r = Math.floor((z - this.minZ) / this.cell);
        if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return null;
        return { c, r };
    }

    /** Grid (col,row) → world Vector3 at cell center, y=0. */
    _toWorld(c, r) {
        return new THREE.Vector3(
            this.minX + (c + 0.5) * this.cell,
            0,
            this.minZ + (r + 0.5) * this.cell
        );
    }

    /**
     * Build a Set of blocked cell keys ("c,r") by sampling all entities
     * with a static Collider. Box colliders rasterize their AABB; circles
     * rasterize their bounding box.
     */
    _buildObstacles(ecs, ignoreIds = new Set()) {
        const blocked = new Set();
        for (const id of ecs.queryEntities(['Transform', 'Collider'])) {
            if (ignoreIds.has(id)) continue;
            const col = ecs.getComponent(id, 'Collider');
            if (!col?.isStatic) continue;
            const tr = ecs.getComponent(id, 'Transform');
            if (!tr?.mesh?.visible) continue;
            const p = tr.mesh.position;
            const halfW = (col.shape === 'circle') ? (col.radius ?? 0.5) : (col.width ?? 1) / 2;
            const halfD = (col.shape === 'circle') ? (col.radius ?? 0.5) : (col.depth ?? 1) / 2;
            const cMin = this._toCell(p.x - halfW, p.z - halfD);
            const cMax = this._toCell(p.x + halfW, p.z + halfD);
            if (!cMin || !cMax) continue;
            for (let r = cMin.r; r <= cMax.r; r++) {
                for (let c = cMin.c; c <= cMax.c; c++) blocked.add(`${c},${r}`);
            }
        }
        return blocked;
    }

    /** Octile heuristic — admissible for 8-way grid. */
    _h(c1, r1, c2, r2) {
        const dx = Math.abs(c1 - c2), dy = Math.abs(r1 - r2);
        return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
    }

    /**
     * A* over the grid. Returns array of THREE.Vector3 (cell centers),
     * starting from the cell after `start` and ending at `end`'s cell.
     * Returns null if unreachable.
     *
     * @param {object} ecs - ECSManager (used to rasterize obstacles)
     * @param {THREE.Vector3} start
     * @param {THREE.Vector3} end
     * @param {number[]} [ignoreIds=[]] - entity ids whose colliders to ignore (e.g. self, target)
     */
    findPath(ecs, start, end, ignoreIds = []) {
        const ignore = new Set(ignoreIds);
        const blocked = this._buildObstacles(ecs, ignore);

        const startCell = this._toCell(start.x, start.z);
        const endCell = this._toCell(end.x, end.z);
        if (!startCell || !endCell) return null;
        // Allow the goal cell even if it's blocked (worker stops AT the target)
        blocked.delete(`${endCell.c},${endCell.r}`);
        // Allow the start cell even if blocked (worker is already there)
        blocked.delete(`${startCell.c},${startCell.r}`);

        const startKey = `${startCell.c},${startCell.r}`;
        const endKey = `${endCell.c},${endCell.r}`;

        const open = [{ key: startKey, c: startCell.c, r: startCell.r, g: 0, f: this._h(startCell.c, startCell.r, endCell.c, endCell.r) }];
        const cameFrom = new Map(); // key -> parent key
        const gScore = new Map([[startKey, 0]]);

        while (open.length > 0) {
            // Pop lowest f. Sort each iteration — fine for small grids.
            open.sort((a, b) => a.f - b.f);
            const cur = open.shift();
            if (cur.key === endKey) {
                return this._reconstruct(cameFrom, endKey);
            }
            // 8 neighbors
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nc = cur.c + dc, nr = cur.r + dr;
                    if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue;
                    const nKey = `${nc},${nr}`;
                    if (blocked.has(nKey)) continue;
                    const stepCost = (dc !== 0 && dr !== 0) ? Math.SQRT2 : 1;
                    const tentative = cur.g + stepCost;
                    if (tentative < (gScore.get(nKey) ?? Infinity)) {
                        cameFrom.set(nKey, cur.key);
                        gScore.set(nKey, tentative);
                        const f = tentative + this._h(nc, nr, endCell.c, endCell.r);
                        // Replace existing entry if any, otherwise push
                        const existing = open.findIndex(n => n.key === nKey);
                        if (existing >= 0) open[existing] = { key: nKey, c: nc, r: nr, g: tentative, f };
                        else open.push({ key: nKey, c: nc, r: nr, g: tentative, f });
                    }
                }
            }
        }
        return null;
    }

    _reconstruct(cameFrom, endKey) {
        const path = [];
        let cur = endKey;
        while (cur) {
            const [c, r] = cur.split(',').map(Number);
            path.push(this._toWorld(c, r));
            cur = cameFrom.get(cur);
        }
        path.reverse();
        // Drop the start cell — the caller is already there
        if (path.length > 1) path.shift();
        return path;
    }
}
