/**
 * Enemy Editor — dev tool for editing src/config/archetypes/enemy.json.
 *
 * Single source of truth: enemy.json holds per-unit stats (mesh, components)
 * AND the global 'spawn' block (interval, point, jitter, cap, counts).
 * Output is one JSON document, copy-paste back over the file.
 */

const ENEMY_PATH = '../../src/config/archetypes/enemy.json';

const state = {
    original: null,
    current:  null,
};

// ─── Loading ─────────────────────────────────────────────────────────────────

async function loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return await res.json();
}

async function loadAll() {
    const enemy = await loadJSON(ENEMY_PATH);
    state.original = enemy;
    state.current  = deepClone(enemy);
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function $(id) { return document.getElementById(id); }

function getComp(name) {
    const cur = state.current;
    cur.components = cur.components || {};
    cur.components[name] = cur.components[name] || {};
    return cur.components[name];
}

function getSpawn() {
    state.current.spawn = state.current.spawn || {};
    state.current.spawn.point = state.current.spawn.point || {};
    return state.current.spawn;
}

function num(id) { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : undefined; }
function int(id) { const v = parseInt($(id).value, 10); return Number.isFinite(v) ? v : undefined; }
function str(id) { return $(id).value.trim(); }

// ─── Populate UI ─────────────────────────────────────────────────────────────

function populateForm() {
    const e = state.current;
    const s = e.spawn || {};
    const sp = s.point || {};

    // Spawn
    $('spawnMode').value      = s.mode || 'batch';
    $('spawnInterval').value  = s.interval        ?? '';
    $('spawnMaxAlive').value  = s.maxAlive        ?? '';
    $('spawnX').value         = sp.x              ?? '';
    $('spawnZ').value         = sp.z              ?? '';
    $('spawnJitter').value    = s.jitter          ?? '';
    $('spawnDespawn').value   = s.despawnDistance ?? '';
    $('spawnCountMin').value  = s.countMin        ?? '';
    $('spawnCountMax').value  = s.countMax        ?? '';

    // Identity
    $('meshColor').value = (e.mesh && e.mesh.color) || '';

    // Movement / Health
    const mov = e.components?.Movement || {};
    $('movSpeed').value = mov.speed ?? '';
    const hp = e.components?.Health || {};
    $('hp').value    = hp.hp    ?? '';
    $('maxHp').value = hp.maxHp ?? '';
    $('armor').value = hp.armor ?? '';

    // Contact Damage
    const cd = e.components?.ContactDamage || {};
    $('cdDamage').value   = cd.damage   ?? '';
    $('cdCooldown').value = cd.cooldown ?? '';
    $('cdRange').value    = cd.range    ?? '';

    // AI
    const ai = e.components?.EnemyAI || {};
    $('aiAggro').value          = ai.aggroRadius    ?? '';
    $('aiHerd').value           = ai.herdRadius     ?? '';
    $('aiWanderSpeed').value    = ai.wanderSpeed    ?? '';
    $('aiWanderRadius').value   = ai.wanderRadius   ?? '';
    $('aiWanderPauseMin').value = ai.wanderPauseMin ?? '';
    $('aiWanderPauseMax').value = ai.wanderPauseMax ?? '';

    // Animation
    const wlk = e.components?.WalkAnim || {};
    $('walkBobHeight').value = wlk.bobHeight ?? '';
    $('walkBobFreq').value   = wlk.bobFreq   ?? '';
    $('walkTiltAngle').value = wlk.tiltAngle ?? '';
    const fla = e.components?.FlashAnim || {};
    $('flashColor').value    = fla.color    ?? '';
    $('flashDuration').value = fla.duration ?? '';

    // Collider
    const cld = e.components?.Collider || {};
    $('colliderShape').value  = cld.shape  || 'circle';
    $('colliderRadius').value = cld.radius ?? '';
    $('colliderStatic').value = String(!!cld.isStatic);

    // Drops (single row)
    const drop0 = (e.components?.Drops?.table?.[0]) || {};
    $('dropType').value   = drop0.type   ?? '';
    $('dropChance').value = drop0.chance ?? '';
    $('dropMin').value    = drop0.min    ?? '';
    $('dropMax').value    = drop0.max    ?? '';
}

// ─── Commit form → state ─────────────────────────────────────────────────────

function commitFromForm() {
    const e = state.current;

    // Spawn
    const s = getSpawn();
    s.mode = $('spawnMode').value || 'batch';
    if ($('spawnInterval').value !== '') s.interval        = num('spawnInterval');
    if ($('spawnMaxAlive').value !== '') s.maxAlive        = int('spawnMaxAlive');
    if ($('spawnX').value        !== '') s.point.x         = num('spawnX');
    if ($('spawnZ').value        !== '') s.point.z         = num('spawnZ');
    if ($('spawnJitter').value   !== '') s.jitter          = num('spawnJitter');
    if ($('spawnDespawn').value  !== '') s.despawnDistance = num('spawnDespawn');
    if ($('spawnCountMin').value !== '') s.countMin        = int('spawnCountMin');
    if ($('spawnCountMax').value !== '') s.countMax        = int('spawnCountMax');

    // Identity
    e.mesh = e.mesh || {};
    if (str('meshColor')) e.mesh.color = str('meshColor');

    // Movement / Health
    const mov = getComp('Movement');
    if ($('movSpeed').value !== '') mov.speed = num('movSpeed');
    const hp = getComp('Health');
    if ($('hp').value    !== '') hp.hp    = num('hp');
    if ($('maxHp').value !== '') hp.maxHp = num('maxHp');
    if ($('armor').value !== '') hp.armor = num('armor');

    // Contact Damage
    const cd = getComp('ContactDamage');
    if ($('cdDamage').value   !== '') cd.damage   = num('cdDamage');
    if ($('cdCooldown').value !== '') cd.cooldown = num('cdCooldown');
    if ($('cdRange').value    !== '') cd.range    = num('cdRange');

    // AI
    const ai = getComp('EnemyAI');
    if ($('aiAggro').value          !== '') ai.aggroRadius    = num('aiAggro');
    if ($('aiHerd').value           !== '') ai.herdRadius     = num('aiHerd');
    if ($('aiWanderSpeed').value    !== '') ai.wanderSpeed    = num('aiWanderSpeed');
    if ($('aiWanderRadius').value   !== '') ai.wanderRadius   = num('aiWanderRadius');
    if ($('aiWanderPauseMin').value !== '') ai.wanderPauseMin = num('aiWanderPauseMin');
    if ($('aiWanderPauseMax').value !== '') ai.wanderPauseMax = num('aiWanderPauseMax');

    // Animation
    const wlk = getComp('WalkAnim');
    if ($('walkBobHeight').value !== '') wlk.bobHeight = num('walkBobHeight');
    if ($('walkBobFreq').value   !== '') wlk.bobFreq   = num('walkBobFreq');
    if ($('walkTiltAngle').value !== '') wlk.tiltAngle = num('walkTiltAngle');
    const fla = getComp('FlashAnim');
    if (str('flashColor'))               fla.color    = str('flashColor');
    if ($('flashDuration').value !== '') fla.duration = num('flashDuration');

    // Collider
    const cld = getComp('Collider');
    cld.shape  = $('colliderShape').value;
    if ($('colliderRadius').value !== '') cld.radius = num('colliderRadius');
    cld.isStatic = $('colliderStatic').value === 'true';

    // Drops (single row)
    const drops = getComp('Drops');
    drops.table = drops.table && drops.table.length ? drops.table : [{}];
    const d0 = drops.table[0];
    if (str('dropType'))              d0.type   = str('dropType');
    if ($('dropChance').value !== '') d0.chance = num('dropChance');
    if ($('dropMin').value    !== '') d0.min    = int('dropMin');
    if ($('dropMax').value    !== '') d0.max    = int('dropMax');

    renderJSON();
}

// ─── Output ──────────────────────────────────────────────────────────────────

function renderJSON() {
    $('jsonOutput').textContent = JSON.stringify(state.current, null, 2);
}

// ─── Copy / Reset ────────────────────────────────────────────────────────────

function setupCopy() {
    $('copyBtn').addEventListener('click', async () => {
        const text = $('jsonOutput').textContent;
        try {
            await navigator.clipboard.writeText(text);
            const fb = $('copyFeedback');
            fb.classList.add('show');
            setTimeout(() => fb.classList.remove('show'), 1500);
        } catch {
            alert('Copy failed — please copy manually');
        }
    });
}

function setupReset() {
    $('resetBtn').addEventListener('click', () => {
        state.current = deepClone(state.original);
        populateForm();
        renderJSON();
    });
}

// ─── Live update wiring ──────────────────────────────────────────────────────

function setupLiveUpdate() {
    const ids = [
        'spawnMode',
        'spawnInterval', 'spawnMaxAlive', 'spawnX', 'spawnZ', 'spawnJitter',
        'spawnDespawn', 'spawnCountMin', 'spawnCountMax',
        'meshColor',
        'movSpeed', 'hp', 'maxHp', 'armor',
        'cdDamage', 'cdCooldown', 'cdRange',
        'aiAggro', 'aiHerd', 'aiWanderSpeed', 'aiWanderRadius',
        'aiWanderPauseMin', 'aiWanderPauseMax',
        'walkBobHeight', 'walkBobFreq', 'walkTiltAngle',
        'flashColor', 'flashDuration',
        'colliderShape', 'colliderRadius', 'colliderStatic',
        'dropType', 'dropChance', 'dropMin', 'dropMax',
    ];
    for (const id of ids) {
        const el = $(id);
        if (!el) continue;
        const ev = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(ev, commitFromForm);
    }
}

function setupGroupToggles() {
    document.querySelectorAll('section.group > header').forEach(h => {
        h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed'));
    });
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
    try {
        await loadAll();
        populateForm();
        setupGroupToggles();
        setupLiveUpdate();
        setupCopy();
        setupReset();
        renderJSON();

        $('loading').classList.add('hidden');
        $('main').classList.remove('hidden');
    } catch (e) {
        console.error(e);
        const errorEl = $('error');
        errorEl.textContent = `Error: ${e.message}. Make sure you're running a local web server from the project root.`;
        errorEl.classList.remove('hidden');
        $('loading').classList.add('hidden');
    }
}

init();
