import EventBus from '../core/EventBus.js';

/**
 * HealthSystem — Tracks entity HP, emits death events.
 *
 * Queries: ['Transform', 'Health']
 * Listens: 'entity:damaged' { entityId, damage }
 * Emits: 'entity:died' { entityId, position, drops }
 */
export class HealthSystem {
    constructor(scene) {
        this.scene = scene;
        this._pending = [];

        EventBus.on('entity:damaged', ({ entityId, damage }) => {
            this._pending.push({ entityId, damage });
        });
    }

    update(entities, deltaTime, ecs) {
        for (const { entityId, damage } of this._pending) {
            const health = ecs.getComponent(entityId, 'Health');
            if (!health) continue;

            const actualDamage = Math.max(0, damage - health.armor);
            health.hp -= actualDamage;

            if (health.hp <= 0) {
                health.hp = 0;
                const transform = ecs.getComponent(entityId, 'Transform');
                const pos = transform ? transform.mesh.position.clone() : null;

                const tag = ecs.getComponent(entityId, 'Tag');
                const drops = [];
                if (tag && tag.has('enemy')) drops.push('meat');

                if (transform && transform.mesh) {
                    this.scene.remove(transform.mesh);
                }

                EventBus.emit('entity:died', {
                    entityId,
                    position: pos,
                    drops
                });

                ecs.destroyEntity(entityId);
            }
        }
        this._pending = [];
    }
}
