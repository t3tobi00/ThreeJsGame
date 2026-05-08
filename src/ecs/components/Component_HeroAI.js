import * as THREE from 'three';

/**
 * Component_HeroAI — Per-soldier guard / pursuit / defend state.
 *
 * The soldier idles at `homePosition`. Each frame, HeroAISystem evaluates
 * a small set of behaviors (avoid-poison, defend-worker, defend-wall,
 * defend-king [stub], group-cohesion [stub], aggro-nearest) and picks
 * the highest-utility behavior. The chosen behavior may set `target`
 * to an enemy entity id and pursue it at Movement.speed; HeroAISystem
 * stops the soldier at `attackRange` so the ContactDamage / SkillSystem
 * auto-swing can land.
 *
 * `homePosition` is populated on spawn (legacy hero spawner; in the
 * prototype this is the soldier's spawn-pad location).
 *
 * Runtime fields written by HeroAISystem each frame:
 *   - target            : entity id of the enemy currently being pursued
 *   - state             : legacy display string ('idle' | 'pursue' | 'flee')
 *   - behavior          : winning behavior key from the score loop
 *                         ('idle' | 'aggro' | 'defend-worker' | 'defend-wall'
 *                          | 'defend-king' | 'avoid-poison' | 'cohesion' | 'yield')
 *   - graceTimer        : counts down each frame; while > 0 acquisition is suppressed
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
        this.behavior = 'idle';

        this.graceTimer = spawnGrace;
    }
}
