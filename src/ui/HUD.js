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
            if (count <= 0) continue;
            activeTypes.add(type);
            const item = this._ensureItem(type);
            if (item.valueText.textContent !== count.toString()) {
                item.valueText.textContent = count;
                this._animatePop(item.element);
            }
        }
        for (const [type, item] of Object.entries(this._items)) {
            if (!activeTypes.has(type)) {
                item.element.remove();
                delete this._items[type];
            }
        }
    }

    _animatePop(element) {
        element.classList.remove('pop');
        void element.offsetWidth;
        element.classList.add('pop');
    }

    /**
     * Optional Draw-Wall toggle button. Called from main.js only in
     * ?prototype mode. Click toggles a global draw mode (DrawWallSystem
     * listens on EventBus); ESC inside DrawWallSystem also flips it off,
     * and we mirror the visual state by listening to the same event.
     */
    enableDrawWallButton() {
        if (this._drawWallBtn) return;
        const btn = document.createElement('button');
        btn.id = 'draw-wall-btn';
        btn.className = 'hud-item draw-wall-btn';
        btn.type = 'button';
        btn.innerHTML = '<span class="icon">✏️</span><span class="value">Draw Wall</span>';
        let active = false;
        const apply = (next) => {
            active = !!next;
            btn.classList.toggle('active', active);
        };
        btn.addEventListener('click', () => {
            EventBus.emit('draw:setMode', { enabled: !active });
        });
        EventBus.on('draw:setMode', ({ enabled }) => apply(enabled));
        this.container.appendChild(btn);
        this._drawWallBtn = btn;
    }
}
