import * as THREE from 'three';
import ResourceRegistry from '../core/ResourceRegistry.js';
import { getArchetype } from '../core/ArchetypeLoader.js';

/**
 * UnlockZoneUI — Flat-on-ground visual overlay for unlock zones.
 *
 * Layout: two-column trade card
 *   [inputs] → [outputs]
 *
 * Features:
 * - Auto-scaling typography — font size adapts to number of items so the
 *   layout fits 1, 2, 3, or 4+ items without breaking
 * - Progress fill — bottom of the zone fills with blue water-like color as
 *   items are drained, showing total completion at a glance
 * - Emoji auto-discovered from resource/archetype JSON ("emoji" field)
 * - Corner brackets frame the zone and pulse green when player is in range
 */

// Segoe UI Emoji first → fixes Edge; Apple Color Emoji → fixes Mac; fallback sans-serif
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

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
        this.outputType = outputType;
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
        this._createFillOverlay();
        this._createContentPlane();
    }

    // ── Whole-zone water fill (rises south → north as drains land) ──

    _createFillOverlay() {
        const geo = new THREE.PlaneGeometry(this.size, this.size);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x44dd88,
            transparent: true,
            opacity: 0.55,
            depthWrite: false
        });
        const fill = new THREE.Mesh(geo, mat);
        fill.rotation.x = -Math.PI / 2;
        fill.position.y = 0.02;        // above base (0.005), below content (0.07)
        fill.scale.y = 0.0001;          // start collapsed
        fill.position.z = -this.size / 2;
        fill.visible = false;
        this._fillMesh = fill;
        this.group.add(fill);
        this._disposables.push(geo, mat);
    }

    _setFillRatio(ratio) {
        const r = Math.max(0, Math.min(1, ratio));
        if (r <= 0) {
            this._fillMesh.visible = false;
            return;
        }
        this._fillMesh.visible = true;
        this._fillMesh.scale.y = r;
        this._fillMesh.position.z = (this.size / 2) * (r - 1);
    }

    // ── Corner Brackets (slim, pointing inward) ────────────────────

    _createCornerBrackets() {
        const half = this.size / 2;
        const armLen = this.size * 0.15;
        const thickness = 0.10;
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

    // ── Flat Content Canvas (1024²) ────────────────────────────────

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
        this._contentPlane.position.y = 0.07;
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

        const padding = w * 0.10;
        const contentW = w - padding * 2;
        const contentH = h - padding * 2;

        const inputColX  = padding + contentW * 0.175;
        const arrowX     = padding + contentW * 0.50;
        const outputColX = padding + contentW * 0.825;

        const centerY = h / 2;

        const inputs = Object.entries(this.cost);
        const outputs = [{ type: this.outputType, count: this.outputCount }];

        // ── Auto-scale font sizes based on max column length ──
        // The column with more items determines the scale factor
        const maxCount = Math.max(inputs.length, outputs.length);
        const scale = this._computeScale(maxCount);

        const emojiSize = Math.round(180 * scale);
        const numberSize = Math.round(150 * scale);
        const arrowSize = Math.round(140 * scale);

        // ── Inputs column ─────────────────────────────────────
        const inputSlotH = contentH / inputs.length;
        for (let i = 0; i < inputs.length; i++) {
            const [type, needed] = inputs[i];
            const current = this.progress[type] || 0;
            const remaining = needed - current;
            const y = padding + inputSlotH * (i + 0.5);

            this._drawEmojiWithCount(
                ctx, getResourceEmoji(type), remaining,
                inputColX, y, current, needed,
                emojiSize, numberSize
            );
        }

        // ── Arrow (middle) ─────────────────────────────────────
        const anyProgress = inputs.some(([t]) => (this.progress[t] || 0) > 0);
        ctx.font = `${arrowSize}px ${EMOJI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = anyProgress ? '#00ff88' : '#aaaaaa';
        ctx.fillText('\u2192', arrowX, centerY);

        // ── Output column ─────────────────────────────────────
        const outputSlotH = contentH / outputs.length;
        for (let i = 0; i < outputs.length; i++) {
            const { type, count } = outputs[i];
            const y = padding + outputSlotH * (i + 0.5);

            let emoji = FALLBACK_OUTPUT_EMOJI;
            const resourceDef = ResourceRegistry.get(type);
            if (resourceDef && resourceDef.emoji) {
                emoji = resourceDef.emoji;
            } else {
                emoji = getOutputEmoji(type);
            }

            const countLabel = count > 1 ? count : null;
            this._drawEmojiWithCount(
                ctx, emoji, countLabel,
                outputColX, y, 0, 0,
                emojiSize, numberSize
            );
        }

        this._texture.needsUpdate = true;
    }

    /**
     * Compute a scale factor for font sizes based on item count.
     * 1 item → 1.3× (big, fills nicely)
     * 2 items → 1.0× (default)
     * 3 items → 0.75×
     * 4 items → 0.6×
     */
    _computeScale(count) {
        if (count <= 1) return 1.3;
        if (count === 2) return 1.0;
        if (count === 3) return 0.78;
        return 0.62;
    }

    /**
     * Draw an emoji with an optional count number next to it.
     */
    _drawEmojiWithCount(ctx, emoji, count, x, y, current, needed, emojiSize, numberSize) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (count === null || count === undefined) {
            // Solo emoji — centered
            ctx.font = `${emojiSize}px ${EMOJI_FONT}`;
            ctx.fillStyle = 'white';
            ctx.fillText(emoji, x, y);
            return;
        }

        // Emoji + count side by side
        // Scale the horizontal offsets with size so spacing stays proportional
        const emojiOffset = -emojiSize * 0.55;
        const numberOffset = emojiSize * 0.45;

        ctx.font = `${emojiSize}px ${EMOJI_FONT}`;
        ctx.fillStyle = 'white';
        ctx.fillText(emoji, x + emojiOffset, y);

        // Count number
        ctx.font = `bold ${numberSize}px Arial, sans-serif`;
        const text = `${count}`;

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = Math.max(6, numberSize * 0.08);
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x + numberOffset, y);

        if (needed > 0) {
            if (current >= needed) {
                ctx.fillStyle = '#00ff88';
            } else if (current > 0) {
                ctx.fillStyle = '#ffee00';
            } else {
                ctx.fillStyle = '#ffffff';
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
            let totalProg = 0;
            let totalCost = 0;
            for (const [type, needed] of Object.entries(this.cost)) {
                totalCost += needed;
                totalProg += Math.min(needed, this.progress[type] || 0);
            }
            this._setFillRatio(totalCost > 0 ? totalProg / totalCost : 0);
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
        if (this._fillMesh) this.group.remove(this._fillMesh);
        if (this._contentPlane) {
            this.group.remove(this._contentPlane);
            this._texture.dispose();
        }
        for (const d of this._disposables) {
            if (d.dispose) d.dispose();
        }
    }
}
