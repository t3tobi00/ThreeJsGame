/**
 * Stockpile — Shared resource pool attached to a building anchor.
 *
 * Used by Worker Pad: Wood-Worker / Essence-Collector deposit here,
 * Builder withdraws to deliver to active ghost zones. No cap.
 *
 * Counts are integers. Workers add via increment(type, n) and pull via
 * tryWithdraw(type, n). PR #3.0 wires the data; PR #3.3 adds drain visuals.
 */
export class Component_Stockpile {
    constructor({ wood = 0, essence = 0 } = {}) {
        this.wood = wood;
        this.essence = essence;
    }

    increment(type, n = 1) {
        if (type === 'wood' || type === 'essence') {
            this[type] += n;
        }
    }

    tryWithdraw(type, n = 1) {
        if ((type === 'wood' || type === 'essence') && this[type] >= n) {
            this[type] -= n;
            return true;
        }
        return false;
    }
}
