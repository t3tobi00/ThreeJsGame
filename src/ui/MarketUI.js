import * as THREE from 'three';

/**
 * MarketUI — Flat-on-ground visual overlay for market zones.
 *
 * Same visual language as UnlockZoneUI:
 * - 4 white L-shaped corner brackets (pointing inward)
 * - Flat canvas showing accepted resources + coin pay rates
 * - Brackets pulse gold when player is in range
 */

const RESOURCE_EMOJI = {
    meat: '\u{1F356}',
    'bio-matter': '\u{1F9EA}',
    'zombie-teeth': '\u{1F9B7}',
    'mutant-core': '\u{1F52E}',
    coin: '\u{1FA99}',
    wood: '\u{1FAB5}'
};

export class MarketUI {
    constructor(group, accepts, payRate, size = 4) {
        this.group = group;
        this.accepts = accepts;
        this.payRate = payRate;
        this.size = size;
        this.isActive = false;
        this._time = 0;
        this._disposables = [];
        this.brackets = [];

        this._createCornerBrackets();
        this._createContentPlane();
    }

    // ── Corner Brackets (pointing inward) ──────────────────────────

    _createCornerBrackets() {
        const half = this.size / 2;
        const armLen = this.size * 0.22;
        const thickness = 0.15;
        const height = 0.08;
        const y = 0.06;
        const inset = 0.02;

        this._bracketMat = new THREE.MeshBasicMaterial({
            color: 0xffd700,
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

        const rowCount = this.accepts.length;
        const topArea = h * 0.58;
        const bottomY = h * 0.78;
        const rowHeight = topArea / rowCount;

        // Each row: resource emoji → coin emoji × pay rate
        for (let i = 0; i < rowCount; i++) {
            const type = this.accepts[i];
            const rate = this.payRate[type] || 1;
            const rowY = rowHeight * i + rowHeight * 0.55;

            // Resource emoji (left)
            const emoji = RESOURCE_EMOJI[type] || '\u2753';
            ctx.font = '100px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(emoji, w * 0.18, rowY);

            // Arrow
            ctx.font = 'bold 80px Arial, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 8;
            ctx.lineJoin = 'round';
            ctx.strokeText('\u2192', w * 0.40, rowY);
            ctx.fillText('\u2192', w * 0.40, rowY);

            // Coin emoji + rate number
            ctx.font = '100px sans-serif';
            ctx.fillText('\u{1FA99}', w * 0.62, rowY);

            ctx.font = 'bold 100px Arial, sans-serif';
            ctx.strokeStyle = 'rgba(0,0,0,0.9)';
            ctx.lineWidth = 10;
            ctx.lineJoin = 'round';
            const rateText = `${rate}`;
            ctx.strokeText(rateText, w * 0.84, rowY);
            ctx.fillStyle = '#ffd700';
            ctx.fillText(rateText, w * 0.84, rowY);
        }

        // Bottom: large coin emoji (output)
        ctx.font = '130px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u{1FA99}', w / 2, bottomY);

        this._texture.needsUpdate = true;
    }

    // ── Public API ─────────────────────────────────────────────────

    setActive(active) {
        if (this.isActive !== active) {
            this.isActive = active;
            this._bracketMat.color.set(active ? 0xffaa00 : 0xffd700);
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
