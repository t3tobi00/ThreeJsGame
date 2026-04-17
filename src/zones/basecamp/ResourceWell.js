// ResourceWell — unlimited resource spawn point.
// Maintains a visible pool of ~N disks on the ground at a fixed position.
// When disks are collected, new ones spawn to refill back to N.
// Uses EventBus 'resource:spawn' to integrate with CollectorSystem.

import EventBus from '../../core/EventBus.js';

export class ResourceWell {
    /**
     * @param {string} resourceType - e.g. 'essence', 'essenceCandy'
     * @param {{x:number, z:number}} center - world position
     * @param {number} [maxVisible=10] - how many disks to keep on the ground
     * @param {number} [refillInterval=0.5] - seconds between refill checks
     * @param {number} [spread=1.2] - scatter radius around center
     */
    constructor(resourceType, center, { maxVisible = 10, refillInterval = 0.5, spread = 1.2 } = {}) {
        this.resourceType = resourceType;
        this.center = center;
        this.maxVisible = maxVisible;
        this.refillInterval = refillInterval;
        this.spread = spread;

        this._spawnedCount = 0;
        this._timer = 0;
    }

    /** Call once to do the initial fill. */
    init() {
        for (let i = 0; i < this.maxVisible; i++) {
            this._spawn();
        }
    }

    /** Call every frame from the game loop. */
    update(deltaTime, scene) {
        this._timer += deltaTime;
        if (this._timer < this.refillInterval) return;
        this._timer = 0;

        // Count how many disks of our type are still near our center
        const alive = this._countNearbyDisks(scene);
        const deficit = this.maxVisible - alive;
        for (let i = 0; i < deficit; i++) {
            this._spawn();
        }
    }

    _spawn() {
        const angle = Math.random() * Math.PI * 2;
        const r = this.spread * Math.sqrt(Math.random());
        const pos = {
            x: this.center.x + Math.cos(angle) * r,
            y: 0,
            z: this.center.z + Math.sin(angle) * r
        };
        EventBus.emit('resource:spawn', { position: pos, type: this.resourceType });
        this._spawnedCount++;
    }

    _countNearbyDisks(scene) {
        // Count visible children near our center that match our resource type.
        // CollectorSystem adds disks directly to the scene, so we scan scene children.
        let count = 0;
        const cx = this.center.x;
        const cz = this.center.z;
        const range = this.spread + 2; // generous range
        for (const child of scene.children) {
            if (child.collected || !child.visible) continue;
            if (child._resourceType !== this.resourceType) continue;
            const dx = child.position.x - cx;
            const dz = child.position.z - cz;
            if (dx * dx + dz * dz < range * range) {
                count++;
            }
        }
        return count;
    }
}
