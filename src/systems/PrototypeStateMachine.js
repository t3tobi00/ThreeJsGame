import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * PrototypeStateMachine — JSON-driven 15-state FSM that orchestrates the
 * 5-act intensity arc described in newGameDesign/PROTOTYPE_PLAN.md (§4).
 *
 * Standalone class (NOT registered with ECSManager — it has a single global
 * state, ticked from main.js animate() alongside cameraSystem/harvestNodeSystem).
 *
 * Configuration: src/config/prototypeStates.json with shape:
 *   {
 *     "firstState": "A",
 *     "spawnConfigs": { "actA": {...}, ... },   // bundles for EnemySystem.setConfig
 *     "states": {
 *       "A": {
 *         "entryActions": [{ "call": "enemy.setSpawnConfig", "arg": "actA" }, ...],
 *         "exitTriggers": [{ "event": "entity:died", "filter": {"faction":"enemy"}, "count": 5 }],
 *         "safetyTimer": 30,
 *         "next": "B"
 *       }
 *     }
 *   }
 *
 * Action vocabulary (the "call" field in entryActions):
 *   enemy.setSpawnConfig <bundleKey>   → enemySystem.setConfig(spawnConfigs[bundleKey])
 *   audio.cue <name>                   → emits 'audio:cue' { name } (AudioManager listens)
 *   camera.shake { amount, duration }  → emits 'camera:shake'
 *   camera.hitstop <seconds>           → emits 'game:hitstop' { duration }
 *   factory.activateGhost <ghostKey>   → reveals a hidden zone (Acts 1+, stub here)
 *   factory.spawn { archetype, count, anchor }  → spawns N at anchor tag/position
 *   revealRivalBase                    → Act 4 stub (filled in by Act 4 ship)
 *   hud.showAlert <text>               → Act 1+ stub
 *   pulseTrees <enable>                → Act 1+ stub
 *
 * Exit trigger filters:
 *   { event: 'entity:died',  filter: { faction: 'enemy' }, count: 5 }     // 5 zombie kills
 *   { event: 'zone:built',   filter: { archetype: 'wall' }, count: 3 }    // 3 walls built since state entry
 *   { event: 'zone:spawned', filter: { archetype: 'scout' }, count: 1 }   // 1 scout spawned
 *   { event: 'boss:killed' }                                              // any rival-king death
 *
 * Events emitted:
 *   'state:entered' { id, prevId }
 *   'state:exited'  { id, nextId }
 */
export class PrototypeStateMachine {
    /**
     * @param {object} deps  { ecs, factory, enemySystem, audio, camera, scene }
     * @param {object} statesConfig  parsed prototypeStates.json
     */
    constructor(deps, statesConfig) {
        this.deps = deps;
        this.spawnConfigs = statesConfig?.spawnConfigs || {};
        this.statesConfig = statesConfig?.states || {};
        this.firstStateId = statesConfig?.firstState || 'A';

        this.currentStateId = null;
        this.enteredAt = 0;
        this.triggerCounts = {};
        this._builtTags = new Set();   // accumulates tags from zone:built/zone:spawned

        this._wireEvents();
    }

    // ─── Lifecycle ────────────────────────────────────────────────

    start() {
        if (!this.statesConfig[this.firstStateId]) {
            console.warn(`[PrototypeStateMachine] firstState '${this.firstStateId}' missing from config`);
            return;
        }
        this.transitionTo(this.firstStateId);
    }

    /**
     * Called from main.js animate() loop. Drives stall-escalation: fires
     * pressure-ramp actions (typically heavier spawn configs) at configured
     * thresholds when the player isn't progressing through milestones.
     *
     * State machine is purely milestone-driven — there is NO time-based
     * auto-advance. If a player is stalled, escalation forces action
     * (more zombies) without skipping the milestone they need to hit.
     */
    update(_deltaTime) {
        if (!this.currentStateId) return;
        const stateCfg = this.statesConfig[this.currentStateId];
        if (!stateCfg) return;

        if (Array.isArray(stateCfg.stallEscalation)) {
            const elapsed = (performance.now() - this.enteredAt) / 1000;
            for (let i = 0; i < stateCfg.stallEscalation.length; i++) {
                const esc = stateCfg.stallEscalation[i];
                const key = `${this.currentStateId}::esc::${i}`;
                if (this.triggerCounts[key]) continue;          // already fired
                if (elapsed < (esc.afterSeconds ?? 9999)) continue;
                // Optional progress check — only fire if the player is actually
                // failing the sub-step. Player making progress (e.g. has wood)
                // → skip this escalation.
                if (!this._checkStallCondition(esc.stallCondition)) continue;
                this.triggerCounts[key] = 1;
                if (Array.isArray(esc.actions)) {
                    for (const action of esc.actions) this._runAction(action);
                }
            }
        }
    }

