import * as THREE from 'three';
import { MARKET_CONFIG } from '../config/gameConfig.js';

/**
 * StallCounterUI — A floating "×N" bubble that sits above a stall stack or
 * a coin tray once the count crosses MARKET_CONFIG.counterBubbleThreshold.
 *
 * Mirrors the WorldHealthBar projection pattern: each frame, project the
 * anchor's world matrix to NDC and place the DOM element at that screen
 * position. Polls the entity's InventoryStack for count (cheaper than
 * wiring 3+ event paths and keeps the UI idempotent regardless of who
 * mutates the inventory).
 *
 * Construction:
 *   new StallCounterUI(camera, ecs, anchor, {
 *     entityId: stallEntityId,
 *     resourceType: 'essenceCandy',   // null → use getTotalCount()
 *     icon: '🍬',                      // optional emoji
 *     threshold: 10                    // optional override
 *   });
 */
export class StallCounterUI {
    constructor(camera, ecs, anchor, opts = {}) {
        this._camera     = camera;
        this._ecs        = ecs;
        this._anchor     = anchor;
        this._entityId   = opts.entityId;
        this._resourceType = opts.resourceType ?? null;
        this._icon       = opts.icon ?? '×';
        this._threshold  = opts.threshold ?? MARKET_CONFIG.counterBubbleThreshold;
        this._lastCount  = -1;

        const container = document.getElementById('ui-layer');
        this._el = document.createElement('div');
        this._el.style.cssText = `
            position: absolute; pointer-events: none;
            display: none;
            transform: translate(-50%, -100%);
            padding: 4px 10px;
            border-radius: 14px;
            background: rgba(20,16,8,0.85);
            color: #ffe680;
            font: 800 14px/1 "Trebuchet MS","Helvetica Neue",sans-serif;
            border: 2px solid #ffe680;
            box-shadow: 0 4px 10px rgba(0,0,0,0.4);
            white-space: nowrap;
        `;
        container.appendChild(this._el);
    }

    update() {
        if (!this._anchor || !this._ecs) {
            this._el.style.display = 'none';
            return;
        }
        const inv = this._ecs.getComponent(this._entityId, 'InventoryStack');
        if (!inv) {
            this._el.style.display = 'none';
            return;
        }

        const count = this._resourceType
            ? inv.getCountByType(this._resourceType)
            : inv.getTotalCount();

        if (count !== this._lastCount) {
            this._lastCount = count;
            this._el.textContent = `${this._icon} ${count}`;
        }

        if (count <= this._threshold) {
            this._el.style.display = 'none';
            return;
        }

        const vec = new THREE.Vector3();
        this._anchor.updateWorldMatrix(true, false);
        vec.setFromMatrixPosition(this._anchor.matrixWorld);
        vec.project(this._camera);

        if (vec.z > 1) {
            this._el.style.display = 'none';
            return;
        }

        const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
        const y = (vec.y * -0.5 + 0.5) * window.innerHeight;
        this._el.style.display = 'block';
        this._el.style.left = `${x}px`;
        this._el.style.top  = `${y}px`;
    }

    destroy() {
        this._el.remove();
        this._anchor = null;
    }
}
