import * as THREE from 'three';
import { WORLD_CONFIG, COLORS } from '../config/gameConfig.js';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.createGround();
        this.createFence();
        this.createProps();
    }

    createGround() {
        const halfSize = WORLD_CONFIG.safeZoneSize / 2;

        // Define the Square with a U-cutout at the bottom-left (front-left in isometric)
        const shape = new THREE.Shape();
        // Shape coordinates (x, y) map to 3D world (x, -z) due to rotation
        shape.moveTo(-halfSize, halfSize); // Top-Left (3D: -9, -9)
        shape.lineTo(-halfSize, -halfSize); // Bottom-Left (3D: -9, 9)
        shape.lineTo(-7, -halfSize);        // Notch start
        shape.lineTo(-7, -5);               // Notch deep
        shape.lineTo(-3, -5);               // Notch wide
        shape.lineTo(-3, -halfSize);        // Notch end
        shape.lineTo(halfSize, -halfSize);  // Bottom-Right (3D: 9, 9)
        shape.lineTo(halfSize, halfSize);   // Top-Right (3D: 9, -9)
        shape.closePath();

        const safeGeo = new THREE.ShapeGeometry(shape);

        // Fix UVs for the grid texture
        const pos = safeGeo.attributes.position;
        const bnd = new THREE.Box3().setFromBufferAttribute(pos);
        const uvs = safeGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            uvs.setXY(i, (x - bnd.min.x) / 1, (y - bnd.min.y) / 1); // 1 unit spacing
        }

        // Procedural grid texture
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        const colorHex = '#' + COLORS.safeZone.toString(16).padStart(6, '0');
        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 128, 128);

        // Stylized Checkerboard Turf
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

        const safeMat = new THREE.MeshStandardMaterial({
            map: gridTex,
            roughness: 0.8,
            metalness: 0.2
        });

        const safePlane = new THREE.Mesh(safeGeo, safeMat);
        safePlane.rotation.x = -Math.PI / 2;
        safePlane.receiveShadow = true;
        this.scene.add(safePlane);

        // Danger Zone (remains a large plane)
        const dangerGeo = new THREE.PlaneGeometry(
            WORLD_CONFIG.dangerZoneSize,
            WORLD_CONFIG.dangerZoneSize
        );

        const dangerMat = new THREE.MeshStandardMaterial({
            color: COLORS.dangerZone,
            roughness: 0.9,
            metalness: 0.1
        });

        const dangerPlane = new THREE.Mesh(dangerGeo, dangerMat);
        dangerPlane.rotation.x = -Math.PI / 2;
        dangerPlane.position.y = -0.01;
        dangerPlane.receiveShadow = true;
        this.scene.add(dangerPlane);
    }

    createFence() {
        const halfSize = WORLD_CONFIG.safeZoneSize / 2;
        const logHeight = 0.5;
        const logRadius = 0.08;
        const spacing = 0.35;

        const logGeo = new THREE.CylinderGeometry(logRadius, logRadius, logHeight, 6);
        const logMat = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.9
        });

        const fenceGroup = new THREE.Group();

        const spawnLogsAlongLine = (start, end, skipFractionStart = 0, skipFractionEnd = 0) => {
            const dist = start.distanceTo(end);
            const count = Math.floor(dist / spacing);
            for (let i = 0; i <= count; i++) {
                const t = i / count;
                // Skip logic for gaps (selling area, gate)
                if (t >= skipFractionStart && t <= skipFractionEnd && (skipFractionStart !== 0 || skipFractionEnd !== 0)) continue;

                const pos = new THREE.Vector3().lerpVectors(start, end, t);

                const log = new THREE.Mesh(logGeo, logMat);
                log.position.copy(pos);
                log.position.y = logHeight / 2;
                log.scale.y = 0.8 + Math.random() * 0.4;
                log.rotation.y = Math.random() * Math.PI;
                log.rotation.x = (Math.random() - 0.5) * 0.1;
                log.rotation.z = (Math.random() - 0.5) * 0.1;
                log.castShadow = true;
                log.receiveShadow = true;
                fenceGroup.add(log);
            }
        };

        // Points
        const p1 = new THREE.Vector3(-halfSize, 0, -halfSize);
        const p2 = new THREE.Vector3(-halfSize, 0, halfSize);
        const p3 = new THREE.Vector3(-7, 0, halfSize);
        const p4 = new THREE.Vector3(-7, 0, 5);
        const p5 = new THREE.Vector3(-3, 0, 5);
        const p6 = new THREE.Vector3(-3, 0, halfSize);
        const p7 = new THREE.Vector3(halfSize, 0, halfSize);
        const p8 = new THREE.Vector3(halfSize, 0, -halfSize);

        // Trace the path
        spawnLogsAlongLine(p1, p2);                   // Left edge
        spawnLogsAlongLine(p2, p3);                   // Bottom edge (start)
        spawnLogsAlongLine(p3, p4);                   // Notch left 
        spawnLogsAlongLine(p4, p5);                   // Notch top
        spawnLogsAlongLine(p5, p6);                   // Notch right
        spawnLogsAlongLine(p6, p7, 0.45, 0.65);       // Bottom edge (Gate Gap at t ~ 0.55. Length=12, gap 2.4)
        spawnLogsAlongLine(p7, p8);                   // Right edge 
        spawnLogsAlongLine(p8, p1, 0.15, 0.25);       // Top edge (Selling Area Gap at right side)

        this.scene.add(fenceGroup);
        this.createSellingTable();
    }

    createSellingTable() {
        const halfSize = WORLD_CONFIG.safeZoneSize / 2;
        const tableMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });

        // Place table slightly peeking out of the back gap on the top edge
        const table = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 1.2), tableMat);
        // p8 is (9, 0, -9). p1 is (-9, 0, -9). 
        // Gap is at 0.15 to 0.25 along line from p8 to p1.
        // t = 0.2 means x is 9 -> -9, 20% along = 9 - (18*0.2) = 5.4.
        table.position.set(5.4, 0.3, -halfSize - 0.2);
        table.castShadow = true;
        this.scene.add(table);
    }

    createProps() {
        // Rocks
        const rockGeo = new THREE.IcosahedronGeometry(1, 0);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.8 });

        // Dead Trees
        const trunkGeo = new THREE.CylinderGeometry(0.1, 0.2, 3, 6);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1.0 });

        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = WORLD_CONFIG.safeZoneSize * 0.7 + Math.random() * 25;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;

            if (Math.random() > 0.5) {
                // Rock
                const rock = new THREE.Mesh(rockGeo, rockMat);
                rock.position.set(x, 0, z);
                rock.scale.set(0.5 + Math.random(), 0.3 + Math.random() * 0.5, 0.5 + Math.random());
                rock.rotation.set(Math.random(), Math.random(), Math.random());
                rock.castShadow = true;
                rock.receiveShadow = true;
                this.scene.add(rock);
            } else {
                // Tree
                const tree = new THREE.Group();
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.y = 1.5;
                trunk.rotation.x = (Math.random() - 0.5) * 0.2;
                trunk.rotation.z = (Math.random() - 0.5) * 0.2;
                trunk.castShadow = true;
                trunk.receiveShadow = true;
                tree.add(trunk);

                // Add simple branches
                for (let j = 0; j < 3; j++) {
                    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 1.5, 4), trunkMat);
                    branch.position.y = 1.5 + j * 0.5;
                    branch.rotation.z = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random());
                    branch.rotation.y = Math.random() * Math.PI * 2;
                    tree.add(branch);
                }

                tree.position.set(x, 0, z);
                this.scene.add(tree);
            }
        }
    }
}
