export const COLORS = {
    player: 0x0088ff, // Deeper, more saturated blue
    crown: 0xffdd00,  // Bright gold
    safeZone: 0x66cc66, // Lush emerald green
    dangerZone: 0xe6c280, // Golden terracotta sand
    grid: 0xffffff,
    sun: 0xffeedd,
    ambient: 0xbbccff
};

export const PLAYER_CONFIG = {
    speed: 10,
    acceleration: 0.35,
    deceleration: 0.5,
    velocityDeadzone: 0.1,
    rotationLerp: 0.2,
    squashStretchFactor: 0.1,
    crownFloatSpeed: 2,
    crownFloatHeight: 0.2
};

export const CAMERA_CONFIG = {
    frustumSize: 22, // Zoomed out to show full base + danger zone
    near: -100,
    far: 1000,
    offset: { x: 12, y: 20, z: 12 }, // Steeper ~50° isometric angle
    lookAtOffset: { x: 0, y: 0, z: 0 },
    lerpFactor: 0.08
};

export const WORLD_CONFIG = {
    safeZoneSize: 18, // Large enough for proper gameplay space
    dangerZoneSize: 100,
    gridSpacing: 1
};

export const ENEMY_CONFIG = {
    speed: 2.5,
    spawnInterval: 2,
    spawnDistance: 35,
    health: 3,
    size: 0.6,
    eyeColor: 0xff0000,
    bodyColor: 0xff4444
};

export const COMBAT_CONFIG = {
    aggroRange: 10,
    projectileSpeed: 18,
    fireRate: 0.5, // Seconds between shots
    projectileColor: 0xffffff,
    projectileSize: 0.12
};

export const STACK_CONFIG = {
    pullRange: 5,
    collectDistance: 0.5,
    stackOffset: 0.22, // Height of each disk in stack (adjusted for chunkiness)
    followLag: 0.1,    // Delay for each disk follow
    wobbleIntensity: 0.3,
    maxStackSize: 20
};

export const COLORS_P2 = {
    enemy: 0xff4444,
    meatDisk: 0xff3333,
    projectile: 0xffffff,
    aggroRing: 0xffffff
};

export const COLORS_P3 = {
    unlockZone: 0xffffff,
    unlockZoneBase: 0x224422, // Darker green for the flat base
    hologram: 0x00aaff,
    turret: 0xaaaaaa,
    wall: 0x888888,
    particle: 0xffffff
};

export const ZONE_CONFIG = {
    size: 1.6,           // Compact zones that fit inside the base
    drainRate: 0.1,      // Seconds between each disk peel
    marchingAntsSpeed: 0.3,
    hologramRotationSpeed: 1.0,
    hologramOpacity: 0.3,
    textScale: 1.0       // Readable but not dominating
};

export const TURRET_CONFIG = {
    cost: 15,
    fireRate: 0.8,       // Seconds between shots
    aggroRange: 12,
    projectileSpeed: 25,
    hp: 50
};

export const WALL_CONFIG = {
    cost: 5,
    hp: 100,
    size: { x: 2, y: 1.5, z: 0.8 }
};

export const PARTICLE_CONFIG = {
    burstCount: 20,
    duration: 0.8,
    size: 0.1
};
