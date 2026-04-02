import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import EventBus from '../core/EventBus.js';

/**
 * ShopSystem — Drains coins from nearby players, applies effects on purchase.
 *
 * Queries: ['Transform', 'Shop']
 * Finds nearby carriers with ['Transform', 'InventoryStack', 'Tag'] (player tag)
 *
 * Effects:
 *   "heal" — restores effectValue HP to the buyer
 *
 * Emits: 'stack:changed', 'entity:hp_changed', 'shop:purchased'
 */
export class ShopSystem {
    constructor(scene) {
        this.scene = scene;
        this._transfer = new ResourceTransfer();
    }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);

        const players = ecs.queryEntities(['Transform', 'InventoryStack', 'Tag']);

        for (const shopId of entities) {
            const shopTransform = ecs.getComponent(shopId, 'Transform');
            const shop = ecs.getComponent(shopId, 'Shop');
            if (!shopTransform || !shop) continue;

            shop.timeSinceLastDrain += deltaTime;

            // Cooldown after a completed purchase
            if (shop.cooldownTimer > 0) {
                shop.cooldownTimer -= deltaTime;
                continue;
            }

            for (const playerId of players) {
                const playerTag = ecs.getComponent(playerId, 'Tag');
                if (!playerTag || !playerTag.has('player')) continue;

                const playerTransform = ecs.getComponent(playerId, 'Transform');
                const playerInventory = ecs.getComponent(playerId, 'InventoryStack');
                if (!playerTransform || !playerInventory) continue;

                const dist = playerTransform.mesh.position.distanceTo(shopTransform.mesh.position);
                if (dist > shop.range) continue;

                // Check if player has coins
                if (playerInventory.getCountByType('coin') === 0) continue;

                if (shop.timeSinceLastDrain < shop.drainRate) continue;

                // Check if purchase would be useful
                if (!this._isEffectUseful(shop, playerId, ecs)) continue;

                // Drain one coin
                const coinMesh = playerInventory.popFromSlot('coin');
                if (!coinMesh) continue;

                shop.coinsDrained++;
                shop.timeSinceLastDrain = 0;

                // Animate coin flying to shop
                const fromPos = coinMesh.position.clone();
                const toPos = shopTransform.mesh.position.clone();
                toPos.y += 1.0;

                this._transfer.send(coinMesh, fromPos, toPos, {
                    arcHeight: 2.0,
                    duration: 0.35,
                    spin: true,
                    onArrive: (m) => {
                        this.scene.remove(m);
                        if (m.geometry) m.geometry.dispose();
                        if (m.material) m.material.dispose();
                    }
                });

                EventBus.emit('stack:changed', {
                    entityId: playerId,
                    type: 'coin',
                    count: playerInventory.getCountByType('coin'),
                    totalCount: playerInventory.getTotalCount()
                });

                // Check if purchase is complete
                if (shop.coinsDrained >= shop.cost) {
                    this._applyEffect(shop, playerId, ecs);
                    shop.coinsDrained = 0;
                    shop.cooldownTimer = shop.cooldown;

                    EventBus.emit('shop:purchased', {
                        shopId,
                        playerId,
                        effect: shop.effect,
                        effectValue: shop.effectValue
                    });
                }

                break; // one coin per tick
            }
        }
    }

    _isEffectUseful(shop, playerId, ecs) {
        if (shop.effect === 'heal') {
            const health = ecs.getComponent(playerId, 'Health');
            if (!health) return false;
            return health.hp < health.maxHp;
        }
        return true;
    }

    _applyEffect(shop, playerId, ecs) {
        switch (shop.effect) {
            case 'heal': {
                const health = ecs.getComponent(playerId, 'Health');
                if (!health) return;
                health.hp = Math.min(health.maxHp, health.hp + shop.effectValue);
                EventBus.emit('entity:hp_changed', {
                    entityId: playerId,
                    hp: health.hp,
                    maxHp: health.maxHp
                });
                break;
            }
            default:
                console.warn(`ShopSystem: unknown effect '${shop.effect}'`);
        }
    }
}
