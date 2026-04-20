/**
 * Component_Machine — Data for gearworks machines.
 *
 * Holds references to the visual machine mesh, input counters, output
 * position, and the full drain/convert config + runtime progress. The
 * mesh-wiring fields (machineMesh, inputCounters, outputLocalCenter,
 * outputDisplayGroup) are populated by EntityFactory after mesh creation
 * from the preset's userData exports.
 */
export class Component_Machine {
    constructor({
        machineMesh = null,
        inputCounters = [],
        outputLocalCenter = null,
        outputDisplayGroup = null,
        outputStackCount = 0,

        cost = {},
        drainRate = 0.15,
        range = 3.5,
        output = null,
        outputCount = 1
    } = {}) {
        this.machineMesh = machineMesh;
        this.inputCounters = inputCounters;
        this.outputLocalCenter = outputLocalCenter;
        this.outputDisplayGroup = outputDisplayGroup;
        this.outputStackCount = outputStackCount;

        this.cost = cost;
        this.drainRate = drainRate;
        this.range = range;
        this.output = output;
        this.outputCount = outputCount;

        this.progress = {};
        for (const key of Object.keys(cost)) {
            this.progress[key] = 0;
        }
        this.timeSinceLastDrain = 0;
    }
}
