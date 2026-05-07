/**
 * Storage — Visible resource storage building.
 *
 * Replaces the invisible Component_Stockpile from PR #3.0. Each storage
 * holds a single resource type (wood OR essence OR future stone) and a
 * visible stack on top of the prop reflects the count.
 *
 * type:        'wood' | 'essence' | 'stone'
 * count:       current number of items stored
 * capacity:    max items (default 100 per arc redesign 2026-05-07)
 * visualMax:   how many items the visible stack actually renders (caps the
 *              stack height so storage with 100 items doesn't grow into a
 *              giant tower).
 *
 * Read by WorkerAISystem (deposit/withdraw) and StorageVisualSystem
 * (renders the stack mesh on top of the prop).
 */
export class Component_Storage {
    constructor({
        type = 'wood',
        count = 0,
        capacity = 100,
        visualMax = 24
    } = {}) {
        this.type = type;
        this.count = count;
        this.capacity = capacity;
        this.visualMax = visualMax;
        // Internal: tracks the # of items we actually rendered last frame so
        // StorageVisualSystem only re-builds the stack mesh when count changes.
        this._renderedCount = -1;
    }

    canAccept(type, n = 1) {
        return this.type === type && (this.count + n) <= this.capacity;
    }

    add(n = 1) {
        const allowed = Math.max(0, Math.min(n, this.capacity - this.count));
        this.count += allowed;
        return allowed;
    }

    take(n = 1) {
        const allowed = Math.max(0, Math.min(n, this.count));
        this.count -= allowed;
        return allowed;
    }
}
