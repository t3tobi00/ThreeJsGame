import * as THREE from 'three';

/**
 * GridSystem — 2D grid mapping numbered cells to world positions.
 *
 * Cell numbering: left-to-right, top-to-bottom.
 *   0  1  2  3  4
 *   5  6  7  8  9
 *  10 11 12 13 14
 *
 * "Top" = most negative Z, "Bottom" = most positive Z.
 */
export class GridSystem {
    constructor({ origin, cellSize, cols, rows }) {
        this.origin = origin;
        this.cellSize = cellSize;
        this.cols = cols;
        this.rows = rows;
        this.totalCells = cols * rows;
    }

    getRow(cellId) {
        return Math.floor(cellId / this.cols);
    }

    getCol(cellId) {
        return cellId % this.cols;
    }

    cellToWorld(cellId) {
        const row = this.getRow(cellId);
        const col = this.getCol(cellId);
        return new THREE.Vector3(
            this.origin.x + col * this.cellSize + this.cellSize / 2,
            0,
            this.origin.z + row * this.cellSize + this.cellSize / 2
        );
    }

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
                side: THREE.DoubleSide
            });
            const plane = new THREE.Mesh(geo, mat);
            plane.rotation.x = -Math.PI / 2;
            plane.position.copy(pos);
            plane.position.y = 0.03;
            group.add(plane);

            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = 'bold 32px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(i.toString(), 32, 32);

            const tex = new THREE.CanvasTexture(canvas);
            const labelGeo = new THREE.PlaneGeometry(s * 0.5, s * 0.5);
            const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
            const label = new THREE.Mesh(labelGeo, labelMat);
            label.rotation.x = -Math.PI / 2;
            label.position.copy(pos);
            label.position.y = 0.04;
            group.add(label);
        }
        return group;
    }
}
