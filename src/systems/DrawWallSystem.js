import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * DrawWallSystem — Draw-to-build wall experiment for ?prototype mode.
 *
 * Coexists with DragInputSystem (player drag-to-waypoint). When draw mode is
 * OFF, this system is a no-op and DragInputSystem owns input as before. When
 * the HUD "Draw Wall" toggle flips it ON, this system intercepts canvas
 * pointer events in the CAPTURE phase and calls stopImmediatePropagation, so
 * the bubble-phase listeners inside DragInputSystem never see the gesture.
 *
 * Drag-release commits a polyline. Logs (palisade-log preset) are placed at
 * fixed arc-length spacing along the polyline — one ECS entity per log,
 * tagged 'wall'+'wall-drawn' so HeroAI's DEFEND_WALL behavior treats it as a
 * defendable structure. Curves and turns are preserved faithfully (no
 * smoothing pass is applied — the per-sample MIN_POINT_SPACING already
 * dedupes finger jitter).
 *
 * Wood cost is gated behind FREE_WALL_DRAW. While true → free + no length
 * cap. When the constant flips false, truncate the path at the point where
 * the player's wood runs out and emit a toast at the truncation location.
 */

const FREE_WALL_DRAW    = true;       // experimental flag; flip false post-test
const LOG_SPACING       = 0.30;       // matches palisade fence spacing
const MIN_DRAW_DIST     = 1.0;        // ignore pencil-tap (release < this) drags
const MIN_POINT_SPACING = 0.10;       // dedupe pointer samples below this
const PREVIEW_COLOR     = 0xffd700;
const PREVIEW_MAX_POINTS = 1024;
const GROUND_Y          = 0;

export class DrawWallSystem {
    constructor(ecs, camera, scene, canvas, factory) {
        this.ecs     = ecs;
        this.camera  = camera;
        this.scene   = scene;
        this.canvas  = canvas;
        this.factory = factory;

        this.enabled = false;
        this.drawing = false;
        this.activePointerId = null;
        this.path = [];

        this.raycaster   = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);
        this._ndc = new THREE.Vector2();
        this._hit = new THREE.Vector3();

        // Preview line
        this.previewLine = null;
        this.previewGeo  = null;
        this.previewPositions = null;
        this._previewCount = 0;

