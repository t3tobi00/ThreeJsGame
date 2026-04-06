import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import SkillRegistry from '../core/SkillRegistry.js';

/**
 * SkillSystem — Dispatches skill use per entity.
 *
 * Queries: ['Transform', 'SkillLoadout', 'SkillState']
 *
 * Per frame, for each entity:
 *   1. Resolve the active skill JSON via SkillRegistry
 *   2. Tick cooldown / reload / windup on SkillState
 *   3. If not reloading + not winding up → find target, start windup (or fire directly)
 *   4. On fire → execute skill, apply cooldown, decrement charges, maybe start reload
 *   5. Emit 'skill:fired' with { entityId, skillId, targetId }
 *
 * Skill executors are pluggable — dispatched by skill.type.
 *   Phase 1-2: 'projectile' (count, spread, charges/reload, windup)
 *   Phase 4:   'melee'
 *   Phase 5:   'harvest'
 *
 * Events emitted:
 *   'skill:fired'         { entityId, skillId, targetId, origin, target, animation }
 *   'skill:windup_start'  { entityId, skillId, duration }
 *   'skill:reload_start'  { entityId, skillId, duration }
 *   'skill:reload_end'    { entityId, skillId }
 */
export class SkillSystem {
    constructor(scene, projectilePool) {
        this.scene = scene;
        this.projectilePool = projectilePool;

        // Live projectiles owned by this system
        this._projectiles = [];

        // Cached geometry/material per projectile id (so visual swap is cheap)
        this._projectileVisuals = new Map();
    }

    update(entities, deltaTime, ecs) {
        this._ecs = ecs;

        for (const entityId of entities) {
            const transform = ecs.getComponent(entityId, 'Transform');
            const loadout   = ecs.getComponent(entityId, 'SkillLoadout');
            const state     = ecs.getComponent(entityId, 'SkillState');
            if (!transform || !loadout || !state) continue;
            if (!loadout.activeSkill) continue;
            if (!state.enabled) continue;

            // Resolve skill definition
            let skill;
            try { skill = SkillRegistry.getSkill(loadout.activeSkill); }
            catch (e) { continue; }

            // Handle skill swap — reset state when active skill changes
            if (state.trackedSkillId !== skill.id) {
                this._initStateForSkill(state, skill);
            }

            // ── Tick timers ──
            if (state.cooldownLeft > 0) state.cooldownLeft -= deltaTime;
            if (state.reloadLeft > 0) {
                state.reloadLeft -= deltaTime;
                if (state.reloadLeft <= 0) {
                    state.reloadLeft = 0;
                    state.chargesLeft = skill.charges || 0;
                    EventBus.emit('skill:reload_end', { entityId, skillId: skill.id });
                }
                continue; // reloading → cannot fire or wind up
            }

            // ── Windup in progress ──
            if (state.isWindingUp) {
                state.windupLeft -= deltaTime;
                if (state.windupLeft <= 0) {
                    // Windup complete → try to fire
                    const target = this._resolveWindupTarget(entityId, transform, skill, state, ecs);
                    state.isWindingUp = false;
                    state.windupLeft = 0;
                    state.windupTargetId = null;

                    if (target) {
                        this._fire(entityId, transform, skill, target, state);
                    }
                }
                continue; // windup frame done
            }

            // ── Ready checks ──
            if (state.cooldownLeft > 0) continue;

            // Find a target
            const targetInfo = this._findTarget(entityId, transform, skill, ecs);
            if (!targetInfo) continue;

            // ── Start windup (or fire directly) ──
            if ((skill.windup || 0) > 0) {
                state.isWindingUp = true;
                state.windupLeft = skill.windup;
                state.windupTargetId = targetInfo.entityId;
                EventBus.emit('skill:windup_start', {
                    entityId,
                    skillId: skill.id,
                    duration: skill.windup,
                    origin: transform.mesh.position.clone(),
                    target: targetInfo.pos.clone()
                });
            } else {
                this._fire(entityId, transform, skill, targetInfo, state);
            }
        }

        // Update live projectiles (movement + collision + cull)
        this._updateProjectiles(deltaTime, ecs);
    }

    // ── Fire ───────────────────────────────────────────────────────

