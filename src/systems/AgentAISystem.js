import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

// Queue configuration
const QUEUE_START = new THREE.Vector3(0, 0, -12);
const QUEUE_SPACING = 1.8;
const TABLE_POSITION = new THREE.Vector3(0, 0, -10.5);
const EXIT_TARGET = new THREE.Vector3(0, 0, -30);
const ARRIVE_THRESHOLD = 0.3;

export class AgentAISystem {
    constructor(factory, scene) {
        this._factory = factory;
        this.scene = scene;
        this._agents = [];
        this._ecs = null;

        EventBus.on('trade:complete', ({ traderId }) => {
            this._setExiting(traderId);
        });

        EventBus.on('agent:exited', ({ entityId }) => {
            this._respawn(entityId);
        });
    }

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

            if (dist > ARRIVE_THRESHOLD) {
                const dir = new THREE.Vector3().subVectors(target, pos).normalize();
                pos.addScaledVector(dir, movement.speed * deltaTime);
                transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            }

            if (dist <= ARRIVE_THRESHOLD) {
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

        for (const { id, ai } of inQueue) {
            if (ai.queueSlot > 0) {
                ai.queueSlot--;
                ai.target = this._queueSlotPos(ai.queueSlot);
            }
        }
    }

    sendFrontToTable(ecs) {
        const front = this._agents
            .map(id => ({ id, ai: ecs.getComponent(id, 'AgentAI') }))
            .filter(({ ai }) => ai && ai.state === 'in_queue' && ai.queueSlot === 0)[0];

        if (!front) return;
        front.ai.state = 'approaching_table';
        front.ai.target = TABLE_POSITION.clone();
        this._advanceQueue(ecs);
    }

    _setExiting(entityId) {
        const agentAI = this._getAI(entityId);
        if (agentAI) {
            agentAI.state = 'exiting';
            agentAI.target = EXIT_TARGET.clone();
        }
    }

    _respawn(exitedEntityId) {
        if (!this._ecs || !this._factory) return;
        const idx = this._agents.indexOf(exitedEntityId);
        if (idx > -1) this._agents.splice(idx, 1);
        this._ecs.destroyEntity(exitedEntityId);

        const slot = this._agents.length;
        const spawnPos = new THREE.Vector3(0, 0, -24);
        const newId = this._factory.create('villager', spawnPos);
        this.register(newId, slot);
    }

    _queueSlotPos(slot) {
        return new THREE.Vector3(
            QUEUE_START.x,
            QUEUE_START.y,
            QUEUE_START.z + slot * QUEUE_SPACING
        );
    }

    _getAI(entityId) {
        return this._ecs ? this._ecs.getComponent(entityId, 'AgentAI') : null;
    }
}
