/**
 * Component_Machine — Data for gearworks machines.
 *
 * Holds references to the visual machine mesh, input counters,
 * output position, and runtime state. Populated by EntityFactory
 * after mesh creation from the preset's userData exports.
 */
export class Component_Machine {
    constructor({
        machineMesh = null,
        inputCounters = [],
        outputLocalCenter = null,
        outputDisplayGroup = null,
        outputStackCount = 0
    } = {}) {
        this.machineMesh = machineMesh;
        this.inputCounters = inputCounters;
        this.outputLocalCenter = outputLocalCenter;
        this.outputDisplayGroup = outputDisplayGroup;
        this.outputStackCount = outputStackCount;
    }
}