    /**
     * Evaluate a stallCondition. Returns true if the player is failing the
     * specified sub-step (escalation should fire). Returns false if the
     * player is actually progressing (skip escalation).
     *
     * Schema:
     *   playerInventoryLt:  { resourceName: maxValue }   stalled if count <  maxValue
     *   playerInventoryGte: { resourceName: minValue }   stalled if count >= minValue (player has enough but isn't using it)
     *   zoneNotBuilt:       "tag"                         stalled if zone with tag NOT yet built
     *   zoneBuilt:          "tag"                         stalled if zone with tag has been built
     *   No condition (null/undefined) → always stalled (always fire after threshold).
     */
    _checkStallCondition(cond) {
        if (!cond) return true;
        const ecs = this.deps?.ecs;
        const playerId = this.deps?.playerId;

        if (cond.playerInventoryLt) {
            const inv = ecs && playerId != null ? ecs.getComponent(playerId, 'InventoryStack') : null;
            if (!inv) return false;
            for (const [type, threshold] of Object.entries(cond.playerInventoryLt)) {
                if ((inv.getCountByType?.(type) ?? 0) >= threshold) return false; // has enough → not stalled
            }
        }

        if (cond.playerInventoryGte) {
            const inv = ecs && playerId != null ? ecs.getComponent(playerId, 'InventoryStack') : null;
            if (!inv) return false;
            for (const [type, threshold] of Object.entries(cond.playerInventoryGte)) {
                if ((inv.getCountByType?.(type) ?? 0) < threshold) return false;  // doesn't have enough → not at this stall step
            }
        }

        if (cond.zoneNotBuilt) {
            if (this._builtTags.has(cond.zoneNotBuilt)) return false; // already built → past this stall
        }

        if (cond.zoneBuilt) {
            if (!this._builtTags.has(cond.zoneBuilt)) return false;   // not built yet → not at this stall step
        }

        return true;
    }

    /** Force a transition. Mostly for debug; normal flow goes through _exit. */
    transitionTo(id) {
        const stateCfg = this.statesConfig[id];
        if (!stateCfg) {
            console.warn(`[PrototypeStateMachine] unknown state '${id}'`);
            return;
        }
        const prevId = this.currentStateId;
        this.currentStateId = id;
        this.enteredAt = performance.now();
        this.triggerCounts = {};

        EventBus.emit('state:entered', { id, prevId });

        if (Array.isArray(stateCfg.entryActions)) {
            for (const action of stateCfg.entryActions) this._runAction(action);
        }
    }

    _exit(fromId, toId) {
        if (!toId) {
            // Terminal state (e.g. END) — fire exited then stop ticking.
            EventBus.emit('state:exited', { id: fromId, nextId: null });
            this.currentStateId = null;
            return;
        }
        EventBus.emit('state:exited', { id: fromId, nextId: toId });
        this.transitionTo(toId);
    }

    // ─── Trigger evaluation ───────────────────────────────────────

    _wireEvents() {
        const events = [
            'entity:died',
            'entity:spawned',
            'zone:built',
            'zone:spawned',
            'item:deposited',
            'boss:killed',
            'rival:reach-perimeter',
            'rally:triggered'
        ];
        for (const evName of events) {
            EventBus.on(evName, (ev) => this._onEvent(evName, ev));
        }
    }

    _onEvent(eventName, ev) {
        // Track built/spawner tags for stall progress checks (must happen
        // BEFORE exit-trigger eval, since both consume the same event).
        if ((eventName === 'zone:built' || eventName === 'zone:spawned') && Array.isArray(ev?.tags)) {
            for (const t of ev.tags) this._builtTags.add(t);
        }

        if (!this.currentStateId) return;
        const stateCfg = this.statesConfig[this.currentStateId];
        if (!stateCfg || !Array.isArray(stateCfg.exitTriggers)) return;

        for (let i = 0; i < stateCfg.exitTriggers.length; i++) {
            const trigger = stateCfg.exitTriggers[i];
            if (trigger.event !== eventName) continue;
            if (!this._triggerMatches(trigger, ev)) continue;
            const key = `${this.currentStateId}::${i}`;
            const newCount = (this.triggerCounts[key] || 0) + 1;
            this.triggerCounts[key] = newCount;
            if (newCount >= (trigger.count || 1)) {
                this._exit(this.currentStateId, stateCfg.next);
                return;
            }
        }
    }

