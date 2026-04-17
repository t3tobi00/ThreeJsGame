/**
 * Player Editor — dev tool for editing src/config/archetypes/player.json.
 *
 * Loads the live player archetype + resources + skills, populates form
 * fields, and regenerates the full JSON on every edit. The output is
 * copy/paste — no server write, same model as the unlock-zone builder.
 */

const PLAYER_PATH    = '../../src/config/archetypes/player.json';
const RESOURCES_PATH = '../../src/config/resources.json';
const SKILLS_MANIFEST = '../../src/config/skills/_manifest.json';

const state = {
    original: null,   // pristine copy from disk — used by Reset
    current:  null,   // working copy that the form mutates
    resources: {},
    skills:   [],
};

// ─── Loading ─────────────────────────────────────────────────────────────────

async function loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return await res.json();
}

async function loadAll() {
    const [player, resources, skillsManifest] = await Promise.all([
        loadJSON(PLAYER_PATH),
        loadJSON(RESOURCES_PATH),
        loadJSON(SKILLS_MANIFEST),
    ]);
    state.original  = player;
    state.current   = deepClone(player);
    state.resources = resources;
    state.skills    = skillsManifest.skills || [];
}

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function $(id) { return document.getElementById(id); }

function getComp(name) {
    state.current.components = state.current.components || {};
    state.current.components[name] = state.current.components[name] || {};
    return state.current.components[name];
}

function num(id, fallback) {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : fallback;
}

function int(id, fallback) {
    const v = parseInt($(id).value, 10);
    return Number.isFinite(v) ? v : fallback;
}

function str(id) {
    return $(id).value.trim();
}

// ─── Populate UI from state.current ──────────────────────────────────────────

function populateForm() {
    const cur = state.current;

    // Identity & skill
    $('meshColor').value = (cur.mesh && cur.mesh.color) || '';
    populateSkills();
    const skillSel = $('activeSkill');
    if (cur.components && cur.components.SkillLoadout && cur.components.SkillLoadout.activeSkill) {
        skillSel.value = cur.components.SkillLoadout.activeSkill;
    }

    // Movement
    const mov = (cur.components && cur.components.Movement) || {};
    $('movSpeed').value = mov.speed ?? '';

    // Health
    const hp = (cur.components && cur.components.Health) || {};
    $('hp').value    = hp.hp    ?? '';
    $('maxHp').value = hp.maxHp ?? '';
    $('armor').value = hp.armor ?? '';

    // Stack
    const stk = (cur.components && cur.components.InventoryStack) || {};
    $('stackMaxSlots').value     = stk.maxSlots     ?? '';
    $('stackSlotCapacity').value = stk.slotCapacity ?? '';
    $('stackSlotSpacing').value  = stk.slotSpacing  ?? '';
    const ao = stk.anchorOffset || {};
    $('anchorX').value = ao.x ?? '';
    $('anchorY').value = ao.y ?? '';
    $('anchorZ').value = ao.z ?? '';
    $('stackStyle').value = stk.style || 'wobble';

    // Collector
    const col = (cur.components && cur.components.Collector) || {};
    $('collectorRadius').value     = col.radius     ?? '';
    $('collectorPullForce').value  = col.pullForce  ?? '';
    $('collectorPickupRate').value = col.pickupRate ?? '';
    $('collectFromTags').value = (col.collectFromTags || []).join(', ');
    populateResourceChecks(col.resourceTypes || []);

    // Depositor
    const dep = (cur.components && cur.components.Depositor) || {};
    $('depRange').value        = dep.range        ?? '';
    $('depTargetTag').value    = dep.targetTag    ?? '';
    $('depTransferRate').value = dep.transferRate ?? '';

    // Animation
    const fly = (cur.components && cur.components.FlyToAnim) || {};
    $('flyArcHeight').value = fly.arcHeight ?? '';
    $('flySpeed').value     = fly.speed     ?? '';
    $('flyEasing').value    = fly.easing    ?? '';

    const spr = (cur.components && cur.components.SpringStackAnim) || {};
    $('springWobble').value = spr.wobble ?? '';
    $('springSquash').value = spr.squash ?? '';
    $('springLag').value    = spr.lag    ?? '';

    const ss = (cur.components && cur.components.SquashStretch) || {};
    $('ssIntensity').value = ss.intensity ?? '';
    $('ssFrequency').value = ss.frequency ?? '';
    $('ssTrigger').value   = ss.trigger   ?? '';

    const wlk = (cur.components && cur.components.WalkAnim) || {};
    $('walkBobHeight').value = wlk.bobHeight ?? '';
    $('walkBobFreq').value   = wlk.bobFreq   ?? '';
    $('walkTiltAngle').value = wlk.tiltAngle ?? '';

    const fla = (cur.components && cur.components.FlashAnim) || {};
    $('flashColor').value    = fla.color    ?? '';
    $('flashDuration').value = fla.duration ?? '';

    // Collider
    const cld = (cur.components && cur.components.Collider) || {};
    $('colliderShape').value  = cld.shape  || 'circle';
    $('colliderRadius').value = cld.radius ?? '';
    $('colliderStatic').value = String(!!cld.isStatic);
}

function populateSkills() {
    const sel = $('activeSkill');
    sel.innerHTML = '';
    for (const name of state.skills) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
    }
}

