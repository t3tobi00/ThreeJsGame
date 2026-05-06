import * as THREE from 'three';
import EventBus from '../core/EventBus.js';

/**
 * NextStepIndicator — prototype-only 3D pointer that tells the player WHERE
 * to go next, in addition to the WHAT-to-do toast that hud.showAlert renders.
 *
 * Drives off the current state's `hints` array (read from PrototypeStateMachine
 * config). Each hint is { condition, target }; the first hint whose condition
 * passes wins. Conditions reuse the stall-escalation vocabulary so the
 * indicator and stall logic stay in lockstep:
 *
 *   condition:
 *     playerInventoryLt:  { wood: 10 }      // stalled if count <  10
 *     playerInventoryGte: { wood: 10 }      // stalled if count >= 10
 *     zoneNotBuilt: "wall_ghost_1"          // not yet built
 *     zoneBuilt:    "wall_ghost_1"          // already built
 *
 *   target:
 *     { kind: "tag",            tag: "wall_ghost_1" }   visible entity carrying that tag
 *     { kind: "nearestTag",     tag: "tree" }            closest visible entity carrying that tag
 *     { kind: "nearestFaction", faction: "enemy" }       closest visible Movement.faction match
 *
 * Visual: an emerald ground ring (pulsing scale + opacity) + a downward
 * diamond chevron floating above the target (gentle Y-bob). Both live under
 * one THREE.Group, attached to the scene root and re-positioned each frame.
 *
 * Also handles the `pulseTrees` action — toggles an emissive pulse on all
 * tree-tagged meshes; restores original emissive on disable.
 */
export class NextStepIndicator {
    constructor(scene, ecs) {
        this.scene = scene;
        this.ecs = ecs;
        this.playerId = null;
        this.stateMachine = null;
        this.currentHints = [];
        this._t = 0;

        this._pulseTreesActive = false;
        this._pulsedMaterials = new Map(); // material → { origHex, origIntensity }

        this.group = new THREE.Group();
        this.group.visible = false;
        scene.add(this.group);

        const ringGeo = new THREE.RingGeometry(0.55, 0.85, 36);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x4cffb0,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.ring = new THREE.Mesh(ringGeo, ringMat);
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.y = 0.05;
        this.ring.renderOrder = 5;
        this.group.add(this.ring);

        // Diamond chevron — 4-sided cone rotated to point down at the target.
        const arrowGeo = new THREE.ConeGeometry(0.34, 0.7, 4);
        const arrowMat = new THREE.MeshBasicMaterial({
            color: 0x8effb0,
            transparent: true,
            opacity: 0.95,
            depthWrite: false
        });
        this.arrow = new THREE.Mesh(arrowGeo, arrowMat);
        this.arrow.rotation.x = Math.PI;
        this.arrow.rotation.y = Math.PI / 4;
        this.arrow.position.y = 3.2;
        this.arrow.renderOrder = 6;
        this.group.add(this.arrow);

        EventBus.on('state:entered', () => this._onStateEntered());
        EventBus.on('state:exited', ({ nextId }) => {
            if (!nextId) this._hide(); // terminal state — clear pointer
        });
    }

    setStateMachine(sm) {
        this.stateMachine = sm;
        this._onStateEntered();
    }

    setPlayerId(id) { this.playerId = id; }

    /**
     * Toggle emissive pulse on all visible tree-tagged meshes.
     * Called from PrototypeStateMachine's `pulseTrees` action.
     */
    setTreePulse(enabled) {
        this._pulseTreesActive = !!enabled;
        if (!enabled) {
            for (const [mat, rec] of this._pulsedMaterials) {
                if (mat?.emissive) {
                    mat.emissive.setHex(rec.origHex);
                    mat.emissiveIntensity = rec.origIntensity;
                }
            }
            this._pulsedMaterials.clear();
        }
    }

    update(dt) {
        this._t += dt;
        if (this._pulseTreesActive) this._tickTreePulse();

        if (!this.currentHints.length || !this.playerId) {
            this._hide();
            return;
        }

        const hint = this._pickActiveHint();
        if (!hint) { this._hide(); return; }

        const targetPos = this._resolveTargetPos(hint.target);
        if (!targetPos) { this._hide(); return; }

        this.group.visible = true;
        this.group.position.copy(targetPos);

        const ringPulse = 0.85 + 0.20 * Math.sin(this._t * 4.0);
        this.ring.scale.set(ringPulse, ringPulse, 1);
        this.ring.material.opacity = 0.55 + 0.25 * Math.sin(this._t * 4.0 + Math.PI / 2);
        this.arrow.position.y = 3.0 + 0.25 * Math.sin(this._t * 3.0);
        this.arrow.rotation.z = Math.sin(this._t * 2.0) * 0.15;
    }

