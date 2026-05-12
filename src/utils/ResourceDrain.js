import EventBus from '../core/EventBus.js';

/**
 * ResourceDrain — shared drain rules for the player's spendable resources.
 *
 * Used by both:
 *   • SpawnMenuSystem  (ARMY / WORK spawns + BUILD ▸ storage placement)
 *   • DrawWallSystem   (per-log wood cost on commit)
 *
 * Drain order is canonical and applies everywhere:
 *   1. Storage entities tagged 'wood-storage' / 'essence-storage' (in scene order)
 *   2. Player's back-stack (`playerId`'s InventoryStack)
 *
 * Pure functions — no instance state. Pass `ecs` + `playerId` per call.
 */

const STORAGE_TAG_BY_TYPE = {
    wood:    'wood-storage',
    essence: 'essence-storage'
};

/**
 * Sum of player back-stack + all matching storage props for `wood` and
 * `essence`. Returns a fresh object every call.
 */
export function computeTotals(ecs, playerId) {
    const totals = { wood: 0, essence: 0 };

    if (playerId != null) {
        const inv = ecs.getComponent(playerId, 'InventoryStack');
        if (inv) {
            totals.wood    += inv.getCountByType('wood')    || 0;
            totals.essence += inv.getCountByType('essence') || 0;
        }
    }

    for (const id of ecs.queryEntities(['Tag', 'InventoryStack'])) {
        const tag = ecs.getComponent(id, 'Tag');
        const inv = ecs.getComponent(id, 'InventoryStack');
        if (!tag || !inv) continue;
        if (tag.has?.('wood-storage'))    totals.wood    += inv.getCountByType('wood')    || 0;
        if (tag.has?.('essence-storage')) totals.essence += inv.getCountByType('essence') || 0;
    }

    return totals;
}

/**
 * Drain up to `amount` of `type` from storages first, player back second.
 * Returns the number actually drained (may be less if totals fall short).
 */
export function drainResource(ecs, playerId, type, amount) {
    let remaining = amount;

    for (const sid of _findStorageEntities(ecs, type)) {
        if (remaining <= 0) break;
        remaining -= _popN(ecs, sid, type, remaining);
    }

    if (remaining > 0 && playerId != null) {
        remaining -= _popN(ecs, playerId, type, remaining);
    }

    return amount - remaining;
}

/**
 * All-or-nothing drain for a multi-resource cost. Verifies affordability
 * first; only mutates if the cost can be fully covered.
 * @returns {boolean} true if drained, false if unaffordable
 */
export function drainCost(ecs, playerId, cost) {
    const totals = computeTotals(ecs, playerId);
    for (const [type, needed] of Object.entries(cost)) {
        if ((totals[type] || 0) < needed) return false;
    }
    for (const [type, needed] of Object.entries(cost)) {
        drainResource(ecs, playerId, type, needed);
    }
    return true;
}

// ─── internals ───────────────────────────────────────────────────────────────

function _findStorageEntities(ecs, resourceType) {
    const wantTag = STORAGE_TAG_BY_TYPE[resourceType];
    if (!wantTag) return [];
    const ids = ecs.queryEntities(['Tag', 'InventoryStack']);
    return ids.filter(id => {
        const tag = ecs.getComponent(id, 'Tag');
        return tag?.has?.(wantTag);
    });
}

/**
 * Pop up to `count` items of `type` from `entityId`'s InventoryStack. The
 * popped meshes are detached + disposed (no flight VFX — drain is in-place).
 * Emits a single `stack:changed` so HUD / menu observers refresh.
 * @returns {number} actually popped
 */
function _popN(ecs, entityId, type, count) {
    const inv = ecs.getComponent(entityId, 'InventoryStack');
    if (!inv) return 0;
    let popped = 0;
    while (popped < count) {
        const mesh = inv.popFromSlot(type);
        if (!mesh) break;
        popped++;
        mesh.parent?.remove(mesh);
        mesh.geometry?.dispose?.();
        mesh.material?.dispose?.();
    }
    if (popped > 0) {
        EventBus.emit('stack:changed', {
            entityId,
            type,
            count: inv.getCountByType(type),
            totalCount: inv.getTotalCount()
        });
    }
    return popped;
}
