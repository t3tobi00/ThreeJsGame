import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import EventBus from '../core/EventBus.js';

/**
 * UnlockZoneSystem — Drains matching resources from nearby carriers into zones.
 *
 * Queries: ['Transform', 'UnlockZone']
 * Emits: 'zone:funded' { zoneId, type, builds, spawns, spawnCount }
 *        'stack:changed' { entityId, count }
 */
export class UnlockZoneSystem {
    constructor(scene) {
        this.scene = scene;
        this._transfer = new ResourceTransfer();
        this._ecs = null;
    }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);
        this._ecs = ecs;

        const carriers = ecs.queryEntities(['Transform', 'InventoryStack']);

        for (const zoneId of entities) {
            const zoneTransform = ecs.getComponent(zoneId, 'Transform');
            const zone = ecs.getComponent(zoneId, 'UnlockZone');
            if (!zoneTransform || !zone) continue;

            zone.timeSinceLastDrain += deltaTime;

            if (this._isFunded(zone)) continue;

            for (const carrierId of carriers) {
                const carrierTransform = ecs.getComponent(carrierId, 'Transform');
                const carrierInventory = ecs.getComponent(carrierId, 'InventoryStack');
                if (!carrierTransform || !carrierInventory) continue;

                const dist = zoneTransform.mesh.position.distanceTo(carrierTransform.mesh.position);
                if (dist > zone.range) continue;
                if (zone.timeSinceLastDrain < zone.drainRate) continue;

                let drained = false;
                for (const [resourceType, needed] of Object.entries(zone.cost)) {
                    if (zone.progress[resourceType] >= needed) continue;

                    const meshIndex = this._findResourceInStack(carrierInventory.stack, resourceType);
                    if (meshIndex === -1) continue;

                    const mesh = this._popResourceAtIndex(carrierInventory.stack, meshIndex);
                    if (!mesh) continue;

                    drained = true;
                    zone.progress[resourceType]++;

                    const fromPos = mesh.position.clone();
                    const toPos = zoneTransform.mesh.position.clone();
                    toPos.y = 0.5;
                    this._transfer.send(mesh, fromPos, toPos, {
                        arcHeight: 3,
                        duration: 0.5,
                        spin: true,
                        onArrive: (m) => {
                            this.scene.remove(m);
                            if (m.geometry) m.geometry.dispose();
                            if (m.material) m.material.dispose();
                        }
                    });

                    EventBus.emit('stack:changed', {
                        entityId: carrierId,
                        count: carrierInventory.stack.getCount()
                    });
                }

                if (drained) {
                    zone.timeSinceLastDrain = 0;
                }

                if (this._isFunded(zone)) {
                    EventBus.emit('zone:funded', {
                        zoneId,
                        type: zone.type,
                        builds: zone.builds,
                        spawns: zone.spawns,
                        spawnCount: zone.spawnCount
                    });
                }
            }
        }
    }

    _isFunded(zone) {
        for (const [type, needed] of Object.entries(zone.cost)) {
            if ((zone.progress[type] || 0) < needed) return false;
        }
        return true;
    }

    _findResourceInStack(stack, resourceType) {
        for (let i = stack.items.length - 1; i >= 0; i--) {
            if (stack.items[i].userData && stack.items[i].userData.resourceType === resourceType) {
                return i;
            }
        }
        return -1;
    }

    _popResourceAtIndex(stack, index) {
        if (index < 0 || index >= stack.items.length) return null;
        const [mesh] = stack.items.splice(index, 1);
        return mesh;
    }
}
