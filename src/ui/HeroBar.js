import EventBus from '../core/EventBus.js';
import { getArchetype } from '../core/ArchetypeLoader.js';

/**
 * HeroBar — second HUD row with a single spawn button.
 *
 * Click → if player has enough coins, deducts them and spawns one hero at
 * the player's current position. Nothing more (no AI, no movement — that
 * comes later).
 *
 * Spawn cost is read from hero.json's "spawn.cost" block so the editor
 * can retune it without touching code.
 */
export class HeroBar {
    constructor(ecs, scene, factory, playerId) {
        this._ecs = ecs;
        this._scene = scene;
        this._factory = factory;
        this._playerId = playerId;

        const archetype = getArchetype('hero');
        this._cost = (archetype.spawn && archetype.spawn.cost) || { coin: 5 };

        this.container = document.getElementById('hero-bar');
        this._button = this._renderButton();
        this.container.appendChild(this._button);

        // Keep the enabled/disabled state in sync with the player's coins.
        EventBus.on('stack:changed', ({ entityId }) => {
            if (entityId === this._playerId) this._refresh();
        });
        this._refresh();
    }

    _renderButton() {
        const btn = document.createElement('button');
        btn.className = 'hero-btn';
        btn.type = 'button';

        const costStr = Object.entries(this._cost)
            .map(([type, n]) => `${n}${this._emojiFor(type)}`)
            .join(' ');

        btn.innerHTML = `
            <span class="hero-icon">🛡️</span>
            <span class="hero-label">Summon Hero</span>
            <span class="hero-cost">${costStr}</span>
        `;
        btn.addEventListener('click', () => this._onClick());
        return btn;
    }

    _emojiFor(type) {
        if (type === 'coin') return '🪙';
        return '';
    }

    _onClick() {
        const inv = this._ecs.getComponent(this._playerId, 'InventoryStack');
        const transform = this._ecs.getComponent(this._playerId, 'Transform');
        if (!inv || !transform) return;

        for (const [type, needed] of Object.entries(this._cost)) {
            if (inv.getCountByType(type) < needed) {
                this._shake();
                return;
            }
        }

        for (const [type, needed] of Object.entries(this._cost)) {
            for (let i = 0; i < needed; i++) {
                const mesh = inv.popFromSlot(type);
                if (mesh) {
                    this._scene.remove(mesh);
                    if (mesh.geometry) mesh.geometry.dispose();
                    if (mesh.material) mesh.material.dispose();
                }
            }
            EventBus.emit('stack:changed', {
                entityId: this._playerId,
                type,
                count: inv.getCountByType(type),
                totalCount: inv.getTotalCount()
            });
        }

        const pos = transform.mesh.position.clone();
        this._factory.create('hero', pos);

        this._pulse();
    }

    _refresh() {
        const inv = this._ecs.getComponent(this._playerId, 'InventoryStack');
        if (!inv) return;
        let affordable = true;
        for (const [type, needed] of Object.entries(this._cost)) {
            if (inv.getCountByType(type) < needed) { affordable = false; break; }
        }
        this._button.classList.toggle('disabled', !affordable);
    }

    _shake() {
        this._button.classList.remove('shake');
        void this._button.offsetWidth;
        this._button.classList.add('shake');
    }

    _pulse() {
        this._button.classList.remove('pulse');
        void this._button.offsetWidth;
        this._button.classList.add('pulse');
    }
}
