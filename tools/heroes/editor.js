/**
 * Hero Editor — simplified dev tool for editing src/config/archetypes/hero.json.
 *
 * Intentionally minimal. Only exposes appearance, HP, spawn cost, and four
 * optional skill toggles (Movement, InventoryStack, Collector, WalkAnim).
 * Everything else stays as-is in the JSON. Output: one document, copy-paste
 * back over the file.
 */

const HERO_PATH = '../../src/config/archetypes/hero.json';

const state = {
    original: null,
    current: null,
};

const SKILL_DEFAULTS = {
    Movement: { speed: 3, controller: 'hero_ai', faction: 'ally' },
    InventoryStack: { maxSlots: 1, slotCapacity: 5, anchorOffset: { x: 0, y: 1.55, z: -0.4 }, slotSpacing: 1.2, style: 'wobble' },
    Collector: { radius: 5, resourceTypes: ['coin'], pullForce: 1, pickupRate: 0.25 },
    WalkAnim: { bobHeight: 0.08, bobFreq: 8, tiltAngle: 0.06 },
    HeroAI:   { guardRadius: 8, attackRange: 2.5, returnSpeed: 2 }
};

// Melee requires three components at once — toggle them as a bundle.
const MELEE_DEFAULTS = {
    SkillLoadout: { activeSkill: 'sword' },
    SkillState: {},
    Arms: {}
};

async function loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return await res.json();
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function $(id) { return document.getElementById(id); }

function hex(n) {
    const c = '#' + n.toString(16).padStart(6, '0');
    return c;
}

function parseHex(str) {
    const s = str.replace('#', '');
    return parseInt(s, 16);
}

function colorAsInt(raw) {
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
        if (raw.startsWith('0x')) return parseInt(raw, 16);
        if (raw.startsWith('#')) return parseInt(raw.slice(1), 16);
        return parseInt(raw, 16);
    }
    return 0xffd700;
}

function ensureComponents() {
    state.current.components = state.current.components || {};
}

function populateForm() {
    const cur = state.current;

    const color = colorAsInt(cur.mesh && cur.mesh.color);
    $('color').value = hex(color);
    $('colorVal').textContent = hex(color);

    ensureComponents();
    const comps = cur.components;

    const health = comps.Health || { hp: 10, maxHp: 10, armor: 0 };
    $('hp').value = health.hp;
    $('hpVal').textContent = health.hp;
    $('armor').value = health.armor || 0;
    $('armorVal').textContent = health.armor || 0;

    const costCoin = (cur.spawn && cur.spawn.cost && cur.spawn.cost.coin) ?? 5;
    $('costCoin').value = costCoin;

    const togglePairs = [
        { key: 'HeroAI',         enableId: 'enableHeroAI',    fieldsId: 'heroAIFields' },
        { key: 'Movement',       enableId: 'enableMovement',  fieldsId: 'movementFields' },
        { key: 'InventoryStack', enableId: 'enableInventory', fieldsId: 'inventoryFields' },
        { key: 'Collector',      enableId: 'enableCollector', fieldsId: 'collectorFields' },
        { key: 'WalkAnim',       enableId: 'enableWalkAnim',  fieldsId: 'walkAnimFields' },
    ];

    for (const { key, enableId, fieldsId } of togglePairs) {
        const enabled = !!comps[key];
        $(enableId).checked = enabled;
        $(fieldsId).classList.toggle('hidden', !enabled);
    }

    $('enableMelee').checked = !!comps.SkillLoadout;

    const ai = comps.HeroAI || SKILL_DEFAULTS.HeroAI;
    $('guardRadius').value = ai.guardRadius ?? 8;
    $('guardRadiusVal').textContent = ai.guardRadius ?? 8;
    $('attackRange').value = ai.attackRange ?? 2.5;
    $('attackRangeVal').textContent = ai.attackRange ?? 2.5;
    $('returnSpeed').value = ai.returnSpeed ?? 2;
    $('returnSpeedVal').textContent = ai.returnSpeed ?? 2;

    const mov = comps.Movement || SKILL_DEFAULTS.Movement;
    $('moveSpeed').value = mov.speed ?? 3;
    $('moveSpeedVal').textContent = mov.speed ?? 3;

    const inv = comps.InventoryStack || SKILL_DEFAULTS.InventoryStack;
    $('invMaxSlots').value = inv.maxSlots ?? 1;
    $('invCap').value = inv.slotCapacity ?? 5;

    const coll = comps.Collector || SKILL_DEFAULTS.Collector;
    $('collRadius').value = coll.radius ?? 5;
    $('collRadiusVal').textContent = coll.radius ?? 5;

    const walk = comps.WalkAnim || SKILL_DEFAULTS.WalkAnim;
    $('bobHeight').value = walk.bobHeight ?? 0.08;
    $('bobHeightVal').textContent = walk.bobHeight ?? 0.08;
}

