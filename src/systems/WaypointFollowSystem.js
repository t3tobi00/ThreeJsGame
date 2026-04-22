import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

const WALK_PRIORITY = 5;
const WALK_TAG = 'walk-path';

/**
 * WaypointFollowSystem — Walks any entity with a Waypoints component
 * toward its next waypoint. Cooperates with other behaviors via
 * BehaviorState: claims priority 5 ('walk-path') while active; yields
 * (preserving list + currentIdx) when a higher-priority claim is held
 * so walks auto-resume when that claim is released.
 *
 * Mirrors HeroAISystem's direct-position write style (controller-
 * agnostic), so MovementSystem doesn't need to know about waypoints
 * and Movement.controller never has to be swapped.
 *
 * Queries: ['Transform', 'Movement', 'Waypoints', 'BehaviorState']
 */
export class WaypointFollowSystem {
    update(entities, deltaTime, ecs) {
        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const movement  = ecs.getComponent(id, 'Movement');
            const wp        = ecs.getComponent(id, 'Waypoints');
            const bs        = ecs.getComponent(id, 'BehaviorState');
            if (!transform || !movement || !wp || !bs) continue;

            // No active path → release walk-path claim if we own it.
            if (!wp.active || wp.list.length === 0) {
                if (bs.tag === WALK_TAG) {
                    bs.priority = 0;
                    bs.tag = 'idle';
                    EventBus.emit('behavior:changed', { entityId: id, tag: 'idle', priority: 0 });
                }
                continue;
            }

            // Yield to higher-priority claims (combat etc.). Preserve list
            // + currentIdx so we resume automatically next frame.
            if (bs.priority > WALK_PRIORITY && bs.tag !== WALK_TAG) {
                continue;
            }

            // Claim walk-path slot.
            if (bs.tag !== WALK_TAG) {
                bs.priority = WALK_PRIORITY;
                bs.tag = WALK_TAG;
                EventBus.emit('behavior:changed', { entityId: id, tag: WALK_TAG, priority: WALK_PRIORITY });
            }

            const pos = transform.mesh.position;
            const target = wp.list[wp.currentIdx];
            if (!target) {
                wp.active = false;
                wp.list = [];
                wp.finalDestination = null;
                continue;
            }

            const dx = target.x - pos.x;
            const dz = target.z - pos.z;
            const dist = Math.hypot(dx, dz);

            if (dist < wp.arrivalThreshold) {
                EventBus.emit('waypoint:reached', { entityId: id, index: wp.currentIdx });
                wp.currentIdx++;
                if (wp.currentIdx >= wp.list.length) {
                    wp.active = false;
                    wp.list = [];
                    wp.finalDestination = null;
                    wp.currentIdx = 0;
                    bs.priority = 0;
                    bs.tag = 'idle';
                    EventBus.emit('waypoint:completed', { entityId: id });
                    EventBus.emit('behavior:changed', { entityId: id, tag: 'idle', priority: 0 });
                }
                continue;
            }

            // Step toward target on the XZ plane.
            if (dist > 0) {
                const step = movement.speed * deltaTime;
                pos.x += (dx / dist) * step;
                pos.z += (dz / dist) * step;
                transform.mesh.rotation.y = Math.atan2(dx, dz);
            }
        }
    }
}
