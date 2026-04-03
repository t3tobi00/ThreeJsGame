/**
 * SpatialHash — Fast 2D proximity queries on the XZ plane.
 *
 * Usage:
 *   const hash = new SpatialHash(3);   // 3-unit cells
 *   hash.clear();
 *   hash.insert(entityId, x, z);
 *   const nearby = hash.query(x, z, radius);  // returns array of entity IDs
 *
 * Rebuilt each frame — cheap for <200 entities, eliminates O(N*M) brute force.
 */
export class SpatialHash {
    constructor(cellSize = 3) {
        this._cellSize = cellSize;
        this._cells = new Map();
    }

    clear() {
        this._cells.clear();
    }

    insert(id, x, z) {
        const key = this._key(x, z);
        let cell = this._cells.get(key);
        if (!cell) {
            cell = [];
            this._cells.set(key, cell);
        }
        cell.push(id);
    }

    /** Returns all entity IDs within radius of (x, z). */
    query(x, z, radius) {
        const results = [];
        const r = Math.ceil(radius / this._cellSize);
        const cx = Math.floor(x / this._cellSize);
        const cz = Math.floor(z / this._cellSize);

        for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
                const cell = this._cells.get(`${cx + dx},${cz + dz}`);
                if (cell) {
                    for (let i = 0; i < cell.length; i++) {
                        results.push(cell[i]);
                    }
                }
            }
        }
        return results;
    }

    _key(x, z) {
        return `${Math.floor(x / this._cellSize)},${Math.floor(z / this._cellSize)}`;
    }
}
