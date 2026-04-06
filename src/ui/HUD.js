import EventBus from '../core/EventBus.js';
import ResourceRegistry from '../core/ResourceRegistry.js';

/**
 * HUD — Displays resource counts.
 * Player HP is shown by WorldHealthBar (floating above head) — not here.
 * Per-gate HP bars are WorldHealthBar instances created in main.js.
 *
 * Resource emojis are pulled from ResourceRegistry (resources.json "emoji"
 * field) so adding a new resource doesn't require touching this file.
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

        // Pull emoji from ResourceRegistry (resources.json). Falls back to ?
        // only for truly unknown types.
        let emoji = '\u2753';
        try {
            const def = ResourceRegistry.get(type);
            if (def && def.emoji) emoji = def.emoji;
        } catch (e) { /* unknown type, keep fallback */ }

        const item = document.createElement('div');
        item.className = 'hud-item';
        item.innerHTML = `
            <span class="icon">${emoji}</span>
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
