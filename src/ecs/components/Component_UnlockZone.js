/**
 * Component_UnlockZone — Data for unlock zones that accept resources.
 *
 * type: 'build'   (one-time, spawns building + zone removed)
 *       'spawner'  (repeatable, spawns units + zone resets)
 *       'convert'  (repeatable, spawns output resources onto a tray + resets)
 */
export class Component_UnlockZone {
    constructor({
        type = 'build',
        cost = {},
        drainRate = 0.15,
        range = 3.0,
        builds = null,
        spawns = null,
        spawnCount = 1,
        output = null,
        outputTag = null,
        outputCount = 1
    } = {}) {
        this.type = type;
        this.cost = cost;
        this.drainRate = drainRate;
        this.range = range;
        this.builds = builds;
        this.spawns = spawns;
        this.spawnCount = spawnCount;
        this.output = output;         // resource type name for UI (e.g. 'coin')
        this.outputTag = outputTag;   // tag to find the output tray entity
        this.outputCount = outputCount; // how many resources to spawn per conversion

        // Runtime state
        this.progress = {};
        for (const key of Object.keys(cost)) {
            this.progress[key] = 0;
        }
        this.timeSinceLastDrain = 0;
    }
}
