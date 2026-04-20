import * as THREE from 'three';
import { ResourceTransfer } from '../utils/ResourceTransfer.js';
import ResourceRegistry from '../core/ResourceRegistry.js';
import StackConfigRegistry from '../core/StackConfigRegistry.js';
import EventBus from '../core/EventBus.js';

/**
 * MachineSystem — Self-contained drain + convert loop for gearworks-style
 * machines. Replaces the UnlockZone dependency for machines: the machine
 * owns its own cost/progress/output state on Component_Machine, renders its
 * own 3D input counters, and spawns output resources on its output pad.
 *
 * Queries: ['Transform', 'Machine']
 * Emits:   'stack:changed' { entityId, count }
 *          'resource:place' { mesh, type }
 */
export class MachineSystem {
    constructor(scene) {
        this.scene = scene;
        this._transfer = new ResourceTransfer();
    }

    update(entities, deltaTime, ecs) {
        this._transfer.update(deltaTime);

        const carriers = ecs.queryEntities(['Transform', 'InventoryStack']);

        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const machine = ecs.getComponent(entityId, 'Machine');
            if (!transform || !machine || !machine.machineMesh) continue;
            if (!machine.cost || Object.keys(machine.cost).length === 0) continue;

            machine.timeSinceLastDrain += deltaTime;

            for (const c of machine.inputCounters) {
                c.update(machine.progress[c.type] || 0);
            }

            if (this._isFunded(machine)) continue;

            for (const carrierId of carriers) {
                const carrierTransform = ecs.getComponent(carrierId, 'Transform');
                const carrierInventory = ecs.getComponent(carrierId, 'InventoryStack');
                if (!carrierTransform || !carrierInventory) continue;

                const dist = transform.mesh.position.distanceTo(carrierTransform.mesh.position);
                if (dist > machine.range) continue;

                if (machine.timeSinceLastDrain < machine.drainRate) continue;

                let drained = false;
                for (const [resourceType, needed] of Object.entries(machine.cost)) {
                    if ((machine.progress[resourceType] || 0) >= needed) continue;
                    if (carrierInventory.getCountByType(resourceType) === 0) continue;

                    const mesh = carrierInventory.popFromSlot(resourceType);
                    if (!mesh) continue;

                    drained = true;
                    machine.progress[resourceType] = (machine.progress[resourceType] || 0) + 1;

                    const fromPos = mesh.position.clone();
                    const toPos = this._getInputTarget(machine, resourceType);
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
                        count: carrierInventory.getTotalCount()
                    });
                    break;
                }

                if (drained) machine.timeSinceLastDrain = 0;

                if (this._isFunded(machine)) {
                    this._produceOutput(machine);
                    break;
                }
            }
        }
    }

    _isFunded(machine) {
        for (const [type, needed] of Object.entries(machine.cost)) {
            if ((machine.progress[type] || 0) < needed) return false;
        }
        return true;
    }

    _getInputTarget(machine, resourceType) {
        const counter = machine.inputCounters.find(c => c.type === resourceType);
        if (counter && counter.localPos) {
            const target = new THREE.Vector3(
                counter.localPos.x, counter.localPos.y, counter.localPos.z
            );
            machine.machineMesh.localToWorld(target);
            return target;
        }
        const fallback = machine.machineMesh.position.clone();
        fallback.y = 0.5;
        return fallback;
    }

    _produceOutput(machine) {
        if (!machine.output || !machine.outputLocalCenter) return;

        if (machine.outputDisplayGroup && machine.outputDisplayGroup.visible) {
            machine.outputDisplayGroup.visible = false;
        }

        const outLocal = machine.outputLocalCenter;
        const outWorld = new THREE.Vector3(outLocal.x, outLocal.y, outLocal.z);
        machine.machineMesh.localToWorld(outWorld);

        const count = machine.outputCount || 1;
        const resConfig = StackConfigRegistry.get(machine.output);
        const stackOffset = (resConfig && resConfig.stackOffset) || 0.3;

        for (let i = 0; i < count; i++) {
            const mesh = ResourceRegistry.createMesh(machine.output, 'stacked');
            if (!mesh) continue;

            const startPos = outWorld.clone();
            startPos.y += 1;
            mesh.position.copy(startPos);
            this.scene.add(mesh);

            const stackIndex = machine.outputStackCount + i;
            const toPos = outWorld.clone();
            toPos.y += stackIndex * stackOffset;

            const resType = machine.output;
            this._transfer.send(mesh, startPos.clone(), toPos, {
                arcHeight: 2.0 + i * 0.3,
                duration: 0.4 + i * 0.08,
                spin: false,
                onArrive: (m) => {
                    m.position.copy(toPos);
                    EventBus.emit('resource:place', { mesh: m, type: resType });
                }
            });
        }
        machine.outputStackCount += count;

        for (const key of Object.keys(machine.progress)) {
            machine.progress[key] = 0;
        }
    }
}
