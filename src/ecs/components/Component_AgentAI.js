/**
 * AgentAI — State machine for NPC autonomous behavior (villager queue/trade/exit).
 * state: current state string.
 * queueSlot: position in the queue (0 = front).
 * exitDist: how far the agent travels before being despawned.
 */
export class Component_AgentAI {
    constructor({ state = 'in_queue', target = null, queueSlot = -1, exitDist = 20 } = {}) {
        this.state = state;       // 'in_queue' | 'approaching_table' | 'buying' | 'exiting'
        this.target = target;     // THREE.Vector3 destination
        this.queueSlot = queueSlot;
        this.exitDist = exitDist;
        // Runtime state
        this.distanceTravelled = 0;
        this.actionTimer = 0;
    }
}
