# Base Defense Tycoon: Design Specification (Phaser 3 — 2D)

---

## 1. Vision & Aesthetic

**Style:** Hyper-casual "Fake Ad" aesthetic. High saturation, high contrast, and extremely smooth tweened animations. Everything should feel bouncy, snappy, and overflowing with visual feedback.

**Perspective:** Top-down 2D with a smooth-follow camera (Phaser's `camera.startFollow` with a configurable `lerpX`/`lerpY` for that "rubber-band" feel).

**Environment:**

- **Safe Zone:** Vibrant green tiled floor with a subtle grid overlay drawn via `Phaser.GameObjects.TileSprite`.
- **Danger Zone:** Dusty orange/brown sand surrounding the base, also a tile sprite with a rougher texture pattern.
- **Boundary:** A soft radial gradient vignette (rendered as a large semi-transparent sprite or shader) visually bleeds between the two zones.

**Characters:**

- **Player:** A bright blue circle with a smaller golden circle "crown" floating just above it (offset on the Y-axis). Both are drawn with `Phaser.GameObjects.Graphics` or simple sprite atlases.
- **Enemies:** Flat red circles with two small white-dot "glowing eyes." Simple, iconic, and instantly readable at the top-down scale.

---

## 2. Controls & Movement

**Input:** Virtual Dynamic Joystick — implemented via pointer events (`pointerdown`, `pointermove`, `pointerup`). The joystick base appears wherever the player first touches/clicks, and the thumb follows within a clamped radius.

**Feedback:**

- The player sprite snaps rotation instantly to the direction of travel (using `Phaser.Math.Angle.Between` and setting the sprite's `rotation`).
- Walking triggers a rhythmic "squash and stretch" tween: the player's `scaleX` compresses to ~1.15 while `scaleY` shrinks to ~0.85, then inverts, looping at the step frequency. This is handled by a chained `Phaser.Tweens` timeline.
- Movement speed is high but uses a small `Phaser.Math.Linear` (lerp) acceleration curve each frame to give a sense of weight.

---

## 3. The "Magnetic Harvest" & "Jelly Stack" (Core Juice)

This is the primary visual hook of the game.

### The Collection Arc

When an enemy dies, it "pops" (a quick scale-up-to-zero tween with a white flash overlay) and spawns 3–5 flat red "Meat" disk sprites at its position.

**Magnetic Pull:** When the player is within a configurable `pullRadius`, the disks don't simply slide — they *leap*.

**Trajectory:** Each disk follows a tweened parabolic arc toward the player's back. This is achieved by tweening the disk's `x`/`y` toward the player while simultaneously tweening a separate `arcOffset` property on a sine curve (peaking at the midpoint of the tween). The disk's rendered Y position = `tweenedY - arcOffset`, creating a convincing "Thwup" lob effect in 2D. A slight rotation tween on the disk during flight adds to the polish.

### The Jelly Stack Physics

**The Pillar:** Collected Meat stacks vertically "behind" the player (rendered as a column of small disk sprites extending upward from the player's position, offset slightly opposite the facing direction).

**Lag-Follow Logic:** The stack is not rigidly attached.

- The bottom-most disk follows the player's position exactly.
- Each subsequent disk follows the one below it with a ~0.05s positional delay, achieved by storing a short history buffer of positions (a ring buffer of the last N frames) and having item `i` read from `history[i * delayFrames]`.

**Sway:** When the player turns or stops abruptly, the accumulated positional lag causes the upper disks to "lean" in the direction of momentum. The visual result is a satisfying jelly-like wobble. A small sinusoidal `x` oscillation is layered on top during deceleration to amplify the effect.

---

## 4. Expansion & Unlock System

The base grows through "Reverse Vacuum" investment zones.

### Visual Cues

- **Dashed Borders:** Unlock zones have animated "marching ants" borders. This is drawn with `Phaser.GameObjects.Graphics` using `lineBetween` with a dash pattern, and the dash offset is incremented each frame to create the marching effect.
- **Hologram Preview:** Inside a locked zone, a semi-transparent, blue-tinted version of the structure (Turret, Wall, or Barracks) is rendered at ~30% alpha with a slow pulsing alpha tween and a gentle floating bob (Y oscillation tween).
- **Floating UI:** A chunky bitmap-font number (e.g., "50") sits above a bouncing resource icon sprite (a simple `y` sine-wave tween).

### The "Drain" Animation

When the player stands in a zone, movement input is disabled.

**Rhythmic Peeling:** Meat disks peel off the top of the player's stack one by one every 0.1s using a `Phaser.Time.TimerEvent`. Each disk tweens from the stack top toward the UI counter position (the zone's floating number) along a small arc.

**Sound/Visual Sync:** Each "peel" triggers a quick scale-up/down tween ("pop") on the UI counter text, plus a screen-shake micro-pulse (`camera.shake` at very low intensity/duration).

**The Construction:** When the counter hits 0, the hologram sprite plays a particle burst (white circle particles via `Phaser.GameObjects.Particles.ParticleEmitter`), then the real structure sprite tweens in: scaling from 0.0 → 1.2 → 1.0 with an `Elastic` ease, accompanied by a radial "shockwave" ring sprite that scales up and fades out.

---

## 5. Defense Mechanics

**Auto-Combat:** The player has a white circular "Aggro Range" indicator drawn on the ground (a `Graphics` circle at low alpha). When enemies overlap this zone (checked via `Phaser.Math.Distance.Between`), the player automatically fires white pellet sprites toward the nearest enemy. Pellets are managed via an **object pool** (`Phaser.GameObjects.Group` with `maxSize`, `createCallback`, and `runChildUpdate`).

**Turret Structures:** Simple top-down tower sprites (a square base with a darker barrel line) that rotate toward and fire at the nearest red enemy within their own range circle.

**Wall Barriers:** Rectangular block sprites that enemies must attack and destroy before reaching the "Core." Walls flash red on hit (a quick tint tween) and display a small health bar (`Graphics` rect) above them.

**Upgrades:** Special zones that increase the player's stack capacity, fire rate, or "Magnetic Pull" range. Each upgrade zone uses the same drain mechanic but with a distinct icon (e.g., a magnet icon for pull range, a lightning bolt for fire rate).

---

## 6. Progression Loop

1. **Harvest:** Venture into the Danger Zone to kill enemies and collect "Meat."
2. **Stack:** Build a massive, wobbling tower of resources trailing behind you.
3. **Expand:** Return to the Safe Zone to "drain" your stack into new unlock tiles.
4. **Fortify:** Build turrets to make harvesting easier and safer.
5. **Level Up:** Once all tiles in a ring are unlocked, the environment expands (camera bounds grow, new tile layers fade in), revealing new resource types and tougher enemies.

---

## 7. Game Levels

### Level 1: The Lone Outpost (Tutorial)

**Story:** You awaken in a deserted wasteland with nothing but a basic base core. You must secure the perimeter before nightfall.

**Objective:** Build your first "Wooden Sentry" and collect 20 Meat.

**Enemies:** "Slow Rollers" — red circles that drift very slowly toward the base and don't attack.

**Survival/Defense:** Focus on learning the "Magnetic Harvest" mechanic. No walls needed yet.

**Engagement Hook:** The first time the player builds the turret, it instantly clears a small swarm of enemies. The screen fills with meat disk sprites and the pull animation goes wild — a huge "dopamine hit" of power.

### Level 2: The Dusty Junction

**Story:** Scouts have reported a larger swarm approaching from the north. You need to establish a bottleneck.

**Objective:** Unlock the "North Gate" and build 2 Stone Walls.

**Enemies:** "Fast Runners" — small, thin-stroked circles that move in randomized zig-zag paths (sinusoidal offset applied to their velocity vector each frame).

**Survival/Defense:** Introduction of manual repair. If a wall takes damage, the player must stand near it and "drain" meat into it to heal, using the same peel animation.

**Engagement Hook:** Managing the "Jelly Stack" while dodging faster enemies adds a layer of kinetic skill.

### Level 3: The Neon Oasis

**Story:** You've discovered a rare resource pool in the center of the desert. The local enemies are more aggressive here.

**Objective:** Build the "Auto-Collector" — a structure that emits its own magnetic pull field, automatically attracting nearby meat disks.

**Enemies:** "Tank Circles" — large, slow enemies with a visible health ring around them. They drop 10x the meat but take many hits to destroy.

**Survival/Defense:** Build "Splash Turrets" that deal area-of-effect damage (rendered as an expanding translucent circle on impact).

**Engagement Hook:** The screen fills with red meat disks. The "Magnetic Pull" visual becomes a chaotic, satisfying swarm of sprites arcing toward the player from every direction.

### Level 4: The Sandstorm Siege

**Story:** A massive storm has reduced visibility. Enemies are coming from all directions.

**Objective:** Surround the base with a complete 360-degree wall ring and survive for 2 minutes.

**Enemies:** "Burrowers" — enemies that fade in (alpha tween from 0 to 1) inside the safe zone, bypassing walls.

**Survival/Defense:** The player must prioritize upgrading their "Aggro Range" to detect enemies earlier. A fog-of-war overlay (a large dark sprite with a circular alpha mask centered on the player, achieved via a `BitmapMask` on a full-screen dark rectangle) limits visibility.

**Engagement Hook:** High-intensity survival. The "Reverse Vacuum" drain animation is the only way to quickly rebuild falling walls under pressure.

### Level 5: The Grand Fortress (Boss Level)

**Story:** The "Circle King" has arrived to reclaim the wasteland.

**Objective:** Defeat the Boss — a massive, multi-segment enemy composed of several overlapping circles with a prominent health bar at the top of the screen.

**Enemies:** Infinite waves of standard enemies led by the Boss.

**Survival/Defense:** Use "Golden Turrets" (temporary high-power boosts) that require massive amounts of meat to activate. These have a glowing gold tint and exaggerated muzzle-flash particles.

**Engagement Hook:** The Boss "explodes" into hundreds of meat disks upon defeat (a massive particle-style burst using the object pool), allowing the player to build a stack so tall it extends well off-screen, signaling the transition to Level 6 (The Frozen Tundra).

---

## 8. Technical Implementation: Single-File Phaser 3

To ensure maximum performance and portability (fitting for a "playable ad" prototype), the game is built within a **single HTML file** using the following architecture:

### Core Framework

- **Engine:** Phaser 3 (loaded via CDN: `https://cdnjs.cloudflare.com/ajax/libs/phaser/3.80.1/phaser.min.js`).
- **Rendering:** Phaser's WebGL renderer (automatic fallback to Canvas). Phaser handles the render pipeline, draw call batching, and texture management internally.
- **Optimization:** Object Pooling via `Phaser.GameObjects.Group` for projectiles, enemies, and "Meat" disks. Groups are configured with `maxSize`, recycling inactive members via `getFirstDead()` to maintain consistent 60 FPS on mobile.

### Scene Structure

The game uses Phaser's `Scene` system. For a single-file build, all scenes are defined as classes within the same script block:

- **BootScene:** Generates all procedural textures (via `Phaser.GameObjects.Graphics` rendered to `RenderTexture` or `generateTexture`) and stores them in the texture manager. This avoids any external image dependencies.
- **GameScene:** The main gameplay loop containing all core systems.
- **UIScene:** A parallel scene (`scene.launch`) rendered on top of GameScene, handling the joystick, HUD, resource counters, and "Level Complete" overlays. This keeps UI logic cleanly separated from game-world rendering.

### Key Systems

**Game State Manager:** A plain JavaScript object (or a lightweight class) tracking Level, Resources, Player Stats, Building Unlocks, and Enemy Wave data. Passed between scenes via `scene.data` or the Phaser registry (`this.registry`).

**Movement & Camera:**

- Player movement uses frame-rate-independent lerp: `player.x += (targetX - player.x) * speed * delta`.
- Camera follows the player via `this.cameras.main.startFollow(player, true, 0.08, 0.08)` for the rubber-band effect.

**Jelly Stack System:**

- A ring buffer stores the player's position every frame (capped at `stackCapacity * delayFrames` entries).
- Each stacked disk sprite reads its position from `buffer[currentIndex - (i * delayFrames)]`, creating the trailing lag.
- A small sinusoidal X offset is applied based on the player's angular velocity to simulate momentum sway.

**Magnetic Harvest Arcs:**

- Each collected disk runs a compound tween: `x`/`y` tween toward the player with an `ease: 'Quad.easeIn'`, combined with a separate `arcHeight` property tweened on a `Sine.easeOut` curve.
- The disk's visual Y is offset by `-arcHeight` each frame in a custom `preUpdate` or via the scene's `update` loop.

**Drain Animation:**

- A `Phaser.Time.TimerEvent` with `delay: 100` and `repeat: stackCount` peels disks off the stack, tweening each toward the target UI element and decrementing the counter with a "pop" scale tween.

**Particle Effects:**

- Construction bursts, enemy death flashes, and boss explosions all use `Phaser.GameObjects.Particles.ParticleEmitter` configured with appropriate `speed`, `lifespan`, `scale`, `alpha`, and `blendMode: 'ADD'` for glowing effects.

**Collision Detection:**

- Overlap checks for magnetic pull range and aggro range use `Phaser.Math.Distance.Between` against pooled enemy groups each frame.
- Projectile-to-enemy and enemy-to-wall collisions use `this.physics.add.overlap()` with Arcade Physics, keeping collision simple and performant.

### Asset Generation (Zero External Dependencies)

All visual assets are generated procedurally at boot time:

- **Player, Enemies, Meat disks:** `Graphics` objects drawing circles, arcs, and fills, then calling `.generateTexture('key', width, height)` to bake them into reusable textures.
- **Structures (Turrets, Walls):** Composed from basic rectangles and lines drawn to Graphics, then baked.
- **Ground Tiles:** Small canvas patterns (grid lines on solid fills) generated via `Graphics` and used as `TileSprite` sources.
- **UI Elements:** Bitmap fonts generated from a canvas, or Phaser's built-in `Text` objects styled with `fontFamily`, `fontSize`, `stroke`, and `shadow` properties for that chunky "mobile game" look.

### Performance Targets

| Metric | Target |
|---|---|
| Frame Rate | 60 FPS on mid-range mobile (2020+) |
| Max Active Enemies | 50 (pooled) |
| Max Active Meat Disks | 100 (pooled) |
| Max Active Projectiles | 30 (pooled) |
| Draw Calls | Minimized via texture atlases (baked at boot) |
| File Size | Single HTML file, < 200KB excluding Phaser CDN |