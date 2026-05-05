// SceneMode — single source of truth for which world the game boots into.
//
// Three modes share the same engine:
//   • legacy    — original gameplay scene (default)
//   • diorama   — parallel "Cardboard Diorama" world
//   • prototype — 5-min playable-ad demo of V1 (newGameDesign/PROTOTYPE_PLAN.md)
//
// Resolution order (first match wins per pass; later passes can override):
//   1. SCENE_CONFIG.mode in src/config/gameConfig.js (baseline)
//   2. URL bare flag ?prototype  → 'prototype'
//   3. URL bare flag ?diorama    → 'diorama'
//   4. URL ?scene=prototype|diorama|legacy (explicit, overrides bare flags)
//
// Callers (Scene/Lighting/SceneLoader/level JSON) consult these helpers rather
// than re-parsing the URL. Removing the URL flag AND setting
// SCENE_CONFIG.mode='legacy' is the full rollback to the original game.

import { SCENE_CONFIG } from '../config/gameConfig.js';

let _cachedMode = null;

function _resolveMode() {
    if (_cachedMode !== null) return _cachedMode;

    let mode = SCENE_CONFIG?.mode || 'legacy';
    if (typeof window !== 'undefined' && window.location?.search) {
        const params = new URLSearchParams(window.location.search);
        // Bare flags
        if (params.has('prototype')) mode = 'prototype';
        if (params.has('diorama'))   mode = 'diorama';
        // ?scene=X overrides bare flags when both are present
        const sceneParam = params.get('scene');
        if (sceneParam === 'prototype') mode = 'prototype';
        if (sceneParam === 'diorama')   mode = 'diorama';
        if (sceneParam === 'legacy')    mode = 'legacy';
    }

    _cachedMode = mode;
    return _cachedMode;
}

export function isDioramaMode()   { return _resolveMode() === 'diorama'; }
export function isPrototypeMode() { return _resolveMode() === 'prototype'; }

export function getSceneMode() {
    return _resolveMode();
}
