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
            opacity: 0.8
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
        const borderGeo = new THREE.PlaneGeometry(size + 0.1, size + 0.1);
        this.borderMat = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(0xffffff) },
                thickness: { value: 0.15 },
                bracketLength: { value: 0.4 } // 0 to 0.5
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
                uniform float time;
                uniform vec3 color;
                uniform float thickness;
                uniform float bracketLength;

                void main() {
                    vec2 uv = vUv;
                    // Distance from edge (0.0 to 0.5)
                    vec2 dist = abs(uv - 0.5) * 2.0; 
                    float edge = max(dist.x, dist.y);
                    
                    // Only draw near the very edges
                    if (edge < 1.0 - thickness) discard;

                    // Dash logic for corners
                    // vUv is 0 to 1.
                    bool show = false;
                    
                    // Corner logic: if both dist.x and dist.y are high, we are in a corner
                    // If either is high, we are on an edge.
                    // Let's just use bracketLength
                    if (dist.x > 1.0 - bracketLength && dist.y > 1.0 - bracketLength) {
                        show = true;
                    }
                    
                    // Animation: Pulse opacity
                    float alpha = show ? (0.8 + 0.2 * sin(time * 5.0)) : 0.0;
                    if (alpha <= 0.0) discard;
                    
                    gl_FragColor = vec4(color, alpha);
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
        const textGeo = new THREE.PlaneGeometry(size * 0.8, size * 0.8);
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
        ctx.font = 'bold 120px Outfit, Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        ctx.fillText(cost.toString(), canvas.width / 2, canvas.height / 2 - 20);

        // Draw Icon below (Gold circle for simplicity - looks like a coin)
        const iconY = canvas.width / 2 + 70;
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffcc00'; // Gold
        ctx.beginPath();
        ctx.arc(canvas.width / 2, iconY, 30, 0, Math.PI * 2);
        ctx.fill();

        // Inner crown-like star or "meat" representation
        ctx.fillStyle = '#cc7700';
        ctx.font = 'bold 30px Arial';
        ctx.fillText('🥩', canvas.width / 2, iconY + 10);

        this.texture.needsUpdate = true;

        // Juice: Scale Pop
        this.textPlane.scale.set(1.2, 1.2, 1.2);
    }

    update(deltaTime) {
        if (this.isCompleted) return;

        if (this.borderMat) {
            this.borderMat.uniforms.time.value += deltaTime;
        }

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
