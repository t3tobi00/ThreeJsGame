/**
 * Drops — Configurable loot table for entity death.
 *
 * table: Array of { type, chance, min, max }
 *   type: resource type string (matches resources.json keys)
 *   chance: 0-1 probability of this drop occurring (default 1.0)
 *   min: minimum disk count when drop triggers (default 2)
 *   max: maximum disk count when drop triggers (default 4)
 */
export class Component_Drops {
    constructor({ table = [] } = {}) {
        this.table = table.map(entry => ({
            type: entry.type || 'meat',
            chance: entry.chance ?? 1.0,
            min: entry.min ?? 2,
            max: entry.max ?? 4
        }));
    }

    /**
     * Roll the drop table and return an array of { type, count } results.
     * Each entry in the table is rolled independently.
     */
    roll() {
        const results = [];
        for (const entry of this.table) {
            if (Math.random() <= entry.chance) {
                const count = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
                results.push({ type: entry.type, count });
            }
        }
        return results;
    }
}
