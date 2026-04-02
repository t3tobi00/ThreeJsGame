import * as THREE from 'three';
import { GridSystem } from './GridSystem.js';
import MeshPresets from './MeshPresets.js';
import { Component_Transform } from '../ecs/components/Component_Transform.js';
import { Component_Collider } from '../ecs/components/Component_Collider.js';

export class SceneLoader {
    static async load(path, scene, ecs = null) {
        const response = await fetch(path);
        const levelData = await response.json();

        const grid = levelData.grid ? new GridSystem(levelData.grid) : null;

        SceneLoader._buildGround(scene, levelData.ground);
        if (levelData.fence) SceneLoader._buildFence(scene, levelData.fence, grid, ecs);
        if (levelData.props) SceneLoader._buildProps(scene, levelData.props);
        if (levelData.road) SceneLoader._buildRoad(scene, levelData.road);

        // Always create grid overlay, control visibility via toggle
        let gridOverlay = null;
        if (grid) {
            gridOverlay = grid.createDebugOverlay();
            gridOverlay.visible = !!(levelData.debug && levelData.debug.showGrid);
            scene.add(gridOverlay);
        }

        return { grid, levelData, gridOverlay };
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
            dangerPlane.rotation.x = -Math.PI / 2;
            dangerPlane.position.y = -0.01;
            dangerPlane.receiveShadow = true;
            scene.add(dangerPlane);
        }
    }

    static _buildFence(scene, fence, grid, ecs = null) {
        if (!grid || !fence.cells) return;

        // Convert [row, col] arrays to "row,col" string keys for Set lookups
        const toKey = (r, c) => `${r},${c}`;
        const fenceSet = new Set(fence.cells.map(([r, c]) => toKey(r, c)));
        const doorSet = new Set((fence.doorCells || []).map(([r, c]) => toKey(r, c)));
        const allBarrier = new Set([...fenceSet, ...doorSet]);
        const edgeMode = fence.edgeMode || 'both'; // 'outer', 'inner', 'both'

        // Calculate centroid for inner/outer detection
        let centroidRow = 0, centroidCol = 0, count = 0;
        for (const [r, c] of [...fence.cells, ...(fence.doorCells || [])]) {
            centroidRow += r;
            centroidCol += c;
            count++;
        }
        centroidRow /= count;
        centroidCol /= count;

        const logHeight = 0.5;
        const spacing = 0.35;
        const fenceGroup = new THREE.Group();
        const half = grid.cellSize / 2;

        const spawnLogsAlongEdge = (start, end) => {
            const dist = start.distanceTo(end);
            const n = Math.floor(dist / spacing);
            if (n === 0) return;
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                const pos = new THREE.Vector3().lerpVectors(start, end, t);
                const log = MeshPresets.create('fence-log');
                log.position.copy(pos);
                log.position.y = logHeight / 2;
                fenceGroup.add(log);
            }
        };

        for (const [row, col] of fence.cells) {
            const center = grid.rowColToWorld(row, col);

            const checkEdge = (nRow, nCol, x1, z1, x2, z2) => {
                const nKey = toKey(nRow, nCol);
                if (allBarrier.has(nKey)) return; // skip edges facing other barrier cells

                if (edgeMode !== 'both') {
                    const nDist = Math.hypot(nRow - centroidRow, nCol - centroidCol);
                    const cDist = Math.hypot(row - centroidRow, col - centroidCol);
                    const isOuter = nDist > cDist;
                    if (edgeMode === 'outer' && !isOuter) return;
                    if (edgeMode === 'inner' && isOuter) return;
                }

                spawnLogsAlongEdge(
                    new THREE.Vector3(x1, 0, z1),
                    new THREE.Vector3(x2, 0, z2)
                );
            };

            // Top edge (negative Z)
            checkEdge(row - 1, col,
                center.x - half, center.z - half, center.x + half, center.z - half);
            // Bottom edge (positive Z)
            checkEdge(row + 1, col,
                center.x - half, center.z + half, center.x + half, center.z + half);
            // Left edge (negative X)
            checkEdge(row, col - 1,
                center.x - half, center.z - half, center.x - half, center.z + half);
            // Right edge (positive X)
            checkEdge(row, col + 1,
                center.x + half, center.z - half, center.x + half, center.z + half);
        }

        scene.add(fenceGroup);

        // Create invisible ECS collider entities for each fence cell (Option A).
        // Visual logs above are pure decoration; these provide solid collision.
        if (ecs) {
            const half = grid.cellSize / 2; // 1.0 for cellSize=2
            for (const [row, col] of fence.cells) {
                const center = grid.rowColToWorld(row, col);
                const obj = new THREE.Object3D();
                obj.position.set(center.x, 0, center.z);
                const id = ecs.createEntity();
                ecs.addComponent(id, 'Transform', new Component_Transform(obj));
                ecs.addComponent(id, 'Collider', new Component_Collider({
                    shape: 'box', width: half, depth: half, isStatic: true
                }));
            }
        }
    }

    static _buildProps(scene, props) {
        const total = (props.rocks || 0) + (props.deadTrees || 0);
        const rockCount = props.rocks || 0;
        const minDist = props.spawnRadius.min;
        const maxDist = props.spawnRadius.max;

        for (let i = 0; i < total; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = minDist + Math.random() * (maxDist - minDist);
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;

            let prop;
            if (i < rockCount) {
                prop = MeshPresets.create('rock');
            } else {
                prop = MeshPresets.create('dead-tree');
            }
            prop.position.set(x, 0, z);
            scene.add(prop);
        }
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
