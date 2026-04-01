/**
 * SpawnAnim — One-shot animation played when an entity is first created.
 * type: 'bounce' (scale up from 0 with overshoot) or 'pop' (quick scale pulse).
 * duration: total animation time in seconds.
 */
export class Component_SpawnAnim {
    constructor({ type = 'bounce', duration = 0.4 } = {}) {
        this.type = type;
        this.duration = duration;
        // Runtime
        this.elapsed = 0;
        this.done = false;
    }
}
