import * as THREE from 'three';

/**
 * AimReticle — PUBG-style aim indicator + hit confirmation marker.
 *
 * Owns two world-space sprites (added directly to the scene):
 *
 *   - dot:       The reticle itself. Slides smoothly to the locked enemy's
 *                chest each frame. Fades in/out when a target is acquired or
 *                lost. Pulses (scale-up) on every shot fired.
 *   - hitMarker: PUBG's "hit X". Briefly flashes at the bullet impact position
 *                each time a shot connects. White on hit, red on kill.
 *
 * Both are billboard sprites with depthTest disabled so they always render on
 * top of the scene — the player must always see them, regardless of geometry.
 */

const DOT_REST_SCALE   = 0.55;
const DOT_PULSE_SCALE  = 0.85;
const DOT_PULSE_TIME   = 0.08;
const FADE_IN_RATE     = 8;   // per second
const FADE_OUT_RATE    = 6;   // per second
const SLIDE_TAU        = 0.05; // exponential-smoothing time constant — ~90% in 0.15s

const HIT_MARKER_DURATION = 0.18;
const HIT_COLOR  = 0xffffff;
const KILL_COLOR = 0xff3333;

export class AimReticle {
    constructor(scene) {
        this.scene = scene;

        this.dot = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this._buildDotTexture(),
            transparent: true,
            depthTest: false,
            depthWrite: false,
            opacity: 0
        }));
        this.dot.scale.set(DOT_REST_SCALE, DOT_REST_SCALE, 1);
        this.dot.renderOrder = 999;
        scene.add(this.dot);

        this.hitMarker = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this._buildXTexture(),
            transparent: true,
            depthTest: false,
            depthWrite: false,
            opacity: 0
        }));
        this.hitMarker.scale.set(0.5, 0.5, 1);
        this.hitMarker.renderOrder = 1000;
        scene.add(this.hitMarker);

        // State
        this._visible = false;
        this._opacity = 0;
        this._targetPos = new THREE.Vector3();
        this._currentPos = new THREE.Vector3();
        this._initialized = false; // first-frame snap, no slide from origin
        this._pulseLeft = 0;
        this._hitMarkerLeft = 0;
    }

    /** Reticle should slide toward worldPos (the locked enemy's chest). */
    setTarget(worldPos) {
        this._targetPos.copy(worldPos);
        if (!this._initialized) {
            this._currentPos.copy(worldPos);
            this.dot.position.copy(worldPos);
            this._initialized = true;
        }
        this._visible = true;
    }

    /** No target — fade out. */
    clearTarget() {
        this._visible = false;
    }

    /** Brief scale-pulse on the dot — called per shot fired. */
    pulse() {
        this._pulseLeft = DOT_PULSE_TIME;
    }

    /**
     * Flash the hit marker at impactPos. Color = red if this hit killed the
     * target, white otherwise.
     */
    showHit(impactPos, isKill) {
        this.hitMarker.position.copy(impactPos);
        this.hitMarker.position.y += 0.2; // lift slightly so it sits above the impact
        this._hitMarkerLeft = HIT_MARKER_DURATION;
        this.hitMarker.material.color.setHex(isKill ? KILL_COLOR : HIT_COLOR);
        this.hitMarker.material.opacity = 1;
    }

    update(deltaTime) {
        // Slide toward target (exponential smoothing — fast initial, smooth settle)
        if (this._visible) {
            const k = 1 - Math.exp(-deltaTime / SLIDE_TAU);
            this._currentPos.lerp(this._targetPos, k);
            this.dot.position.copy(this._currentPos);
            this._opacity = Math.min(1, this._opacity + deltaTime * FADE_IN_RATE);
        } else {
            this._opacity = Math.max(0, this._opacity - deltaTime * FADE_OUT_RATE);
            if (this._opacity === 0) this._initialized = false;
        }
        this.dot.material.opacity = this._opacity;

        // Pulse — scale up briefly on fire, decay back
        if (this._pulseLeft > 0) {
            this._pulseLeft = Math.max(0, this._pulseLeft - deltaTime);
            const t = this._pulseLeft / DOT_PULSE_TIME; // 1 → 0
            const s = DOT_REST_SCALE + (DOT_PULSE_SCALE - DOT_REST_SCALE) * t;
            this.dot.scale.set(s, s, 1);
        } else {
            this.dot.scale.set(DOT_REST_SCALE, DOT_REST_SCALE, 1);
        }

        // Hit marker fade + grow (PUBG-style "expanding X")
        if (this._hitMarkerLeft > 0) {
            this._hitMarkerLeft = Math.max(0, this._hitMarkerLeft - deltaTime);
            const t = this._hitMarkerLeft / HIT_MARKER_DURATION; // 1 → 0
            this.hitMarker.material.opacity = t;
            const s = 0.5 + (1 - t) * 0.4; // 0.5 → 0.9 as it fades
            this.hitMarker.scale.set(s, s, 1);
        } else if (this.hitMarker.material.opacity !== 0) {
            this.hitMarker.material.opacity = 0;
        }
    }

    _buildDotTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        // Outer dark outline for readability against light terrain
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.arc(32, 32, 9, 0, Math.PI * 2);
        ctx.fill();
        // White dot core
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.beginPath();
        ctx.arc(32, 32, 6, 0, Math.PI * 2);
        ctx.fill();
        return new THREE.CanvasTexture(c);
    }

    _buildXTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        // Dark shadow stroke first (readability)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(18, 18); ctx.lineTo(46, 46);
        ctx.moveTo(46, 18); ctx.lineTo(18, 46);
        ctx.stroke();
        // White X on top (will be tinted via material.color)
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(18, 18); ctx.lineTo(46, 46);
        ctx.moveTo(46, 18); ctx.lineTo(18, 46);
        ctx.stroke();
        return new THREE.CanvasTexture(c);
    }
}
