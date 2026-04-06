/**
 * SkillRegistry — Loads and caches skill + projectile JSON definitions.
 *
 * Skills live in src/config/skills/*.json and are listed in _manifest.json.
 * Projectiles live in src/config/projectiles/*.json and are listed in _manifest.json.
 *
 * Usage:
 *   await SkillRegistry.load();          // once at startup
 *   const skill = SkillRegistry.getSkill('pistol');
 *   const proj  = SkillRegistry.getProjectile('bullet');
 *
 * Mirrors the ArchetypeLoader + ResourceRegistry patterns used elsewhere.
 */

const _skills = new Map();
const _projectiles = new Map();
let _loaded = false;

async function _fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SkillRegistry: failed to fetch ${url.pathname} (${res.status})`);
    return res.json();
}

async function load() {
    if (_loaded) return;

    // Load skill manifest + all skill files
    const skillsManifestUrl = new URL('../config/skills/_manifest.json', import.meta.url);
    const skillsManifest = await _fetchJson(skillsManifestUrl);
    await Promise.all((skillsManifest.skills || []).map(async (id) => {
        const url = new URL(`../config/skills/${id}.json`, import.meta.url);
        const def = await _fetchJson(url);
        _skills.set(def.id || id, def);
    }));

    // Load projectile manifest + all projectile files
    const projManifestUrl = new URL('../config/projectiles/_manifest.json', import.meta.url);
    const projManifest = await _fetchJson(projManifestUrl);
    await Promise.all((projManifest.projectiles || []).map(async (id) => {
        const url = new URL(`../config/projectiles/${id}.json`, import.meta.url);
        const def = await _fetchJson(url);
        _projectiles.set(def.id || id, def);
    }));

    _loaded = true;
    console.log(
        `[SkillRegistry] Loaded ${_skills.size} skills:`, [..._skills.keys()],
        `| ${_projectiles.size} projectiles:`, [..._projectiles.keys()]
    );
}

function getSkill(id) {
    if (!_loaded) throw new Error('SkillRegistry: call load() before getSkill()');
    const def = _skills.get(id);
    if (!def) throw new Error(`SkillRegistry: skill '${id}' not found`);
    return def;
}

function getProjectile(id) {
    if (!_loaded) throw new Error('SkillRegistry: call load() before getProjectile()');
    const def = _projectiles.get(id);
    if (!def) throw new Error(`SkillRegistry: projectile '${id}' not found`);
    return def;
}

function hasSkill(id) {
    return _skills.has(id);
}

export default { load, getSkill, getProjectile, hasSkill };
