import * as THREE from 'three';
import { GridSystem } from './GridSystem.js';
import MeshPresets from './MeshPresets.js';

export class SceneLoader {
    static async load(path, scene) {
        const response = await fetch(path);
        const levelData = await response.json();

        const grid = levelData.grid ? new GridSystem(levelData.grid) : null;

        SceneLoader._buildGround(scene, levelData.ground);
        if (levelData.fence) SceneLoader._buildFence(scene, levelData.fence);
        if (levelData.props) SceneLoader._buildProps(scene, levelData.props);
        if (levelData.road) SceneLoader._buildRoad(scene, levelData.road);

        if (grid && levelData.debug && levelData.debug.showGrid) {
            const overlay = grid.createDebugOverlay();
            scene.add(overlay);
        }

        return { grid, levelData };
    }

    static _buildGround(scene, ground) {
        if (!ground) return;

        if (ground.safeZone) {
            const sz = ground.safeZone;
            const halfSize = sz.size / 2;

            // Same shape as Environment.js — U-cutouts on bottom
            const shape = new THREE.Shape();
            shape.moveTo(-halfSize, halfSize);
            shape.lineTo(-halfSize, -halfSize);
            shape.lineTo(-7, -halfSize);
            shape.lineTo(-7, -5);
            shape.lineTo(-3, -5);
            shape.lineTo(-3, -halfSize);
            shape.lineTo(3, -halfSize);
            shape.lineTo(3, -5);
            shape.lineTo(7, -5);
            shape.lineTo(7, -halfSize);
            shape.lineTo(halfSize, -halfSize);
            shape.lineTo(halfSize, halfSize);
            shape.closePath();

            const safeGeo = new THREE.ShapeGeometry(shape);

            const pos = safeGeo.attributes.position;
            const bnd = new THREE.Box3().setFromBufferAttribute(pos);
            const uvs = safeGeo.attributes.uv;
            for (let i = 0; i < pos.count; i++) {
                uvs.setXY(i, (pos.getX(i) - bnd.min.x) / 1, (pos.getY(i) - bnd.min.y) / 1);
            }

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

    static _buildFence(scene, fence) {
        const halfSize = fence.halfSize;
        const logHeight = 0.5;
        const spacing = 0.35;
        const fenceGroup = new THREE.Group();

        const spawnLogsAlongLine = (start, end, skipStart = 0, skipEnd = 0) => {
            const dist = start.distanceTo(end);
            const count = Math.floor(dist / spacing);
            for (let i = 0; i <= count; i++) {
                const t = i / count;
                if (t >= skipStart && t <= skipEnd && (skipStart !== 0 || skipEnd !== 0)) continue;
                const pos = new THREE.Vector3().lerpVectors(start, end, t);
                const log = MeshPresets.create('fence-log');
                log.position.copy(pos);
                log.position.y = logHeight / 2;
                fenceGroup.add(log);
            }
        };

        const p1  = new THREE.Vector3(-halfSize, 0, -halfSize);
        const p2  = new THREE.Vector3(-halfSize, 0, halfSize);
        const p3  = new THREE.Vector3(-7, 0, halfSize);
        const p4  = new THREE.Vector3(-7, 0, 5);
        const p5  = new THREE.Vector3(-3, 0, 5);
        const p6  = new THREE.Vector3(-3, 0, halfSize);
        const p7  = new THREE.Vector3(3, 0, halfSize);
        const p8  = new THREE.Vector3(3, 0, 5);
        const p9  = new THREE.Vector3(7, 0, 5);
        const p10 = new THREE.Vector3(7, 0, halfSize);
        const p11 = new THREE.Vector3(halfSize, 0, halfSize);
        const p12 = new THREE.Vector3(halfSize, 0, -halfSize);

        spawnLogsAlongLine(p1, p2);
        spawnLogsAlongLine(p2, p3);
        spawnLogsAlongLine(p3, p4);
        spawnLogsAlongLine(p4, p5);
        spawnLogsAlongLine(p5, p6);
        const gapB = fence.gapFractions.bottom;
        spawnLogsAlongLine(p6, p7, gapB.start, gapB.end);
        spawnLogsAlongLine(p7, p8);
        spawnLogsAlongLine(p8, p9);
        spawnLogsAlongLine(p9, p10);
        spawnLogsAlongLine(p10, p11);
        spawnLogsAlongLine(p11, p12);
        const gapT = fence.gapFractions.top;
        spawnLogsAlongLine(p12, p1, gapT.start, gapT.end);

        scene.add(fenceGroup);

        // Selling table visual
        const tableMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        const table = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 1.2), tableMat);
        table.position.set(0, 0.3, -9.2);
        table.castShadow = true;
        scene.add(table);
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
