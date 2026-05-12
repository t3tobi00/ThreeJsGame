import * as THREE from 'three';
import { GridSystem } from './GridSystem.js';
import MeshPresets from './MeshPresets.js';
import BalanceLoader from './BalanceLoader.js';

export class SceneLoader {
    static async load(path, scene) {
        const response = await fetch(path);
        const levelData = await response.json();
        // Resolve $balance.X.Y.Z placeholders in unlock-zone costs etc.
        BalanceLoader.resolvePlaceholders(levelData);

        const grid = levelData.grid ? new GridSystem(levelData.grid) : null;

        SceneLoader._buildGround(scene, levelData.ground);

        let fenceGroup = null;
        let fenceEdges = []; // plain { x, z, width, depth } — main.js creates ECS colliders
        let fenceSides = {}; // { sideName: { group, edges } } when fence.sides is used
        if (levelData.fence) {
            const result = SceneLoader._buildFence(scene, levelData.fence, grid);
            fenceGroup = result.fenceGroup;
            fenceEdges = result.fenceEdges;
            fenceSides = result.fenceSides || {};
        }

        // Props are now returned as position data — main.js creates real ECS
        // entities via EntityFactory so every scattered tree/rock is harvestable.
        const propEntities = levelData.props
            ? SceneLoader._computePropPositions(levelData.props)
            : [];

        if (levelData.road)  SceneLoader._buildRoad(scene, levelData.road);

        let gridOverlay = null;
        if (grid) {
            gridOverlay = grid.createDebugOverlay();
            gridOverlay.visible = !!(levelData.debug && levelData.debug.showGrid);
            scene.add(gridOverlay);
        }

        return { grid, levelData, gridOverlay, fenceGroup, fenceEdges, fenceSides, propEntities };
    }

    static _buildGround(scene, ground) {
        if (!ground) return;

        if (ground.safeZone) {
            const sz = ground.safeZone;
            const safeGeo = new THREE.PlaneGeometry(sz.size, sz.size);

            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            const color = typeof sz.color === 'string' ? '#' + sz.color.replace('0x', '') : '#66cc66';
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 128, 128);
            ctx.fillStyle = 'rgba(0, 50, 0, 0.05)';
            ctx.fillRect(0, 0, 64, 64);
            ctx.fillRect(64, 64, 64, 64);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(64, 0, 64, 64);
            ctx.fillRect(0, 64, 64, 64);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, 128, 128);

            const gridTex = new THREE.CanvasTexture(canvas);
            gridTex.wrapS = THREE.RepeatWrapping;
            gridTex.wrapT = THREE.RepeatWrapping;

