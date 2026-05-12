/**
 * BalanceLoader — loads src/config/balance.json and resolves `$balance.X.Y.Z`
 * placeholders inside any data structure (typically archetype JSON).
 *
 * The Excel-style intent: balance.json is the master sheet. Archetypes write
 * `"hp": "$balance.combat.zombie.HP"` instead of literal numbers. At boot,
 * BalanceLoader.load() fetches the sheet; resolvePlaceholders() walks any
 * object/array tree and substitutes real numbers in place. Tuning is then a
 * single-file edit (master inputs at top → re-derive numbers in the same
 * file) and every consumer picks up the new values on next reload.
 *
 * Usage:
 *   await BalanceLoader.load();
 *   ArchetypeLoader, EnemySystem, etc. read via:
 *     BalanceLoader.get('combat.zombie.HP')   // → 30
 *     BalanceLoader.resolvePlaceholders(obj)  // mutates obj in place
 */

let _balance = null;

async function load() {
    if (_balance) return _balance;
    const url = new URL('../config/balance.json', import.meta.url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`BalanceLoader: failed to load balance.json (${res.status})`);
    _balance = await res.json();
    return _balance;
}

function get(path) {
    if (!_balance) throw new Error('BalanceLoader.get: call load() first.');
    return _getByPath(_balance, path);
}

function getAll() {
    if (!_balance) throw new Error('BalanceLoader.getAll: call load() first.');
    return _balance;
}

/**
 * Walk an arbitrary value (object/array/primitive). Any string of the form
 * `$balance.foo.bar.baz` is replaced with the resolved number. Objects are
 * mutated in place; arrays too. Strings inside _doc / _* keys are NOT walked
 * (so doc-comments can mention placeholders without being substituted).
 */
function resolvePlaceholders(value) {
    if (!_balance) throw new Error('BalanceLoader.resolvePlaceholders: call load() first.');
    return _walk(value);
}

function _walk(value) {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) value[i] = _walk(value[i]);
        return value;
    }
    if (value && typeof value === 'object') {
        for (const k of Object.keys(value)) {
            // Skip doc / underscore-prefixed keys so they can mention
            // `$balance.foo` in prose without triggering substitution.
            if (k.startsWith('_')) continue;
            value[k] = _walk(value[k]);
        }
        return value;
    }
    if (typeof value === 'string' && value.startsWith('$balance.')) {
        const path = value.slice('$balance.'.length);
        const resolved = _getByPath(_balance, path);
        if (resolved === undefined) {
            throw new Error(`BalanceLoader: unknown placeholder '${value}'`);
        }
        return resolved;
    }
    return value;
}

function _getByPath(root, path) {
    let cur = root;
    for (const part of path.split('.')) {
        if (cur == null) return undefined;
        cur = cur[part];
    }
    return cur;
}

export default { load, get, getAll, resolvePlaceholders };