    _onStateEntered() {
        if (!this.stateMachine) return;
        const id = this.stateMachine.currentStateId;
        const cfg = id != null ? this.stateMachine.statesConfig[id] : null;
        this.currentHints = Array.isArray(cfg?.hints) ? cfg.hints : [];
    }

    _hide() {
        this.group.visible = false;
    }

    _pickActiveHint() {
        const inv = this.ecs.getComponent(this.playerId, 'InventoryStack');
        const builtTags = this.stateMachine?._builtTags || new Set();
        for (const h of this.currentHints) {
            if (this._evalCondition(h.condition, inv, builtTags)) return h;
        }
        return null;
    }

    _evalCondition(cond, inv, builtTags) {
        if (!cond) return true;
        if (cond.playerInventoryLt) {
            for (const [t, v] of Object.entries(cond.playerInventoryLt)) {
                if ((inv?.getCountByType?.(t) ?? 0) >= v) return false;
            }
        }
        if (cond.playerInventoryGte) {
            for (const [t, v] of Object.entries(cond.playerInventoryGte)) {
                if ((inv?.getCountByType?.(t) ?? 0) < v) return false;
            }
        }
        if (cond.zoneNotBuilt && builtTags.has(cond.zoneNotBuilt)) return false;
        if (cond.zoneBuilt && !builtTags.has(cond.zoneBuilt)) return false;
        return true;
    }

    _resolveTargetPos(target) {
        if (!target) return null;
        switch (target.kind) {
            case 'tag':            return this._findVisibleTaggedPos(target.tag);
            case 'nearestTag':     return this._findNearestByTag(target.tag);
            case 'nearestFaction': return this._findNearestByFaction(target.faction);
            default: return null;
        }
    }

    _findVisibleTaggedPos(tag) {
        if (!tag) return null;
        for (const id of this.ecs.queryEntities(['Transform', 'Tag'])) {
            const tagComp = this.ecs.getComponent(id, 'Tag');
            if (!tagComp?.has?.(tag)) continue;
            const tr = this.ecs.getComponent(id, 'Transform');
            if (tr?.mesh && tr.mesh.visible !== false) return tr.mesh.position.clone();
        }
        return null;
    }

    _findNearestByTag(tag) {
        if (!tag) return null;
        const playerTr = this.ecs.getComponent(this.playerId, 'Transform');
        if (!playerTr?.mesh) return null;
        const pos = playerTr.mesh.position;
        let best = null;
        let bestDsq = Infinity;
        for (const id of this.ecs.queryEntities(['Transform', 'Tag'])) {
            const tagComp = this.ecs.getComponent(id, 'Tag');
            if (!tagComp?.has?.(tag)) continue;
            const tr = this.ecs.getComponent(id, 'Transform');
            if (!tr?.mesh || tr.mesh.visible === false) continue;
            const dsq = tr.mesh.position.distanceToSquared(pos);
            if (dsq < bestDsq) { bestDsq = dsq; best = tr.mesh.position; }
        }
        return best ? best.clone() : null;
    }

    _findNearestByFaction(faction) {
        if (!faction) return null;
        const playerTr = this.ecs.getComponent(this.playerId, 'Transform');
        if (!playerTr?.mesh) return null;
        const pos = playerTr.mesh.position;
        let best = null;
        let bestDsq = Infinity;
        for (const id of this.ecs.queryEntities(['Transform', 'Movement'])) {
            const m = this.ecs.getComponent(id, 'Movement');
            if (m?.faction !== faction) continue;
            const tr = this.ecs.getComponent(id, 'Transform');
            if (!tr?.mesh || tr.mesh.visible === false) continue;
            const dsq = tr.mesh.position.distanceToSquared(pos);
            if (dsq < bestDsq) { bestDsq = dsq; best = tr.mesh.position; }
        }
        return best ? best.clone() : null;
    }

    _tickTreePulse() {
        const intensity = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(this._t * 3.5));
        for (const id of this.ecs.queryEntities(['Transform', 'Tag'])) {
            const tagComp = this.ecs.getComponent(id, 'Tag');
            if (!tagComp?.has?.('tree')) continue;
            const tr = this.ecs.getComponent(id, 'Transform');
            if (!tr?.mesh || tr.mesh.visible === false) continue;
            tr.mesh.traverse(obj => {
                if (!obj.isMesh || !obj.material || !obj.material.emissive) return;
                const mat = obj.material;
                if (!this._pulsedMaterials.has(mat)) {
                    this._pulsedMaterials.set(mat, {
                        origHex: mat.emissive.getHex(),
                        origIntensity: mat.emissiveIntensity ?? 1.0
                    });
                }
                mat.emissive.setHex(0x4caf50);
                mat.emissiveIntensity = intensity;
            });
        }
    }
}

export default NextStepIndicator;
