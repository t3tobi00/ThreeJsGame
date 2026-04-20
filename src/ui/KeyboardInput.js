/**
 * KeyboardInput — WASD + arrow-key movement input.
 *
 * Returns a normalized { x, y } vector where y uses screen convention
 * (-1 = up/forward, +1 = down/back) so it can be summed with Joystick
 * output by MovementSystem without sign flipping.
 *
 * Listens on window so keys work regardless of focus (clears on blur
 * to avoid sticky keys when the tab loses focus mid-press).
 */
export class KeyboardInput {
    constructor() {
        this._keys = new Set();
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            this._keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => {
            this._keys.delete(e.code);
        });
        window.addEventListener('blur', () => this._keys.clear());
    }

    getVector() {
        let x = 0, y = 0;
        if (this._keys.has('KeyW') || this._keys.has('ArrowUp'))    y -= 1;
        if (this._keys.has('KeyS') || this._keys.has('ArrowDown'))  y += 1;
        if (this._keys.has('KeyA') || this._keys.has('ArrowLeft'))  x -= 1;
        if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) x += 1;
        if (x !== 0 && y !== 0) {
            const inv = 1 / Math.SQRT2;
            x *= inv;
            y *= inv;
        }
        return { x, y };
    }

    isPressed() {
        return this._keys.size > 0;
    }
}
