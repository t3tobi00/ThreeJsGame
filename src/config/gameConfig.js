export const COLORS = {
    player: 0x00aaff,
    crown: 0xffcc00,
    safeZone: 0x44aa44,
    dangerZone: 0xcc7744,
    grid: 0xffffff,
    sun: 0xffffff,
    ambient: 0xbbccff
};

export const PLAYER_CONFIG = {
    speed: 8,
    acceleration: 0.15,
    rotationLerp: 0.2,
    squashStretchFactor: 0.1,
    crownFloatSpeed: 2,
    crownFloatHeight: 0.2
};

export const CAMERA_CONFIG = {
    fov: 45,
    near: 0.1,
    far: 1000,
    offset: { x: 15, y: 15, z: 15 },
    lookAtOffset: { x: 0, y: 0, z: 0 },
    lerpFactor: 0.1
};

export const WORLD_CONFIG = {
    safeZoneSize: 20,
    dangerZoneSize: 100,
    gridSpacing: 1
};

export const ENEMY_CONFIG = {
    speed: 3,
    spawnInterval: 2,
    spawnDistance: 45,
    health: 3,
    size: 0.8,
    eyeColor: 0xff0000,
    bodyColor: 0xff4444
};

export const COMBAT_CONFIG = {
    aggroRange: 8,
    projectileSpeed: 20,
    fireRate: 0.5, // Seconds between shots
    projectileColor: 0xffffff,
    projectileSize: 0.15
};

export const STACK_CONFIG = {
    pullRange: 5,
    collectDistance: 0.5,
    stackOffset: 0.25, // Height of each disk in stack
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
