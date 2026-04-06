/**
 * Unlock Zone Builder — dev tool for generating unlock zone JSON.
 *
 * Loads archetypes and resources from the project's config files at runtime,
 * so new archetypes/resources appear automatically (after adding to _manifest.json).
 */

const ARCHETYPES_DIR = '../src/config/archetypes/';
const MANIFEST_PATH = ARCHETYPES_DIR + '_manifest.json';
const RESOURCES_PATH = '../src/config/resources.json';

const state = {
    archetypes: {},   // { name → full archetype JSON }
    resources: {},    // { name → resource definition }
};

// ─── Loading ─────────────────────────────────────────────────────────────────

async function loadManifest() {
    const res = await fetch(MANIFEST_PATH);
    if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
    return await res.json();
}

async function loadArchetypes() {
    const files = await loadManifest();
    for (const file of files) {
        const res = await fetch(ARCHETYPES_DIR + file);
        if (!res.ok) {
            console.warn(`Skipping ${file} — ${res.status}`);
            continue;
        }
        const data = await res.json();
        // Use filename without .json as the archetype name
        const name = file.replace(/\.json$/, '');
        state.archetypes[name] = data;
    }
}

async function loadResources() {
    const res = await fetch(RESOURCES_PATH);
    if (!res.ok) throw new Error(`Failed to load resources: ${res.status}`);
    state.resources = await res.json();
}

// ─── Form Setup ──────────────────────────────────────────────────────────────

function populateDropdowns() {
    const archetypeNames = Object.keys(state.archetypes).sort();
    const resourceNames = Object.keys(state.resources).sort();

    // Archetype dropdowns (builds, spawns)
    for (const id of ['buildsArchetype', 'spawnsArchetype']) {
        const sel = document.getElementById(id);
        sel.innerHTML = '';
        for (const name of archetypeNames) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            sel.appendChild(opt);
        }
    }

    // Output resource dropdown
    const outSel = document.getElementById('outputResource');
    outSel.innerHTML = '';
    for (const name of resourceNames) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        outSel.appendChild(opt);
    }

    // Default sensible values
    if (archetypeNames.includes('turret')) {
        document.getElementById('buildsArchetype').value = 'turret';
    }
    if (archetypeNames.includes('villager')) {
        document.getElementById('spawnsArchetype').value = 'villager';
    }
    if (resourceNames.includes('coin')) {
        document.getElementById('outputResource').value = 'coin';
    }
}

function createCostRow(resource = null, count = 1) {
    const row = document.createElement('div');
    row.className = 'cost-row';

    const resourceNames = Object.keys(state.resources).sort();

    const sel = document.createElement('select');
    sel.className = 'cost-resource';
    for (const name of resourceNames) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
    }
    if (resource && resourceNames.includes(resource)) sel.value = resource;

    const num = document.createElement('input');
    num.type = 'number';
    num.min = '1';
    num.value = count;
    num.className = 'cost-count';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn icon danger';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
        row.remove();
        updateJSON();
    });

    sel.addEventListener('change', updateJSON);
    num.addEventListener('input', updateJSON);

    row.appendChild(sel);
    row.appendChild(num);
    row.appendChild(removeBtn);
    return row;
}

function setupCostList() {
    const list = document.getElementById('costList');
    // Seed with one cost row: meat x10
    list.appendChild(createCostRow('meat', 10));

    document.getElementById('addCostBtn').addEventListener('click', () => {
        list.appendChild(createCostRow());
        updateJSON();
    });
}

// ─── Visibility Switching ────────────────────────────────────────────────────

function setupTypeSwitching() {
    const sections = {
        build: document.getElementById('buildSection'),
        spawner: document.getElementById('spawnerSection'),
        convert: document.getElementById('convertSection'),
    };

    document.querySelectorAll('input[name="type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            for (const [type, el] of Object.entries(sections)) {
                el.classList.toggle('hidden', radio.value !== type || !radio.checked);
            }
            updateJSON();
        });
    });
}

function setupOutputModeSwitching() {
    const tagField = document.getElementById('targetTagField');
    const cellField = document.getElementById('targetCellField');
    const carrierHint = document.getElementById('targetCarrierHint');

    document.querySelectorAll('input[name="outputMode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            tagField.classList.toggle('hidden', radio.value !== 'tag');
            cellField.classList.toggle('hidden', radio.value !== 'cell');
            carrierHint.classList.toggle('hidden', radio.value !== 'carrier');
            updateJSON();
        });
    });
}

