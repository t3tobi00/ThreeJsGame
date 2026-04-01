import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import { QUEUE_CONFIG } from '../config/gameConfig.js';

export class AgentAISystem {
    constructor(factory, scene) {
        this._factory = factory;
        this.scene = scene;
        this._agents = [];
        this._ecs = null;

        // EventBus listeners
        EventBus.on('trade:complete', ({ traderId }) => {
            this._setExiting(traderId);
        });

        EventBus.on('agent:exited', ({ entityId }) => {
            this._respawn(entityId);
        });
    }

    setECS(ecs) { this._ecs = ecs; }

    register(entityId, queueSlot) {
        const agentAI = this._getAI(entityId);
        if (agentAI) {
            agentAI.queueSlot = queueSlot;
            agentAI.state = 'in_queue';
            agentAI.target = this._queueSlotPos(queueSlot);
        }
        this._agents.push(entityId);
    }

    update(entities, deltaTime, ecs) {
        this._ecs = ecs;

        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const movement = ecs.getComponent(entityId, 'Movement');
            const agentAI = ecs.getComponent(entityId, 'AgentAI');
            if (!transform || !movement || !agentAI) continue;
            if (!agentAI.target) continue;

            const pos = transform.mesh.position;
            const target = agentAI.target;
            const dist = pos.distanceTo(target);

            if (dist > QUEUE_CONFIG.arriveThreshold) {
                const dir = new THREE.Vector3().subVectors(target, pos).normalize();
                pos.addScaledVector(dir, movement.speed * deltaTime);
                transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            }

            if (dist <= QUEUE_CONFIG.arriveThreshold) {
                this._handleArrival(entityId, agentAI, transform, ecs);
            }
        }
    }

    _handleArrival(entityId, agentAI, transform, ecs) {
        switch (agentAI.state) {
            case 'in_queue':
                break;
            case 'approaching_table':
                agentAI.state = 'buying';
                agentAI.target = null;
                EventBus.emit('agent:at_table', { entityId });
                break;
            case 'exiting':
                if (this.scene) this.scene.remove(transform.mesh);
                EventBus.emit('agent:exited', { entityId });
                break;
        }
    }

    _advanceQueue(ecs) {
        const inQueue = this._agents
            .map(id => ({ id, ai: ecs.getComponent(id, 'AgentAI') }))
            .filter(({ ai }) => ai && ai.state === 'in_queue')
            .sort((a, b) => a.ai.queueSlot - b.ai.queueSlot);

        // Reassign slots sequentially (0, 1, 2, ...) to close any gaps
        for (let i = 0; i < inQueue.length; i++) {
            const { ai } = inQueue[i];
            if (ai.queueSlot !== i) {
                ai.queueSlot = i;
                ai.target = this._queueSlotPos(i);
            }
        }
    }

    sendFrontToTable(ecs) {
        // Don't send another villager if one is already approaching or buying
        const alreadyTrading = this._agents.some(id => {
            const ai = ecs.getComponent(id, 'AgentAI');
            return ai && (ai.state === 'approaching_table' || ai.state === 'buying');
        });
        if (alreadyTrading) return;

        const front = this._agents
            .map(id => ({ id, ai: ecs.getComponent(id, 'AgentAI') }))
            .filter(({ ai }) => ai && ai.state === 'in_queue' && ai.queueSlot === 0)[0];

        if (!front) return;
        front.ai.state = 'approaching_table';
        front.ai.target = new THREE.Vector3(QUEUE_CONFIG.tableApproach.x, 0, QUEUE_CONFIG.tableApproach.z);
        this._advanceQueue(ecs);
    }

    _setExiting(entityId) {
        const agentAI = this._getAI(entityId);
        if (agentAI) {
            agentAI.state = 'exiting';
            agentAI.target = new THREE.Vector3(QUEUE_CONFIG.exitTarget.x, 0, QUEUE_CONFIG.exitTarget.z);
        }
    }

    _respawn(exitedEntityId) {
        if (!this._ecs || !this._factory) return;
        const idx = this._agents.indexOf(exitedEntityId);
        if (idx > -1) this._agents.splice(idx, 1);
        this._ecs.destroyEntity(exitedEntityId);

        // Compact the queue first so existing agents have correct slots
        this._advanceQueue(this._ecs);

        // New villager goes to the back of the queue
        const inQueueSlots = this._agents
            .map(id => this._ecs.getComponent(id, 'AgentAI'))
            .filter(ai => ai && ai.state === 'in_queue')
            .map(ai => ai.queueSlot);
        const slot = inQueueSlots.length > 0 ? Math.max(...inQueueSlots) + 1 : 0;

        const spawnPos = new THREE.Vector3(0, 0, -24);
        const newId = this._factory.create('villager', spawnPos);
        this.register(newId, slot);
    }

    _queueSlotPos(slot) {
        return new THREE.Vector3(
            QUEUE_CONFIG.start.x,
            0,
            QUEUE_CONFIG.start.z - slot * QUEUE_CONFIG.spacing
        );
    }

    _getAI(entityId) {
        return this._ecs ? this._ecs.getComponent(entityId, 'AgentAI') : null;
    }
}
