import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import ResourceRegistry from '../core/ResourceRegistry.js';
import EventBus from '../core/EventBus.js';
import { MarketUI } from '../ui/MarketUI.js';

/**
 * MarketSystem — Sells player resources for coins at market zones.
 *
 * Queries: ['Transform', 'Market']
 * Finds nearby carriers with ['Transform', 'Collector', 'InventoryStack']
 * Drains accepted resources from carrier, spawns coins onto output tray.
 * Player picks up coins from tray via Collector (collectFromTags: ["tray"]).
 *
 * Emits: 'stack:changed'
 */
export class MarketSystem {
    constructor(scene) {
        this.scene = scene;
        this._transfer = new ResourceTransfer();     // resource → zone
        this._coinTransfer = new ResourceTransfer();  // zone → tray (separate to avoid onArrive nesting)
        this._uiMap = new Map(); // marketId → MarketUI
    }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);
        this._coinTransfer.update(deltaTime);

        const carriers = ecs.queryEntities(['Transform', 'Collector', 'InventoryStack']);

        // Clean up UIs for markets that no longer exist
        for (const [id] of this._uiMap) {
            if (!entities.includes(id)) {
                this._destroyUI(id);
            }
        }

        for (const marketId of entities) {
            const marketTransform = ecs.getComponent(marketId, 'Transform');
            const market = ecs.getComponent(marketId, 'Market');
            if (!marketTransform || !market) continue;

            // Create UI on first encounter
            const ui = this._ensureUI(marketId, marketTransform, market);

            market.timeSinceLastDrain += deltaTime;

            // Animate UI
            if (ui) ui.animate(deltaTime);

            let anyCarrierInRange = false;

            for (const carrierId of carriers) {
                const carrierTransform = ecs.getComponent(carrierId, 'Transform');
                const carrierInventory = ecs.getComponent(carrierId, 'InventoryStack');
                if (!carrierTransform || !carrierInventory) continue;

                const dist = carrierTransform.mesh.position.distanceTo(marketTransform.mesh.position);
                if (dist > market.range) continue;

                anyCarrierInRange = true;

                if (market.timeSinceLastDrain < market.drainRate) continue;

                // Find a sellable resource in the carrier
                for (const type of market.accepts) {
                    if (carrierInventory.getCountByType(type) === 0) continue;

                    const mesh = carrierInventory.popFromSlot(type);
                    if (!mesh) continue;

                    market.timeSinceLastDrain = 0;

                    const coinValue = market.payRate[type] || 1;

                    // Animate resource flying to zone center
                    const fromPos = mesh.position.clone();
                    const toPos = marketTransform.mesh.position.clone();
                    toPos.y += 0.5;

                    this._transfer.send(mesh, fromPos, toPos, {
                        arcHeight: 2.5,
                        duration: 0.4,
                        spin: true,
                        onArrive: (m) => {
                            this.scene.remove(m);
                            if (m.geometry) m.geometry.dispose();
                            if (m.material) m.material.dispose();

                            // Spawn coins onto the output tray
                            this._spawnCoinsToTray(coinValue, marketTransform.mesh.position, market.outputTag, ecs);
                        }
                    });

                    // Update carrier HUD
                    EventBus.emit('stack:changed', {
                        entityId: carrierId,
                        type,
                        count: carrierInventory.getCountByType(type),
                        totalCount: carrierInventory.getTotalCount()
                    });

                    break; // one resource per drain tick
                }
            }

            // Update active state (glow when player nearby)
            if (ui) ui.setActive(anyCarrierInRange);
        }
    }

    _ensureUI(marketId, transform, market) {
        if (this._uiMap.has(marketId)) return this._uiMap.get(marketId);

        const group = transform.mesh;
        const ui = new MarketUI(group, market.accepts, market.payRate, 4);
        this._uiMap.set(marketId, ui);
        return ui;
    }

    _destroyUI(marketId) {
        const ui = this._uiMap.get(marketId);
        if (ui) {
            ui.destroy();
            this._uiMap.delete(marketId);
        }
    }

    /**
     * Spawn coin meshes that arc to the output tray and stack on it.
     * Player collects from tray via Collector (collectFromTags: ["tray"]).
     */
    _spawnCoinsToTray(count, fromPos, outputTag, ecs) {
        const trayId = this._findByTag(ecs, outputTag);
        if (!trayId) return;

        const trayTransform = ecs.getComponent(trayId, 'Transform');
        const trayInv = ecs.getComponent(trayId, 'InventoryStack');
        if (!trayTransform || !trayInv) return;

        for (let i = 0; i < count; i++) {
            const coinMesh = ResourceRegistry.createMesh('coin');
            const startPos = fromPos.clone();
            startPos.x += (Math.random() - 0.5) * 0.5;
            startPos.y += 0.5 + i * 0.1;
            startPos.z += (Math.random() - 0.5) * 0.5;

            coinMesh.position.copy(startPos);
            this.scene.add(coinMesh);

            const toPos = trayTransform.mesh.position.clone();
            toPos.y += 0.4;

            this._coinTransfer.send(coinMesh, startPos.clone(), toPos, {
                arcHeight: 2.0 + i * 0.3,
                duration: 0.35 + i * 0.08,
                spin: false,
                onArrive: (m) => {
                    trayInv.addToSlot('coin', m, { animate: true });
                    EventBus.emit('stack:changed', {
                        entityId: trayId,
                        type: 'coin',
                        count: trayInv.getCountByType('coin'),
                        totalCount: trayInv.getTotalCount()
                    });
                }
            });
        }
    }

    _findByTag(ecs, tagName) {
        const candidates = ecs.queryEntities(['Transform', 'Tag', 'InventoryStack']);
        for (const id of candidates) {
            const tag = ecs.getComponent(id, 'Tag');
            if (tag && tag.has(tagName)) return id;
        }
        return null;
    }
}
