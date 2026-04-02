import EventBus from '../core/EventBus.js';

const RESOURCE_EMOJI = {
    meat: '\u{1F356}',
    coin: '\u{1FA99}',
    wood: '\u{1FAB5}',
    stone: '\u{1FAA8}'
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

    _animatePop(element) {
        element.classList.remove('pop');
        void element.offsetWidth;
        element.classList.add('pop');
    }
}
