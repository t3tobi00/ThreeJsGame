import EventBus from '../core/EventBus.js';

/**
 * PrototypeStats — end-of-run counter aggregator for ?prototype mode.
 *
 * Subscribes to events from boot. All counters are publicly readable
 * for debug overlays; getSummary() returns the snapshot for the
 * Stats screen in PrototypeEndUI.
 *
 * Tracked:
 *   zombiesKilled    — entity:died filtered by Movement.faction === 'enemy'
 *   peakEssence      — max essence count seen on the player's stack
 *   peakWood         — max wood count seen on the player's stack
 *   startTime        — boot (replaced by first state:entered if available)
 *   endTime          — set by state:entered{id:END} or player:died
 *   killedRivalKing  — boss:killed → true
 *   survived         — false on player:died, otherwise true
 *
 * Setters required:
 *   setPlayer(id) — for stack:changed filter
 *   setECS(ecs)   — for entity:died faction lookup
 */
export class PrototypeStats {
    constructor() {
        this.zombiesKilled = 0;
        this.peakEssence = 0;
        this.peakWood = 0;
        this.startTime = performance.now();
        this.endTime = null;
        this.killedRivalKing = false;
        this.survived = true;

        this._playerId = null;
        this._ecs = null;
        this._wireEvents();
    }

    setPlayer(id) { this._playerId = id; }
    setECS(ecs)   { this._ecs = ecs; }

    /** Snapshot for end-of-run UI. */
    getSummary() {
        const end = this.endTime ?? performance.now();
        return {
            zombiesKilled: this.zombiesKilled,
            peakEssence: this.peakEssence,
            peakWood: this.peakWood,
            timeSec: Math.round((end - this.startTime) / 1000),
            killedRivalKing: this.killedRivalKing,
            survived: this.survived
        };
    }

    _wireEvents() {
        EventBus.on('entity:died', ({ entityId }) => {
            if (!this._ecs) return;
            const movement = this._ecs.getComponent(entityId, 'Movement');
            if (movement?.faction === 'enemy') this.zombiesKilled++;
        });

        EventBus.on('stack:changed', ({ entityId, type, count }) => {
            if (entityId !== this._playerId) return;
            if (type === 'essence' && count > this.peakEssence) this.peakEssence = count;
            if (type === 'wood'    && count > this.peakWood)    this.peakWood = count;
        });

        EventBus.on('state:entered', ({ id }) => {
            if (id === 'END') this.endTime = performance.now();
        });

        EventBus.on('boss:killed', () => { this.killedRivalKing = true; });

        EventBus.on('player:died', () => {
            this.survived = false;
            if (!this.endTime) this.endTime = performance.now();
        });
    }
}

export default PrototypeStats;
