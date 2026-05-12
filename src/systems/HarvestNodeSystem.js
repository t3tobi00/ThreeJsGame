import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * HarvestNodeSystem — Respawns harvestable resource nodes after they're
 * destroyed, OR (when respawnTime <= 0) leaves a one-shot replacement prop
 * (e.g. tree-prototype → tree-stump) for finite-resource maps.
 *
 * Non-ECS system: it doesn't query per frame. It listens to 'entity:died'
 * and checks if the dying entity had a Harvestable component. If respawnTime
 * is positive it queues a respawn timer; when the timer hits zero the node
 * is recreated. If respawnTime <= 0 the resource is finite — a stump prop
 * is spawned immediately (for trees) and the node never returns.
 *
 * Wiring: construct with (factory, ecs). Call update(dt) from animate loop.
 */

/** archetypeName → archetypeName that should appear after a finite-resource kill */
const FINITE_REPLACEMENT = {
    'tree-prototype': 'tree-stump'
};

export class HarvestNodeSystem {
    constructor(factory, ecs) {
        this.factory = factory;
        this.ecs = ecs;
        this._pending = []; // { archetypeName, spawnPos, respawnLeft }

        EventBus.on('entity:died', ({ entityId }) => this._onEntityDied(entityId));
    }

    _onEntityDied(entityId) {
        // The ECS has NOT yet destroyed the entity's components at the moment
        // this event fires (HealthSystem emits before destroyEntity). But there's
        // no guarantee of fire order across listeners, so we use ecs.getComponent
        // which returns null if already cleared. Use an immediate read.
        const harvestable = this.ecs.getComponent(entityId, 'Harvestable');
        if (!harvestable) return;

        const archetypeName = harvestable.archetypeName;
        const spawnPos = harvestable.spawnPos;
        if (!archetypeName || !spawnPos) return;

        // Finite resource: spawn the replacement prop now, never respawn.
        if (harvestable.respawnTime <= 0) {
            const replacement = FINITE_REPLACEMENT[archetypeName];
            if (replacement) {
                this.factory.create(replacement, spawnPos.clone());
            }
            return;
        }

        this._pending.push({
            archetypeName,
            spawnPos: spawnPos.clone(),
            respawnLeft: harvestable.respawnTime
        });
    }

    update(deltaTime) {
        if (this._pending.length === 0) return;

        for (let i = this._pending.length - 1; i >= 0; i--) {
            const entry = this._pending[i];
            entry.respawnLeft -= deltaTime;
            if (entry.respawnLeft <= 0) {
                this.factory.create(entry.archetypeName, entry.spawnPos);
                this._pending.splice(i, 1);
            }
        }
    }
}
