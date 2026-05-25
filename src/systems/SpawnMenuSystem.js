import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import { getArchetype } from '../core/ArchetypeLoader.js';
import * as ResourceDrain from '../utils/ResourceDrain.js';

/**
 * SpawnMenuSystem — gameplay logic behind the right-edge spawn menu.
 *
 *   • ARMY / WORKERS taps → cost-check (storage + player back), drain
 *     storage FIRST, top up shortfall from player back, spawn the unit at
 *     the Kingdom Flag with a ring offset.
 *   • BUILD ▸ Wall tap → flips DrawWallSystem on (`draw:setMode`).
 *   • BUILD ▸ Wood/Essence Storage tap → enters placement mode. A ground
 *     indicator follows the cursor (pointermove). pointerdown reads the
 *     archetype's spawn.cost (from balance.json via $balance placeholders),
 *     drains storage-first + player-back-second, then spawns the storage.
 *     2026-05-11: FREE_STORAGE_PLACE flag removed — storages now cost.
 *
 * Mutex: tapping one mode (wall draw vs storage placement) cancels the
 * other. Tapping any ARMY/WORKERS unit cancels both. ESC cancels placement.
 *
 * Banner wave: the Kingdom Flag mesh exposes a flagPivot Object3D in
 * userData. We oscillate its Y rotation each frame so the banner reads as
 * "alive" without spawning a dedicated AnimationSystem hook.
 */

const STORAGE_TAG = {
    'wood-storage':    'wood-storage',
    'essence-storage': 'essence-storage'
};

const STORAGE_COLOR = {
    'wood-storage':    0xc97a2a,
    'essence-storage': 0x1ea5d6
};

const SPAWN_RING_RADIUS = 1.8;       // matches HeroBar pattern
const GROUND_Y          = 0;

export class SpawnMenuSystem {
    constructor({ ecs, factory, scene, camera, canvas, playerId, particleSystem = null }) {
        this.ecs     = ecs;
        this.factory = factory;
        this.scene   = scene;
        this.camera  = camera;
        this.canvas  = canvas;
        this.playerId = playerId;
        this.particleSystem = particleSystem;

        this._flagId = null;
        this._flagPivot = null;
        this._waveT = 0;

        // Placement mode state
        this._placeArchetype = null;     // null | 'wood-storage' | 'essence-storage'
        this._lastBuildSub = null;        // 'wall' | 'wood-storage' | 'essence-storage' | null
        this._indicator = null;
        this._raycaster = new THREE.Raycaster();
        this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);
        this._ndc = new THREE.Vector2();
        this._hit = new THREE.Vector3();

        this._bindUI();
        this._bindCanvasListeners();

        // Refresh totals on every inventory change (any entity).
        EventBus.on('stack:changed', () => this._pushTotals());

