import * as THREE from 'three';
import ResourceRegistry from '../core/ResourceRegistry.js';

/**
 * MilitaryBaseUI — Cost display sitting on the west corner of the
 * military base's roof slab.
 *
 * Layout:
 *   • One small essence-tube mesh per essence required (4 for green,
 *     8 for red), stacked vertically. Top tubes vanish one by one as
 *     the player auto-drops essence into the base.
 *   • Small number sprite next to the bottom tube showing the remaining
 *     count at a glance (smaller than PR #4.4 v1).
 *
 * Roof anchor: position relative to the building's group origin.
 *   y = 1.88  (just above the new roof slab at y=1.78 with thickness 0.18)
 *   x = -0.95 (west corner, flush with the battlements)
 *   z = -0.5  (slightly toward the back so the player can read it walking up)
 *
 * Same public interface as UnlockZoneUI (animate / updateProgress /
 * setActive / destroy) — UnlockZoneSystem swaps it in transparently for
 * any zone tagged 'military-base'.
 */

const TUBE_SCALE = 0.45;
const ANCHOR_X = -0.95;
const ANCHOR_Y = 1.88;
const ANCHOR_Z = -0.5;

export class MilitaryBaseUI {
    constructor(group, cost) {
        this.group = group;
        this.cost = cost;
        this.progress = {};
        for (const k of Object.keys(cost)) this.progress[k] = 0;
        this.isActive = false;
        this._t = 0;
        this._disposables = [];

        this._panel = new THREE.Group();
        this._panel.position.set(ANCHOR_X, ANCHOR_Y, ANCHOR_Z);
        this.group.add(this._panel);

        this._buildTubeStack();
        this._buildNumberSprite();
        this._refresh();
    }

    _buildTubeStack() {
        // One essence-tube icon, positioned to the right of the number so
        // it reads "[remaining count] [essence-tube]" left-to-right.
        // Slight +z so it sits in front of the number sprite, not behind it.
        this._tubes = [];
        const tube = ResourceRegistry.createMesh('essence', 'stacked');
        tube.scale.setScalar(TUBE_SCALE);
        tube.position.set(0.55, 0, 0.15);
        tube.renderOrder = 1000;
        // Yaw 90° around the up axis — keeps the tube horizontal (same as
        // the player's stack default) but turns its long side to face the
        // camera approach direction.
        tube.rotation.y = Math.PI / 2;
        this._panel.add(tube);
        this._tubes.push(tube);
    }

    _buildNumberSprite() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        this._texture = tex;

        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.55, 0.55, 1);
        sprite.position.set(0.0, 0.0, 0);   // number sits at panel anchor; tube is to its right
        sprite.renderOrder = 999;
        this._numberSprite = sprite;
        this._panel.add(sprite);

        this._disposables.push(tex, mat);
    }

    _renderNumber(remaining) {
        const ctx = this._ctx;
        const w = this._canvas.width;
        const h = this._canvas.height;
        ctx.clearRect(0, 0, w, h);

        let fill = '#ffffff';
        const cost = this.cost.essence ?? 0;
        const progress = this.progress.essence ?? 0;
        if (progress > 0 && progress < cost) fill = '#ffee00';
        else if (progress >= cost && cost > 0) fill = '#00ff88';

        ctx.font = 'bold 110px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.92)';
        ctx.lineWidth = 12;
        ctx.strokeText(`${remaining}`, w / 2, h / 2);
        ctx.fillStyle = fill;
        ctx.fillText(`${remaining}`, w / 2, h / 2);

        this._texture.needsUpdate = true;
    }

    _refresh() {
        const cost = this.cost.essence ?? 0;
        const progress = this.progress.essence ?? 0;
        const remaining = Math.max(0, cost - progress);

        // Single icon: hide it once cost is fully paid (remaining = 0).
        for (const tube of this._tubes) tube.visible = remaining > 0;
        this._renderNumber(remaining);
    }

    // ── Public API (matches UnlockZoneUI) ────────────────────────────

    updateProgress(progress) {
        let changed = false;
        for (const k of Object.keys(this.cost)) {
            const newVal = progress[k] || 0;
            if ((this.progress[k] || 0) !== newVal) {
                this.progress[k] = newVal;
                changed = true;
            }
        }
        if (changed) this._refresh();
    }

    setActive(active) {
        this.isActive = !!active;
    }

    animate(dt) {
        this._t += dt;
        // Slow, calm bounce on the whole panel — number + tube rise and
        // fall together by ~5cm at 0.6 Hz. Reads as "alive" without being
        // distracting.
        const bobY = Math.sin(this._t * 1.8) * 0.05;
        this._panel.position.y = ANCHOR_Y + bobY;
        // Gentle pulse on the number sprite when player is in range.
        const s = this.isActive ? 0.55 + 0.05 * Math.sin(this._t * 6.0) : 0.55;
        this._numberSprite.scale.set(s, s, 1);
    }

    destroy() {
        if (this._panel?.parent) this._panel.parent.remove(this._panel);
        for (const d of this._disposables) d.dispose?.();
    }
}