function commitFromForm() {
    const cur = state.current;

    const colorInt = parseHex($('color').value);
    cur.mesh = cur.mesh || {};
    cur.mesh.color = '0x' + colorInt.toString(16).padStart(6, '0');
    $('colorVal').textContent = hex(colorInt);

    ensureComponents();
    const comps = cur.components;

    const hp = parseInt($('hp').value, 10);
    comps.Health = comps.Health || {};
    comps.Health.hp = hp;
    comps.Health.maxHp = hp;
    comps.Health.armor = parseInt($('armor').value, 10) || 0;
    $('hpVal').textContent = hp;
    $('armorVal').textContent = comps.Health.armor;

    const costCoin = parseInt($('costCoin').value, 10);
    cur.spawn = cur.spawn || {};
    cur.spawn.cost = cur.spawn.cost || {};
    if (Number.isFinite(costCoin) && costCoin > 0) {
        cur.spawn.cost.coin = costCoin;
    } else {
        delete cur.spawn.cost.coin;
    }

    const togglePairs = [
        { key: 'HeroAI',         enableId: 'enableHeroAI',    fieldsId: 'heroAIFields',    read: readHeroAI },
        { key: 'Movement',       enableId: 'enableMovement',  fieldsId: 'movementFields',  read: readMovement },
        { key: 'InventoryStack', enableId: 'enableInventory', fieldsId: 'inventoryFields', read: readInventory },
        { key: 'Collector',      enableId: 'enableCollector', fieldsId: 'collectorFields', read: readCollector },
        { key: 'WalkAnim',       enableId: 'enableWalkAnim',  fieldsId: 'walkAnimFields',  read: readWalkAnim },
    ];

    for (const { key, enableId, fieldsId, read } of togglePairs) {
        const enabled = $(enableId).checked;
        $(fieldsId).classList.toggle('hidden', !enabled);
        if (enabled) {
            comps[key] = read(comps[key] || deepClone(SKILL_DEFAULTS[key]));
        } else {
            delete comps[key];
        }
    }

    // Melee = SkillLoadout + SkillState + Arms bundle.
    const meleeOn = $('enableMelee').checked;
    if (meleeOn) {
        for (const [k, v] of Object.entries(MELEE_DEFAULTS)) {
            comps[k] = comps[k] || deepClone(v);
        }
    } else {
        for (const k of Object.keys(MELEE_DEFAULTS)) delete comps[k];
    }

    renderJSON();
}

function readHeroAI(existing) {
    const guardRadius = parseFloat($('guardRadius').value);
    const attackRange = parseFloat($('attackRange').value);
    const returnSpeed = parseFloat($('returnSpeed').value);
    $('guardRadiusVal').textContent = guardRadius;
    $('attackRangeVal').textContent = attackRange;
    $('returnSpeedVal').textContent = returnSpeed;
    return { ...existing, guardRadius, attackRange, returnSpeed };
}

function readMovement(existing) {
    const speed = parseFloat($('moveSpeed').value);
    $('moveSpeedVal').textContent = speed;
    return { ...existing, speed };
}

function readInventory(existing) {
    const maxSlots = parseInt($('invMaxSlots').value, 10);
    const slotCapacity = parseInt($('invCap').value, 10);
    return { ...existing, maxSlots, slotCapacity };
}

function readCollector(existing) {
    const radius = parseFloat($('collRadius').value);
    $('collRadiusVal').textContent = radius;
    return { ...existing, radius };
}

function readWalkAnim(existing) {
    const bobHeight = parseFloat($('bobHeight').value);
    $('bobHeightVal').textContent = bobHeight;
    return { ...existing, bobHeight };
}

function renderJSON() {
    $('jsonOutput').textContent = JSON.stringify(state.current, null, 4);
}

function wireEvents() {
    const ids = [
        'color', 'hp', 'armor', 'costCoin',
        'enableHeroAI', 'guardRadius', 'attackRange', 'returnSpeed',
        'enableMelee',
        'enableMovement', 'moveSpeed',
        'enableInventory', 'invMaxSlots', 'invCap',
        'enableCollector', 'collRadius',
        'enableWalkAnim', 'bobHeight',
    ];
    for (const id of ids) {
        const el = $(id);
        for (const ev of ['input', 'change']) {
            el.addEventListener(ev, commitFromForm);
        }
    }

    $('copyBtn').addEventListener('click', async () => {
        const text = $('jsonOutput').textContent;
        try {
            await navigator.clipboard.writeText(text);
            const fb = $('copyFeedback');
            fb.classList.add('show');
            setTimeout(() => fb.classList.remove('show'), 1200);
        } catch (e) {
            alert('Copy failed — please copy manually');
        }
    });

    $('resetBtn').addEventListener('click', () => {
        state.current = deepClone(state.original);
        populateForm();
        renderJSON();
    });
}

(async function init() {
    try {
        const hero = await loadJSON(HERO_PATH);
        state.original = hero;
        state.current = deepClone(hero);

        $('loading').classList.add('hidden');
        $('editor').classList.remove('hidden');

        populateForm();
        wireEvents();
        renderJSON();
    } catch (e) {
        $('loading').classList.add('hidden');
        const errorEl = $('error');
        errorEl.classList.remove('hidden');
        errorEl.textContent = `Error: ${e.message}. Make sure you're running a local web server from the project root.`;
        console.error(e);
    }
})();
