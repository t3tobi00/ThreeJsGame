import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * DamagePopupUI — Floating damage numbers that pop up above hit entities.
 *
 * Listens for 'damage:popup' events: { position: Vector3, amount, isCrit }.
 * Creates a DOM element, animates it up + fades, removes after ~0.8s.
 *
 * Popups do NOT track the entity after spawn — they use the spawn position
 * as the starting anchor. This keeps the implementation simple and is
 * standard hyper-casual behavior (numbers float upward from where the hit
 * landed, not from the moving target).
 */
export class DamagePopupUI {
    constructor(camera) {
        this.camera = camera;
        this.container = document.getElementById('ui-layer');
        this._active = []; // { el, worldPos, elapsed, duration, startOffset }

        this._injectStyles();

        EventBus.on('damage:popup', (evt) => this._spawn(evt));
    }

    _injectStyles() {
        if (document.getElementById('damage-popup-styles')) return;
        const style = document.createElement('style');
        style.id = 'damage-popup-styles';
        style.textContent = `
            .damage-popup {
                position: fixed;
                pointer-events: none;
                user-select: none;
                font-family: Impact, Arial Black, sans-serif;
                font-weight: 900;
                font-size: 24px;
                color: #fff176;
                text-shadow:
                    0 2px 0 #000,
                    2px 2px 0 #000,
                    -2px 2px 0 #000,
                    0 0 10px rgba(255,241,118,0.8);
                transform: translate(-50%, -50%);
                will-change: transform, opacity;
                z-index: 1500;
                letter-spacing: 1px;
            }
            .damage-popup.crit {
                font-size: 38px;
                color: #ff5733;
                text-shadow:
                    0 3px 0 #000,
                    3px 3px 0 #000,
                    -3px 3px 0 #000,
                    0 0 16px rgba(255,87,51,1);
            }
        `;
        document.head.appendChild(style);
    }

    _spawn({ position, amount, isCrit }) {
        if (!this.container) return;

        const el = document.createElement('div');
        el.className = 'damage-popup' + (isCrit ? ' crit' : '');
        el.textContent = isCrit ? `${amount}!` : `${amount}`;
        this.container.appendChild(el);

        this._active.push({
            el,
            worldPos: position.clone(),
            elapsed: 0,
            duration: 0.8,
            jitterX: (Math.random() - 0.5) * 30, // horizontal drift so stacked numbers fan out
            isCrit: !!isCrit
        });
    }

    update(deltaTime) {
        if (this._active.length === 0) return;

        const w = window.innerWidth;
        const h = window.innerHeight;

        for (let i = this._active.length - 1; i >= 0; i--) {
            const p = this._active[i];
            p.elapsed += deltaTime;
            const t = p.elapsed / p.duration;

            if (t >= 1) {
                p.el.remove();
                this._active.splice(i, 1);
                continue;
            }

            // Project world → screen
            const v = p.worldPos.clone().project(this.camera);
            const sx = (v.x * 0.5 + 0.5) * w + p.jitterX;
            const sy = (-(v.y * 0.5) + 0.5) * h;

            // Float upward, then ease back slightly
            const upOffset = 40 + t * 60;
            // Scale: pop in, hold, shrink out
            let scale;
            if (t < 0.15) scale = p.isCrit ? (0.6 + (t / 0.15) * 0.8) : (0.5 + (t / 0.15) * 0.7);
            else if (t > 0.7) scale = (p.isCrit ? 1.4 : 1.2) * (1 - (t - 0.7) / 0.3 * 0.5);
            else scale = p.isCrit ? 1.4 : 1.2;

            // Opacity — full for most of the life, fade at end
            const opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;

            p.el.style.left = `${sx}px`;
            p.el.style.top  = `${sy - upOffset}px`;
            p.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
            p.el.style.opacity = opacity;

            // Hide if behind camera
            if (v.z > 1) p.el.style.display = 'none';
            else p.el.style.display = 'block';
        }
    }
}
