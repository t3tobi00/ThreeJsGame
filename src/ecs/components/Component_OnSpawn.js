/**
 * OnSpawn — One-shot multi-spawn helper.
 *
 * Attached to an anchor entity (e.g. worker-pad-active). On the first frame
 * after creation, OnSpawnSystem reads `children`, calls factory.create for
 * each at `anchorPos + offset`, then removes the component (one-shot).
 *
 * children: [{ archetype: 'wood-worker', offset: [1, 0, 0] }, ...]
 */
export class Component_OnSpawn {
    constructor({ children = [] } = {}) {
        this.children = children;
    }
}
