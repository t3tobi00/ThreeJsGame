import EventBus from '../core/EventBus.js';

const RESOURCE_EMOJI = {
    meat: '\u{1F356}',
    coin: '\u{1FA99}'
};

/**
 * HUD — Displays player resource counts.
 * Listens to 'stack:changed' via EventBus — no manual wiring needed.
 */
export class HUD {
    constructor(ecs, playerId) {
        this.container = document.getElementById('hud');
        this._ecs = ecs;
        this._playerId = playerId;
        this._items = {};

        this._ensureItem('meat');
        this._createHPBar();

        EventBus.on('entity:hp_changed', ({ entityId, hp, maxHp }) => {
            if (entityId === this._playerId) {
                this.updateHP(hp, maxHp);
            }
        });

        EventBus.on('stack:changed', ({ entityId }) => {
            if (entityId === this._playerId) {
                const inventory = this._ecs.getComponent(this._playerId, 'InventoryStack');
                if (inventory) this.updateResources(inventory.getSlotSummary());
            }
        });
    }

    _ensureItem(type) {
        if (this._items[type]) return this._items[type];

        const item = document.createElement('div');
        item.className = 'hud-item';
        item.innerHTML = `
            <span class="icon">${RESOURCE_EMOJI[type] || '\u2753'}</span>
            <span class="value">0</span>
        `;
        this.container.appendChild(item);
        const valueText = item.querySelector('.value');
        this._items[type] = { element: item, valueText };
        return this._items[type];
    }

    updateResources(slotSummary) {
        const activeTypes = new Set();

        for (const { type, count } of slotSummary) {
            activeTypes.add(type);
            const item = this._ensureItem(type);
            if (item.valueText.textContent !== count.toString()) {
                item.valueText.textContent = count;
                this._animatePop(item.element);
            }
        }

        for (const [type, item] of Object.entries(this._items)) {
            if (!activeTypes.has(type) && item.valueText.textContent !== '0') {
                item.valueText.textContent = '0';
            }
        }
    }

    _createHPBar() {
        this._hpBar = document.createElement('div');
        this._hpBar.id = 'hp-bar';
        this._hpBar.innerHTML = `
            <div class="hp-label">\u2764\uFE0F</div>
            <div class="hp-track">
                <div class="hp-fill" style="width: 100%"></div>
            </div>
        `;
        this._hpBar.style.cssText = `
            display: flex; align-items: center; gap: 6px;
            margin-top: 8px; padding: 4px 10px;
            background: rgba(0,0,0,0.5); border-radius: 8px;
        `;
        const track = this._hpBar.querySelector('.hp-track');
        track.style.cssText = `
            width: 100px; height: 10px; background: rgba(255,255,255,0.2);
            border-radius: 5px; overflow: hidden;
        `;
        const fill = this._hpBar.querySelector('.hp-fill');
        fill.style.cssText = `
            height: 100%; background: #44cc44; border-radius: 5px;
            transition: width 0.3s ease;
        `;
        this.container.appendChild(this._hpBar);
        this._hpFill = fill;
    }

    updateHP(hp, maxHp) {
        if (!this._hpFill) return;
        const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
        this._hpFill.style.width = `${pct}%`;
        this._hpFill.style.background = pct > 50 ? '#44cc44' : pct > 25 ? '#ffaa00' : '#ff4444';
    }

    _animatePop(element) {
        element.classList.remove('pop');
        void element.offsetWidth;
        element.classList.add('pop');
    }
}
