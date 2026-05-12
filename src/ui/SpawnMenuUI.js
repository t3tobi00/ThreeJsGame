import EventBus from '../core/EventBus.js';
import { getArchetype } from '../core/ArchetypeLoader.js';
import ResourceRegistry from '../core/ResourceRegistry.js';
import BalanceLoader from '../core/BalanceLoader.js';
import { bakeResourceIconSet } from '../utils/ResourceIconBaker.js';

/**
 * SpawnMenuUI — right-edge accordion HUD for ?prototype mode.
 *
 * Layout: a slim vertical column of 3 section chips pinned to the right
 * (ARMY · WORKERS · BUILD). Tap a chip → its items slide out horizontally
 * to the LEFT of the chip. One section open at a time (accordion). Tap
 * the same chip again or any other chip to switch / collapse.
 *
 * Each item button shows label + cost. ARMY/WORKERS/BUILD-storage items
 * render greyed with red cost when unaffordable (driven by
 * `spawn:totalsChanged`). BUILD ▸ Wall stays freeBuild — DrawWallSystem
 * pays per-log on commit so there's no flat upfront cost to show.
 *
 * The UI is pure presentation: it emits one event,
 *   `spawnmenu:tap { kind, sub, affordable }`
 * and listens for `spawn:totalsChanged { totals }` to refresh affordability.
 * SpawnMenuSystem owns all gameplay logic (cost check, drain, spawn,
 * placement-mode transitions).
 */

// Per-item portrait + label. Icons are rendered via the system emoji font
// (Apple Color Emoji / Segoe UI Emoji etc.) at a large size so each chip
// reads as a portrait, not a text button.
const ITEMS = {
    army: [
        { sub: 'scout',        archetype: 'scout',        label: 'Scout',  icon: '🛡️' },
        { sub: 'bruiser',      archetype: 'bruiser',      label: 'Bruiser', icon: '🔥' },
        { sub: 'sharpshooter', archetype: 'sharpshooter', label: 'Archer',  icon: '🏹' }
    ],
    workers: [
        // Builder chip is intentionally hidden — the prototype no longer
        // routes resources through the builder pipeline. Re-enable by
        // adding `{ sub: 'worker-builder', archetype: 'worker-builder',
        // label: 'Builder', icon: '🔨' }` here when Acts 2/3 resume.
        { sub: 'wood-worker',       archetype: 'wood-worker',       label: 'Lumber',  icon: '🪓' },
        { sub: 'essence-collector', archetype: 'essence-collector', label: 'Mage',    icon: '✨' }
    ],
    build: [
        // Wall stays freeBuild — DrawWallSystem pays per-log on commit; no
        // flat upfront cost to show in the menu. (Issue #2 will route the
        // per-log cost through storage too.)
        { sub: 'wall',            label: 'Wall',     icon: '🧱', freeBuild: true },
        // Storage placement reads the same `arch.spawn.cost` path as ARMY/WORK
        // so balance.economy.wood_storage / essence_storage drives the chip
        // badge and the affordability gate. `freeBuild` removed so cost lookup
        // runs in _buildItemButton.
        { sub: 'wood-storage',    archetype: 'wood-storage',    label: 'Wood Box', icon: '🪵' },
        { sub: 'essence-storage', archetype: 'essence-storage', label: 'Ess. Box', icon: '💎' }
    ]
};

export class SpawnMenuUI {
    constructor() {
        this._totals = { essence: 0, wood: 0 };          // drives affordability
        this._activeSection = null;                       // 'army' | 'workers' | 'build' | null
        this._activeBuildSub = null;                      // last-selected BUILD sub (for active state)

        // Bake the actual resource meshes into 96 px PNG data URLs once at
        // boot. Used in cost badges and BUILD▸storage chip portraits so the
        // menu shows real game assets instead of an emoji.
        this._resourceIcons = bakeResourceIconSet(['essence', 'wood'], 96);

        this.container = this._buildContainer();
        document.body.appendChild(this.container);

        this._refreshAffordability();

        // Spawn-system pushes a totals snapshot after every drain.
        EventBus.on('spawn:totalsChanged', ({ totals }) => {
            this._totals = totals;
            this._refreshAffordability();
        });

        // Mode changes drive two things:
        //   1. Auto-hide the whole menu while wall-draw / storage-place is
        //      active so the player can interact with the map unobstructed.
        //   2. Clear the BUILD item active highlight when mode returns to null.
        EventBus.on('spawn:modeChanged', ({ mode }) => {
            this.container.classList.toggle('menu-hidden', !!mode);
            if (mode) {
                // Collapse the open section too — when the menu reappears we
                // want a clean closed state so the player isn't confused
                // about what's selected.
                this._activeSection = null;
                this._refreshActiveStates();
            } else {
                this._activeBuildSub = null;
                this._refreshActiveStates();
            }
        });
    }

