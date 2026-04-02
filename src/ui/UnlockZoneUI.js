import * as THREE from 'three';

/**
 * UnlockZoneUI — Flat-on-ground visual overlay for unlock zones.
 *
 * - 4 white L-shaped corner brackets (pointing inward)
 * - Single flat canvas filling the zone with: resource emoji + bold number + output emoji
 * - Brackets pulse green when player is in range
 */

const RESOURCE_EMOJI = {
    meat: '\u{1F356}',
    'bio-matter': '\u{1F9EA}',
    'zombie-teeth': '\u{1F9B7}',
    'mutant-core': '\u{1F52E}',
    coin: '\u{1FA99}',
    wood: '\u{1FAB5}',
    stone: '\u{1FAA8}'
};

const OUTPUT_EMOJI = {
    turret: '\u{1F3F0}',
    wall: '\u{1F9F1}',
    villager: '\u{1F464}',
    archer: '\u{1F3F9}'
};

export class UnlockZoneUI {
    constructor(group, cost, outputType, size = 4) {
        this.group = group;
        this.cost = cost;
        this.outputType = outputType;
        this.size = size;
        this.progress = {};
        this.isActive = false;
        this._time = 0;
        this._disposables = [];

        this.brackets = [];

        for (const key of Object.keys(cost)) {
            this.progress[key] = 0;
        }

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
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
        });

        const hGeo = new THREE.BoxGeometry(armLen, height, thickness);
        const vGeo = new THREE.BoxGeometry(thickness, height, armLen);
        this._disposables.push(hGeo, vGeo, this._bracketMat);

        const corners = [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1]
        ];

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

    // ── Flat Content Canvas (fills the zone) ───────────────────────

    _createContentPlane() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');

        this._texture = new THREE.CanvasTexture(canvas);
        this._texture.minFilter = THREE.LinearFilter;

        // Fill almost the entire zone
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

        const entries = Object.entries(this.cost);
        const resourceCount = entries.length;

        // Top 60%: resource rows, Bottom 40%: output emoji
        const topArea = h * 0.58;
        const bottomY = h * 0.78;
        const rowHeight = topArea / resourceCount;

        for (let i = 0; i < resourceCount; i++) {
            const [type, needed] = entries[i];
            const current = this.progress[type] || 0;
            const remaining = needed - current;
            const rowY = rowHeight * i + rowHeight * 0.55;

            // Resource emoji — large
            const emoji = RESOURCE_EMOJI[type] || '\u2753';
            ctx.font = '120px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(emoji, w * 0.28, rowY);

            // Bold number — very large
            const text = `${remaining}`;
            ctx.font = 'bold 180px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Dark outline
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.lineWidth = 14;
            ctx.lineJoin = 'round';
            ctx.strokeText(text, w * 0.66, rowY);

            // Fill
            if (remaining <= 0) {
                ctx.fillStyle = '#00ff88';
            } else if (current > 0) {
                ctx.fillStyle = '#ffee00';
            } else {
                ctx.fillStyle = '#ffffff';
            }
            ctx.fillText(text, w * 0.66, rowY);
        }

        // Output emoji — large, centered at bottom
        const outputEmoji = OUTPUT_EMOJI[this.outputType] || '\u{1F527}';
        ctx.font = '130px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(outputEmoji, w / 2, bottomY);

        this._texture.needsUpdate = true;
    }

    // ── Public API ─────────────────────────────────────────────────

    updateProgress(progress) {
        let changed = false;
        for (const key of Object.keys(this.cost)) {
            const newVal = progress[key] || 0;
            if ((this.progress[key] || 0) !== newVal) {
                changed = true;
                this.progress[key] = newVal;
            }
        }
        if (changed) {
            this._renderContent();
        }
    }

    setActive(active) {
        if (this.isActive !== active) {
            this.isActive = active;
            this._bracketMat.color.set(active ? 0x00ff88 : 0xffffff);
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
