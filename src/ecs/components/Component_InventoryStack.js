import { ResourceStack } from '../../utils/ResourceStack.js';
import StackConfigRegistry from '../../core/StackConfigRegistry.js';

/**
 * Component_InventoryStack — Multi-slot inventory with per-type stacking.
 *
 * Each slot holds one resource type with its own ResourceStack.
 * Slots are created on demand when a new resource type is added.
 *
 * Single-slot entities (tables, trays) use maxSlots=1.
 * Multi-slot entities (player) use maxSlots=3 with side-by-side visuals.
 */
export class Component_InventoryStack {
    constructor({
        maxSlots = 1,
        slotCapacity,
        maxCapacity,          // legacy alias for slotCapacity
        acceptsTypes = null,  // null = accept all, array = specific types
        anchorOffset = { x: 0, y: 1, z: 0 },
        slotSpacing = 0.45,
        style = 'wobble'
    } = {}) {
        this.maxSlots = maxSlots;
        this.slotCapacity = slotCapacity ?? maxCapacity ?? 30;
        this.acceptsTypes = acceptsTypes;
        this.anchorOffset = anchorOffset;
        this.slotSpacing = slotSpacing;
        this.style = style;

        this._stackConfig = {
            stackOffset: style === 'wobble' ? 0.22 : 0.12,
            stiffness: style === 'wobble' ? 0.6 : 0.85,
            lerpFactor: 0.35,
            maxSize: this.slotCapacity
        };

        /** @type {{ type: string, stack: ResourceStack }[]} */
        this.slots = [];
    }

    /**
     * Get or create a slot's ResourceStack for a resource type.
     * Returns null if no room for a new slot or type not accepted.
     */
    getSlot(resourceType) {
        const existing = this.slots.find(s => s.type === resourceType);
        if (existing) return existing.stack;

        // Check if we can create a new slot
        if (this.slots.length >= this.maxSlots) return null;
        if (this.acceptsTypes && !this.acceptsTypes.includes(resourceType)
            && !this.acceptsTypes.includes('any')) return null;

        const stack = new ResourceStack({ ...this._stackConfig });
        this.slots.push({ type: resourceType, stack });
        return stack;
    }

    /** Check if this inventory can accept one more of the given type. */
    canAccept(resourceType) {
        if (this.acceptsTypes && !this.acceptsTypes.includes(resourceType)
            && !this.acceptsTypes.includes('any')) return false;

        const existing = this.slots.find(s => s.type === resourceType);
        if (existing) return existing.stack.getCount() < this.slotCapacity;

        return this.slots.length < this.maxSlots;
    }

    /**
     * Add a mesh to the correct slot. Returns true if added.
     *
     * Applies the per-resource stack config from StackConfigRegistry so the
     * mesh lands at the correct uniform scale and the slot's vertical
     * offset matches the resource's tunable — regardless of which caller
     * invoked this method (StackSystem on 'item:collected', DepositorSystem
     * drain, TraderSystem/StallSystem payouts, BuildSystem resource
     * transfer, etc.). One place to tune how any resource stacks.
     */
    addToSlot(resourceType, mesh, options = {}) {
        const stack = this.getSlot(resourceType);
        if (!stack) return false;

        const cfg = StackConfigRegistry.get(resourceType);
        if (cfg.stackScale) {
            mesh.userData.stackScale = cfg.stackScale;
            mesh.scale.setScalar(cfg.stackScale);
        }
        if (cfg.stackOffset) {
            stack.stackOffset = cfg.stackOffset;
        }

        return stack.add(mesh, options);
    }

    /** Pop one item from a specific resource type slot. */
    popFromSlot(resourceType) {
        const slotIndex = this.slots.findIndex(s => s.type === resourceType);
        if (slotIndex === -1) return null;
        const slot = this.slots[slotIndex];
        if (slot.stack.getCount() === 0) return null;

        const mesh = slot.stack.pop();
        // Free up empty slots
        if (slot.stack.getCount() === 0) {
            this.slots.splice(slotIndex, 1);
        }
        return mesh;
    }

    /** Pop one item from any slot (last non-empty slot first). */
    popAny() {
        for (let i = this.slots.length - 1; i >= 0; i--) {
            if (this.slots[i].stack.getCount() > 0) {
                const mesh = this.slots[i].stack.pop();
                if (this.slots[i].stack.getCount() === 0) {
                    this.slots.splice(i, 1);
                }
                return mesh;
            }
        }
        return null;
    }

    /** Total items across all slots. */
    getTotalCount() {
        return this.slots.reduce((sum, s) => sum + s.stack.getCount(), 0);
    }

    /** Count for a specific resource type. */
    getCountByType(type) {
        const slot = this.slots.find(s => s.type === type);
        return slot ? slot.stack.getCount() : 0;
    }

    /** Find which slot types have items. Returns array of { type, count }. */
    getSlotSummary() {
        return this.slots.map(s => ({ type: s.type, count: s.stack.getCount() }));
    }

    /**
     * Legacy compatibility: returns the first slot's ResourceStack.
     * For single-slot entities (tables, trays), this works like before.
     * Creates a default 'any' slot if no slots exist yet.
     */
    get stack() {
        if (this.slots.length === 0) {
            // Create a default slot so legacy code that does stack.add() still works
            const type = (this.acceptsTypes && this.acceptsTypes[0]) || 'any';
            return this.getSlot(type);
        }
        return this.slots[0].stack;
    }
}