            const safeMat = new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.8, metalness: 0.2 });
            const safePlane = new THREE.Mesh(safeGeo, safeMat);
            safePlane.rotation.x = -Math.PI / 2;
            safePlane.receiveShadow = true;
            scene.add(safePlane);
        }

        if (ground.dangerZone) {
            const dz = ground.dangerZone;
            const dzColor = typeof dz.color === 'string' ? parseInt(dz.color, 16) : dz.color;
            const dangerGeo = new THREE.PlaneGeometry(dz.size, dz.size);
            const dangerMat = new THREE.MeshStandardMaterial({ color: dzColor, roughness: 0.9, metalness: 0.1 });
            const dangerPlane = new THREE.Mesh(dangerGeo, dangerMat);
            dangerPlane.name = 'danger-zone-ground';
            dangerPlane.rotation.x = -Math.PI / 2;
            dangerPlane.position.y = -0.01;
            dangerPlane.receiveShadow = true;
            scene.add(dangerPlane);
        }
    }

    static _buildFence(scene, fence, grid) {
        if (!grid) return { fenceGroup: null, fenceEdges: [], fenceSides: {} };

        // Two input shapes:
        //   fence.cells: [...]                  ← legacy (level-1, diorama)
        //   fence.sides: { north:[...], ... }   ← new, enables staged reveal
        // Legacy is wrapped as a single anonymous '_all' side internally.
        let sides;
        if (fence.sides)      sides = fence.sides;
        else if (fence.cells) sides = { _all: fence.cells };
        else return { fenceGroup: null, fenceEdges: [], fenceSides: {} };

        const toKey = (r, c) => `${r},${c}`;

        // Combine all cells across sides for the global barrier set + centroid.
        // The north side's lateral edges still check whether the east/west
        // cells exist as barriers, so corners don't double-render.
        const allCells = [];
        for (const cells of Object.values(sides)) {
            for (const cell of cells) allCells.push(cell);
        }
        if (allCells.length === 0) return { fenceGroup: null, fenceEdges: [], fenceSides: {} };

        const allBarrier = new Set(allCells.map(([r, c]) => toKey(r, c)));
        for (const [r, c] of (fence.doorCells || [])) allBarrier.add(toKey(r, c));

        let centroidRow = 0, centroidCol = 0;
        for (const [r, c] of allCells) { centroidRow += r; centroidCol += c; }
        centroidRow /= allCells.length;
        centroidCol /= allCells.length;

        const edgeMode  = fence.edgeMode || 'both';
        const logPreset = fence.preset   || 'fence-log';
        const spacing   = fence.spacing  || 0.35;
        const logOpts   = fence.logOpts  || {};
        const THICKNESS = 0.15;

        const fenceGroup = new THREE.Group();
        const fenceEdges = [];      // combined (back-compat)
        const fenceSides = {};      // per-side breakdown

        const spawnLogsAlongEdge = (start, end, targetGroup) => {
            const dist = start.distanceTo(end);
            const n = Math.floor(dist / spacing);
            if (n === 0) return;
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                const pos = new THREE.Vector3().lerpVectors(start, end, t);
                const log = MeshPresets.create(logPreset, logOpts);
                log.position.copy(pos);
                // Legacy fence-log centers a 0.5u cylinder above ground.
                // Tall presets (palisade-log) anchor at y=0 themselves.
                if (logPreset === 'fence-log') log.position.y = 0.25;
                targetGroup.add(log);
            }
        };

        for (const [sideName, cells] of Object.entries(sides)) {
            const sideGroup = new THREE.Group();
            sideGroup.name = `fence-${sideName}`;
            const sideEdges = [];

            const recordEdge = (start, end, isHorizontal, edgeLength) => {
                const e = {
                    x:     (start.x + end.x) / 2,
                    z:     (start.z + end.z) / 2,
                    width: isHorizontal ? edgeLength : THICKNESS,
                    depth: isHorizontal ? THICKNESS  : edgeLength,
                };
                sideEdges.push(e);
                fenceEdges.push(e);
            };

            for (const [row, col] of cells) {
                const nw = grid.toWorld({ row, col, anchor: 'nw' });
                const se = grid.toWorld({ row, col, anchor: 'se' });
                const edgeLen = se.x - nw.x;

                const checkEdge = (nRow, nCol, x1, z1, x2, z2, isHorizontal) => {
                    const nKey = toKey(nRow, nCol);
                    if (allBarrier.has(nKey)) return;

                    if (edgeMode !== 'both') {
                        const nDist = Math.hypot(nRow - centroidRow, nCol - centroidCol);
                        const cDist = Math.hypot(row  - centroidRow, col  - centroidCol);
                        const isOuter = nDist > cDist;
                        if (edgeMode === 'outer' && !isOuter) return;
                        if (edgeMode === 'inner' &&  isOuter) return;
                    }

                    const start = new THREE.Vector3(x1, 0, z1);
                    const end   = new THREE.Vector3(x2, 0, z2);
                    spawnLogsAlongEdge(start, end, sideGroup);
                    recordEdge(start, end, isHorizontal, edgeLen);
                };

                checkEdge(row-1, col, nw.x, nw.z, se.x, nw.z, true);
                checkEdge(row+1, col, nw.x, se.z, se.x, se.z, true);
                checkEdge(row, col-1, nw.x, nw.z, nw.x, se.z, false);
                checkEdge(row, col+1, se.x, nw.z, se.x, se.z, false);
            }

            fenceGroup.add(sideGroup);
            fenceSides[sideName] = { group: sideGroup, edges: sideEdges };
        }

        scene.add(fenceGroup);
        return { fenceGroup, fenceEdges, fenceSides };
    }

    /**
     * Compute scattered positions for rock/tree props. Returns an array of
     * { archetype, position } entries so main.js can spawn real entities via
     * EntityFactory (making every prop minable).
     */
    static _computePropPositions(props) {
        const rockCount = props.rocks || 0;
        const treeCount = props.deadTrees || 0;
        const minDist = props.spawnRadius?.min ?? 12;
        const maxDist = props.spawnRadius?.max ?? 38;

        const entries = [];
        for (let i = 0; i < rockCount + treeCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = minDist + Math.random() * (maxDist - minDist);
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            entries.push({
                archetype: i < rockCount ? 'rock' : 'tree',
                position: { x, y: 0, z }
            });
        }
        return entries;
    }

    static _buildRoad(scene, road) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#999999';
        ctx.fillRect(0, 0, 128, 128);

        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 2;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const offset = (r % 2) * 16;
                ctx.strokeRect(c * 32 + offset, r * 32, 32, 32);
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, road.length / road.width);

        const geo = new THREE.PlaneGeometry(road.width, road.length);
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(road.position.x, 0.005, road.position.z);
        mesh.receiveShadow = true;
        scene.add(mesh);
    }
}
