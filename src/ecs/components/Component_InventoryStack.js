import { ResourceStack } from '../../utils/ResourceStack.js';

/**
 * Component_InventoryStack — Handles holding and stacking resources.
 */
export class Component_InventoryStack {
    /**
     * @param {Object} options
     * @param {string[]} [options.acceptsTypes=['any']] e.g. ['meat', 'coin']
     * @param {number} [options.maxCapacity=30]
     * @param {Object} [options.anchorOffset={x:0, y:1, z:0}] Offset relative to entity transform
     * @param {string} [options.style='wobble'] 'wobble', 'rigid'
     */
    constructor({
        acceptsTypes = ['any'],
        maxCapacity = 30,
        anchorOffset = { x: 0, y: 1, z: 0 },
        style = 'wobble'
    } = {}) {
        this.acceptsTypes = acceptsTypes;
        this.maxCapacity = maxCapacity;
        this.anchorOffset = anchorOffset;
        this.style = style;

        // The actual physics-stack utility
        this.stack = new ResourceStack({
            stackOffset: style === 'wobble' ? 0.22 : 0.12,
            stiffness: style === 'wobble' ? 0.6 : 0.85,
            lerpFactor: 0.35,
            maxSize: maxCapacity
        });
    }
}
