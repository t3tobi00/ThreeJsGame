import * as THREE from 'three';

/**
 * Component_HeroAI — Per-hero guard + pursuit state.
 *
 * The hero idles at `homePosition`. Any enemy whose position enters
 * `guardRadius` of home becomes a candidate target. The HeroAISystem
 * moves the hero toward the chosen target; the SkillSystem (via the
 * equipped melee skill) handles the actual attacking once the hero is
 * within weapon range.
 *
 * `homePosition` is populated on spawn by HeroBar (player's initial
 * spawn point). The tunable fields come from hero.json (editable via
 * the Hero Editor).
 */
export class Component_HeroAI {
    constructor({
        guardRadius = 8,
        attackRange = 2.5,
        returnSpeed = 2,
        spawnGrace = 1.0
    } = {}) {
        this.guardRadius = guardRadius;
        this.attackRange = attackRange;
        this.returnSpeed = returnSpeed;

        this.homePosition = new THREE.Vector3();
        this.target = null;
        this.state = 'idle';

        // Time remaining before the hero is allowed to acquire a target.
        // Counts down in HeroAISystem. Prevents the "runs at the player on
        // spawn" behavior caused by an enemy already being in range on the
        // first frame after spawn.
        this.graceTimer = spawnGrace;
    }
}
