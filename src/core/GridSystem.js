import * as THREE from 'three';

/**
 * GridSystem — single source of truth for grid ↔ world math.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Grid layout
 * ──────────────────────────────────────────────────────────────────────────
 *   • Cells numbered left-to-right, top-to-bottom (row-major):
 *        0  1  2  3  4
 *        5  6  7  8  9
 *       10 11 12 13 14
 *   • "Top" = most negative Z, "Bottom" = most positive Z.
 *   • row → world Z, col → world X. Y is always handled separately.
 *   • Grid is configured per-level in levelData.grid
 *     ({ origin: {x, z}, cellSize, cols, rows }) and instantiated once
 *     in SceneLoader.load(). To cover more ground later, bump `cols`/`rows`
 *     and push `origin` further negative — no code changes required.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Anchors (compass aligned to grid axes)
 * ──────────────────────────────────────────────────────────────────────────
 *   Describes WHERE within the footprint the returned world point sits.
 *
 *          n  (−Z)
 *      nw ─┬─ ne
 *       │  │  │
 *  w ───┼──c──┼─── e     (c = 'center', default)
 *       │  │  │
 *      sw ─┴─ se
 *          s  (+Z)
 *
 *   Single-letter anchors return the midpoint of that edge of the span;
 *   two-letter anchors return the corresponding corner. Use corner/edge
 *   anchors when you need an object flush with a specific cell boundary
 *   (e.g. a machine that starts at the outer edge of cell [17, 2]:
 *        grid.toWorld({ row: 17, col: 2, anchor: 'nw' })).
 */

const ANCHORS = new Set([
    'center', 'c',
    'n', 's', 'e', 'w',
    'nw', 'ne', 'sw', 'se',
]);

export class GridSystem {
    constructor({ origin, cellSize, cols, rows }) {
        this.origin = origin;
        this.cellSize = cellSize;
        this.cols = cols;
        this.rows = rows;
        this.totalCells = cols * rows;
    }

    // ─── Cell id helpers ────────────────────────────────────────────────
    getRow(cellId) { return Math.floor(cellId / this.cols); }
    getCol(cellId) { return cellId % this.cols; }

    // ─── Canonical grid → world conversion ──────────────────────────────

    /**
     * Convert a grid footprint to a world position.
     *
     * @param {Object} opts
     * @param {number} opts.row              Top (−Z) row of the footprint.
     * @param {number} opts.col              Left (−X) column of the footprint.
     * @param {[number, number]} [opts.span] [rows, cols]. Default [1, 1].
     * @param {string} [opts.anchor]         'center' | n/s/e/w | nw/ne/sw/se.
     * @param {number} [opts.y]              World Y. Default 0.
     * @param {{x?:number, z?:number}} [opts.offset] Post-anchor world-space nudge.
     * @returns {THREE.Vector3}
     */
    toWorld({ row, col, span = [1, 1], anchor = 'center', y = 0, offset = null } = {}) {
        if (!ANCHORS.has(anchor)) {
            throw new Error(`GridSystem.toWorld: unknown anchor "${anchor}"`);
        }
        const { minX, maxX, minZ, maxZ } = this.toWorldBounds({ row, col, span });
        const midX = (minX + maxX) / 2;
        const midZ = (minZ + maxZ) / 2;

        let x, z;
        switch (anchor) {
            case 'nw': x = minX; z = minZ; break;
            case 'ne': x = maxX; z = minZ; break;
            case 'sw': x = minX; z = maxZ; break;
            case 'se': x = maxX; z = maxZ; break;
            case 'n':  x = midX; z = minZ; break;
            case 's':  x = midX; z = maxZ; break;
            case 'w':  x = minX; z = midZ; break;
            case 'e':  x = maxX; z = midZ; break;
            default:   x = midX; z = midZ; // center / c
        }

        if (offset) {
            if (offset.x) x += offset.x;
            if (offset.z) z += offset.z;
        }
        return new THREE.Vector3(x, y, z);
    }

    /**
     * Axis-aligned world-space bounds of a grid footprint. Used by zone
     * bookkeeping and collision AABBs. Corner-based (not center-based),
     * so the returned rectangle exactly matches the drawn cells.
     */
    toWorldBounds({ row, col, span = [1, 1] } = {}) {
        const [spanR, spanC] = span;
        const s = this.cellSize;
        return {
            minX: this.origin.x + col * s,
            maxX: this.origin.x + (col + spanC) * s,
            minZ: this.origin.z + row * s,
            maxZ: this.origin.z + (row + spanR) * s,
        };
    }

    // ─── Back-compat shims ──────────────────────────────────────────────
    /** Shorthand for a single-cell, centered lookup. Stable across grid resizes. */
    rowColToWorld(row, col) {
        return this.toWorld({ row, col });
    }

    cellToWorld(cellId) {
        return this.toWorld({ row: this.getRow(cellId), col: this.getCol(cellId) });
    }

    // ─── World → grid ───────────────────────────────────────────────────
    worldToCell(pos) {
        const col = Math.floor((pos.x - this.origin.x) / this.cellSize);
        const row = Math.floor((pos.z - this.origin.z) / this.cellSize);
        const clampedCol = Math.max(0, Math.min(col, this.cols - 1));
        const clampedRow = Math.max(0, Math.min(row, this.rows - 1));
        return clampedRow * this.cols + clampedCol;
    }

    getNeighbors(cellId) {
        const row = this.getRow(cellId);
        const col = this.getCol(cellId);
        const neighbors = [];
        if (row > 0) neighbors.push(cellId - this.cols);
        if (row < this.rows - 1) neighbors.push(cellId + this.cols);
        if (col > 0) neighbors.push(cellId - 1);
        if (col < this.cols - 1) neighbors.push(cellId + 1);
        return neighbors;
    }

    areAdjacent(a, b) {
        return this.getNeighbors(a).includes(b);
    }

    getCells(ids) {
        return ids.map(id => ({
            id,
            row: this.getRow(id),
            col: this.getCol(id),
            pos: this.cellToWorld(id)
        }));
    }

    createDebugOverlay() {
        const group = new THREE.Group();
        for (let i = 0; i < this.totalCells; i++) {
            const pos = this.cellToWorld(i);
            const s = this.cellSize;

            const geo = new THREE.PlaneGeometry(s * 0.95, s * 0.95);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide,
                depthTest: false
            });
            const plane = new THREE.Mesh(geo, mat);
            plane.rotation.x = -Math.PI / 2;
            plane.position.copy(pos);
            plane.position.y = 0.1;
            plane.renderOrder = 999;
            group.add(plane);

            // Cell border
            const edges = new THREE.EdgesGeometry(geo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
                color: 0x000000, transparent: true, opacity: 0.5, depthTest: false
            }));
            line.rotation.x = -Math.PI / 2;
            line.position.copy(pos);
            line.position.y = 0.1;
            line.renderOrder = 999;
            group.add(line);

            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = 'bold 22px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const row = this.getRow(i);
            const col = this.getCol(i);
            ctx.fillText(`${row}|${col}`, 32, 32);

            const tex = new THREE.CanvasTexture(canvas);
            const labelGeo = new THREE.PlaneGeometry(s * 0.5, s * 0.5);
            const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthTest: false });
            const label = new THREE.Mesh(labelGeo, labelMat);
            label.rotation.x = -Math.PI / 2;
            label.position.copy(pos);
            label.position.y = 0.11;
            label.renderOrder = 1000;
            group.add(label);
        }
        return group;
    }
}
