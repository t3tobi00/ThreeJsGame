import * as THREE from 'three';
import { ROAD_CONFIG } from '../config/gameConfig.js';

export class Road {
    constructor(scene) {
        this.scene = scene;
        this.createVisuals();
    }

    createVisuals() {
        // Create paved road using plane with procedural texture
        const roadGeo = new THREE.PlaneGeometry(ROAD_CONFIG.width, ROAD_CONFIG.length);

        // Create procedural stone/paved texture
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Base stone color
        ctx.fillStyle = '#999999';
        ctx.fillRect(0, 0, 256, 256);

        // Add stone tiles pattern
        const tileSize = 32;
        for (let y = 0; y < 256; y += tileSize) {
            for (let x = 0; x < 256; x += tileSize) {
                // Alternate tile colors for variety
                const shade = Math.random() * 40 - 20;
                const gray = Math.max(0, Math.min(255, 153 + shade));
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                ctx.fillRect(x, y, tileSize - 2, tileSize - 2);

                // Add some texture noise
                ctx.fillStyle = `rgba(0, 0, 0, 0.1)`;
                ctx.fillRect(x + Math.random() * 10, y + Math.random() * 10, 2, 2);
                ctx.fillRect(x + Math.random() * 10, y + Math.random() * 10, 2, 2);
            }
        }

        // Add edge lines
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 252, 252);

        const roadTex = new THREE.CanvasTexture(canvas);
        roadTex.wrapS = THREE.RepeatWrapping;
        roadTex.wrapT = THREE.RepeatWrapping;
        roadTex.repeat.set(1, Math.ceil(ROAD_CONFIG.length / ROAD_CONFIG.width));

        const roadMat = new THREE.MeshStandardMaterial({
            map: roadTex,
            color: ROAD_CONFIG.color,
            roughness: 0.9,
            metalness: 0.1
        });

        this.road = new THREE.Mesh(roadGeo, roadMat);
        this.road.rotation.x = -Math.PI / 2;
        this.road.position.set(
            ROAD_CONFIG.position.x,
            0.01, // Slightly above ground to prevent z-fighting
            ROAD_CONFIG.position.z
        );
        this.road.receiveShadow = true;
        this.scene.add(this.road);
    }
}
