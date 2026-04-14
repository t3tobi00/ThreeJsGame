import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import { UnlockZoneUI } from '../ui/UnlockZoneUI.js';
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
        this._uiMap = new Map(); // zoneId -> UnlockZoneUI

        // Clean up UI when a build zone is destroyed
        EventBus.on('zone:built', ({ zoneId }) => {
            this._destroyUI(zoneId);
        });
    }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);
        this._ecs = ecs;

        const carriers = ecs.queryEntities(['Transform', 'InventoryStack']);

        // Clean up UIs for zones that no longer exist
        for (const [id] of this._uiMap) {
            if (!entities.includes(id)) {
                this._destroyUI(id);
            }
        }

        for (const zoneId of entities) {
            const zoneTransform = ecs.getComponent(zoneId, 'Transform');
            const zone = ecs.getComponent(zoneId, 'UnlockZone');
            if (!zoneTransform || !zone) continue;

            // Create UI on first encounter
            const ui = this._ensureUI(zoneId, zoneTransform, zone);

            zone.timeSinceLastDrain += deltaTime;

            // Animate UI each frame
            if (ui) {
                ui.animate(deltaTime);
                ui.updateProgress(zone.progress);
            }

            if (this._isFunded(zone)) continue;

            // Track if any carrier is in range this frame
            let anyCarrierInRange = false;

            for (const carrierId of carriers) {
                const carrierTransform = ecs.getComponent(carrierId, 'Transform');
                const carrierInventory = ecs.getComponent(carrierId, 'InventoryStack');
                if (!carrierTransform || !carrierInventory) continue;

                const dist = zoneTransform.mesh.position.distanceTo(carrierTransform.mesh.position);
                if (dist > zone.range) continue;

                anyCarrierInRange = true;

                if (zone.timeSinceLastDrain < zone.drainRate) continue;

                let drained = false;
                for (const [resourceType, needed] of Object.entries(zone.cost)) {
                    if (zone.progress[resourceType] >= needed) continue;
                    if (carrierInventory.getCountByType(resourceType) === 0) continue;

                    const mesh = carrierInventory.popFromSlot(resourceType);
                    if (!mesh) continue;

                    drained = true;
                    zone.progress[resourceType]++;

                    const fromPos = mesh.position.clone();
                    const toPos = this._getDrainTarget(zoneTransform, resourceType);
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
                        type: resourceType,
                        count: carrierInventory.getCountByType(resourceType),
                        totalCount: carrierInventory.getTotalCount()
                    });
                }

                if (drained) {
                    zone.timeSinceLastDrain = 0;
                }

                if (this._isFunded(zone)) {
                    EventBus.emit('zone:funded', {
                        zoneId,
                        carrierId,
                        type: zone.type,
                        builds: zone.builds,
                        spawns: zone.spawns,
                        spawnCount: zone.spawnCount
                    });
                }
            }

            // Update active state (glow when player nearby)
            if (ui) {
                ui.setActive(anyCarrierInRange);
            }
        }
    }

    _ensureUI(zoneId, transform, zone) {
        if (this._uiMap.has(zoneId)) return this._uiMap.get(zoneId);

        const group = transform.mesh;

        // Gearworks machines have built-in 3D counters — use adapter instead of HTML UI
        if (group.userData && group.userData.inputCounters) {
            const counters = group.userData.inputCounters;
            const adapter = {
                updateProgress(progress) {
                    for (const c of counters) c.update(progress[c.type] || 0);
                },
                animate() {},
                setActive() {},
                destroy() {}
            };
            this._uiMap.set(zoneId, adapter);
            return adapter;
        }
        const outputType = zone.builds || zone.spawns || zone.output || 'unknown';

        // Read size from the mesh preset (base plane child)
        let size = 4;
        if (group.children && group.children.length > 0) {
            const basePlane = group.children[0];
            if (basePlane.geometry && basePlane.geometry.parameters) {
                size = basePlane.geometry.parameters.width || 4;
            }
        }

        const outputCount = zone.outputCount || zone.spawnCount || 1;
        const ui = new UnlockZoneUI(group, zone.cost, outputType, size, outputCount);
        this._uiMap.set(zoneId, ui);
        return ui;
    }

    _destroyUI(zoneId) {
        const ui = this._uiMap.get(zoneId);
        if (ui) {
            ui.destroy();
            this._uiMap.delete(zoneId);
        }
    }

    _getDrainTarget(zoneTransform, resourceType) {
        const ud = zoneTransform.mesh.userData;
        // For machines: fly items to the matching input slot on the machine mesh
        if (ud && ud.inputCounters && ud.machineMesh) {
            const counter = ud.inputCounters.find(c => c.type === resourceType);
            if (counter && counter.localPos) {
                const target = new THREE.Vector3(
                    counter.localPos.x,
                    counter.localPos.y,
                    counter.localPos.z
                );
                ud.machineMesh.localToWorld(target);
                return target;
            }
        }
        // Default: fly to zone position
        const pos = zoneTransform.mesh.position.clone();
        pos.y = 0.5;
        return pos;
    }

    _isFunded(zone) {
        for (const [type, needed] of Object.entries(zone.cost)) {
            if ((zone.progress[type] || 0) < needed) return false;
        }
        return true;
    }

}
