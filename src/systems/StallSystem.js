import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import ResourceRegistry from '../core/ResourceRegistry.js';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import { MARKET_CONFIG } from '../config/gameConfig.js';

/**
 * StallSystem — Owns market-stall transactions.
 *
 * Queries: ['Transform', 'Stall', 'InventoryStack']
 *
 * Responsibilities:
 *   - On 'stall:purchase_request' from CustomerAISystem: pop one product from
 *     the stall's inventory and arc N coin meshes (one per price unit) onto
 *     the linked coin tray. Emit 'stall:purchased' on completion.
 *   - Watch each stall's inventory count and emit 'stall:stack_changed'
 *     whenever it changes so the counter UI can update without polling.
 *   - Emit 'stall:empty' the first frame a stall transitions to zero stock
 *     so customers can deselect a dry stall.
 *
 * Reuses ResourceTransfer for arc animations (no new flight code).
 */
export class StallSystem {
    constructor(scene) {
        this.scene = scene;
        this._transfer = new ResourceTransfer();
        this._ecs = null;
        this._lastCounts = new Map();   // stallId → last broadcast count
        this._wasEmpty   = new Map();   // stallId → bool, last frame's empty state

        EventBus.on('stall:purchase_request', (payload) => {
            this._handlePurchaseRequest(payload);
        });
    }

    setECS(ecs) { this._ecs = ecs; }

    update(entities, deltaTime, ecs) {
        this._ecs = ecs;
        this._transfer.update(deltaTime);

        // Detect inventory count changes per stall — emit stack:changed-style
        // events so the counter UI can subscribe without polling each frame.
        for (const stallId of entities) {
            const inv = ecs.getComponent(stallId, 'InventoryStack');
            const stall = ecs.getComponent(stallId, 'Stall');
            if (!inv || !stall) continue;

            const count = inv.getCountByType(stall.productType);
            const prev  = this._lastCounts.get(stallId);
            if (prev !== count) {
                this._lastCounts.set(stallId, count);
                EventBus.emit('stall:stack_changed', { stallId, count });
            }

            const wasEmpty = this._wasEmpty.get(stallId) === true;
            const isEmpty  = count === 0;
            if (isEmpty && !wasEmpty) {
                EventBus.emit('stall:empty', { stallId });
            }
            this._wasEmpty.set(stallId, isEmpty);
        }
    }

    /**
     * Process a customer's purchase. Returns true if the trade went through.
     * Emits 'stall:purchased' so CustomerAISystem can advance the customer
     * out of the 'buying' state.
     */
    _handlePurchaseRequest({ customerId, stallId, maxPrice }) {
        const ecs = this._ecs;
        if (!ecs) return false;

        const stall          = ecs.getComponent(stallId, 'Stall');
        const stallInventory = ecs.getComponent(stallId, 'InventoryStack');
        const stallTransform = ecs.getComponent(stallId, 'Transform');
        if (!stall || !stallInventory || !stallTransform) return false;

        const customerTransform = ecs.getComponent(customerId, 'Transform');
        const customerInventory = ecs.getComponent(customerId, 'InventoryStack');
        if (!customerTransform || !customerInventory) {
            this._emitFailedPurchase(customerId, stallId, stall.productType);
            return false;
        }

        // Affordability check (optional: customer can pass a budget cap).
        if (typeof maxPrice === 'number' && stall.price > maxPrice) {
            this._emitFailedPurchase(customerId, stallId, stall.productType);
            return false;
        }

        const productMesh = stallInventory.popFromSlot(stall.productType);
        if (!productMesh) {
            // Sold out — release the customer immediately.
            this._emitFailedPurchase(customerId, stallId, stall.productType);
            return false;
        }

        // Arc the product from the stall to the customer's stack anchor.
        const fromPos = productMesh.position.clone();
        const toPos   = customerTransform.mesh.position.clone()
            .add(new THREE.Vector3(0, 1.7, 0));
        this._transfer.send(productMesh, fromPos, toPos, {
            arcHeight: 1.6, duration: 0.45, spin: false,
            onArrive: (m) => {
                customerInventory.addToSlot(stall.productType, m, { animate: false });
            }
        });

        // Pay coins. Each coin gets its own freshly-built mesh, arced onto the
        // linked coin tray with a small stagger so the payment reads as a
        // little shower instead of a single chunky drop.
        const trayId = stall.trayId;
        const trayInventory  = trayId ? ecs.getComponent(trayId, 'InventoryStack') : null;
        const trayTransform  = trayId ? ecs.getComponent(trayId, 'Transform')      : null;

        const coinsToPay = Math.max(0, Math.floor(stall.price));
        for (let i = 0; i < coinsToPay; i++) {
            const coinMesh = ResourceRegistry.createMesh('coin');
            this.scene.add(coinMesh);
            const coinFrom = customerTransform.mesh.position.clone()
                .add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 1.5, (Math.random() - 0.5) * 0.2));
            coinMesh.position.copy(coinFrom);

            const coinTo = trayTransform
                ? trayTransform.mesh.position.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2, 0.4, (Math.random() - 0.5) * 0.2))
                : new THREE.Vector3(0, 0.4, 0);

            const arrivalDelaySec = i * MARKET_CONFIG.stallCoinPayoutStaggerSec;
            const flightDuration  = 0.5 + arrivalDelaySec;

            this._transfer.send(coinMesh, coinMesh.position.clone(), coinTo, {
                arcHeight: 1.8 + i * 0.05, duration: flightDuration, spin: true,
                onArrive: (m) => {
                    if (trayInventory) {
                        trayInventory.addToSlot('coin', m, { animate: true });
                    } else {
                        this.scene.remove(m);
                    }
                }
            });
        }

        EventBus.emit('stall:purchased', {
            customerId, stallId,
            price: coinsToPay,
            productType: stall.productType
        });
        return true;
    }

    _emitFailedPurchase(customerId, stallId, productType) {
        // Send a 0-price purchase event so the customer state machine still
        // advances out of 'buying' and walks away. Keeps the contract simple
        // (one event resolves a request, success or fail).
        EventBus.emit('stall:purchased', {
            customerId, stallId,
            price: 0,
            productType
        });
    }
}
