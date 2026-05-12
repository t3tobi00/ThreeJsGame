import EventBus from '../core/EventBus.js';

/**
 * PrototypeToast — minimal top-center red toast banner for short messages.
 *
 * Lazily creates a single div on first show and reuses it. Auto-fades after
 * ~3.5s. Listens to the `hud:showAlert` EventBus event so any system can fire
 * a toast without coupling to UI code:
 *
 *   EventBus.emit('hud:showAlert', { text: 'Out of wood — wall cut short.' });
 *
 * Replaces the inline _showAlert that used to live in PrototypeStateMachine
 * (removed 2026-05-11 along with the tutorial pass). When a richer tutorial
 * system lands later it can reuse this same event channel.
 */
export class PrototypeToast {
    constructor() {
        this._el = null;
        this._timer = null;
        EventBus.on('hud:showAlert', ({ text } = {}) => this.show(text || ''));
    }

    show(text) {
        if (typeof document === 'undefined' || !text) return;
        if (!this._el) {
            this._el = document.createElement('div');
            this._el.id = 'prototype-toast';
            this._el.style.cssText =
                'position: fixed; top: 80px; left: 50%; transform: translateX(-50%);' +
                'background: rgba(255, 80, 80, 0.92); color: white;' +
                'font: bold 22px Arial, sans-serif;' +
                'padding: 12px 28px; border-radius: 12px;' +
                'box-shadow: 0 6px 24px rgba(0,0,0,0.5);' +
                'z-index: 1500; pointer-events: none;' +
                'opacity: 0; transition: opacity 0.3s;' +
                'text-shadow: 1px 1px 2px rgba(0,0,0,0.6);';
            document.body.appendChild(this._el);
        }
        this._el.textContent = text;
        this._el.style.opacity = '1';
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(() => {
            if (this._el) this._el.style.opacity = '0';
        }, 3500);
    }
}
