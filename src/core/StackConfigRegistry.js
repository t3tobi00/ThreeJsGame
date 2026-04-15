/**
 * StackConfigRegistry — Singleton holding the per-resource stack metadata
 * loaded from src/config/stackConfig.json at boot.
 *
 * Centralizes the values that control how resources pile on an entity:
 *   - stackScale:  uniform mesh scale applied when the item enters any stack
 *   - stackOffset: vertical gap between items in a single column
 *
 * Every caller that adds to an InventoryStack routes through
 * Component_InventoryStack.addToSlot, which in turn consults this registry
 * — so the gearworks machine output, the player's back-stack, a villager's
 * arms, a market-stall counter, and a coin tray all use the same numbers
 * and there is one place to tune them.
 *
 * API:
 *   await StackConfigRegistry.load();       // once, from main.js
 *   const cfg = StackConfigRegistry.get(type);
 *   // → { stackScale: number, stackOffset: number }
 */

const DEFAULT = Object.freeze({ stackScale: 1, stackOffset: 0.22 });
let _cfg = {};

const StackConfigRegistry = {
    async load(path = './src/config/stackConfig.json') {
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            _cfg = json.resources || {};
        } catch (e) {
            console.warn('StackConfigRegistry: load failed, using defaults', e);
            _cfg = {};
        }
    },

    get(type) {
        return _cfg[type] || DEFAULT;
    },

    types() {
        return Object.keys(_cfg);
    }
};

export default StackConfigRegistry;
