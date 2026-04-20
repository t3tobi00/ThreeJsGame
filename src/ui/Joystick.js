/**
 * Joystick — fixed-position virtual joystick for touch devices.
 *
 * The base sits at a fixed location (bottom-left via CSS). Only pointer
 * drags that START inside the base register — the rest of the screen
 * stays free for other touch interactions (clicking heroes, dragging
 * units, tapping UI buttons). Call setVisible(false) to hide (mouse-
 * primary devices hide it via CSS media query).
 *
 * getVector() returns { x, y } normalized to [-1, 1]. y uses screen
 * convention (-1 = up/forward, +1 = down/back) so KeyboardInput and
 * Joystick can be summed directly by MovementSystem.
 */
export class Joystick {
    constructor() {
        this.active = false;
        this.pointerId = null;
        this.vector = { x: 0, y: 0 };
        this.origin = { x: 0, y: 0 };
        this.radius = 0;

        this.container = document.getElementById('joystick-container');
        this._createElements();
        this._setupListeners();
        this._computeGeometry();
        window.addEventListener('resize', () => this._computeGeometry());
    }

    _createElements() {
        this.base = document.createElement('div');
        this.base.className = 'joystick-base';

        this.stick = document.createElement('div');
        this.stick.className = 'joystick-stick';

        this.base.appendChild(this.stick);
        this.container.appendChild(this.base);
    }

    _computeGeometry() {
        const rect = this.base.getBoundingClientRect();
        this.radius = rect.width / 2;
        this.origin.x = rect.left + this.radius;
        this.origin.y = rect.top + this.radius;
    }

    _setupListeners() {
        this.base.addEventListener('pointerdown', (e) => this._onDown(e));
        window.addEventListener('pointermove', (e) => this._onMove(e));
        window.addEventListener('pointerup',    (e) => this._onUp(e));
        window.addEventListener('pointercancel',(e) => this._onUp(e));
    }

    _onDown(e) {
        if (this.active) return;
        if (e.cancelable) e.preventDefault();
        this.active = true;
        this.pointerId = e.pointerId;
        this._computeGeometry();
        this._update(e.clientX, e.clientY);
        try { this.base.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }

    _onMove(e) {
        if (!this.active || e.pointerId !== this.pointerId) return;
        if (e.cancelable) e.preventDefault();
        this._update(e.clientX, e.clientY);
    }

    _onUp(e) {
        if (!this.active || e.pointerId !== this.pointerId) return;
        this.active = false;
        this.pointerId = null;
        this.vector.x = 0;
        this.vector.y = 0;
        this.stick.style.transform = 'translate(-50%, -50%)';
    }

    _update(cx, cy) {
        const dx = cx - this.origin.x;
        const dy = cy - this.origin.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 6) {
            this.vector.x = 0;
            this.vector.y = 0;
            this.stick.style.transform = 'translate(-50%, -50%)';
            return;
        }

        const clamped = Math.min(dist, this.radius);
        const nx = (dx / dist) * clamped;
        const ny = (dy / dist) * clamped;

        this.vector.x = nx / this.radius;
        this.vector.y = ny / this.radius;

        this.stick.style.transform =
            `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    }

    getVector() {
        return this.vector;
    }

    setVisible(visible) {
        this.container.style.display = visible ? '' : 'none';
    }
}
