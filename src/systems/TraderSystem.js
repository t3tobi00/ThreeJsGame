import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import EventBus from '../core/EventBus.js';
import { COIN_CONFIG } from '../config/gameConfig.js';
import ResourceRegistry from '../core/ResourceRegistry.js';

export class TraderSystem {
    constructor(scene, agentAISystem, coinTrayEntityId) {
        this.scene = scene;
        this._agentAI = agentAISystem;
        this._coinTrayId = coinTrayEntityId;
        this._transfer = new ResourceTransfer();
        this._ecs = null;

        EventBus.on('item:deposited', ({ targetId }) => {
            if (this._ecs) {
                const tableInv = this._ecs.getComponent(targetId, 'InventoryStack');
                if (tableInv && tableInv.stack.getCount() >= 1) {
                    this._agentAI.sendFrontToTable(this._ecs);
                }
            }
        });

        EventBus.on('agent:at_table', ({ entityId }) => {
            if (this._ecs) this._executeTransaction(entityId, this._ecs);
        });
    }

    setECS(ecs) { this._ecs = ecs; }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);
        this._ecs = ecs;

        // Periodic check: if table has meat and nobody is trading, send next villager
        this._checkTimer = (this._checkTimer || 0) + deltaTime;
        if (this._checkTimer >= 1.0) {
            this._checkTimer = 0;
            this._tryNextTrade(ecs);
        }
    }

    _tryNextTrade(ecs) {
        const tables = ecs.queryEntities(['Tag', 'InventoryStack']);
        const tableId = tables.find(id => {
            const tag = ecs.getComponent(id, 'Tag');
            return tag && tag.has('table');
        });
        if (!tableId) return;

        const tableInv = ecs.getComponent(tableId, 'InventoryStack');
        if (!tableInv || tableInv.stack.getCount() === 0) return;

        this._agentAI.sendFrontToTable(ecs);
    }

    _executeTransaction(buyerId, ecs) {
        const tables = ecs.queryEntities(['Tag', 'InventoryStack', 'Trader']);
        const tableId = tables.find(id => {
            const tag = ecs.getComponent(id, 'Tag');
            return tag && tag.has('table');
        });
        if (!tableId) {
            // No table found — release the villager so it doesn't get stuck
            setTimeout(() => EventBus.emit('trade:complete', { traderId: buyerId, gave: { type: 'coin', count: 0 }, received: { type: 'meat', count: 0 } }), 100);
            return;
        }

        const buyerInventory  = ecs.getComponent(buyerId, 'InventoryStack');
        const buyerTransform  = ecs.getComponent(buyerId, 'Transform');
        const tableInventory  = ecs.getComponent(tableId, 'InventoryStack');
        const tableTransform  = ecs.getComponent(tableId, 'Transform');

        if (!buyerInventory || !tableInventory || !buyerTransform || !tableTransform) {
            setTimeout(() => EventBus.emit('trade:complete', { traderId: buyerId, gave: { type: 'coin', count: 0 }, received: { type: 'meat', count: 0 } }), 100);
            return;
        }

        const meatToBuy = Math.min(3, tableInventory.stack.getCount());
        if (meatToBuy === 0) {
            // No meat available — release the villager
            setTimeout(() => EventBus.emit('trade:complete', { traderId: buyerId, gave: { type: 'coin', count: 0 }, received: { type: 'meat', count: 0 } }), 100);
            return;
        }

        for (let i = 0; i < meatToBuy; i++) {
            const meatMesh = tableInventory.stack.pop();
            if (!meatMesh) break;
            const from = meatMesh.position.clone();
            const to = buyerTransform.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));
            this._transfer.send(meatMesh, from, to, {
                arcHeight: 2, duration: 0.45, spin: true,
                onArrive: (m) => buyerInventory.stack.add(m, { animate: false })
            });
        }

        const coinsToGive = Math.ceil(meatToBuy * (COIN_CONFIG.valuePerMeat || 1));
        const coinTrayInv = this._coinTrayId ? ecs.getComponent(this._coinTrayId, 'InventoryStack') : null;
        const coinTrayTransform = this._coinTrayId ? ecs.getComponent(this._coinTrayId, 'Transform') : null;

        for (let i = 0; i < coinsToGive; i++) {
            const coinMesh = ResourceRegistry.createMesh('coin');
            this.scene.add(coinMesh);
            coinMesh.position.copy(buyerTransform.mesh.position).add(new THREE.Vector3(0, 1.4, 0));
            const to = coinTrayTransform
                ? coinTrayTransform.mesh.position.clone().add(new THREE.Vector3(0, 0.4, 0))
                : new THREE.Vector3(0, 0.4, 0);
            this._transfer.send(coinMesh, coinMesh.position.clone(), to, {
                arcHeight: 2, duration: 0.45, spin: false,
                onArrive: (m) => { if (coinTrayInv) coinTrayInv.stack.add(m, { animate: true }); }
            });
        }

        setTimeout(() => {
            EventBus.emit('trade:complete', {
                traderId: buyerId,
                gave: { type: 'coin', count: coinsToGive },
                received: { type: 'meat', count: meatToBuy }
            });
        }, 600);
    }

}
