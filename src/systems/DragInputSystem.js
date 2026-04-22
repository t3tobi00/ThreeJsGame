import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

const TAP_MOVE_THRESHOLD_PX = 8;
const TAP_MOVE_THRESHOLD_SQ = TAP_MOVE_THRESHOLD_PX * TAP_MOVE_THRESHOLD_PX;
const TRAIL_MIN_SPACING = 0.1;
const TRAIL_MAX_POINTS = 256;
const GROUND_Y = 0;

/**
 * DragInputSystem — One-gesture drag-to-waypoint input.
 *
 * Flow (single gesture, no persistent selection):
 *   pointerdown ON a DragCommandable entity    → arm it, ring appears instantly
 *   pointerdown elsewhere                      → dead gesture, nothing happens
 *   drag                                        → preview trail on ground
 *   pointerup after moving past tap threshold   → commit straight-line path
 *                                                 (hero walks direct to the
 *                                                 final pointer-up location,
 *                                                 ignoring intermediate squiggles)
 *   pointerup without moving                   → no-op (also deselects)
 *
 * The selection ring shows only for the duration of the gesture. No tap-to-
 * select, no standalone selected state — can't misfire on accidental touches.
 *
 * Completely character-agnostic: any entity with Transform +
 * Component_DragCommandable (+ Waypoints for path commit) is armable.
 */
export class DragInputSystem {
    constructor(ecs, camera, scene, canvas, joystick = null) {
        this.ecs = ecs;
        this.camera = camera;
        this.scene = scene;
        this.canvas = canvas;
        this.joystick = joystick;

        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);
        this._ndc = new THREE.Vector2();
        this._hit = new THREE.Vector3();

        // Gesture state — all cleared on pointerup/cancel.
        this.pointerId = null;
        this.startX = 0;
        this.startY = 0;
        this.isDragging = false;
        this.armedId = null;              // entity armed for this gesture
        this.lastHit = new THREE.Vector3();
        this.hasHit = false;

        // Scene-level trail line (reused).
        this.trailGeometry = null;
        this.trailLine = null;
        this.trailPositions = null;
        this.trailCount = 0;
        this._lastTrailPt = new THREE.Vector3();
        this._hasLastTrailPt = false;

        this._time = 0;

        this._bindListeners();

