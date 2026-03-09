import * as THREE from 'three';
import { COLORS_P3, ZONE_CONFIG } from '../config/gameConfig.js';

export class UnlockZone {
    constructor(scene, position, type, cost, onComplete) {
        this.scene = scene;
        this.position = position;
        this.type = type; // 'Turret' or 'Wall'
        this.cost = cost;
        this.currentCost = cost;
        this.onComplete = onComplete;
        this.isCompleted = false;

        this.group = new THREE.Group();
        this.group.position.copy(position);
        this.scene.add(this.group);

        this.initVisuals();
    }

    initVisuals() {
        // Square Base Plane
        const baseSize = ZONE_CONFIG.size;
        const baseGeo = new THREE.PlaneGeometry(baseSize, baseSize);
        const baseMat = new THREE.MeshBasicMaterial({
            color: COLORS_P3.unlockZoneBase || 0x224422,
            transparent: true,
            opacity: 0.6
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.rotation.x = -Math.PI / 2;
        base.position.y = 0.01;
        this.group.add(base);

        // Corner Brackets Shader
        this.initBorder(baseSize);

        // Text & Icon Plane (Canvas Texture)
        this.initTextPlane(baseSize);
    }

    initBorder(size) {
        const borderGeo = new THREE.PlaneGeometry(size, size);
        this.borderMat = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xffffff) },
                thickness: { value: 0.18 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform vec3 color;
                uniform float thickness;

                void main() {
                    vec2 uv = vUv;
                    // Distance from center (0.0 to 1.0)
                    vec2 dist = abs(uv - 0.5) * 2.0; 
                    float edge = max(dist.x, dist.y);
                    
                    // Only draw near the very edges
                    if (edge < 1.0 - thickness) discard;

                    float d = 0.0;
                    if (dist.x > dist.y) {
                        d = abs(uv.y - 0.5);
                    } else {
                        d = abs(uv.x - 0.5);
                    }
                    
                    // Chunky corners logic: discard the middle 60% of each edge
                    if (d < 0.3) discard;
                    
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });

        const border = new THREE.Mesh(borderGeo, this.borderMat);
        border.rotation.x = -Math.PI / 2;
        border.position.y = 0.02;
        this.group.add(border);
    }

    initTextPlane(size) {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 256;
        this.canvas.height = 256;

        this.texture = new THREE.CanvasTexture(this.canvas);
        const textGeo = new THREE.PlaneGeometry(size * 0.9 * ZONE_CONFIG.textScale, size * 0.9 * ZONE_CONFIG.textScale);
        const textMat = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true
        });

        this.textPlane = new THREE.Mesh(textGeo, textMat);
        this.textPlane.rotation.x = -Math.PI / 2;
        this.textPlane.position.y = 0.05;
        this.group.add(this.textPlane);

        this.updateCostText(this.currentCost);
    }

    updateCostText(cost) {
        const ctx = this.ctx;
        const canvas = this.canvas;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Value (Number)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 140px Outfit, Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        // Draw Thick Outline
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#224422'; // Dark green outline instead of black for better integration
        ctx.strokeText(cost.toString(), canvas.width / 2, canvas.height / 2 - 30);

        // Fill Text
        ctx.fillText(cost.toString(), canvas.width / 2, canvas.height / 2 - 30);

        // Draw Icon below
        const iconY = canvas.width / 2 + 70;
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffcc00'; // Gold
        ctx.beginPath();
        ctx.arc(canvas.width / 2, iconY, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#cc7700';
        ctx.stroke();

        // Inner meat emoji
        ctx.fillStyle = '#cc7700';
        ctx.font = 'bold 35px Arial';
        ctx.fillText('🥩', canvas.width / 2, iconY + 12);

        this.texture.needsUpdate = true;

        // Juice: Scale Pop
        this.textPlane.scale.set(1.2, 1.2, 1.2);
    }

    update(deltaTime) {
        if (this.isCompleted) return;

        // Smoothly return text plane scale to 1.0
        if (this.textPlane.scale.x > 1.0) {
            const lerpFactor = 0.15;
            this.textPlane.scale.x = THREE.MathUtils.lerp(this.textPlane.scale.x, 1.0, lerpFactor);
            this.textPlane.scale.y = THREE.MathUtils.lerp(this.textPlane.scale.y, 1.0, lerpFactor);
            this.textPlane.scale.z = THREE.MathUtils.lerp(this.textPlane.scale.z, 1.0, lerpFactor);
        }
    }

    drain(amount = 1) {
        if (this.isCompleted) return;

        this.currentCost -= amount;
        this.updateCostText(Math.max(0, this.currentCost));

        if (this.currentCost <= 0) {
            this.currentCost = 0;
            this.complete();
        }

        return this.currentCost;
    }

    complete() {
        this.isCompleted = true;
        this.group.visible = false;
        if (this.onComplete) {
            this.onComplete();
        }
    }
}