    // ─── Build DOM ─────────────────────────────────────────────────────────

    _buildContainer() {
        const root = document.createElement('div');
        root.id = 'spawn-menu';

        for (const sectionKey of ['army', 'workers', 'build']) {
            root.appendChild(this._buildSection(sectionKey));
        }
        return root;
    }

    _buildSection(sectionKey) {
        const section = document.createElement('div');
        section.className = 'spawn-section';
        section.dataset.section = sectionKey;

        // Items panel (slides out to the LEFT of the chip)
        const items = document.createElement('div');
        items.className = 'section-items';
        for (const item of ITEMS[sectionKey]) {
            items.appendChild(this._buildItemButton(sectionKey, item));
        }
        section.appendChild(items);

        // Section chip (header)
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'section-chip';
        chip.textContent = this._sectionLabel(sectionKey);
        chip.addEventListener('click', () => this._toggleSection(sectionKey));
        section.appendChild(chip);

        return section;
    }

    _buildItemButton(sectionKey, item) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'spawn-item';
        btn.dataset.kind = sectionKey;
        btn.dataset.sub = item.sub;

        // Resolve cost from the archetype's spawn.cost block (which uses
        // $balance placeholders). Items with `freeBuild: true` skip this
        // and render as "FREE" — currently only BUILD ▸ Wall, since its
        // cost is per-log via DrawWallSystem rather than flat.
        let cost = null;
        if (!item.freeBuild) {
            try {
                const arch = getArchetype(item.archetype);
                cost = arch?.spawn?.cost || null;
            } catch (e) { /* missing archetype, leave free */ }
        }
        btn.dataset.cost = cost ? JSON.stringify(cost) : '';

        // Portrait. BUILD ▸ Wood/Essence Box show the REAL baked resource
        // mesh (PNG from ResourceIconBaker) so the chip matches what the
        // player carries. Everything else uses the emoji portrait.
        const iconEl = this._buildItemIcon(item);
        btn.appendChild(iconEl);

        const labelEl = document.createElement('span');
        labelEl.className = 'item-label';
        labelEl.textContent = item.label;
        btn.appendChild(labelEl);

        const costEl = document.createElement('span');
        costEl.className = 'item-cost';
        if (cost) {
            costEl.appendChild(this._buildCostBadge(cost));
        } else if (item.sub === 'wall') {
            // Wall is the only continuous-cost item: DrawWallSystem pays
            // `wood_per_drawn_log` per `logs_per_wood` logs. Show the
            // per-log rate using the same badge style as flat costs.
            const woodPerLog  = BalanceLoader.get('economy.wood_per_drawn_log') ?? 1;
            const logsPerWood = BalanceLoader.get('economy.logs_per_wood')      ?? 1;
            costEl.appendChild(this._buildCostBadge({ wood: woodPerLog }));
            const trailer = document.createElement('span');
            trailer.className = 'cost-trailer';
            trailer.textContent = ` / ${logsPerWood} log${logsPerWood > 1 ? 's' : ''}`;
            costEl.appendChild(trailer);
        } else {
            costEl.textContent = 'FREE';
            costEl.classList.add('free');
        }
        btn.appendChild(costEl);

        btn.addEventListener('click', () => this._onItemClick(btn, sectionKey, item, cost));

