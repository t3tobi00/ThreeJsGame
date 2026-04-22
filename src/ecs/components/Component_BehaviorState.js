/**
 * Component_BehaviorState — Cooperative priority lock for entity behaviors.
 *
 * Any behavior system that wants to drive this entity writes its
 * `priority` and `tag` here. Lower-priority systems check and yield
 * when priority > their own.
 *
 * Conventions:
 *   0   idle
 *   5   walk-path (drag-to-waypoint)
 *   10  combat
 *   20+ cinematic / scripted
 *
 * This is deliberately tiny — there is no central scheduler. Each
 * behavior system self-manages its claim, keeping the system
 * character-agnostic and easy to extend.
 */
export class Component_BehaviorState {
    constructor({ priority = 0, tag = 'idle' } = {}) {
        this.priority = priority;
        this.tag = tag;
    }
}
