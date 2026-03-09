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
        // Safe Zone
        const safeGeo = new THREE.PlaneGeometry(
            WORLD_CONFIG.safeZoneSize,
            WORLD_CONFIG.safeZoneSize
        );

        // Procedural grid texture
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Use color from config
        const colorHex = '#' + COLORS.safeZone.toString(16).padStart(6, '0');
        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, 128, 128);

        const gridTex = new THREE.CanvasTexture(canvas);
        gridTex.wrapS = THREE.RepeatWrapping;
        gridTex.wrapT = THREE.RepeatWrapping;
        gridTex.repeat.set(WORLD_CONFIG.safeZoneSize, WORLD_CONFIG.safeZoneSize);

        const safeMat = new THREE.MeshStandardMaterial({
            map: gridTex,
            roughness: 0.8,
            metalness: 0.2
        });

        const safePlane = new THREE.Mesh(safeGeo, safeMat);
        safePlane.rotation.x = -Math.PI / 2;
        safePlane.receiveShadow = true;
        this.scene.add(safePlane);

        // Danger Zone
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
        dangerPlane.position.y = -0.01; // Slightly below safe zone
        dangerPlane.receiveShadow = true;
        this.scene.add(dangerPlane);
    }

    createFence() {
        const size = WORLD_CONFIG.safeZoneSize;
        const halfSize = size / 2;
        const logHeight = 0.8;
        const logRadius = 0.15;
        const spacing = 0.45;

        const logGeo = new THREE.CylinderGeometry(logRadius, logRadius, logHeight, 6);
        const logMat = new THREE.MeshStandardMaterial({
            color: 0x8b4513, // SaddleBrown
            roughness: 0.9
        });

        // Use InstancedMesh for performance if we had many, but Group is fine for this scale
        const fenceGroup = new THREE.Group();

        const spawnLogsAlongLine = (start, end) => {
            const dist = start.distanceTo(end);
            const count = Math.floor(dist / spacing);
            for (let i = 0; i <= count; i++) {
                const t = i / count;
                const pos = new THREE.Vector3().lerpVectors(start, end, t);

                const log = new THREE.Mesh(logGeo, logMat);
                log.position.copy(pos);
                log.position.y = logHeight / 2;
                // Random height variations for "organic" look
                log.scale.y = 0.8 + Math.random() * 0.4;
                log.rotation.y = Math.random() * Math.PI;
                log.rotation.x = (Math.random() - 0.5) * 0.1;
                log.rotation.z = (Math.random() - 0.5) * 0.1;
                log.castShadow = true;
                log.receiveShadow = true;
                fenceGroup.add(log);
            }
        };

        // Top, Bottom, Left, Right
        spawnLogsAlongLine(new THREE.Vector3(-halfSize, 0, -halfSize), new THREE.Vector3(halfSize, 0, -halfSize));
        spawnLogsAlongLine(new THREE.Vector3(-halfSize, 0, halfSize), new THREE.Vector3(halfSize, 0, halfSize));
        spawnLogsAlongLine(new THREE.Vector3(-halfSize, 0, -halfSize), new THREE.Vector3(-halfSize, 0, halfSize));
        spawnLogsAlongLine(new THREE.Vector3(halfSize, 0, -halfSize), new THREE.Vector3(halfSize, 0, halfSize));

        this.scene.add(fenceGroup);
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
            const dist = WORLD_CONFIG.safeZoneSize * 0.6 + Math.random() * 30;
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