        return btn;
    }

    _buildItemIcon(item) {
        // Storage build chips show the actual resource artifact.
        if (item.sub === 'wood-storage' && this._resourceIcons.wood) {
            return this._iconImg(this._resourceIcons.wood, item.label);
        }
        if (item.sub === 'essence-storage' && this._resourceIcons.essence) {
            return this._iconImg(this._resourceIcons.essence, item.label);
        }
        // Fallback: emoji portrait.
        const span = document.createElement('span');
        span.className = 'item-icon emoji';
        span.textContent = item.icon || '?';
        return span;
    }

    _iconImg(src, alt) {
        const img = document.createElement('img');
        img.className = 'item-icon img';
        img.src = src;
        img.alt = alt || '';
        img.draggable = false;
        return img;
    }

    /**
     * Render a cost like "8 [essence-icon]" using the BAKED 2D image of
     * the actual resource mesh (falls back to the resources.json emoji if
     * baking failed for that type). Wraps each (number + icon) pair so
     * multi-resource costs flow naturally.
     */
    _buildCostBadge(cost) {
        const frag = document.createDocumentFragment();
        const entries = Object.entries(cost);
        for (let i = 0; i < entries.length; i++) {
            const [type, n] = entries[i];

            const numEl = document.createElement('span');
            numEl.className = 'cost-num';
            numEl.textContent = n;
            frag.appendChild(numEl);

            const baked = this._resourceIcons[type];
            if (baked) {
                const img = document.createElement('img');
                img.className = 'cost-icon';
                img.src = baked;
                img.alt = type;
                img.draggable = false;
                frag.appendChild(img);
            } else {
                let emoji = '?';
                try {
                    const def = ResourceRegistry.get(type);
                    if (def?.emoji) emoji = def.emoji;
                } catch (_) { /* unknown type */ }
                const emojiEl = document.createElement('span');
                emojiEl.className = 'cost-emoji';
                emojiEl.textContent = emoji;
                frag.appendChild(emojiEl);
            }

            if (i < entries.length - 1) {
                const sep = document.createElement('span');
                sep.className = 'cost-sep';
                sep.textContent = ' · ';
                frag.appendChild(sep);
            }
        }
        return frag;
    }

    _sectionLabel(key) {
        if (key === 'army')    return 'ARMY';
        if (key === 'workers') return 'WORK';
        return 'BUILD';
    }

    // ─── Interaction ───────────────────────────────────────────────────────

    _toggleSection(sectionKey) {
        this._activeSection = (this._activeSection === sectionKey) ? null : sectionKey;
        this._refreshActiveStates();
    }

    _refreshActiveStates() {
        for (const section of this.container.querySelectorAll('.spawn-section')) {
            const k = section.dataset.section;
            section.classList.toggle('expanded', k === this._activeSection);
        }
        for (const btn of this.container.querySelectorAll('.spawn-item')) {
            const isActiveBuild = btn.dataset.kind === 'build' && btn.dataset.sub === this._activeBuildSub;
            btn.classList.toggle('active-mode', isActiveBuild);
        }
    }

    _onItemClick(btn, sectionKey, item, cost) {
        const affordable = this._isAffordable(cost);

        if (!affordable && cost) {
            // Reject: shake + don't emit a tap (system has nothing to do).
            this._shake(btn);
            return;
        }

        // BUILD items toggle a mode — mark this sub as the live build.
        if (sectionKey === 'build') {
            // Tapping the same active-mode chip cancels.
            this._activeBuildSub = (this._activeBuildSub === item.sub) ? null : item.sub;
            this._refreshActiveStates();
        }

        EventBus.emit('spawnmenu:tap', {
            kind: sectionKey,
            sub: item.sub,
            archetype: item.archetype || null,
            cost: cost || null,
            affordable: true
        });
    }

    _isAffordable(cost) {
        if (!cost) return true;
        for (const [type, needed] of Object.entries(cost)) {
            if ((this._totals[type] || 0) < needed) return false;
        }
        return true;
    }

    _refreshAffordability() {
        for (const btn of this.container.querySelectorAll('.spawn-item')) {
            const raw = btn.dataset.cost;
            if (!raw) continue;             // FREE items never grey out
            const cost = JSON.parse(raw);
            const affordable = this._isAffordable(cost);
            btn.classList.toggle('disabled', !affordable);
        }
    }

    _shake(el) {
        el.classList.remove('shake');
        void el.offsetWidth;
        el.classList.add('shake');
    }
}