    _triggerMatches(trigger, ev) {
        if (!trigger.filter) return true;
        const ecs = this.deps?.ecs;
        for (const [key, expected] of Object.entries(trigger.filter)) {
            switch (key) {
                case 'tag': {
                    if (!ev?.entityId || !ecs) return false;
                    const tag = ecs.getComponent(ev.entityId, 'Tag');
                    if (!tag?.has?.(expected)) return false;
                    break;
                }
                case 'faction': {
                    if (!ev?.entityId || !ecs) return false;
                    const movement = ecs.getComponent(ev.entityId, 'Movement');
                    if (movement?.faction !== expected) return false;
                    break;
                }
                case 'archetype':
                    if (ev?.archetype !== expected) return false;
                    break;
                default:
                    if (ev?.[key] !== expected) return false;
            }
        }
        return true;
    }

    // ─── Action interpreter ───────────────────────────────────────

    _runAction({ call, arg }) {
        try {
            switch (call) {
                case 'enemy.setSpawnConfig': {
                    const cfg = this.spawnConfigs?.[arg];
                    if (!cfg) {
                        console.warn(`[PrototypeStateMachine] spawnConfig key '${arg}' not found`);
                        break;
                    }
                    this.deps?.enemySystem?.setConfig(cfg);
                    break;
                }
                case 'audio.cue':
                    EventBus.emit('audio:cue', { name: arg });
                    break;
                case 'camera.shake':
                    EventBus.emit('camera:shake', {
                        amount: arg?.amount ?? 0.3,
                        duration: arg?.duration ?? 0.3
                    });
                    break;
                case 'camera.hitstop':
                    EventBus.emit('game:hitstop', { duration: arg ?? 0.06 });
                    break;
                case 'enemy.freeze':
                    // Stops EnemySystem update (movement + spawning).
                    // Pre-placed zombies sit still; ContactDamage still applies
                    // if the player walks into them. Used for BOOT grace period.
                    this.deps?.enemySystem?.setFrozen(!!arg);
                    break;
                case 'enemy.activateReserves': {
                    // Convert all currently-idle zombies into marchers
                    // (permanentChase=true). Used on State B entry to wake up
                    // the 7 idlers loitering at the spawn area so they march
                    // south and the spawner cap doesn't dead-weight.
                    const ecs = this.deps?.ecs;
                    if (!ecs) break;
                    const candidates = ecs.queryEntities(['EnemyAI']);
                    let activated = 0;
                    for (const id of candidates) {
                        const ai = ecs.getComponent(id, 'EnemyAI');
                        if (ai && !ai.permanentChase) {
                            ai.permanentChase = true;
                            activated++;
                        }
                    }
                    if (activated === 0) {
                        console.log('[PrototypeStateMachine] activateReserves: no idle enemies to activate');
                    }
                    break;
                }
                case 'enemy.sendWave': {
                    // Spawn `count` zombies (default marchers) at the current
                    // EnemySystem spawn point with random jitter. This bypasses
                    // the maxAlive cap — used by stall-escalation to push
                    // visible reinforcements at the player.
                    const enemySystem = this.deps?.enemySystem;
                    const factory = this.deps?.factory;
                    if (!enemySystem || !factory) break;
                    const count = arg?.count || 3;
                    const archetype = arg?.archetype || 'enemy-prototype-marcher';
                    const spawn = enemySystem._spawn || {};
                    const sp = spawn.point || { x: 0, z: -22 };
                    const j = spawn.jitter || 4;
                    for (let i = 0; i < count; i++) {
                        const jx = (Math.random() * 2 - 1) * j;
                        const jz = (Math.random() * 2 - 1) * j;
                        const pos = new THREE.Vector3(sp.x + jx, 0, sp.z + jz);
                        factory.create(archetype, pos);
                    }
                    break;
                }
                case 'factory.spawn':
                    this._actionFactorySpawn(arg);
                    break;
                case 'factory.activateGhost': {
                    // Find every entity tagged with `arg` and toggle
                    // Transform.mesh.visible = true. Pairs with the level
                    // JSON's `hidden:true` flag and main.js's
                    // tagComp.tags.push(zoneDef.tag) — see loadLevel().
                    const ecs = this.deps?.ecs;
                    if (!ecs) break;
                    const candidates = ecs.queryEntities(['Transform', 'Tag']);
                    let activated = 0;
                    for (const id of candidates) {
                        const tag = ecs.getComponent(id, 'Tag');
                        if (!tag?.has?.(arg)) continue;
                        const t = ecs.getComponent(id, 'Transform');
                        if (t?.mesh) {
                            t.mesh.visible = true;
                            activated++;
                        }
                    }
                    if (activated === 0) {
                        console.warn(`[PrototypeStateMachine] activateGhost('${arg}'): no entities matched`);
                    }
                    break;
                }
                case 'revealRivalBase':
                    // Act 4: opacity tween + dust burst on rival-base entity. Foundation: stub.
                    console.log('[PrototypeStateMachine] revealRivalBase() — stub (Act 4)');
                    break;
                case 'hud.showAlert':
                    this._showAlert(String(arg ?? ''));
                    break;
                case 'pulseTrees':
                    // Toggles emissive pulse on every visible tree mesh. Wired
                    // through the NextStepIndicator since it already iterates
                    // tree-tagged entities for its 'nearestTag tree' targets.
                    this.deps?.indicator?.setTreePulse?.(!!arg);
                    break;
                default:
                    console.warn(`[PrototypeStateMachine] unknown action '${call}'`);
            }
        } catch (e) {
            console.error(`[PrototypeStateMachine] action '${call}' threw:`, e);
        }
    }

