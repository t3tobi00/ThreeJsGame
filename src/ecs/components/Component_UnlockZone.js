/**
 * Component_UnlockZone — Data for unlock zones that accept resources.
 *
 * type: 'build' (one-time, spawns building + zone removed)
 *       'spawner' (repeatable, spawns units + zone resets)
 */
export class Component_UnlockZone {
    constructor({
        type = 'build',
        cost = {},
        drainRate = 0.15,
        range = 3.0,
        builds = null,
        spawns = null,
        spawnCount = 1
    } = {}) {
        this.type = type;
        this.cost = cost;
        this.drainRate = drainRate;
        this.range = range;
        this.builds = builds;
        this.spawns = spawns;
        this.spawnCount = spawnCount;

        // Runtime state
        this.progress = {};
        for (const key of Object.keys(cost)) {
            this.progress[key] = 0;
        }
        this.timeSinceLastDrain = 0;
    }
}
