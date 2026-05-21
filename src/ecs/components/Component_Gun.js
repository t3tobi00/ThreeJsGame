/**
 * Component_Gun — Auto-aim gun for the player.
 *
 * Stop-to-fire model: PlayerGunSystem checks joystick magnitude each frame.
 * While the joystick is at rest the gun rotates the player toward the nearest
 * valid target and fires at `fireRate` shots/sec. While the joystick is active
 * the gun goes idle — movement owns rotation, gun owns rotation only when still.
 *
 * Tunables intentionally favor "punchy semi-auto" feel: 5 shots/sec cadence,
 * fast travel so the tracer is readable, range capped so positioning matters.
 */
export class Component_Gun {
    constructor({
        damage = 6,
        fireRate = 5,            // shots per second (cooldown = 1/fireRate)
        range = 12,              // max XZ distance to acquire a target
        bulletSpeed = 60,        // world-units per second
        bulletMaxRange = 16,     // bullet despawn distance from origin
        targetFactions = ['enemy', 'rival'],
        muzzleHeight = 1.0,      // shoulder/chest spawn height for bullets
        enabled = true,
    } = {}) {
        this.damage = damage;
        this.fireRate = fireRate;
        this.range = range;
        this.bulletSpeed = bulletSpeed;
        this.bulletMaxRange = bulletMaxRange;
        this.targetFactions = targetFactions;
        this.muzzleHeight = muzzleHeight;
        this.enabled = enabled;

        // Runtime state
        this.cooldownLeft = 0;
        this.isFiring = false;
        this.currentTargetId = -1;
    }
}