        this._bindListeners();
        EventBus.on('draw:setMode', ({ enabled }) => this.setEnabled(enabled));
    }

    // ECS hook — system is event-driven, no per-frame work.
    update() {}

    setEnabled(on) {
        if (on === this.enabled) return;
        this.enabled = !!on;
        if (!this.enabled && this.drawing) this._cancelDraw();
        document.body.classList.toggle('draw-wall-mode', this.enabled);
    }

    // ─── Listeners ─────────────────────────────────────────────────────────

    _bindListeners() {
        this.canvas.addEventListener('pointerdown',   (e) => this._onDown(e),   { capture: true });
        this.canvas.addEventListener('pointermove',   (e) => this._onMove(e),   { capture: true });
        this.canvas.addEventListener('pointerup',     (e) => this._onUp(e),     { capture: true });
        this.canvas.addEventListener('pointercancel', (e) => this._onCancel(e), { capture: true });
        document.addEventListener('keydown', (e) => {
            if (this.enabled && e.key === 'Escape') {
                EventBus.emit('draw:setMode', { enabled: false });
            }
        });
    }

    _onDown(e) {
        if (!this.enabled) return;
        if (this.drawing) return;
        e.stopImmediatePropagation();
        e.preventDefault?.();
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }

        this.drawing = true;
        this.activePointerId = e.pointerId;
        this.path.length = 0;

        if (this._screenToGround(e.clientX, e.clientY, this._hit)) {
            this.path.push(this._hit.clone());
        }
        this._beginPreview();
    }

    _onMove(e) {
        if (!this.enabled) return;
        if (!this.drawing || e.pointerId !== this.activePointerId) return;
        e.stopImmediatePropagation();

        if (this._screenToGround(e.clientX, e.clientY, this._hit)) {
            const last = this.path.length > 0 ? this.path[this.path.length - 1] : null;
            if (!last || last.distanceTo(this._hit) >= MIN_POINT_SPACING) {
                this.path.push(this._hit.clone());
                this._appendPreview(this._hit);
            }
        }
    }

    _onUp(e) {
        if (!this.enabled) return;
        if (!this.drawing || e.pointerId !== this.activePointerId) return;
        e.stopImmediatePropagation();
        this._commitDraw();
    }

    _onCancel(e) {
        if (!this.drawing || e.pointerId !== this.activePointerId) return;
        this._cancelDraw();
    }

    // ─── Commit / cancel ───────────────────────────────────────────────────

    _commitDraw() {
        const path = this.path.slice();
        this.drawing = false;
        this.activePointerId = null;
        this._clearPreview();
        this.path.length = 0;

        // One-shot mode: every pointer release exits draw mode so an
        // accidental second tap doesn't immediately start another wall.
        // Player must click the chip again to draw a second wall.
        EventBus.emit('draw:setMode', { enabled: false });

        const totalLen = _pathLength(path);
        if (totalLen < MIN_DRAW_DIST) return;          // tap or stub — ignore

        // Wood-cost truncation will go here when FREE_WALL_DRAW flips false.
        // For now, full path → all logs.
        const usablePath = FREE_WALL_DRAW ? path : path; // placeholder

        const samples = _resampleByArcLength(usablePath, LOG_SPACING);
        if (samples.length === 0) return;

        for (let i = 0; i < samples.length; i++) {
            const p = samples[i];

            // Aim each log along the local tangent (rotation around Y).
            // palisade-log is radially symmetric, so this is mostly a hint
            // for any future per-instance variation reading rotY.
            const next = samples[i + 1] || samples[i - 1];
            const rotY = next ? Math.atan2(next.x - p.x, next.z - p.z) : 0;

            this.factory.create('wall-drawn', p, { _meshOpts: { rotY } });
        }

        EventBus.emit('draw:wallBuilt', { logs: samples.length, length: totalLen });
    }

    _cancelDraw() {
        this.drawing = false;
        this.activePointerId = null;
        this.path.length = 0;
        this._clearPreview();
    }

    // ─── Raycast ───────────────────────────────────────────────────────────

    _screenToGround(clientX, clientY, out) {
        const rect = this.canvas.getBoundingClientRect();
        this._ndc.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
        this._ndc.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this._ndc, this.camera);
        return !!this.raycaster.ray.intersectPlane(this.groundPlane, out);
    }

    // ─── Preview line ──────────────────────────────────────────────────────

    _beginPreview() {
        if (!this.previewGeo) {
            this.previewGeo = new THREE.BufferGeometry();
            this.previewPositions = new Float32Array(PREVIEW_MAX_POINTS * 3);
            this.previewGeo.setAttribute('position', new THREE.BufferAttribute(this.previewPositions, 3));
            const mat = new THREE.LineBasicMaterial({
                color: PREVIEW_COLOR,
                transparent: true,
                opacity: 0.95,
                depthWrite: false
            });
            this.previewLine = new THREE.Line(this.previewGeo, mat);
            this.previewLine.renderOrder = 998;
            this.scene.add(this.previewLine);
        }
        this.previewLine.visible = true;
        this._previewCount = 0;
        this.previewGeo.setDrawRange(0, 0);
        if (this.path.length > 0) this._appendPreview(this.path[0]);
    }

    _appendPreview(p) {
        if (this._previewCount >= PREVIEW_MAX_POINTS) return;
        const i = this._previewCount * 3;
        this.previewPositions[i]     = p.x;
        this.previewPositions[i + 1] = GROUND_Y + 0.04;
        this.previewPositions[i + 2] = p.z;
        this._previewCount++;
        this.previewGeo.setDrawRange(0, this._previewCount);
        this.previewGeo.attributes.position.needsUpdate = true;
    }

    _clearPreview() {
        if (this.previewLine) this.previewLine.visible = false;
        this._previewCount = 0;
        if (this.previewGeo) this.previewGeo.setDrawRange(0, 0);
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function _pathLength(path) {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
        len += path[i - 1].distanceTo(path[i]);
    }
    return len;
}

/**
 * Resample a polyline by ARC-LENGTH at the given spacing. Always emits a
 * sample at offset 0 (the path start). Returns an array of THREE.Vector3.
 * This is what makes a curved drag produce evenly-spaced logs along the
 * curve rather than clumped at the original sample points.
 */
function _resampleByArcLength(path, spacing) {
    const out = [];
    if (path.length === 0) return out;
    out.push(path[0].clone());
    if (path.length === 1) return out;

    let target = spacing;
    let acc    = 0;

    for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const segLen = a.distanceTo(b);
        if (segLen <= 1e-6) continue;
        while (acc + segLen >= target) {
            const t = (target - acc) / segLen;
            out.push(new THREE.Vector3().lerpVectors(a, b, t));
            target += spacing;
        }
        acc += segLen;
    }
    return out;
}