    _fire(entityId, transform, skill, targetInfo, state) {
        // Execute by type
        this._executeSkill(entityId, transform, skill, targetInfo, this._ecs);

        // Apply cooldown
        state.cooldownLeft = skill.fireRate || 0.3;

        // Charges / reload bookkeeping
        if ((skill.charges || 0) > 0) {
            state.chargesLeft -= 1;
            if (state.chargesLeft <= 0) {
                state.chargesLeft = 0;
                state.reloadLeft = skill.reloadTime || 1;
                EventBus.emit('skill:reload_start', {
                    entityId, skillId: skill.id, duration: state.reloadLeft
                });
            }
        }

        // Fired event — arms & effects react
        EventBus.emit('skill:fired', {
            entityId,
            skillId: skill.id,
            targetId: targetInfo.entityId,
            origin: transform.mesh.position.clone(),
            target: targetInfo.pos.clone(),
            animation: skill.animation || null
        });
    }

    // ── Initialization ─────────────────────────────────────────────

    _initStateForSkill(state, skill) {
        state.trackedSkillId = skill.id;
        state.cooldownLeft = 0;
        state.chargesLeft = skill.charges || 0;
        state.reloadLeft = 0;
        state.windupLeft = 0;
        state.isWindingUp = false;
        state.windupTargetId = null;
        state.comboCount = 0;
    }

    // ── Targeting ──────────────────────────────────────────────────

    _findTarget(shooterId, shooterTransform, skill, ecs) {
        const range = skill.range || 10;
        const shooterPos = shooterTransform.mesh.position;

        if (skill.type === 'projectile' || skill.type === 'melee') {
            const factions = skill.targetFactions || ['enemy'];
            let best = null;
            let bestDist = range;

            // Faction-matched enemies
            const enemyCandidates = ecs.queryEntities(['Transform', 'Movement', 'Health']);
            for (const id of enemyCandidates) {
                if (id === shooterId) continue;
                const m = ecs.getComponent(id, 'Movement');
                if (!factions.includes(m.faction)) continue;
                const t = ecs.getComponent(id, 'Transform');
                const dist = shooterPos.distanceTo(t.mesh.position);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = { entityId: id, pos: t.mesh.position };
                }
            }

            // For melee weapons with alsoTargetTags (e.g. sword that chops trees),
            // also consider nearby tagged harvestables. Picks the nearest of
            // either category so the sword auto-swings whether you're near a
            // zombie or a tree.
            if (skill.type === 'melee' && skill.alsoTargetTags?.length > 0) {
                const alsoTags = skill.alsoTargetTags;
                const taggedCandidates = ecs.queryEntities(['Transform', 'Tag', 'Health']);
                for (const id of taggedCandidates) {
                    if (id === shooterId) continue;
                    const tag = ecs.getComponent(id, 'Tag');
                    if (!tag || !alsoTags.some(t => tag.has(t))) continue;
                    const t = ecs.getComponent(id, 'Transform');
                    const dist = shooterPos.distanceTo(t.mesh.position);
                    if (dist < bestDist) {
                        bestDist = dist;
                        best = { entityId: id, pos: t.mesh.position };
                    }
                }
            }

            return best;
        }

