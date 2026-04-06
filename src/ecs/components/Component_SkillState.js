/**
 * Component_SkillState — Runtime state machine for a skill being used by an entity.
 *
 * Tracks cooldowns, charges, reload, and windup per entity. Reset when the
 * active skill changes (SkillSystem handles re-init).
 */
export class Component_SkillState {
    constructor() {
        // Set to true to disable skill use (e.g. by SafeZoneSystem)
        this.enabled = true;

        // Current skill id being tracked (so we can detect swaps)
        this.trackedSkillId = null;

        // Time since last fire. When >= skill.fireRate → ready.
        this.cooldownLeft = 0;

        // Charges remaining before needing to reload. 0 = infinite (no reload).
        this.chargesLeft = 0;

        // Seconds left on reload. >0 → skill is unusable.
        this.reloadLeft = 0;

        // Windup state — player holds a "charging" pose before the shot fires.
        this.windupLeft = 0;
        this.isWindingUp = false;

        // Entity id of the target locked at windup start (so we don't lose it mid-charge)
        this.windupTargetId = null;

        // Combo counter for melee weapons — increments on every successful swing.
        // Used by skills with a "combo.finisherEvery" config to trigger a heavy
        // finisher swing on every Nth hit. Does NOT reset on idle (by design).
        this.comboCount = 0;
    }
}