    _actionFactorySpawn(arg) {
        const factory = this.deps?.factory;
        if (!factory || !arg?.archetype) return;
        const count = arg.count || 1;
        const pos = this._resolveAnchor(arg.anchor);
        if (!pos) {
            console.warn(`[PrototypeStateMachine] factory.spawn: anchor '${JSON.stringify(arg.anchor)}' did not resolve`);
            return;
        }
        for (let i = 0; i < count; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2
            );
            factory.create(arg.archetype, pos.clone().add(offset));
        }
    }

    /**
     * Minimal toast overlay for hud.showAlert action. Lazy-creates a single
     * top-center div, fades it in/out on each call. ~3.5s display.
     */
    _showAlert(text) {
        if (typeof document === 'undefined' || !text) return;
        if (!this._alertEl) {
            this._alertEl = document.createElement('div');
            this._alertEl.id = 'prototype-stall-alert';
            this._alertEl.style.cssText =
                'position: fixed; top: 80px; left: 50%; transform: translateX(-50%);' +
                'background: rgba(255, 80, 80, 0.92); color: white;' +
                'font: bold 22px Arial, sans-serif;' +
                'padding: 12px 28px; border-radius: 12px;' +
                'box-shadow: 0 6px 24px rgba(0,0,0,0.5);' +
                'z-index: 1500; pointer-events: none;' +
                'opacity: 0; transition: opacity 0.3s;' +
                'text-shadow: 1px 1px 2px rgba(0,0,0,0.6);';
            document.body.appendChild(this._alertEl);
        }
        this._alertEl.textContent = text;
        this._alertEl.style.opacity = '1';
        if (this._alertTimer) clearTimeout(this._alertTimer);
        this._alertTimer = setTimeout(() => {
            if (this._alertEl) this._alertEl.style.opacity = '0';
        }, 3500);
    }

    /** Anchor resolution: world Vector3 (object form), or Tag-name string. */
    _resolveAnchor(anchor) {
        if (!anchor) return new THREE.Vector3(0, 0, 0);
        if (typeof anchor === 'object' && anchor.x != null) {
            return new THREE.Vector3(anchor.x, anchor.y || 0, anchor.z);
        }
        if (typeof anchor === 'string') {
            const ecs = this.deps?.ecs;
            if (!ecs) return null;
            const candidates = ecs.queryEntities(['Transform', 'Tag']);
            for (const id of candidates) {
                const tag = ecs.getComponent(id, 'Tag');
                if (tag?.has?.(anchor)) {
                    const t = ecs.getComponent(id, 'Transform');
                    return t ? t.mesh.position.clone() : null;
                }
            }
        }
        return null;
    }
}

export default PrototypeStateMachine;
