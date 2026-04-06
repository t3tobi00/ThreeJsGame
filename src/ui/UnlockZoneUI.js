import * as THREE from 'three';
import ResourceRegistry from '../core/ResourceRegistry.js';
import { getArchetype } from '../core/ArchetypeLoader.js';

/**
 * UnlockZoneUI — Flat-on-ground visual overlay for unlock zones.
 *
 * Layout: two-column trade card
 *   [inputs] → [outputs]
 *
 * - Inputs column: emoji + count stacked vertically (35% width)
 * - Arrow in middle (20% width)
 * - Outputs column: emoji stacked vertically (35% width)
 * - 10% padding on all sides
 *
 * Emoji are auto-discovered from resource/archetype JSON — add "emoji" field
 * to any new resource or archetype to make it show up here automatically.
 *
 * Corner brackets frame the zone and pulse green when the player is in range.
 */

const FALLBACK_RESOURCE_EMOJI = '\u2753';
const FALLBACK_OUTPUT_EMOJI   = '\u{1F527}';

function getResourceEmoji(type) {
    const def = ResourceRegistry.get(type);
    return (def && def.emoji) || FALLBACK_RESOURCE_EMOJI;
}

function getOutputEmoji(name) {
    try {
        const arch = getArchetype(name);
        return (arch && arch.emoji) || FALLBACK_OUTPUT_EMOJI;
    } catch (e) {
        return FALLBACK_OUTPUT_EMOJI;
    }
}

export class UnlockZoneUI {
    constructor(group, cost, outputType, size = 4, outputCount = 1) {
        this.group = group;
        this.cost = cost;
        this.outputType = outputType;  // archetype name (e.g. "turret") OR resource type (e.g. "coin")
        this.outputCount = outputCount;
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

    // ── Corner Brackets (slim, pointing inward) ────────────────────

    _createCornerBrackets() {
        const half = this.size / 2;
        const armLen = this.size * 0.15;  // was 0.22 — slimmer
        const thickness = 0.10;            // was 0.15 — thinner
        const height = 0.08;
        const y = 0.06;
        const inset = 0.02;

        this._bracketMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.85
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

    // ── Flat Content Canvas (1024², two-column layout) ────────────

    _createContentPlane() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');

        this._texture = new THREE.CanvasTexture(canvas);
        this._texture.minFilter = THREE.LinearFilter;
        this._texture.magFilter = THREE.LinearFilter;

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

        // Layout geometry — 10% padding, 35/20/35/10 column split
        const padding = w * 0.10;
        const contentW = w - padding * 2;
        const contentH = h - padding * 2;

        const inputColX  = padding + contentW * 0.175;  // center of left 35%
        const arrowX     = padding + contentW * 0.50;   // center of middle 20%
        const outputColX = padding + contentW * 0.825;  // center of right 35%

        const centerY = h / 2;

        // ── Inputs (left column) ──────────────────────────────
        const inputs = Object.entries(this.cost);
        const inputSpacing = inputs.length > 1 ? contentH / inputs.length : 0;
        const inputStartY = centerY - ((inputs.length - 1) / 2) * inputSpacing;

        for (let i = 0; i < inputs.length; i++) {
            const [type, needed] = inputs[i];
            const current = this.progress[type] || 0;
            const remaining = needed - current;
            const y = inputStartY + i * inputSpacing;

            this._drawEmojiWithCount(
                ctx,
                getResourceEmoji(type),
                remaining,
                inputColX,
                y,
                current,
                needed
            );
        }

        // ── Arrow (middle) ─────────────────────────────────────
        const anyProgress = inputs.some(([t, n]) => (this.progress[t] || 0) > 0);
        ctx.font = '140px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = anyProgress ? '#00ff88' : '#888888';
        ctx.fillText('\u2192', arrowX, centerY);  // →

        // ── Outputs (right column) ─────────────────────────────
        // For now: single output (outputType + outputCount)
        // Future: array of outputs — iterate same as inputs
        const outputs = [{ type: this.outputType, count: this.outputCount }];
        const outputSpacing = outputs.length > 1 ? contentH / outputs.length : 0;
        const outputStartY = centerY - ((outputs.length - 1) / 2) * outputSpacing;

        for (let i = 0; i < outputs.length; i++) {
            const { type, count } = outputs[i];
            const y = outputStartY + i * outputSpacing;

            // Try resource emoji first, fall back to archetype emoji
            let emoji = FALLBACK_OUTPUT_EMOJI;
            const resourceDef = ResourceRegistry.get(type);
            if (resourceDef && resourceDef.emoji) {
                emoji = resourceDef.emoji;
            } else {
                emoji = getOutputEmoji(type);
            }

            // Only show count > 1 for outputs (builds are always 1, converts may be 5)
            const countLabel = count > 1 ? count : null;
            this._drawEmojiWithCount(ctx, emoji, countLabel, outputColX, y, 0, 0);
        }

        this._texture.needsUpdate = true;
    }

    /**
     * Draw an emoji with an optional count number next to it.
     * The emoji is drawn slightly left of center, the number to the right.
     */
    _drawEmojiWithCount(ctx, emoji, count, x, y, current, needed) {
        // Emoji
        ctx.font = '160px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';

        if (count === null || count === undefined) {
            // No count — just center the emoji
            ctx.fillText(emoji, x, y);
            return;
        }

        // Emoji on left, number on right (shifted from center)
        const emojiOffset = -70;
        const numberOffset = 50;

        ctx.fillText(emoji, x + emojiOffset, y);

        // Count — large, bold, with stroke for readability
        ctx.font = 'bold 140px Arial, sans-serif';
        const text = `${count}`;

        // Dark stroke outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 12;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x + numberOffset, y);

        // Fill color based on progress
        if (needed > 0) {
            if (current >= needed) {
                ctx.fillStyle = '#00ff88';   // complete — green
            } else if (current > 0) {
                ctx.fillStyle = '#ffee00';   // partial — yellow
            } else {
                ctx.fillStyle = '#ffffff';   // pending — white
            }
        } else {
            ctx.fillStyle = '#ffffff';
        }
        ctx.fillText(text, x + numberOffset, y);
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
            this._bracketMat.opacity = 0.85;
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
