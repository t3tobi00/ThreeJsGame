import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import { getArchetype } from '../core/ArchetypeLoader.js';
import { WorldHealthBar } from './WorldHealthBar.js';

/**
 * HeroBar — second HUD row with a single spawn button.
 *
 * Click → if player has enough coins, deducts them and spawns one hero at
 * the player's ORIGINAL spawn point (not their current position). The
 * newly-spawned hero plants that spot as its `homePosition`, so it guards
 * a fixed location and drifts back there after chasing enemies.
 *
 * Spawn cost is read from hero.json's "spawn.cost" block so the editor
 * can retune it without touching code.
 */
export class HeroBar {
    constructor(ecs, scene, factory, playerId, spawnPos, camera = null) {
        this._ecs = ecs;
        this._scene = scene;
        this._factory = factory;
        this._playerId = playerId;
        this._spawnPos = spawnPos ? spawnPos.clone() : new THREE.Vector3();
        this._camera = camera;

        const archetype = getArchetype('hero');
        this._cost = (archetype.spawn && archetype.spawn.cost) || { coin: 5 };

        this.container = document.getElementById('hero-bar');
        this._button = this._renderButton();
        this.container.appendChild(this._button);

        // heroId -> WorldHealthBar. Each hero gets its own floating bar.
        this._healthBars = new Map();

        // Clean up the bar when a hero dies (HealthSystem removes the mesh
        // and destroys the entity; we drop the UI overlay to match).
        EventBus.on('entity:died', ({ entityId }) => {
            const bar = this._healthBars.get(entityId);
            if (bar) {
                bar.destroy();
                this._healthBars.delete(entityId);
            }
        });

        // Keep the enabled/disabled state in sync with the player's coins.
        EventBus.on('stack:changed', ({ entityId }) => {
            if (entityId === this._playerId) this._refresh();
        });
        this._refresh();
    }

    /** Call once per frame from the main animate loop. */
    update() {
        for (const bar of this._healthBars.values()) bar.update();
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

        // Ring offset — puts each hero on its own tile around the spawn
        // point so it doesn't share a spot with the player (which would
        // create a collision-pushes-hero → hero-returns-home feedback loop).
        const ringRadius = 1.8;
        const angle = Math.random() * Math.PI * 2;
        const pos = this._spawnPos.clone();
        pos.x += Math.cos(angle) * ringRadius;
        pos.z += Math.sin(angle) * ringRadius;

        const heroId = this._factory.create('hero', pos);

        const heroAI = this._ecs.getComponent(heroId, 'HeroAI');
        if (heroAI) heroAI.homePosition.copy(pos);

        // Floating HP bar above the hero's head (same widget the player uses).
        if (this._camera) {
            const heroTransform = this._ecs.getComponent(heroId, 'Transform');
            const health = this._ecs.getComponent(heroId, 'Health');
            if (heroTransform && health) {
                const bar = new WorldHealthBar(this._camera, heroTransform.mesh, heroId, { yOffset: 1.6, width: 42 });
                // Initialize it to full HP so the green fill shows immediately
                // (without this it waits for the first entity:hp_changed event).
                bar._setHP(health.hp, health.maxHp);
                this._healthBars.set(heroId, bar);
            }
        }

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
