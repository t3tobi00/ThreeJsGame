import * as THREE from 'three';
import { WORLD_CONFIG, COLORS } from '../config/gameConfig.js';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.createGround();
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
        ctx.fillStyle = '#44aa44';
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
}
