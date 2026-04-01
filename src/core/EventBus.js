/**
 * EventBus — Lightweight pub/sub singleton.
 * Systems emit events and listen to events. They never call each other directly.
 *
 * Usage:
 *   EventBus.on('entity:died', ({ entityId, position, drops }) => { ... });
 *   EventBus.emit('entity:died', { entityId: 42, position: pos, drops: ['meat'] });
 *   EventBus.off('entity:died', handler);
 */
const EventBus = {
    _listeners: new Map(),

    on(event, handler) {
        if (!this._listeners.has(event)) this._listeners.set(event, new Set());
        this._listeners.get(event).add(handler);
    },

    off(event, handler) {
        if (this._listeners.has(event)) this._listeners.get(event).delete(handler);
    },

    emit(event, payload) {
        if (!this._listeners.has(event)) return;
        for (const handler of this._listeners.get(event)) {
            handler(payload);
        }
    },

    /** Remove all listeners — call between game resets. */
    clear() {
        this._listeners.clear();
    }
};

export default EventBus;
