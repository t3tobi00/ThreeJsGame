import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import EventBus from '../core/EventBus.js';

/**
 * StorageDepositSystem — One-way player-stack → storage-prop drain.
 *
 * Prototype-only. When the player walks within TRIGGER_RADIUS of a storage
 * prop (Tag 'storage'), items arc from their jelly-stack into the storage's
 * own InventoryStack at ITEM_CADENCE seconds per item, type-routed:
 *   wood items only feed wood-storage, essence only feeds essence-storage.
 *
 * Routing reuses the existing DepositorSystem pattern: ResourceTransfer
 * Bezier arc + InventoryStack.popFromSlot / addToSlot, so the storage's
 * StackSystem-driven visual stack updates without any extra plumbing.
 *
 * Coexists with the worker → storage flow; nothing here mutates worker
 * deposit logic.
 */
const TRIGGER_RADIUS = 2.0;
const ITEM_CADENCE   = 0.08;   // seconds per item, per resource type
const ARC_HEIGHT     = 1.6;
const ARC_DURATION   = 0.35;

export class StorageDepositSystem {
    constructor(scene, ecs, playerId) {
        this.scene      = scene;
        this._ecs       = ecs;
        this._playerId  = playerId ?? null;
        this._transfer  = new ResourceTransfer();
        this._cooldown  = Object.create(null);   // type → seconds since last arc launch
    }

    setPlayerId(id) { this._playerId = id; }

    update(deltaTime) {
        this._transfer.update(deltaTime);
        for (const k in this._cooldown) this._cooldown[k] += deltaTime;

        const ecs = this._ecs;
        if (!ecs || this._playerId == null) return;

        const playerTr  = ecs.getComponent(this._playerId, 'Transform');
        const playerInv = ecs.getComponent(this._playerId, 'InventoryStack');
        if (!playerTr?.mesh || !playerInv) return;
        if (playerInv.getTotalCount() === 0) return;

        const playerPos = playerTr.mesh.position;
        const carriedTypes = playerInv.slots
            .filter(s => s.stack.getCount() > 0)
            .map(s => s.type);

        if (carriedTypes.length === 0) return;

        const candidates = ecs.queryEntities(['Transform', 'Tag', 'InventoryStack']);

        for (const type of carriedTypes) {
            if ((this._cooldown[type] ?? 999) < ITEM_CADENCE) continue;
            if (playerInv.getCountByType(type) === 0) continue;  // re-check (mutated mid-loop)

            const target = this._findNearestAcceptingStorage(
                candidates, ecs, playerPos, type
            );
            if (!target) continue;

            const mesh = playerInv.popFromSlot(type);
            if (!mesh) continue;
            this._cooldown[type] = 0;

            const fromPos = mesh.position.clone();
            const toPos   = target.tr.mesh.position.clone()
                .add(new THREE.Vector3(0, 0.6, 0));

            this._transfer.send(mesh, fromPos, toPos, {
                arcHeight: ARC_HEIGHT,
                duration:  ARC_DURATION,
                spin:      false,
                onArrive: (m) => {
                    const stillAccepts = target.inv.canAccept(type);
                    if (stillAccepts) {
                        target.inv.addToSlot(type, m, { animate: true });
                        EventBus.emit('item:deposited', {
                            depositorId: this._playerId,
                            targetId:    target.id,
                            itemType:    type
                        });
                    } else {
                        // Storage filled while in flight — drop the mesh.
                        if (m.parent) m.parent.remove(m);
                        if (m.geometry) m.geometry.dispose?.();
                        if (m.material) m.material.dispose?.();
                    }
                }
            });

            EventBus.emit('stack:changed', {
                entityId:   this._playerId,
                type,
                count:      playerInv.getCountByType(type),
                totalCount: playerInv.getTotalCount()
            });
        }
    }

    _findNearestAcceptingStorage(candidates, ecs, fromPos, type) {
        let best = null;
        let bestDist = Infinity;
        for (const id of candidates) {
            if (id === this._playerId) continue;
            const tag = ecs.getComponent(id, 'Tag');
            if (!tag || !tag.has('storage')) continue;
            const inv = ecs.getComponent(id, 'InventoryStack');
            if (!inv) continue;
            if (!inv.canAccept(type)) continue;        // type filter + capacity
            const tr = ecs.getComponent(id, 'Transform');
            if (!tr?.mesh) continue;
            const d = fromPos.distanceTo(tr.mesh.position);
            if (d > TRIGGER_RADIUS) continue;
            if (d < bestDist) {
                bestDist = d;
                best = { id, tr, inv };
            }
        }
        return best;
    }
}
