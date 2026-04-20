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
    'market-stall', 'market-coin-tray', 'customer'
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
