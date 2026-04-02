import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * WorldHealthBar — A small HP bar rendered as an HTML overlay anchored to a 3D mesh.
 *
 * Projects the target mesh's world position to screen space each frame,
 * exactly like FloatingUI does for labels.
 *
 * Usage:
 *   const bar = new WorldHealthBar(camera, playerMesh, playerId);
 *   // in animate loop:
 *   bar.update();
 */
export class WorldHealthBar {
    constructor(camera, targetMesh, entityId, { yOffset = 1.8, width = 50 } = {}) {
        this._camera     = camera;
        this._target     = targetMesh;
        this._entityId   = entityId;
        this._yOffset    = yOffset;
        this._container  = document.getElementById('ui-layer');

        // Build the bar element
        this._el = document.createElement('div');
        this._el.style.cssText = `
            position: absolute; pointer-events: none;
            width: ${width}px; height: 6px;
            background: rgba(0,0,0,0.55);
            border-radius: 3px; overflow: hidden;
        `;
        this._fill = document.createElement('div');
        this._fill.style.cssText = `
            height: 100%; width: 100%;
            background: #44cc44;
            border-radius: 3px;
            transition: width 0.15s ease, background 0.3s ease;
        `;
        this._el.appendChild(this._fill);
        this._container.appendChild(this._el);

        // Listen to HP changes for this specific entity
        EventBus.on('entity:hp_changed', ({ entityId, hp, maxHp }) => {
            if (entityId === this._entityId) this._setHP(hp, maxHp);
        });
    }

    /** Call every frame from the main animate loop. */
    update() {
        if (!this._target) return;

        const vec = new THREE.Vector3();
        this._target.updateWorldMatrix(true, false);
        vec.setFromMatrixPosition(this._target.matrixWorld);
        vec.y += this._yOffset;
        vec.project(this._camera);

        if (vec.z > 1) {
            this._el.style.display = 'none';
            return;
        }

        const x = (vec.x *  0.5 + 0.5) * window.innerWidth;
        const y = (vec.y * -0.5 + 0.5) * window.innerHeight;

        this._el.style.display  = 'block';
        this._el.style.left     = `${x}px`;
        this._el.style.top      = `${y}px`;
        this._el.style.transform = 'translate(-50%, -100%)';
    }

    destroy() {
        this._el.remove();
        this._target = null;
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    _setHP(hp, maxHp) {
        const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
        this._fill.style.width      = `${pct}%`;
        this._fill.style.background =
            pct > 50 ? '#44cc44' : pct > 25 ? '#ffaa00' : '#ff4444';
    }
}
