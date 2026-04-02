import * as THREE from 'three';

/**
 * ShopUI — Flat-on-ground visual overlay for shop zones.
 *
 * Same visual language as UnlockZoneUI/MarketUI:
 * - 4 L-shaped corner brackets (pointing inward, green tint)
 * - Flat canvas showing cost (coins) → effect (heal heart, etc.)
 * - Brackets pulse when player is in range
 */

const EFFECT_EMOJI = {
    heal: '\u2764\uFE0F',
    speed_boost: '\u26A1',
    damage_boost: '\u2694\uFE0F'
};

export class ShopUI {
    constructor(group, shop, size = 4) {
        this.group = group;
        this.cost = shop.cost;
        this.effect = shop.effect;
        this.label = shop.label;
        this.size = size;
        this.isActive = false;
        this._time = 0;
        this._disposables = [];
        this.brackets = [];

        this._createCornerBrackets();
        this._createContentPlane();
    }

    // ── Corner Brackets ────────────────────────────────────────────

    _createCornerBrackets() {
        const half = this.size / 2;
        const armLen = this.size * 0.22;
        const thickness = 0.15;
        const height = 0.08;
        const y = 0.06;
        const inset = 0.02;

        this._bracketMat = new THREE.MeshBasicMaterial({
            color: 0x44cc44,
            transparent: true,
            opacity: 0.9
        });

        const hGeo = new THREE.BoxGeometry(armLen, height, thickness);
        const vGeo = new THREE.BoxGeometry(thickness, height, armLen);
        this._disposables.push(hGeo, vGeo, this._bracketMat);

        const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

        for (const [xDir, zDir] of corners) {
            const cx = xDir * (half - inset);
            const cz = zDir * (half - inset);

            const hArm = new THREE.Mesh(hGeo, this._bracketMat);
            hArm.position.set(cx - (armLen / 2) * xDir, y, cz);
            this.group.add(hArm);
            this.brackets.push(hArm);

            const vArm = new THREE.Mesh(vGeo, this._bracketMat);
            vArm.position.set(cx, y, cz - (armLen / 2) * zDir);
            this.group.add(vArm);
            this.brackets.push(vArm);
        }
    }

    // ── Flat Content Canvas ────────────────────────────────────────

    _createContentPlane() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');

        this._texture = new THREE.CanvasTexture(canvas);
        this._texture.minFilter = THREE.LinearFilter;

        const planeSize = this.size * 0.88;
        const geo = new THREE.PlaneGeometry(planeSize, planeSize);
        const mat = new THREE.MeshBasicMaterial({
            map: this._texture,
            transparent: true,
            depthTest: false
        });
        this._contentPlane = new THREE.Mesh(geo, mat);
        this._contentPlane.rotation.x = -Math.PI / 2;
        this._contentPlane.position.y = 0.06;
        this._contentPlane.renderOrder = 999;
        this.group.add(this._contentPlane);

        this._disposables.push(geo, mat);
        this._renderContent();
    }

    _renderContent() {
        const ctx = this._ctx;
        const w = this._canvas.width;
        const h = this._canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Top: coin emoji + cost number
        const topY = h * 0.3;

        // Coin emoji
        ctx.font = '120px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u{1FA99}', w * 0.3, topY);

        // Cost number
        ctx.font = 'bold 160px Arial, sans-serif';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 12;
        ctx.lineJoin = 'round';
        ctx.strokeText(`${this.cost}`, w * 0.68, topY);
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`${this.cost}`, w * 0.68, topY);

        // Arrow
        ctx.font = 'bold 100px Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 8;
        ctx.strokeText('\u2193', w / 2, h * 0.52);
        ctx.fillText('\u2193', w / 2, h * 0.52);

        // Bottom: effect emoji (large)
        const effectEmoji = EFFECT_EMOJI[this.effect] || '\u2753';
        ctx.font = '150px sans-serif';
        ctx.fillText(effectEmoji, w / 2, h * 0.76);

        this._texture.needsUpdate = true;
    }

    // ── Public API ─────────────────────────────────────────────────

    setActive(active) {
        if (this.isActive !== active) {
            this.isActive = active;
            this._bracketMat.color.set(active ? 0x00ff88 : 0x44cc44);
        }
    }

    animate(dt) {
        this._time += dt;
        if (this.isActive) {
            this._bracketMat.opacity = 0.6 + Math.sin(this._time * 5) * 0.4;
        } else {
            this._bracketMat.opacity = 0.9;
        }
    }

    destroy() {
        for (const b of this.brackets) this.group.remove(b);
        if (this._contentPlane) {
            this.group.remove(this._contentPlane);
            this._texture.dispose();
        }
        for (const d of this._disposables) {
            if (d.dispose) d.dispose();
        }
    }
}