        EventBus.on('entity:died', ({ entityId }) => {
            if (entityId === this.armedId) {
                this._hideRingFor(this.armedId, /*entityGone=*/true);
                this._resetGesture();
            }
        });
    }

    // ─── ECS hook ──────────────────────────────────────────────────────────

    update(entities, deltaTime /*, ecs */) {
        this._time += deltaTime;
        if (this.armedId != null) {
            const dc = this.ecs.getComponent(this.armedId, 'DragCommandable');
            if (dc?.ringMesh?.material) {
                dc.ringMesh.material.opacity = 0.6 + 0.3 * Math.sin(this._time * 6);
            }
        }
    }

    // ─── Pointer Handling ──────────────────────────────────────────────────

    _bindListeners() {
        this.canvas.addEventListener('pointerdown',        (e) => this._onPointerDown(e));
        this.canvas.addEventListener('pointermove',        (e) => this._onPointerMove(e));
        this.canvas.addEventListener('pointerup',          (e) => this._onPointerUp(e));
        this.canvas.addEventListener('pointercancel',      (e) => this._onPointerCancel(e));
        this.canvas.addEventListener('lostpointercapture', (e) => this._onPointerCancel(e));

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this._hideRingFor(this.armedId);
                this._resetGesture();
            }
        });
    }

    _onPointerDown(e) {
        if (this.joystick?.active && this.joystick.pointerId === e.pointerId) return;
        if (this.pointerId != null) return;

        // Must land ON a drag-commandable entity. Otherwise the gesture is
        // dead — no arm, no trail, no selection.
        if (!this._screenToGround(e.clientX, e.clientY, this._hit)) return;
        const pickedId = this._pickEntityAt(this._hit);
        if (pickedId == null) return;

        this.pointerId = e.pointerId;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.isDragging = false;
        this.armedId = pickedId;
        this.lastHit.copy(this._hit);
        this.hasHit = true;

        this._showRingFor(pickedId);
        EventBus.emit('drag:armed', { entityId: pickedId });

        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }

    _onPointerMove(e) {
        if (e.pointerId !== this.pointerId) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        if (!this.isDragging) {
            if (dx * dx + dy * dy < TAP_MOVE_THRESHOLD_SQ) return;
            this.isDragging = true;
            this._beginTrail();
        }

        if (this._screenToGround(e.clientX, e.clientY, this._hit)) {
            this.lastHit.copy(this._hit);
            this.hasHit = true;
            this._appendTrailPoint(this._hit);
        }
    }

    _onPointerUp(e) {
        if (e.pointerId !== this.pointerId) return;

        if (this.isDragging && this.armedId != null && this.hasHit) {
            this._commitStraightLine(this.armedId, this.lastHit);
        }
        // No-drag case (tap without movement) is intentionally a no-op —
        // ring already showed instant feedback, and the gesture simply ends.

        this._hideRingFor(this.armedId);
        this._resetGesture();
    }

    _onPointerCancel(e) {
        if (e.pointerId !== this.pointerId) return;
        this._hideRingFor(this.armedId);
        this._resetGesture();
    }

    _resetGesture() {
        if (this.pointerId != null) {
            try { this.canvas.releasePointerCapture(this.pointerId); } catch (_) { /* ignore */ }
        }
        this.pointerId = null;
        this.isDragging = false;
        this.armedId = null;
        this.hasHit = false;
        this._hideTrail();
    }

    // ─── Picking ───────────────────────────────────────────────────────────

    _pickEntityAt(groundPos) {
        let bestId = null;
        let bestDistSq = Infinity;
        const candidates = this.ecs.queryEntities(['Transform', 'DragCommandable']);
        for (const id of candidates) {
            const dc = this.ecs.getComponent(id, 'DragCommandable');
            if (!dc || !dc.enabled) continue;
            const tr = this.ecs.getComponent(id, 'Transform');
            if (!tr?.mesh) continue;
            const p = tr.mesh.position;
            const dx = p.x - groundPos.x;
            const dz = p.z - groundPos.z;
            const d2 = dx * dx + dz * dz;
            const r = dc.pickRadius;
            if (d2 <= r * r && d2 < bestDistSq) {
                bestDistSq = d2;
                bestId = id;
            }
        }
        return bestId;
    }

    // ─── Selection Ring ────────────────────────────────────────────────────

    _showRingFor(entityId) {
        const dc = this.ecs.getComponent(entityId, 'DragCommandable');
        const tr = this.ecs.getComponent(entityId, 'Transform');
        if (!dc || !tr) return;

        dc.selected = true;
        if (!dc.ringMesh) {
            const inner = Math.max(0.2, dc.ringRadius - 0.12);
            const outer = dc.ringRadius;
            const geo = new THREE.RingGeometry(inner, outer, 48);
            const mat = new THREE.MeshBasicMaterial({
                color: dc.ringColor,
                transparent: true,
                opacity: 0.9,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(geo, mat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.02;
            ring.renderOrder = 999;
            tr.mesh.add(ring);
            dc.ringMesh = ring;
        } else {
            dc.ringMesh.visible = true;
        }
    }

    _hideRingFor(entityId, entityGone = false) {
        if (entityId == null) return;
        const dc = entityGone ? null : this.ecs.getComponent(entityId, 'DragCommandable');
        if (!dc) return;
        dc.selected = false;
        if (dc.ringMesh) {
            const ring = dc.ringMesh;
            if (ring.parent) ring.parent.remove(ring);
            ring.geometry?.dispose();
            ring.material?.dispose();
            dc.ringMesh = null;
        }
    }

    // ─── Path Commit (straight line: endpoint only) ────────────────────────

    _commitStraightLine(entityId, endpoint) {
        const wp = this.ecs.getComponent(entityId, 'Waypoints');
        if (!wp) return;

        // Straight-line policy: one waypoint = final pointer-up location.
        // Intermediate squiggles are ignored — the hero walks direct.
        wp.list = [endpoint.clone()];
        wp.currentIdx = 0;
        wp.finalDestination = endpoint.clone();
        wp.active = true;

        EventBus.emit('drag:path_assigned', {
            entityId,
            waypoints: wp.list
        });
    }

    // ─── Raycasting ────────────────────────────────────────────────────────

    _screenToGround(clientX, clientY, out) {
        const rect = this.canvas.getBoundingClientRect();
        this._ndc.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
        this._ndc.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this._ndc, this.camera);
        return !!this.raycaster.ray.intersectPlane(this.groundPlane, out);
    }

    // ─── Trail (preview only; not used for walking) ────────────────────────

    _beginTrail() {
        const dc = this.armedId != null
            ? this.ecs.getComponent(this.armedId, 'DragCommandable')
            : null;
        const color = dc?.trailColor ?? 0xffd700;

        if (!this.trailGeometry) {
            this.trailGeometry = new THREE.BufferGeometry();
            this.trailPositions = new Float32Array(TRAIL_MAX_POINTS * 3);
            this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
            const material = new THREE.LineBasicMaterial({
                color,
                transparent: true,
                opacity: 0.9,
                depthWrite: false
            });
            this.trailLine = new THREE.Line(this.trailGeometry, material);
            this.trailLine.renderOrder = 998;
            this.scene.add(this.trailLine);
        } else {
            this.trailLine.material.color.setHex(color);
            this.trailLine.visible = true;
        }
        this.trailCount = 0;
        this._hasLastTrailPt = false;
        this.trailGeometry.setDrawRange(0, 0);
    }

    _appendTrailPoint(p) {
        if (this._hasLastTrailPt) {
            const dx = p.x - this._lastTrailPt.x;
            const dz = p.z - this._lastTrailPt.z;
            if (dx * dx + dz * dz < TRAIL_MIN_SPACING * TRAIL_MIN_SPACING) return;
        }
        if (this.trailCount >= TRAIL_MAX_POINTS) return;

        const i = this.trailCount * 3;
        this.trailPositions[i]     = p.x;
        this.trailPositions[i + 1] = GROUND_Y + 0.03;
        this.trailPositions[i + 2] = p.z;
        this.trailCount++;
        this._lastTrailPt.set(p.x, p.y, p.z);
        this._hasLastTrailPt = true;
        this.trailGeometry.setDrawRange(0, this.trailCount);
        this.trailGeometry.attributes.position.needsUpdate = true;
    }

    _hideTrail() {
        if (this.trailLine) this.trailLine.visible = false;
        if (this.trailGeometry) this.trailGeometry.setDrawRange(0, 0);
        this.trailCount = 0;
        this._hasLastTrailPt = false;
    }
}
