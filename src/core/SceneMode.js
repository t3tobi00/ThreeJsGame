// SceneMode — single source of truth for which world the game boots into.
//
// Resolution order:
//   1. URL query param `?diorama` (or `?scene=diorama`) — wins, for quick toggling
//   2. URL query param `?scene=legacy` — explicit opt-out
//   3. SCENE_CONFIG.mode in src/config/gameConfig.js
//
// Both code paths (Scene/Lighting/SceneLoader/level JSON) consult this.
// Removing `?diorama` from the URL or setting SCENE_CONFIG.mode='legacy' is the
// full rollback — no other change required.

import { SCENE_CONFIG } from '../config/gameConfig.js';

let _cached = null;

export function isDioramaMode() {
    if (_cached !== null) return _cached;

    let mode = SCENE_CONFIG?.mode || 'legacy';
    if (typeof window !== 'undefined' && window.location?.search) {
        const params = new URLSearchParams(window.location.search);
        if (params.has('diorama')) mode = 'diorama';
        if (params.get('scene') === 'diorama') mode = 'diorama';
        if (params.get('scene') === 'legacy')  mode = 'legacy';
    }

    _cached = (mode === 'diorama');
    return _cached;
}

export function getSceneMode() {
    return isDioramaMode() ? 'diorama' : 'legacy';
}
