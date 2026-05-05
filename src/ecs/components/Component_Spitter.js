/**
 * Spitter — Ranged poison-spit attack.
 *
 * range: max distance to acquire a target.
 * cooldown: seconds between spit launches.
 * damage: HP removed on direct hit.
 * windupDuration: anim wind-up before projectile spawns (so the spit appears
 *                 to leave the mouth at the head-thrust peak).
 * projectileSpeed: world units per second.
 * arcHeight: peak Y rise of the parabolic flight path above straight-line.
 * targetFactions: which factions are valid victims.
 */
export class Component_Spitter {
    constructor({
        range = 5.0,
        cooldown = 1.5,
        damage = 5,
        windupDuration = 0.30,
        projectileSpeed = 8,
        arcHeight = 1.2,
        targetFactions = ['player', 'ally', 'structure']
    } = {}) {
        this.range = range;
        this.cooldown = cooldown;
        this.damage = damage;
        this.windupDuration = windupDuration;
        this.projectileSpeed = projectileSpeed;
        this.arcHeight = arcHeight;
        this.targetFactions = targetFactions;
        // Runtime
        this.timeSinceLastSpit = 999;
        this._isWindingUp = false;
    }
}
