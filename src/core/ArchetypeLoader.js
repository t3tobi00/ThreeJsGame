/**
 * ArchetypeLoader — Loads and merges JSON archetype definitions.
 *
 * Archetypes live in src/config/archetypes/*.json.
 * An archetype can extend another via "extends": "<name>".
 * Extending merges component configs, with the child overriding parent values.
 */

const ARCHETYPE_NAMES = [
    'player', 'hero', 'enemy', 'speeder', 'tank',
    'villager', 'turret', 'wall', 'meat-table', 'coin-tray',
    'unlock-turret', 'gate',
    'tree', 'rock',
    'gearworks-machine',
    'market-stall', 'market-coin-tray', 'customer',
    // ?prototype mode archetypes (newGameDesign/PROTOTYPE_PLAN.md).
    // Most are extends-based overrides of the legacy archetype to keep
    // legacy/diorama feel unchanged; scout + bruiser + sharpshooter are
    // full new units (the three soldier classes).
    'player-prototype', 'enemy-prototype', 'enemy-prototype-marcher', 'tree-prototype',
    'scout', 'bruiser', 'sharpshooter', 'unlock-turret-prototype', 'wall-segment',
    // Act 3 (PR #3.0) — Worker Pad anchor + placeholder fallback.
    // PR #3.1 adds the real worker archetypes (visual-only; AI in PR #3.2/#3.3).
    'worker-pad-active', 'worker-placeholder',
    'wood-worker', 'essence-collector', 'worker-builder',
    // Act 3 (PR #4.0) — storage redesign. Replaces invisible Stockpile
    // with visible storage props that show their contents stacked on top.
    // stone-storage added as scaffolding for the future stone economy.
    'wood-storage', 'essence-storage', 'stone-storage',
    // PR #4.2 — three worker-base buildings, each spawns its worker via OnSpawn.
    'wood-worker-base', 'essence-collector-base', 'builder-base',
    // PR #4.4 — military bases (mesh archetypes used by scout_pad / bruiser_pad).
    'green-military-base', 'red-military-base'
];

/** @type {Map<string, object>} name → resolved archetype */
const _cache = new Map();

/**
 * Load all archetypes. Call once at startup (await it).
 * After this, use getArchetype(name) synchronously.
 */
export async function loadArchetypes() {
    const raw = new Map();

    // Fetch all JSON files in parallel
    await Promise.all(ARCHETYPE_NAMES.map(async (name) => {
        const url = new URL(`../config/archetypes/${name}.json`, import.meta.url);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`ArchetypeLoader: failed to load ${name}.json (${res.status})`);
        raw.set(name, await res.json());
    }));

    // Resolve inheritance
    for (const name of ARCHETYPE_NAMES) {
        _cache.set(name, _resolve(name, raw));
    }

    console.log(`[ArchetypeLoader] Loaded ${_cache.size} archetypes:`, [..._cache.keys()]);
}

/**
 * Get a fully-resolved archetype by name (synchronous after loadArchetypes()).
 * @param {string} name e.g. 'player', 'enemy', 'speeder'
 * @returns {object} resolved archetype with merged components
 */
export function getArchetype(name) {
    const a = _cache.get(name);
    if (!a) throw new Error(`ArchetypeLoader: archetype '${name}' not found. Did you call loadArchetypes()?`);
    return a;
}

function _resolve(name, raw, visited = new Set()) {
    if (visited.has(name)) {
        throw new Error(`ArchetypeLoader: circular extends detected: ${[...visited, name].join(' → ')}`);
    }
    visited.add(name);

    const archetype = raw.get(name);
    if (!archetype) throw new Error(`ArchetypeLoader: '${name}' not in raw map`);

    if (!archetype.extends) return _deepClone(archetype);

    const parent = _resolve(archetype.extends, raw, visited);
    return {
        ...parent,
        ...archetype,
        extends: undefined,
        components: _mergeComponents(parent.components || {}, archetype.components || {})
    };
}

function _mergeComponents(parent, child) {
    const result = _deepClone(parent);
    for (const [compName, compData] of Object.entries(child)) {
        result[compName] = { ...(result[compName] || {}), ..._deepClone(compData) };
    }
    return result;
}

function _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
