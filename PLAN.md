# Base Defense Tycoon - Development Plan

## Phase 1: Foundation — Boilerplate, World & Player Movement

Get a playable character moving around a visible world with a satisfying camera.

### Deliverables

- **Project scaffolding** — Set up the full modular folder structure defined in CLAUDE.md (`src/config/`, `core/`, `entities/`, `systems/`, `ui/`, `utils/`)
- **Renderer & scene** — Initialize the WebGL renderer, scene, and isometric top-down camera
- **Environment** — Safe Zone (green, grid-textured floor) and Danger Zone (sandy surrounding area) as distinct ground planes
- **Lighting** — Sun + ambient lighting with shadows on the ground
- **Player entity** — Blue capsule with floating golden crown, procedural geometry
- **Movement** — Virtual dynamic joystick (appears on touch/click anywhere), smooth acceleration curve, instant rotation snap to travel direction
- **Squash & stretch** — Capsule compresses/stretches during movement
- **Camera follow** — Rubber-band camera with smooth trailing delay
- **Responsive canvas** — Handle window resize, cap pixel ratio

### Primary Skills

`threejs-fundamentals`, `threejs-lighting`, `threejs-materials`, `threejs-geometry`, `threejs-interaction`, `threejs-animation`

---

## Phase 2: Core Juice — Enemies, Magnetic Harvest & Jelly Stack

Build the two signature mechanics that make the game feel satisfying.

### Deliverables

- **Enemy entity** — Red cylinders with glowing eyes, spawning in the Danger Zone
- **Enemy AI** — Basic movement toward the base/player
- **Object pool** — Reusable pool for enemies and meat disks
- **Auto-combat** — White aggro range indicator on the floor; player auto-fires white pellets when enemies enter range
- **Enemy death** — "Pop" into 3-5 flat red meat disks on death
- **Magnetic Harvest** — Disks leap toward the player along parabolic Bezier arcs when within pull range, accelerating into the player
- **Jelly Stack** — Collected disks stack on the player's back with trailing lag-follow, sway on direction change, squash feedback on new additions
- **HUD** — Resource counter showing current stack size

### Primary Skills

`threejs-geometry`, `threejs-animation`, `threejs-materials`, `threejs-interaction`

---

## Phase 3: Base Building — Expansion, Drain & Structures (COMPLETE)

Turn collected resources into base infrastructure.

### Deliverables

- [x] **Unlock zones** — Defined areas with animated marching-ants dashed borders
- [x] **Hologram previews** — Semi-transparent, slowly spinning structure previews inside locked zones
- [x] **Floating UI** — 3D resource cost counter above each zone
- [x] **Drain mechanic** — Player enters zone, movement locks, meat peels off stack top rhythmically with scale-pulse feedback on the counter
- [x] **Construction animation** — Hologram bursts into particles, real structure boings into existence (scale overshoot then settle)
- [x] **Turret structure** — Wooden/metallic tower that auto-targets and fires at nearest enemy
- [x] **Wall structure** — Block barrier that enemies must destroy to pass
- [x] **Game state manager** — Track resources, unlocked buildings, player stats
- [x] **Level layout system** — Define which zones and structures exist per level

### Primary Skills

`threejs-materials`, `threejs-animation`, `threejs-geometry`, `threejs-textures`, `threejs-postprocessing`

---

## Phase 4: Progression — Levels 1 through 4

Build out the level content, enemy variety, upgrades, and escalating difficulty.

### Deliverables

- **Level 1: The Lone Outpost** — Tutorial flow; Slow Roller enemies; first turret build triggers a swarm-clear dopamine hit
- **Level 2: The Dusty Junction** — Fast Runner enemies (zig-zag movement); Stone Walls; wall repair mechanic (drain meat into damaged walls)
- **Level 3: The Neon Oasis** — Tank Cylinders (high HP, high meat drop); Splash Turrets (AoE); Auto-Collector building; screen floods with flying meat disks
- **Level 4: The Sandstorm Siege** — Reduced visibility (fog/particle storm); Burrower enemies (spawn inside safe zone); 360-degree wall defense; 2-minute survival timer; Aggro Range upgrade
- **Upgrade system** — Unlock zones that increase stack capacity, fire rate, or magnetic pull range
- **Level transition** — Environment expansion when all tiles in a ring are unlocked; "Level Complete" screen
- **Enemy variety system** — Configurable enemy types (speed, HP, size, drop count, behavior patterns)

### Primary Skills

`threejs-animation`, `threejs-shaders`, `threejs-postprocessing`, `threejs-materials`, `threejs-lighting`

---

## Phase 5: Boss & Polish — Level 5, Effects & Final Tuning

The climactic boss fight and final layer of visual polish.

### Deliverables

- **Level 5: The Grand Fortress** — Infinite standard enemy waves alongside the boss
- **Cylinder King boss** — Massive, segmented multi-part cylinder with a health bar; unique attack patterns
- **Golden Turrets** — Temporary high-power turret boost requiring large meat investment
- **Boss death** — Explodes into hundreds of meat disks; stack grows off-screen as a visual payoff
- **Particle effects** — Death pops, construction bursts, projectile impacts, sandstorm particles
- **Post-processing** — Bloom on emissive elements, screen effects for boss phase or sandstorm
- **Sound hooks** — Architecture for triggering audio events (even if sounds are added later)
- **Performance pass** — Profile on mobile, tighten object pools, audit shadow casters, optimize draw calls
- **Level 6 teaser** — Visual hint at "The Frozen Tundra" after boss defeat

### Primary Skills

`threejs-animation`, `threejs-postprocessing`, `threejs-shaders`, `threejs-geometry`, `threejs-lighting`