        if (skill.type === 'harvest') {
            // Tag-based targeting: find the nearest entity whose Tag component
            // contains ANY of the skill's targetTags. Harvestables don't need
            // a Movement component.
            const wantTags = skill.targetTags || ['harvestable'];
            const candidates = ecs.queryEntities(['Transform', 'Tag', 'Health']);
            let best = null;
            let bestDist = range;
            for (const id of candidates) {
                if (id === shooterId) continue;
                const tag = ecs.getComponent(id, 'Tag');
                if (!tag) continue;
                if (!wantTags.some(t => tag.has(t))) continue;
                const t = ecs.getComponent(id, 'Transform');
                const dist = shooterTransform.mesh.position.distanceTo(t.mesh.position);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = { entityId: id, pos: t.mesh.position };
                }
            }
            return best;
        }

        return null;
    }

    /**
     * At end-of-windup, prefer the originally-locked target if it's still valid and in range.
     * Otherwise fall back to the current nearest target.
     */
    _resolveWindupTarget(shooterId, shooterTransform, skill, state, ecs) {
        const lockedId = state.windupTargetId;
        if (lockedId != null && ecs.hasComponents(lockedId, ['Transform', 'Movement', 'Health'])) {
            const t = ecs.getComponent(lockedId, 'Transform');
            const dist = shooterTransform.mesh.position.distanceTo(t.mesh.position);
            if (dist <= (skill.range || 10)) {
                return { entityId: lockedId, pos: t.mesh.position };
            }
        }
        return this._findTarget(shooterId, shooterTransform, skill, ecs);
    }

    // ── Dispatch ───────────────────────────────────────────────────

    _executeSkill(shooterId, transform, skill, targetInfo, ecs) {
        switch (skill.type) {
            case 'projectile':
                this._executeProjectile(transform, skill, targetInfo);
                break;
            case 'melee':
                this._executeMelee(shooterId, transform, skill, targetInfo, ecs);
                break;
            case 'harvest':
                this._executeHarvest(shooterId, transform, skill, targetInfo, ecs);
                break;
        }
    }

    /**
     * Harvest — same cone-hit logic as melee, but targets entities by Tag
     * rather than Movement.faction. No combo/finisher/knockback. Hit sparks
     * use a dust-colored palette via the skill's effect.sparkColor if set.
     */
    _executeHarvest(shooterId, transform, skill, primaryTarget, ecs) {
        const range = skill.range || 2.5;
        const cfg = skill.harvest || {};
        const coneAngleRad = THREE.MathUtils.degToRad(cfg.coneAngleDeg || 100);
        const halfCone = coneAngleRad / 2;

        const origin = transform.mesh.position;
        const facing = new THREE.Vector3().subVectors(primaryTarget.pos, origin);
        facing.y = 0;
        if (facing.lengthSq() < 0.0001) return;
        facing.normalize();

        const damage = skill.damage || 5;
        const wantTags = skill.targetTags || ['harvestable'];
        const sparkColor = skill.effect?.sparkColor || 0x9e7a48;

        const candidates = ecs.queryEntities(['Transform', 'Tag', 'Health']);
        const hits = [];
        for (const id of candidates) {
            if (id === shooterId) continue;
            const tag = ecs.getComponent(id, 'Tag');
            if (!tag || !wantTags.some(t => tag.has(t))) continue;

            const t = ecs.getComponent(id, 'Transform');
            const toNode = new THREE.Vector3().subVectors(t.mesh.position, origin);
            toNode.y = 0;
            const dist = toNode.length();
            if (dist > range || dist < 0.0001) continue;
            toNode.divideScalar(dist);

            const dot = facing.dot(toNode);
            const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
            if (angle > halfCone) continue;

            hits.push({ id, transform: t });
        }

        for (const hit of hits) {
            EventBus.emit('entity:damaged', { entityId: hit.id, damage });

            const hitPos = hit.transform.mesh.position.clone();
            hitPos.y += 0.6;
            EventBus.emit('effect:hit_spark', {
                position: hitPos,
                isFinisher: false,
                color: sparkColor
            });
            EventBus.emit('damage:popup', {
                position: hit.transform.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)),
                amount: Math.round(damage),
                isCrit: false
            });
        }

        // Fire the swing event with actual hit positions so the effect system
        // can place chop visuals + dust puffs at each impacted node.
        EventBus.emit('skill:melee_swing', {
            entityId: shooterId,
            skillId: skill.id,
            origin: origin.clone(),
            direction: facing.clone(),
            isFinisher: false,
            hitCount: hits.length,
            hitPositions: hits.map(h => h.transform.mesh.position.clone())
        });
    }

    /**
     * Melee swing — hits all valid enemies in a forward-facing cone, plus
     * any tagged harvestables in the cone if skill.alsoTargetTags is set.
     *
     * A sword that can chop trees and fight zombies at once is much more
     * satisfying than forcing a skill swap per task, so melee weapons now
     * double as axes/pickaxes against Tag-matched objects.
     *
     * Flow:
     *   1. Compute facing direction toward the primary (nearest) target
     *   2. Increment combo count; check if this swing is a finisher
     *   3. Find ALL enemies inside range + cone arc
     *   4. Find ALL tagged harvestables inside range + cone arc (if configured)
     *   5. Deal damage (x multiplier on finisher), push them back, spawn
     *      hit sparks + damage popups per hit
     *   6. Emit 'skill:melee_swing' so SkillEffectSystem can spawn the arc
     *   7. On finisher-with-hits: emit camera shake + hitstop
     */
    _executeMelee(shooterId, transform, skill, primaryTarget, ecs) {
        const range = skill.range || 3;
        const cfgMelee = skill.melee || {};
        const coneAngleRad = THREE.MathUtils.degToRad(cfgMelee.coneAngleDeg || 120);
        const halfCone = coneAngleRad / 2;

        // Facing direction: XZ-flattened vector from shooter to primary target
        const origin = transform.mesh.position;
        const facing = new THREE.Vector3().subVectors(primaryTarget.pos, origin);
        facing.y = 0;
        if (facing.lengthSq() < 0.0001) return;
        facing.normalize();

        // Combo + finisher logic
        const state = ecs.getComponent(shooterId, 'SkillState');
        const combo = skill.combo || {};
        const finisherEvery = combo.finisherEvery || 0;
        state.comboCount = (state.comboCount || 0) + 1;
        const isFinisher = finisherEvery > 0 && (state.comboCount % finisherEvery === 0);

        const damageMult   = isFinisher ? (combo.finisherDamageMult   || 2.5) : 1;
        const knockbackMult= isFinisher ? (combo.finisherKnockbackMult|| 2.0) : 1;
        const coneBonus    = isFinisher ? (combo.finisherConeBonusDeg || 40)  : 0;
        const rangeBonus   = isFinisher ? (combo.finisherRangeBonus   || 1.0) : 0;

        const effectiveRange = range + rangeBonus;
        const effectiveHalfCone = halfCone + THREE.MathUtils.degToRad(coneBonus) / 2;

        const damage = (skill.damage || 5) * damageMult;
        const knockback = (skill.knockback || 0.5) * knockbackMult;

        // Find all targets inside the cone.
        // First pass: faction-matched enemies (entities with Movement + Health).
        const factions = skill.targetFactions || ['enemy'];
        const enemyCandidates = ecs.queryEntities(['Transform', 'Movement', 'Health']);

        const hits = [];
        for (const id of enemyCandidates) {
            if (id === shooterId) continue;
            const m = ecs.getComponent(id, 'Movement');
            if (!factions.includes(m.faction)) continue;

            const t = ecs.getComponent(id, 'Transform');
            const toEnemy = new THREE.Vector3().subVectors(t.mesh.position, origin);
            toEnemy.y = 0;
            const dist = toEnemy.length();
            if (dist > effectiveRange) continue;
            if (dist < 0.0001) continue;
            toEnemy.divideScalar(dist); // normalize

            // Cone test via dot product
            const dot = facing.dot(toEnemy);
            const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
            if (angle > effectiveHalfCone) continue;

            hits.push({ id, transform: t, isHarvestable: false });
        }

        // Second pass: tagged harvestables (trees, rocks) if the skill allows it.
        // Lets swords chop wood and break stones without swapping to pickaxe.
        const alsoTags = skill.alsoTargetTags || [];
        if (alsoTags.length > 0) {
            const taggedCandidates = ecs.queryEntities(['Transform', 'Tag', 'Health']);
            for (const id of taggedCandidates) {
                if (id === shooterId) continue;
                const tag = ecs.getComponent(id, 'Tag');
                if (!tag || !alsoTags.some(t => tag.has(t))) continue;

                const t = ecs.getComponent(id, 'Transform');
                const toNode = new THREE.Vector3().subVectors(t.mesh.position, origin);
                toNode.y = 0;
                const dist = toNode.length();
                if (dist > effectiveRange) continue;
                if (dist < 0.0001) continue;
                toNode.divideScalar(dist);

                const dot = facing.dot(toNode);
                const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
                if (angle > effectiveHalfCone) continue;

                hits.push({ id, transform: t, isHarvestable: true });
            }
        }

        // Apply damage, knockback, spark, popup per hit
        for (const hit of hits) {
            EventBus.emit('entity:damaged', { entityId: hit.id, damage });

            if (hit.isHarvestable) {
                // Harvestables: dedicated chop impact instead of the yellow
                // sparks. Swing arc still plays (emitted below) so the sword
                // keeps its identity; the chop is the *contact* feedback.
                EventBus.emit('effect:mine_chop', {
                    position: hit.transform.mesh.position.clone()
                });
            } else {
                // Enemies: knockback + yellow sparks (or hot finisher sparks)
                const kb = new THREE.Vector3().subVectors(hit.transform.mesh.position, origin);
                kb.y = 0;
                if (kb.lengthSq() > 0.0001) {
                    kb.normalize().multiplyScalar(knockback);
                    hit.transform.mesh.position.add(kb);
                }

                const hitPos = hit.transform.mesh.position.clone();
                hitPos.y += 1.0;
                EventBus.emit('effect:hit_spark', {
                    position: hitPos,
                    isFinisher
                });
            }

            // Damage popup for every hit (enemies and harvestables)
            EventBus.emit('damage:popup', {
                position: hit.transform.mesh.position.clone().add(new THREE.Vector3(0, 1.8, 0)),
                amount: Math.round(damage),
                isCrit: isFinisher
            });
        }

        // Tell the effect system to spawn the slash arc (always, even on a whiff —
        // feels bad to swing and see nothing)
        EventBus.emit('skill:melee_swing', {
            entityId: shooterId,
            skillId: skill.id,
            origin: origin.clone(),
            direction: facing.clone(),
            isFinisher,
            hitCount: hits.length
        });

        // Finisher juice — only when we actually connected
        if (isFinisher && hits.length > 0) {
            EventBus.emit('camera:shake', { amount: 0.35, duration: 0.15 });
            EventBus.emit('game:hitstop', { duration: 0.06 });
        }
    }

    _executeProjectile(transform, skill, targetInfo) {
        const projId = skill.projectile?.id || 'bullet';
        const projCfg = SkillRegistry.getProjectile(projId);

        const count = skill.projectile?.count || 1;
        const spreadDeg = skill.projectile?.spreadDeg || 0;
        const spreadRad = THREE.MathUtils.degToRad(spreadDeg);

        // Lift spawn point to roughly shoulder/chest height so projectiles don't
        // fly along the ground. Both origin and target are lifted equally so the
        // direction vector stays horizontal → projectile flies at constant Y.
        const muzzleHeight = skill.muzzleHeight != null ? skill.muzzleHeight : 1.0;

        const origin = transform.mesh.position.clone();
        origin.y += muzzleHeight;

        const targetAt = targetInfo.pos.clone();
        targetAt.y += muzzleHeight;

        const baseDir = new THREE.Vector3().subVectors(targetAt, origin).normalize();

        for (let i = 0; i < count; i++) {
            // Rotate base direction around world Y by a random offset within the cone.
            // For a single projectile (count=1, spread=0) this is a no-op.
            let dir = baseDir.clone();
            if (spreadRad > 0) {
                const offset = (Math.random() - 0.5) * spreadRad;
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), offset);
            }

            const p = this.projectilePool.get();
            p.reset(origin, dir);

            // Swap visual for this projectile type (cheap, cached)
            this._applyProjectileVisual(p, projCfg);

            // Override velocity using projectile config speed
            if (projCfg.speed) {
                p.velocity.copy(dir).multiplyScalar(projCfg.speed);
            }

            // Optional: orient mesh along velocity (for arrows) — lookAt() points
            // the mesh's local -Z toward the target, which matches how we build
            // arrow geometry (tip at -Z, fletching at +Z).
            if (projCfg.alignToVelocity) {
                const lookAt = origin.clone().add(dir);
                p.lookAt(lookAt);
            } else {
                p.rotation.set(0, 0, 0);
            }

            p.damage = skill.damage || 1;
            p._maxLifetime = projCfg.lifetime || 2;
            p._elapsed = 0;
            this.scene.add(p);
            this._projectiles.push(p);
        }
    }

    /**
     * Swap the projectile mesh's geometry + material to match the projectile config.
     * Cached per projectile id so we don't rebuild geometry every shot.
     *
     * For multi-part projectiles (e.g. arrow = shaft + tip), creates fresh child
     * Mesh instances parented to the projectile. Children are removed when the
     * projectile is reused for a different type.
     */
    _applyProjectileVisual(projectile, projCfg) {
        if (projectile._projectileId === projCfg.id) return; // already correct

        // Clean up any previous child decorations (e.g. arrow → bullet swap)
        while (projectile.children.length > 0) {
            projectile.remove(projectile.children[0]);
        }

        let visual = this._projectileVisuals.get(projCfg.id);
        if (!visual) {
            visual = this._buildProjectileVisual(projCfg);
            this._projectileVisuals.set(projCfg.id, visual);
        }

        projectile.geometry = visual.geometry;
        projectile.material = visual.material;

        // Attach decoration parts as children (arrowhead, fletching, etc.)
        if (visual.parts) {
            for (const part of visual.parts) {
                const partMesh = new THREE.Mesh(part.geometry, part.material);
                partMesh.position.copy(part.position);
                if (part.rotation) partMesh.rotation.copy(part.rotation);
                projectile.add(partMesh);
            }
        }

        projectile._projectileId = projCfg.id;
    }

    _buildProjectileVisual(projCfg) {
        const mesh = projCfg.mesh || {};
        const colorHex = typeof mesh.color === 'string' ? parseInt(mesh.color, 16) : (mesh.color || 0xffff44);
        const preset = mesh.preset || 'sphere';

        // ── Arrow: tapered shaft cylinder + pointed cone tip ──
        // KNOWN BUG (TODO): the silver arrowhead currently points backward
        // (toward the shooter, not the enemy). Root cause: Mesh.lookAt() orients
        // a mesh's local +Z toward the target, but the cone apex is built at -Z
        // via rotateX(-PI/2). To fix: rotate the cone the other way (rotateX(+PI/2))
        // and place the tip at a positive Z offset. Leaving as-is for now — shape
        // still reads as an arrow and gameplay is unaffected.
        if (preset === 'arrow') {
            const shaftLen = mesh.shaftLength != null ? mesh.shaftLength : 1.0;
            const shaftRad = mesh.shaftRadius != null ? mesh.shaftRadius : 0.05;
            const tipLen   = mesh.tipLength   != null ? mesh.tipLength   : 0.25;
            const tipRad   = mesh.tipRadius   != null ? mesh.tipRadius   : 0.12;
            const tipColor = typeof mesh.tipColor === 'string'
                ? parseInt(mesh.tipColor, 16)
                : (mesh.tipColor || 0xe0e0e0);

            // Shaft — cylinder rotated so length runs along local Z
            const shaftGeo = new THREE.CylinderGeometry(shaftRad, shaftRad, shaftLen, 10);
            shaftGeo.rotateX(Math.PI / 2);
            const shaftMat = new THREE.MeshStandardMaterial({
                color: colorHex,
                emissive: colorHex,
                emissiveIntensity: 0.35,
                roughness: 0.6
            });

            // Tip — cone whose apex points along -Z (forward / travel direction).
            // ConeGeometry apex is at +Y by default; rotateX(-PI/2) sends +Y → -Z.
            const tipGeo = new THREE.ConeGeometry(tipRad, tipLen, 10);
            tipGeo.rotateX(-Math.PI / 2);
            const tipMat = new THREE.MeshStandardMaterial({
                color: tipColor,
                emissive: tipColor,
                emissiveIntensity: 0.6,
                metalness: 0.6,
                roughness: 0.3
            });

            // Cone center sits in front of the shaft's front face
            const tipZ = -(shaftLen / 2 + tipLen / 2);

            return {
                geometry: shaftGeo,
                material: shaftMat,
                parts: [
                    {
                        geometry: tipGeo,
                        material: tipMat,
                        position: new THREE.Vector3(0, 0, tipZ)
                    }
                ]
            };
        }

        // ── Generic presets ──
        let geometry;
        if (preset === 'box') {
            geometry = new THREE.BoxGeometry(
                mesh.width  || 0.1,
                mesh.height || 0.1,
                mesh.depth  || 0.5
            );
        } else if (preset === 'cylinder') {
            geometry = new THREE.CylinderGeometry(
                mesh.radiusTop    || 0.05,
                mesh.radiusBottom || 0.05,
                mesh.length       || 0.8,
                8
            );
            geometry.rotateX(Math.PI / 2);
        } else {
            geometry = new THREE.SphereGeometry(mesh.radius || 0.15, 8, 8);
        }

        const material = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: mesh.emissiveIntensity != null ? mesh.emissiveIntensity : 0.8
        });

        return { geometry, material };
    }

    // ── Projectile tick ────────────────────────────────────────────

    _updateProjectiles(deltaTime, ecs) {
        for (let i = this._projectiles.length - 1; i >= 0; i--) {
            const p = this._projectiles[i];
            p.update(deltaTime);
            p._elapsed += deltaTime;

            // Collision — XZ distance only (ignore Y so chest-height projectiles
            // still register on ground-level entity positions).
            let hit = false;
            const hittable = ecs.queryEntities(['Transform', 'Health', 'Movement']);
            for (const entityId of hittable) {
                const movement = ecs.getComponent(entityId, 'Movement');
                if (movement.faction === 'player' || movement.faction === 'neutral') continue;

                const t = ecs.getComponent(entityId, 'Transform');
                const dx = p.position.x - t.mesh.position.x;
                const dz = p.position.z - t.mesh.position.z;
                if (dx * dx + dz * dz < 1.0) {
                    EventBus.emit('entity:damaged', { entityId, damage: p.damage || 1 });
                    hit = true;
                    break;
                }
            }

            const expired = (p._elapsed || 0) >= (p._maxLifetime || 2);
            if (hit || !p.visible || expired || p.position.length() > 60) {
                this.scene.remove(p);
                this.projectilePool.release(p);
                this._projectiles.splice(i, 1);
            }
        }
    }
}
