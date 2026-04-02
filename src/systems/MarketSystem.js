import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import ResourceRegistry from '../core/ResourceRegistry.js';
import EventBus from '../core/EventBus.js';

/**
 * MarketSystem — Sells player resources for coins at market zones.
 *
 * Queries: ['Transform', 'Market']
 * Finds nearby carriers with ['Transform', 'Collector', 'InventoryStack']
 * Drains accepted resources, spawns coin meshes into carrier inventory.
 *
 * Emits: 'stack:changed', 'item:collected'
 */
export class MarketSystem {
    constructor(scene) {
        this.scene = scene;
        this._transfer = new ResourceTransfer();
    }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);

        const carriers = ecs.queryEntities(['Transform', 'Collector', 'InventoryStack']);

        for (const marketId of entities) {
            const marketTransform = ecs.getComponent(marketId, 'Transform');
            const market = ecs.getComponent(marketId, 'Market');
            if (!marketTransform || !market) continue;

            market.timeSinceLastDrain += deltaTime;

            for (const carrierId of carriers) {
                const carrierTransform = ecs.getComponent(carrierId, 'Transform');
                const carrierInventory = ecs.getComponent(carrierId, 'InventoryStack');
                if (!carrierTransform || !carrierInventory) continue;

                const dist = carrierTransform.mesh.position.distanceTo(marketTransform.mesh.position);
                if (dist > market.range) continue;

                if (market.timeSinceLastDrain < market.drainRate) continue;

                // Find a sellable resource in the carrier
                for (const type of market.accepts) {
                    if (carrierInventory.getCountByType(type) === 0) continue;

                    const mesh = carrierInventory.popFromSlot(type);
                    if (!mesh) continue;

                    market.timeSinceLastDrain = 0;

                    const coinValue = market.payRate[type] || 1;

                    // Animate resource flying to market stall
                    const fromPos = mesh.position.clone();
                    const toPos = marketTransform.mesh.position.clone();
                    toPos.y += 1.0;

                    this._transfer.send(mesh, fromPos, toPos, {
                        arcHeight: 2.5,
                        duration: 0.4,
                        spin: true,
                        onArrive: (m) => {
                            this.scene.remove(m);
                            if (m.geometry) m.geometry.dispose();
                            if (m.material) m.material.dispose();

                            // Spawn coins back to carrier
                            this._spawnCoins(coinValue, marketTransform.mesh.position, carrierId, ecs);
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
        }
    }

    /**
     * Spawn coin meshes that fly to the carrier's inventory.
     * Each coin gets a slightly longer flight duration to stagger arrivals.
     */
    _spawnCoins(count, fromPos, carrierId, ecs) {
        const carrierTransform = ecs.getComponent(carrierId, 'Transform');
        if (!carrierTransform) return;

        for (let i = 0; i < count; i++) {
            const coinMesh = ResourceRegistry.createMesh('coin');
            const startPos = fromPos.clone();
            startPos.x += (Math.random() - 0.5) * 0.5;
            startPos.y += 1.0 + i * 0.1;
            startPos.z += (Math.random() - 0.5) * 0.5;

            coinMesh.position.copy(startPos);
            this.scene.add(coinMesh);

            const toPos = carrierTransform.mesh.position.clone();
            toPos.y += 1.2;

            this._transfer.send(coinMesh, startPos.clone(), toPos, {
                arcHeight: 2.0 + i * 0.3,
                duration: 0.35 + i * 0.08,
                spin: true,
                onArrive: (m) => {
                    EventBus.emit('item:collected', {
                        collectorId: carrierId,
                        itemType: 'coin',
                        mesh: m
                    });
                }
            });
        }
    }
}