// ─── JSON Building ───────────────────────────────────────────────────────────

function readCost() {
    const cost = {};
    document.querySelectorAll('#costList .cost-row').forEach(row => {
        const res = row.querySelector('.cost-resource').value;
        const n = parseInt(row.querySelector('.cost-count').value, 10);
        if (res && n > 0) cost[res] = n;
    });
    return cost;
}

function readCellPair(rowId, colId) {
    const r = document.getElementById(rowId).value.trim();
    const c = document.getElementById(colId).value.trim();
    if (r === '' || c === '') return null;
    return [parseInt(r, 10), parseInt(c, 10)];
}

function getSelectedType() {
    return document.querySelector('input[name="type"]:checked').value;
}

function getSelectedOutputMode() {
    return document.querySelector('input[name="outputMode"]:checked').value;
}

function buildZoneJSON() {
    const zone = {};

    // Position
    const cell = readCellPair('cellRow', 'cellCol');
    if (cell) zone.cell = cell;

    // Grid span
    const span = readCellPair('spanRows', 'spanCols');
    if (span) zone.gridSpan = span;

    // Type
    const type = getSelectedType();
    zone.type = type;

    // Cost
    const cost = readCost();
    if (Object.keys(cost).length > 0) zone.cost = cost;

    // Type-specific
    if (type === 'build') {
        zone.builds = document.getElementById('buildsArchetype').value;
        const buildsAt = readCellPair('buildsAtRow', 'buildsAtCol');
        if (buildsAt) zone.buildsAt = buildsAt;

    } else if (type === 'spawner') {
        zone.spawns = document.getElementById('spawnsArchetype').value;
        const n = parseInt(document.getElementById('spawnCount').value, 10);
        if (n > 1) zone.spawnCount = n;
        const spawnsAt = readCellPair('spawnsAtRow', 'spawnsAtCol');
        if (spawnsAt) zone.spawnsAt = spawnsAt;

    } else if (type === 'convert') {
        zone.output = document.getElementById('outputResource').value;
        const n = parseInt(document.getElementById('outputCount').value, 10);
        if (n !== 1) zone.outputCount = n;

        const mode = getSelectedOutputMode();
        if (mode === 'tag') {
            const tag = document.getElementById('targetTag').value.trim();
            zone.outputTarget = { tag: tag || 'tray' };
        } else if (mode === 'carrier') {
            zone.outputTarget = { carrier: true };
        } else if (mode === 'cell') {
            const targetCell = readCellPair('targetCellRow', 'targetCellCol');
            if (targetCell) zone.outputTarget = { cell: targetCell };
        }
    }

    return zone;
}

function updateJSON() {
    const zone = buildZoneJSON();
    const formatted = JSON.stringify(zone, null, 4);
    document.getElementById('jsonOutput').textContent = formatted;
}

// ─── Copy ────────────────────────────────────────────────────────────────────

function setupCopy() {
    document.getElementById('copyBtn').addEventListener('click', async () => {
        const text = document.getElementById('jsonOutput').textContent;
        try {
            await navigator.clipboard.writeText(text);
            const fb = document.getElementById('copyFeedback');
            fb.classList.add('show');
            setTimeout(() => fb.classList.remove('show'), 1500);
        } catch (e) {
            alert('Copy failed — please copy manually');
        }
    });
}

// ─── Form change listeners ───────────────────────────────────────────────────

function setupLiveUpdate() {
    const ids = [
        'cellRow', 'cellCol', 'spanRows', 'spanCols',
        'buildsArchetype', 'buildsAtRow', 'buildsAtCol',
        'spawnsArchetype', 'spawnCount', 'spawnsAtRow', 'spawnsAtCol',
        'outputResource', 'outputCount', 'targetTag',
        'targetCellRow', 'targetCellCol'
    ];
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateJSON);
    }
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
    try {
        await loadArchetypes();
        await loadResources();

        populateDropdowns();
        setupCostList();
        setupTypeSwitching();
        setupOutputModeSwitching();
        setupCopy();
        setupLiveUpdate();
        updateJSON();

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('main').classList.remove('hidden');
    } catch (e) {
        console.error(e);
        const errorEl = document.getElementById('error');
        errorEl.textContent = `Error: ${e.message}. Make sure you're running a local web server from the project root.`;
        errorEl.classList.remove('hidden');
        document.getElementById('loading').classList.add('hidden');
    }
}

init();
