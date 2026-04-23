import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

const TAP_MOVE_THRESHOLD_PX = 8;
const TAP_MOVE_THRESHOLD_SQ = TAP_MOVE_THRESHOLD_PX * TAP_MOVE_THRESHOLD_PX;
const TRAIL_MIN_SPACING = 0.1;
const TRAIL_MAX_POINTS = 256;
const GROUND_Y = 0;

const MARQUEE_COLOR = 0x44ccff;
const MARQUEE_FILL_OPACITY = 0.12;
const MARQUEE_LINE_OPACITY = 0.9;

// Gesture state machine
const MODE_IDLE            = 'idle';
const MODE_ARMED_SINGLE    = 'armed_single';       // touchdown on commandable unit (not in group)
const MODE_ARMED_GROUP     = 'armed_group';        // touchdown on unit inside selected group
const MODE_ARMED_MARQUEE   = 'armed_marquee';      // touchdown on empty ground
const MODE_SINGLE_DRAG     = 'single_drag';
const MODE_GROUP_DRAG      = 'group_drag';
const MODE_MARQUEE_DRAG    = 'marquee_drag';
const MODE_PAN             = 'pan';

/**
 * DragInputSystem — Unified touch/mouse input for unit commanding + map panning.
 *
 * Gesture layers (all on the same canvas):
 *   1-finger on commandable unit       → drag → straight-line walk
 *   1-finger on empty ground           → drag → marquee → group selection
 *   1-finger on selected-group unit    → drag → group walk (formation preserved)
 *   2 fingers anywhere                 → pan the camera (XZ plane)
 *
 * Selection persistence:
 *   - Single-unit command: gesture-scoped (ring only while finger down).
 *   - Group selection via marquee: persistent across gestures; cleared on
 *     group-move commit, new marquee, or tap on a non-group commandable unit.
 *
 * Completely character-agnostic: any entity with Component_DragCommandable is
 * pickable; any with Component_Waypoints receives a path.
 */
export class DragInputSystem {
    constructor(ecs, camera, scene, canvas, joystick = null, cameraSystem = null) {
        this.ecs = ecs;
        this.camera = camera;
        this.scene = scene;
        this.canvas = canvas;
        this.joystick = joystick;
        this.cameraSystem = cameraSystem;

        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);
        this._ndc = new THREE.Vector2();
        this._hit = new THREE.Vector3();

        // Multi-pointer tracking. Map pointerId → { x, y }.
        this.pointers = new Map();
        this.primaryId = null;

        // Mode + per-gesture primary state
        this.mode = MODE_IDLE;
        this.startX = 0;
        this.startY = 0;
        this.startGround = new THREE.Vector3();
        this.lastHit = new THREE.Vector3();
        this.hasHit = false;
        this.armedId = null;            // unit under the primary finger

        // Persistent group selection (entity IDs)
        this.selectedGroup = new Set();

        // Pan state — snapshot-based to avoid feedback with camera lerp.
        // At pan-start we clone the live camera and remember the fingers'
        // ground-hits in that frozen frame of reference. Every subsequent
        // step computes an ABSOLUTE pan offset from the same reference, so
        // the camera's lerp smooths the motion without creating a loop.
        this._panCamSnapshot = null;
        this._panBaseX = 0;
        this._panBaseZ = 0;
        this._panAnchorMidX = 0;
        this._panAnchorMidZ = 0;
        this._panAnchorSet = false;

        // Pinch-zoom state — captured at pan-start. Zoom factor each frame
        // = startZoom * (currentFingerDist / startFingerDist).
        this._pinchStartDist = 0;
        this._pinchStartZoom = 1;

        // Visuals
        this.trailGeometry = null;
        this.trailLine = null;
        this.trailPositions = null;
        this.trailCount = 0;
        this._lastTrailPt = new THREE.Vector3();
        this._hasLastTrailPt = false;

        this.marqueeGroup = null;       // THREE.Group containing fill + border
        this.marqueeFill = null;
        this.marqueeBorder = null;

        this._time = 0;

        this._bindListeners();