        // ESC clears whatever mode is active.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this._exitAllModes();
        });

        // If DrawWallSystem turns itself off (its own ESC, or one-shot
        // commit), our BUILD▸Wall chip should drop its active state.
        EventBus.on('draw:setMode', ({ enabled }) => {
            if (!enabled && this._lastBuildSub === 'wall') {
                this._lastBuildSub = null;
                EventBus.emit('spawn:modeChanged', { mode: null });
            }
        });
    }

    // ECS hook — banner wave + indicator follow.
    update(deltaTime) {
        if (this._flagPivot) {
            this._waveT += deltaTime;
            this._flagPivot.rotation.y = Math.sin(this._waveT * 1.8) * 0.18;
            this._flagPivot.rotation.z = Math.sin(this._waveT * 2.4) * 0.04;
        }
    }

    setFlagId(id) {
        this._flagId = id;
        const tr = this.ecs.getComponent(id, 'Transform');
        this._flagPivot = tr?.mesh?.userData?.flagPivot || null;
        // Push initial totals once we have the playerId path wired.
        this._pushTotals();
    }

    // ─── UI listener ───────────────────────────────────────────────────────

    _bindUI() {
        EventBus.on('spawnmenu:tap', (ev) => this._onTap(ev));
    }

    _onTap({ kind, sub, archetype, cost }) {
        // Any tap that isn't a BUILD chip clears placement / draw modes.
        if (kind !== 'build') {
            this._exitAllModes();
            return this._handleSpawn(archetype, cost);
        }

        // BUILD: re-tapping the active sub cancels (matches the UI's toggle).
        if (this._lastBuildSub === sub) {
            this._exitAllModes();
            return;
        }

        // Switching modes: cancel whatever was active first.
        this._exitAllModes(/* silent */ true);

        if (sub === 'wall') {
            this._lastBuildSub = 'wall';
            EventBus.emit('draw:setMode', { enabled: true });
            EventBus.emit('spawn:modeChanged', { mode: 'wall' });
            return;
        }

        if (sub === 'wood-storage' || sub === 'essence-storage') {
            this._lastBuildSub = sub;
            this._enterPlaceMode(sub);
            EventBus.emit('spawn:modeChanged', { mode: 'place_' + sub });
            return;
        }
    }

    // ─── Spawn flow ────────────────────────────────────────────────────────

    _handleSpawn(archetypeName, cost) {
        if (!archetypeName) return;

        if (cost && !this._drainCost(cost)) {
            // Affordability is also gated client-side in the UI (greyed
            // chip), but defend in depth — the totals snapshot might be
            // stale for one frame after a fast double-tap.
            return;
        }

        this._spawnAtFlag(archetypeName);
        this._pushTotals();
    }

    /**
     * Drain `cost` from storage FIRST, then top up shortfall from player back.
     * Thin wrapper over ResourceDrain.drainCost — kept for readability at
     * call sites + parity with `_handleSpawn` flow. Returns true on success.
     */
    _drainCost(cost) {
        return ResourceDrain.drainCost(this.ecs, this.playerId, cost);
    }

    _spawnAtFlag(archetypeName) {
        const flagPos = this._getFlagPos();
        if (!flagPos) {
            console.warn('[SpawnMenuSystem] no flag in scene — cannot spawn', archetypeName);
            return;
        }
        const angle = Math.random() * Math.PI * 2;
        const pos = flagPos.clone();
        pos.x += Math.cos(angle) * SPAWN_RING_RADIUS;
        pos.z += Math.sin(angle) * SPAWN_RING_RADIUS;

        const id = this.factory.create(archetypeName, pos);

        // HeroAI guards from spawn position; mirror the level-loader pattern.
        const heroAI = this.ecs.getComponent(id, 'HeroAI');
        if (heroAI) heroAI.homePosition.copy(pos);

        // Small spawn-burst VFX — gold sparkle radiating outward from the spawn point.
        if (this.particleSystem) {
            const burstPos = pos.clone();
            burstPos.y = 0.6;
            this.particleSystem.createImpactBurst(burstPos, 0xffd366, 18);
        }
        EventBus.emit('spawnmenu:unitSpawned', { archetype: archetypeName, entityId: id });
    }

    _getFlagPos() {
        if (this._flagId == null) return null;
        const tr = this.ecs.getComponent(this._flagId, 'Transform');
        return tr?.mesh?.position?.clone() || null;
    }

    // ─── Totals ────────────────────────────────────────────────────────────

    _computeTotals() {
        return ResourceDrain.computeTotals(this.ecs, this.playerId);
    }

    _pushTotals() {
        EventBus.emit('spawn:totalsChanged', { totals: this._computeTotals() });
    }

    // ─── Placement mode (BUILD ▸ Wood/Essence Storage) ─────────────────────

    _enterPlaceMode(archetypeName) {
        this._placeArchetype = archetypeName;
        document.body.classList.add('place-mode');
        this._ensureIndicator(archetypeName);
        // Stay hidden until the first pointermove resolves a ground hit —
        // otherwise the indicator pops in at world (0,0,0) and "jumps" to
        // the cursor on the next mouse motion.
        if (this._indicator) this._indicator.visible = false;
    }

    _exitAllModes(silent = false) {
        this._placeArchetype = null;
        this._lastBuildSub = null;
        document.body.classList.remove('place-mode');
        if (this._indicator) this._indicator.visible = false;
        // Cancel a pending wall draw too.
        EventBus.emit('draw:setMode', { enabled: false });
        if (!silent) EventBus.emit('spawn:modeChanged', { mode: null });
    }

    _ensureIndicator(archetypeName) {
        if (this._indicator) {
            // Recolor existing indicator to match the new storage type.
            const c = STORAGE_COLOR[archetypeName] || 0xffffff;
            for (const child of this._indicator.children) {
                if (child.material) child.material.color.setHex(c);
            }
            return;
        }
        const group = new THREE.Group();
        const geo = new THREE.BoxGeometry(2.4, 0.4, 2.4);
        const mat = new THREE.MeshBasicMaterial({
            color: STORAGE_COLOR[archetypeName] || 0xffffff,
            transparent: true, opacity: 0.45, depthWrite: false
        });
        const box = new THREE.Mesh(geo, mat);
        box.position.y = 0.2;
        group.add(box);

        // Crosshair lines on top so the player sees an exact center.
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
        const cross = new THREE.Group();
        const crossGeoX = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-1.2, 0, 0), new THREE.Vector3(1.2, 0, 0)
        ]);
        const crossGeoZ = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, -1.2), new THREE.Vector3(0, 0, 1.2)
        ]);
        cross.add(new THREE.Line(crossGeoX, lineMat));
        cross.add(new THREE.Line(crossGeoZ, lineMat));
        cross.position.y = 0.42;
        group.add(cross);

        group.renderOrder = 999;
        group.visible = false;
        this.scene.add(group);
        this._indicator = group;
    }

    // ─── Canvas listeners (placement only) ─────────────────────────────────

    _bindCanvasListeners() {
        this.canvas.addEventListener('pointermove', (e) => this._onPointerMove(e), { capture: true });
        this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e), { capture: true });
    }

    _onPointerMove(e) {
        if (!this._placeArchetype) return;
        if (this._screenToGround(e.clientX, e.clientY, this._hit)) {
            if (this._indicator) {
                this._indicator.position.set(this._hit.x, 0, this._hit.z);
                this._indicator.visible = true;
            }
        }
    }

    _onPointerDown(e) {
        if (!this._placeArchetype) return;
        // Intercept BEFORE DragInputSystem so the click doesn't double as
        // a player-waypoint command.
        e.stopImmediatePropagation();
        e.preventDefault?.();

        if (!this._screenToGround(e.clientX, e.clientY, this._hit)) return;

        // Pull cost from the archetype (resolved via balance.json placeholders
        // at boot). Drain storage-first / player-back-second. Defends against
        // a fast double-tap after a partial drain — _drainCost re-checks
        // affordability against the latest totals before mutating anything.
        let cost = null;
        try {
            const arch = getArchetype(this._placeArchetype);
            cost = arch?.spawn?.cost || null;
        } catch (_) { /* missing archetype — fall through with cost=null */ }

        if (cost && !this._drainCost(cost)) {
            // Tap ignored — UI greys the chip too, but this is defense in depth.
            this._exitAllModes();
            return;
        }

        const pos = new THREE.Vector3(this._hit.x, 0, this._hit.z);
        this.factory.create(this._placeArchetype, pos);
        this._pushTotals();

        // One-shot: every tap exits placement mode so we don't accidentally
        // place a second box on the same drag.
        this._exitAllModes();
    }

    _screenToGround(clientX, clientY, out) {
        const rect = this.canvas.getBoundingClientRect();
        this._ndc.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
        this._ndc.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._ndc, this.camera);
        return !!this._raycaster.ray.intersectPlane(this._groundPlane, out);
    }
}