function populateResourceChecks(active) {
    const wrap = $('resourceChecks');
    wrap.innerHTML = '';
    const names = Object.keys(state.resources).sort();
    const activeSet = new Set(active);
    for (const name of names) {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = name;
        cb.checked = activeSet.has(name);
        cb.addEventListener('change', commitFromForm);
        const span = document.createElement('span');
        span.textContent = `${state.resources[name].emoji || ''} ${name}`.trim();
        label.appendChild(cb);
        label.appendChild(span);
        wrap.appendChild(label);
    }
}

// ─── Commit form → state.current ─────────────────────────────────────────────

function commitFromForm() {
    const cur = state.current;

    // Identity
    cur.mesh = cur.mesh || {};
    if (str('meshColor')) cur.mesh.color = str('meshColor');

    // Skill
    const skill = $('activeSkill').value;
    if (skill) getComp('SkillLoadout').activeSkill = skill;

    // Movement
    const mov = getComp('Movement');
    const movSpeed = num('movSpeed');
    if (movSpeed !== undefined) mov.speed = movSpeed;

    // Health
    const hp = getComp('Health');
    if ($('hp').value    !== '') hp.hp    = num('hp');
    if ($('maxHp').value !== '') hp.maxHp = num('maxHp');
    if ($('armor').value !== '') hp.armor = num('armor');

    // Stack
    const stk = getComp('InventoryStack');
    if ($('stackMaxSlots').value     !== '') stk.maxSlots     = int('stackMaxSlots');
    if ($('stackSlotCapacity').value !== '') stk.slotCapacity = int('stackSlotCapacity');
    if ($('stackSlotSpacing').value  !== '') stk.slotSpacing  = num('stackSlotSpacing');
    stk.anchorOffset = stk.anchorOffset || {};
    if ($('anchorX').value !== '') stk.anchorOffset.x = num('anchorX');
    if ($('anchorY').value !== '') stk.anchorOffset.y = num('anchorY');
    if ($('anchorZ').value !== '') stk.anchorOffset.z = num('anchorZ');
    stk.style = $('stackStyle').value;

    // Collector
    const col = getComp('Collector');
    if ($('collectorRadius').value     !== '') col.radius     = num('collectorRadius');
    if ($('collectorPullForce').value  !== '') col.pullForce  = num('collectorPullForce');
    if ($('collectorPickupRate').value !== '') col.pickupRate = num('collectorPickupRate');
    col.resourceTypes = Array.from(
        $('resourceChecks').querySelectorAll('input[type=checkbox]:checked')
    ).map(cb => cb.value);
    const tagsRaw = str('collectFromTags');
    col.collectFromTags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Depositor
    const dep = getComp('Depositor');
    if ($('depRange').value        !== '') dep.range        = num('depRange');
    if (str('depTargetTag'))               dep.targetTag    = str('depTargetTag');
    if ($('depTransferRate').value !== '') dep.transferRate = num('depTransferRate');

    // Animation
    const fly = getComp('FlyToAnim');
    if ($('flyArcHeight').value !== '') fly.arcHeight = num('flyArcHeight');
    if ($('flySpeed').value     !== '') fly.speed     = num('flySpeed');
    if (str('flyEasing'))               fly.easing    = str('flyEasing');

    const spr = getComp('SpringStackAnim');
    if ($('springWobble').value !== '') spr.wobble = num('springWobble');
    if ($('springSquash').value !== '') spr.squash = num('springSquash');
    if ($('springLag').value    !== '') spr.lag    = num('springLag');

    const ss = getComp('SquashStretch');
    if ($('ssIntensity').value !== '') ss.intensity = num('ssIntensity');
    if ($('ssFrequency').value !== '') ss.frequency = num('ssFrequency');
    if (str('ssTrigger'))              ss.trigger   = str('ssTrigger');

    const wlk = getComp('WalkAnim');
    if ($('walkBobHeight').value !== '') wlk.bobHeight = num('walkBobHeight');
    if ($('walkBobFreq').value   !== '') wlk.bobFreq   = num('walkBobFreq');
    if ($('walkTiltAngle').value !== '') wlk.tiltAngle = num('walkTiltAngle');

    const fla = getComp('FlashAnim');
    if (str('flashColor'))             fla.color    = str('flashColor');
    if ($('flashDuration').value !== '') fla.duration = num('flashDuration');

    // Collider
    const cld = getComp('Collider');
    cld.shape  = $('colliderShape').value;
    if ($('colliderRadius').value !== '') cld.radius = num('colliderRadius');
    cld.isStatic = $('colliderStatic').value === 'true';

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
        } catch (e) {
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
        'meshColor', 'activeSkill',
        'movSpeed',
        'hp', 'maxHp', 'armor',
        'stackMaxSlots', 'stackSlotCapacity', 'stackSlotSpacing',
        'anchorX', 'anchorY', 'anchorZ', 'stackStyle',
        'collectorRadius', 'collectorPullForce', 'collectorPickupRate',
        'collectFromTags',
        'depRange', 'depTargetTag', 'depTransferRate',
        'flyArcHeight', 'flySpeed', 'flyEasing',
        'springWobble', 'springSquash', 'springLag',
        'ssIntensity', 'ssFrequency', 'ssTrigger',
        'walkBobHeight', 'walkBobFreq', 'walkTiltAngle',
        'flashColor', 'flashDuration',
        'colliderShape', 'colliderRadius', 'colliderStatic',
    ];
    for (const id of ids) {
        const el = $(id);
        if (!el) continue;
        const ev = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(ev, commitFromForm);
    }
}

// ─── Group collapse/expand ───────────────────────────────────────────────────

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