        EventBus.on('entity:died', ({ entityId }) => {
            if (this.selectedGroup.has(entityId)) {
                this._hideRingFor(entityId, /*gone=*/true);
                this.selectedGroup.delete(entityId);
            }
            if (entityId === this.armedId) {
                this._hideRingFor(this.armedId, /*gone=*/true);
                this._resetPrimaryGesture();
            }
        });
    }

    // ─── ECS hook ──────────────────────────────────────────────────────────

    update(entities, deltaTime /*, ecs */) {
        this._time += deltaTime;

        // Pulse armed (gesture-active) ring
        if (this.armedId != null) {
            const dc = this.ecs.getComponent(this.armedId, 'DragCommandable');
            if (dc?.ringMesh?.material) {
                dc.ringMesh.material.opacity = 0.6 + 0.3 * Math.sin(this._time * 6);
            }
        }
    }

    // ─── Listeners ─────────────────────────────────────────────────────────

    _bindListeners() {
        this.canvas.addEventListener('pointerdown',        (e) => this._onPointerDown(e));
        this.canvas.addEventListener('pointermove',        (e) => this._onPointerMove(e));
        this.canvas.addEventListener('pointerup',          (e) => this._onPointerUp(e));
        this.canvas.addEventListener('pointercancel',      (e) => this._onPointerCancel(e));
        this.canvas.addEventListener('lostpointercapture', (e) => this._onPointerCancel(e));

        // Wheel = mouse wheel + trackpad two-finger scroll. passive:false so
        // we can preventDefault and kill the browser back/forward history
        // gesture on MacBook trackpads.
        this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this._hardReset();
        });
    }

    _onWheel(e) {
        e.preventDefault();
        if (!this.cameraSystem) return;
        // Don't hijack the wheel while the user is actively drawing a path
        // or marquee — those gestures own the input.
        if (this.mode === MODE_SINGLE_DRAG
         || this.mode === MODE_GROUP_DRAG
         || this.mode === MODE_MARQUEE_DRAG) return;

        // ctrlKey-on-wheel = MacBook trackpad pinch (browser convention).
        // Ctrl+scroll on any device is also widely expected to zoom. Treat as
        // zoom; route everything else to pan.
        if (e.ctrlKey) {
            // deltaY is typically in pixels for pinch. Convert to a smooth
            // multiplicative factor — exp keeps zoom-in and zoom-out rates
            // symmetric regardless of direction.
            const factor = Math.exp(-e.deltaY * 0.01);
            this.cameraSystem.zoomBy(factor);
            return;
        }

        // Normalize deltaMode for pan path: 0=pixel, 1=line, 2=page.
        let dx = e.deltaX;
        let dy = e.deltaY;
        if (e.deltaMode === 1)      { dx *= 16; dy *= 16; }
        else if (e.deltaMode === 2) { dx *= window.innerHeight; dy *= window.innerHeight; }

        // Convert pixel delta → world ΔXZ via a live-camera raycast pair at
        // screen center. Wheel events are discrete, so no feedback concern.
        const rect = this.canvas.getBoundingClientRect();
        const cx = rect.left + rect.width  / 2;
        const cy = rect.top  + rect.height / 2;
        const p1 = new THREE.Vector3();
        const p2 = new THREE.Vector3();
        if (!this._screenToGround(cx, cy, p1)) return;
        if (!this._screenToGround(cx + dx, cy + dy, p2)) return;

        // Grab-the-map: camera moves OPPOSITE the swipe so the ground stays
        // under the fingers. Matches touch pan and macOS natural-scroll.
        const base = this.cameraSystem.getPan();
        this.cameraSystem.setPan(base.x - (p2.x - p1.x), base.z - (p2.z - p1.z));
    }

    _onPointerDown(e) {
        // Joystick (if re-enabled later) owns its own pointer.
        if (this.joystick?.active && this.joystick.pointerId === e.pointerId) return;

        // Track every pointer on our canvas; cap at 2 tracked.
        if (this.pointers.size >= 2) return;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }

        if (this.pointers.size === 1) {
            // This is the primary — decide initial mode by what it landed on.
            this.primaryId = e.pointerId;
            this._beginPrimaryGesture(e.clientX, e.clientY);
        } else if (this.pointers.size === 2) {
            // Second finger → cancel any primary gesture (hide trail/marquee,
            // drop armed ring) and enter pan mode.
            this._cancelPrimaryGesture();
            this._enterPanMode();
        }
    }

    _onPointerMove(e) {
        if (!this.pointers.has(e.pointerId)) return;
        const p = this.pointers.get(e.pointerId);
        p.x = e.clientX;
        p.y = e.clientY;

        if (this.mode === MODE_PAN) {
            this._panStep();
            return;
        }

        if (e.pointerId !== this.primaryId) return;
        this._primaryMove(e.clientX, e.clientY);
    }

    _onPointerUp(e) {
        if (!this.pointers.has(e.pointerId)) return;
        this.pointers.delete(e.pointerId);
        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }

        if (this.mode === MODE_PAN) {
            // Pan ends as soon as we drop back below 2 fingers. A lingering
            // finger does NOT resurrect a single-finger gesture (it wasn't
            // tracked from its own pointerdown in a meaningful way).
            this._exitPanMode();
            this._resetPrimaryGesture();
            return;
        }

        if (e.pointerId === this.primaryId) {
            this._primaryUp();
            this._resetPrimaryGesture();
        }
    }

    _onPointerCancel(e) {
        if (!this.pointers.has(e.pointerId)) return;
        this.pointers.delete(e.pointerId);

        if (this.mode === MODE_PAN && this.pointers.size < 2) {
            this._exitPanMode();
        }
        if (e.pointerId === this.primaryId) {
            this._cancelPrimaryGesture();
            this._resetPrimaryGesture();
        }
    }

    // ─── Primary-finger gesture ────────────────────────────────────────────

    _beginPrimaryGesture(clientX, clientY) {
        this.startX = clientX;
        this.startY = clientY;
        this.hasHit = false;

        if (!this._screenToGround(clientX, clientY, this._hit)) {
            this.mode = MODE_IDLE;   // no ground hit (shouldn't happen)
            return;
        }
        this.startGround.copy(this._hit);
        this.lastHit.copy(this._hit);
        this.hasHit = true;

        const pickedId = this._pickEntityAt(this._hit);
        if (pickedId != null && this.selectedGroup.has(pickedId)) {
            // Touched a unit already in the selected group → ARMED_GROUP.
            // Tap release (no drag) → remove this one from the group.
            // Drag → group-move command for the whole group.
            this.mode = MODE_ARMED_GROUP;
            this.armedId = pickedId;
            // Ring is already visible from group selection. No new ring pop.
        } else if (pickedId != null) {
            // Touched a commandable unit NOT in group → ARMED_SINGLE.
            // Tap release (no drag) → replace selection with just this unit.
            // Drag → clear any existing group + single-unit command.
            // NOTE: we deliberately do NOT clear the existing group here —
            // the decision to clear (drag) or replace (tap) is made on
            // release, not at touchdown. This lets tap-to-replace behave
            // predictably for long-distance commands.
            this.mode = MODE_ARMED_SINGLE;
            this.armedId = pickedId;
            this._showRingFor(pickedId);
            EventBus.emit('drag:armed', { entityId: pickedId });
        } else {
            // Empty ground → could become a marquee (on drag) or a
            // long-distance command (on tap release if a group is selected).
            this.mode = MODE_ARMED_MARQUEE;
            this.armedId = null;
        }
    }

    _primaryMove(clientX, clientY) {
        const dx = clientX - this.startX;
        const dy = clientY - this.startY;
        const past = dx * dx + dy * dy >= TAP_MOVE_THRESHOLD_SQ;

        // Promote armed → drag once past the tap threshold
        if (this.mode === MODE_ARMED_SINGLE && past) {
            this.mode = MODE_SINGLE_DRAG;
            // Drag from a non-group unit = single-unit command. Clear any
            // previously selected group (user is commanding just this one).
            // The armed unit isn't in that group (guaranteed by ARMED_SINGLE
            // entry condition), so its ring survives _clearGroup.
            if (this.selectedGroup.size > 0) this._clearGroup();
            this._beginTrail();
        } else if (this.mode === MODE_ARMED_GROUP && past) {
            this.mode = MODE_GROUP_DRAG;
            this._beginTrail();
        } else if (this.mode === MODE_ARMED_MARQUEE && past) {
            this.mode = MODE_MARQUEE_DRAG;
            this._beginMarqueeMesh();
            this._updateMarqueeMesh(this.startGround, this._hit);
        }

        if (this._screenToGround(clientX, clientY, this._hit)) {
            this.lastHit.copy(this._hit);
            this.hasHit = true;

            if (this.mode === MODE_SINGLE_DRAG || this.mode === MODE_GROUP_DRAG) {
                this._appendTrailPoint(this._hit);
            } else if (this.mode === MODE_MARQUEE_DRAG) {
                this._updateMarqueeMesh(this.startGround, this._hit);
            }
        }
    }

    _primaryUp() {
        switch (this.mode) {
            case MODE_SINGLE_DRAG:
                if (this.armedId != null && this.hasHit) {
                    this._commitSingle(this.armedId, this.lastHit);
                }
                this._hideRingFor(this.armedId);
                break;

            case MODE_GROUP_DRAG:
                if (this.hasHit) this._commitGroup(this.lastHit);
                this._clearGroup();
                break;

            case MODE_MARQUEE_DRAG:
                this._commitMarquee(this.startGround, this.lastHit);
                break;

            // Tap on a non-group commandable unit → REPLACE the selection
            // with just that unit (ring persists). Classic "single select."
            case MODE_ARMED_SINGLE:
                if (this.armedId != null) {
                    // Drop any previous group selection. The armed unit is
                    // guaranteed NOT in that group, so _clearGroup leaves its
                    // ring intact — which we then promote to persistent by
                    // adding to selectedGroup.
                    if (this.selectedGroup.size > 0) this._clearGroup();
                    this.selectedGroup.add(this.armedId);
                    EventBus.emit('drag:group_selected', { entityIds: [this.armedId] });
                }
                break;

            // Tap on a unit already in the group → DESELECT just that unit.
            // Rest of the group stays selected. If this was the only member,
            // the group becomes empty.
            case MODE_ARMED_GROUP:
                if (this.armedId != null) {
                    this.selectedGroup.delete(this.armedId);
                    this._hideRingFor(this.armedId);
                    EventBus.emit('drag:group_selected', { entityIds: Array.from(this.selectedGroup) });
                }
                break;

            // Tap on empty ground.
            //   - With a group selected → long-distance command: the whole
            //     group marches to the tap point. Ring clears.
            //   - With nothing selected → no-op (prevents misfires).
            case MODE_ARMED_MARQUEE:
                if (this.selectedGroup.size > 0 && this.hasHit) {
                    this._commitGroup(this.lastHit);
                    this._clearGroup();
                }
                break;
        }
    }

    _cancelPrimaryGesture() {
        // Abort whatever the primary finger was doing without committing.
        if (this.mode === MODE_ARMED_SINGLE || this.mode === MODE_SINGLE_DRAG) {
            this._hideRingFor(this.armedId);
        }
        this._hideTrail();
        this._hideMarqueeMesh();
    }

    _resetPrimaryGesture() {
        this.primaryId = null;
        this.mode = this.pointers.size >= 2 ? MODE_PAN : MODE_IDLE;
        this.armedId = null;
        this.hasHit = false;
        this._hideTrail();
        this._hideMarqueeMesh();
    }

    _hardReset() {
        this._cancelPrimaryGesture();
        if (this.mode === MODE_PAN) this._exitPanMode();
        this.pointers.clear();
        this.primaryId = null;
        this.mode = MODE_IDLE;
        this.armedId = null;
    }

    // ─── Two-finger pan ────────────────────────────────────────────────────

    _enterPanMode() {
        this.mode = MODE_PAN;

        // Snapshot the live camera into an independent clone. All pan
        // raycasts use this snapshot, never the live camera — so the
        // camera's own lerping motion can't feed back into our deltas.
        this._panCamSnapshot = this.camera.clone();
        this._panCamSnapshot.updateMatrixWorld(true);

        // Baseline pan offset — new fingers pan relative to wherever the
        // camera was already panned to.
        const base = this.cameraSystem?.getPan?.() ?? { x: 0, z: 0 };
        this._panBaseX = base.x;
        this._panBaseZ = base.z;

        // Anchor world midpoint of the two fingers' START positions, in
        // the snapshot-camera frame. Never updated until pan ends.
        this._panAnchorSet = false;
        this._seedPanAnchor();

        // Pinch-zoom baseline — record fingers' screen distance and current
        // zoom. _panStep then drives zoom = startZoom * (currDist / startDist)
        // each frame, decoupled from pan.
        this._pinchStartDist = this._pointerPairDist();
        this._pinchStartZoom = this.cameraSystem?.getZoom?.() ?? 1;
    }

    _exitPanMode() {
        this.mode = MODE_IDLE;
        this._panCamSnapshot = null;
        this._panAnchorSet = false;
        this._pinchStartDist = 0;
    }

    _pointerPairDist() {
        if (this.pointers.size < 2) return 0;
        const iter = this.pointers.values();
        const a = iter.next().value;
        const b = iter.next().value;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.hypot(dx, dy);
    }

    _seedPanAnchor() {
        if (this.pointers.size < 2 || !this._panCamSnapshot) return;
        const iter = this.pointers.values();
        const a = iter.next().value;
        const b = iter.next().value;
        const p1 = new THREE.Vector3();
        const p2 = new THREE.Vector3();
        if (!this._snapshotScreenToGround(a.x, a.y, p1)) return;
        if (!this._snapshotScreenToGround(b.x, b.y, p2)) return;
        this._panAnchorMidX = (p1.x + p2.x) * 0.5;
        this._panAnchorMidZ = (p1.z + p2.z) * 0.5;
        this._panAnchorSet = true;
    }

    _panStep() {
        if (this.pointers.size < 2 || !this.cameraSystem || !this._panCamSnapshot) return;
        if (!this._panAnchorSet) {
            this._seedPanAnchor();
            return;
        }
        const iter = this.pointers.values();
        const a = iter.next().value;
        const b = iter.next().value;
        const p1 = new THREE.Vector3();
        const p2 = new THREE.Vector3();
        if (!this._snapshotScreenToGround(a.x, a.y, p1)) return;
        if (!this._snapshotScreenToGround(b.x, b.y, p2)) return;

        const curMidX = (p1.x + p2.x) * 0.5;
        const curMidZ = (p1.z + p2.z) * 0.5;

        // We want the world point that WAS under the fingers at pan-start
        // (the anchor) to remain under the fingers now. If, in the frozen
        // snapshot frame, the fingers currently map to `curMid`, then the
        // camera must translate by (anchorMid - curMid) so the anchor falls
        // under the fingers' new screen position. ABSOLUTE offset — no
        // per-frame accumulation, no feedback.
        const dx = this._panAnchorMidX - curMidX;
        const dz = this._panAnchorMidZ - curMidZ;
        this.cameraSystem.setPan(this._panBaseX + dx, this._panBaseZ + dz);

        // Pinch-zoom: apply absolute zoom based on the finger distance ratio.
        // Decoupled from pan — zoom changes the frustum, pan changes position.
        if (this._pinchStartDist > 0) {
            const curDist = this._pointerPairDist();
            if (curDist > 0) {
                const factor = curDist / this._pinchStartDist;
                this.cameraSystem.setZoom(this._pinchStartZoom * factor);
            }
        }
    }

    _snapshotScreenToGround(clientX, clientY, out) {
        const rect = this.canvas.getBoundingClientRect();
        this._ndc.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
        this._ndc.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this._ndc, this._panCamSnapshot);
        return !!this.raycaster.ray.intersectPlane(this.groundPlane, out);
    }

    // ─── Entity picking / raycasting ───────────────────────────────────────

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

    _screenToGround(clientX, clientY, out) {
        const rect = this.canvas.getBoundingClientRect();
        this._ndc.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
        this._ndc.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this._ndc, this.camera);
        return !!this.raycaster.ray.intersectPlane(this.groundPlane, out);
    }

    // ─── Commits ───────────────────────────────────────────────────────────

    _commitSingle(entityId, endpoint) {
        const wp = this.ecs.getComponent(entityId, 'Waypoints');
        if (!wp) return;
        wp.list = [endpoint.clone()];
        wp.currentIdx = 0;
        wp.finalDestination = endpoint.clone();
        wp.active = true;
        EventBus.emit('drag:path_assigned', { entityId, waypoints: wp.list });
    }

    _commitGroup(endpoint) {
        if (this.selectedGroup.size === 0) return;

        // Compute group centroid (XZ only).
        let cx = 0, cz = 0, n = 0;
        for (const id of this.selectedGroup) {
            const tr = this.ecs.getComponent(id, 'Transform');
            if (!tr?.mesh) continue;
            cx += tr.mesh.position.x;
            cz += tr.mesh.position.z;
            n++;
        }
        if (n === 0) return;
        cx /= n; cz /= n;

        // Each unit keeps its relative offset from the centroid so the group
        // travels as a formation rather than piling on one point.
        for (const id of this.selectedGroup) {
            const tr = this.ecs.getComponent(id, 'Transform');
            const wp = this.ecs.getComponent(id, 'Waypoints');
            if (!tr?.mesh || !wp) continue;
            const ox = tr.mesh.position.x - cx;
            const oz = tr.mesh.position.z - cz;
            const target = new THREE.Vector3(endpoint.x + ox, endpoint.y, endpoint.z + oz);
            wp.list = [target];
            wp.currentIdx = 0;
            wp.finalDestination = target.clone();
            wp.active = true;
            EventBus.emit('drag:path_assigned', { entityId: id, waypoints: wp.list });
        }
    }

    _commitMarquee(a, b) {
        const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
        const minZ = Math.min(a.z, b.z), maxZ = Math.max(a.z, b.z);

        // Gather every DragCommandable whose XZ position is inside the AABB.
        const hits = [];
        const candidates = this.ecs.queryEntities(['Transform', 'DragCommandable']);
        for (const id of candidates) {
            const dc = this.ecs.getComponent(id, 'DragCommandable');
            if (!dc || !dc.enabled) continue;
            const tr = this.ecs.getComponent(id, 'Transform');
            if (!tr?.mesh) continue;
            const p = tr.mesh.position;
            if (p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ) {
                hits.push(id);
            }
        }

        // Replace the existing group.
        this._clearGroup();
        for (const id of hits) {
            this.selectedGroup.add(id);
            this._showRingFor(id);
        }
        EventBus.emit('drag:group_selected', { entityIds: hits });
    }

    _clearGroup() {
        for (const id of this.selectedGroup) this._hideRingFor(id);
        this.selectedGroup.clear();
        EventBus.emit('drag:group_cleared', {});
    }

    // ─── Selection ring ────────────────────────────────────────────────────

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

    // ─── Trail (preview only) ──────────────────────────────────────────────

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

    // ─── Marquee rectangle ─────────────────────────────────────────────────

    _beginMarqueeMesh() {
        if (!this.marqueeGroup) {
            const group = new THREE.Group();

            const fillGeo = new THREE.PlaneGeometry(1, 1);
            const fillMat = new THREE.MeshBasicMaterial({
                color: MARQUEE_COLOR,
                transparent: true,
                opacity: MARQUEE_FILL_OPACITY,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const fill = new THREE.Mesh(fillGeo, fillMat);
            fill.rotation.x = -Math.PI / 2;
            group.add(fill);

            const borderGeo = new THREE.BufferGeometry();
            const positions = new Float32Array(5 * 3); // 4 corners + closing
            borderGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const borderMat = new THREE.LineBasicMaterial({
                color: MARQUEE_COLOR,
                transparent: true,
                opacity: MARQUEE_LINE_OPACITY,
                depthWrite: false
            });
            const border = new THREE.Line(borderGeo, borderMat);
            group.add(border);

            this.marqueeGroup = group;
            this.marqueeFill = fill;
            this.marqueeBorder = border;
            this.scene.add(group);
        }
        this.marqueeGroup.visible = true;
    }

    _updateMarqueeMesh(a, b) {
        if (!this.marqueeGroup) return;
        const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
        const minZ = Math.min(a.z, b.z), maxZ = Math.max(a.z, b.z);
        const w = Math.max(0.01, maxX - minX);
        const h = Math.max(0.01, maxZ - minZ);

        // Fill: scale the unit plane and place it at the rect center.
        this.marqueeFill.scale.set(w, h, 1);
        this.marqueeFill.position.set((minX + maxX) * 0.5, GROUND_Y + 0.015, (minZ + maxZ) * 0.5);

        // Border: 4-corner loop.
        const y = GROUND_Y + 0.02;
        const pos = this.marqueeBorder.geometry.attributes.position.array;
        pos[0]  = minX; pos[1]  = y; pos[2]  = minZ;
        pos[3]  = maxX; pos[4]  = y; pos[5]  = minZ;
        pos[6]  = maxX; pos[7]  = y; pos[8]  = maxZ;
        pos[9]  = minX; pos[10] = y; pos[11] = maxZ;
        pos[12] = minX; pos[13] = y; pos[14] = minZ;
        this.marqueeBorder.geometry.attributes.position.needsUpdate = true;
    }

    _hideMarqueeMesh() {
        if (this.marqueeGroup) this.marqueeGroup.visible = false;
    }
}
