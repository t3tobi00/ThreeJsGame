Base Defense Tycoon: Design Specification

1. Vision & Aesthetic

Style: Hyper-casual "Fake Ad" aesthetic. High saturation, high contrast, and extremely smooth animations.

Perspective: Isometric top-down with a "rubber-band" camera follow (slight delay for smoothness).

Environment: - Safe Zone: Vibrant green, grid-textured floor.

Danger Zone: Dusty orange/brown sand surrounding the base.

Characters:

Player: A sleek blue capsule wearing a floating golden crown.

Enemies: Low-poly red cylinders with glowing eyes.

2. Controls & Movement

Input: Virtual Dynamic Joystick (appears anywhere on touch/click).

Feedback: - The player snaps rotation instantly to the direction of travel.

Walking triggers a "squash and stretch" animation (the capsule compresses slightly on impact with the ground).

Movement speed is high but has a tiny acceleration curve for weight.

3. The "Magnetic Harvest" & "Jelly Stack" (Core Juice)

This is the primary visual hook of the game.

The Collection Arc

When an enemy dies, it "pops" into 3-5 flat red "Meat" disks.

Magnetic Pull: When the player is within range, the disks don't slide; they leap.

Trajectory: A parabolic "Thwup" arc. The disk gains height (Y-axis) and accelerates toward a target point on the player's back.

The Jelly Stack Physics

The Pillar: Collected Meat stacks vertically on the player's back like poker chips.

Lag-Follow Logic: The stack is not a rigid body.

The bottom-most item follows the player perfectly.

Each subsequent item follows the one below it with a 0.05s delay.

Sway: When the player turns or stops abruptly, the stack "leans" into the momentum, creating a satisfying jelly-like wobble.

4. Expansion & Unlock System

The base grows through "Reverse Vacuum" investment zones.

Visual Cues

Dashed Borders: Unlock zones have animated "marching ants" borders (white dashed lines moving in a loop).

Hologram Preview: Inside an locked zone, a semi-transparent, blue-tinted version of the structure (Turret, Wall, or Barracks) floats and spins slowly.

Floating UI: A chunky 3D number (e.g., "50") sits above a bouncing resource icon.

The "Drain" Animation

When the player stands in a zone, movement is locked.

Rhythmic Peeling: Meat disks peel off the top of the player's stack one by one every 0.1s.

Sound/Visual Sync: Each "peel" is accompanied by a scale-up/down "pop" on the UI counter.

The Construction: When the counter hits 0, the hologram explodes into white particles, and the real structure "Boings" into existence (scaling from 0.0 to 1.2 then settling at 1.0).

5. Defense Mechanics

Auto-Combat: The player has a white circular "Aggro Range" indicator on the floor. When enemies enter, the player automatically fires white pellets.

Turret Structures: Simple wooden or metallic towers that fire at the nearest red cylinder.

Wall Barriers: Blocks that enemies must destroy before reaching the "Core."

Upgrades: Special zones that increase the player's stack capacity, fire rate, or "Magnetic Pull" range.

6. Progression Loop

Harvest: Venture into the Danger Zone to kill enemies and collect "Meat."

Stack: Build a massive, wobbling tower of resources on your back.

Expand: Return to the Safe Zone to "drain" your stack into new unlock tiles.

Fortify: Build turrets to make harvesting easier and safer.

Level Up: Once all tiles in a ring are unlocked, the environment expands, revealing new resource types and tougher enemies.

7. Base Defense Tycoon: Game Levels

Level 1: The Lone Outpost (Tutorial)

Story: You awaken in a deserted wasteland with nothing but a basic base core. You must secure the perimeter before nightfall.

Objective: Build your first "Wooden Sentry" and collect 20 Meat.

Enemies: "Slow Rollers" (Red cylinders that move very slowly and don't attack).

Survival/Defense: Focus on learning the "Magnetic Harvest" mechanic. No walls are needed yet.

Engagement Hook: The first time the player builds the turret, it instantly clears a small swarm of enemies, providing a huge "dopamine hit" of power.

Level 2: The Dusty Junction

Story: Scouts have reported a larger swarm approaching from the north. You need to establish a bottleneck.

Objective: Unlock the "North Gate" and build 2 Stone Walls.

Enemies: "Fast Runners" (Small, thin cylinders that move in zig-zags).

Survival/Defense: Introduction of manual repair. If a wall takes damage, the player must "drain" meat into it to heal it.

Engagement Hook: Managing the "Jelly Stack" while dodging faster enemies adds a layer of kinetic skill.

Level 3: The Neon Oasis

Story: You've discovered a rare resource pool in the center of the desert. The local cylinders are more aggressive here.

Objective: Build the "Auto-Collector" (a building that sucks in nearby meat automatically).

Enemies: "Tank Cylinders" (Large, slow enemies that drop 10x the meat but take many hits).

Survival/Defense: Build "Splash Turrets" that deal area-of-effect damage.

Engagement Hook: The screen fills with red meat disks. The "Magnetic Pull" visual becomes a chaotic, satisfying swarm of items flying toward the player.

Level 4: The Sandstorm Siege

Story: A massive storm has reduced visibility. Enemies are coming from all directions.

Objective: Surround the base with a complete 360-degree wall and survive for 2 minutes.

Enemies: "Burrowers" (Enemies that pop up inside your safe zone).

Survival/Defense: The player must prioritize upgrading their "Aggro Range" to see enemies through the storm.

Engagement Hook: High-intensity survival. The "Reverse Vacuum" drain animation is the only way to quickly rebuild falling walls under pressure.

Level 5: The Grand Fortress (Boss Level)

Story: The "Cylinder King" has arrived to reclaim the wasteland.

Objective: Defeat the Boss (a massive, segmented 3D cylinder).

Enemies: Infinite waves of standard enemies led by a giant Boss with a health bar.

Survival/Defense: Use "Golden Turrets" (temporary high-power boosts) that require massive amounts of meat to activate.

Engagement Hook: The Boss "explodes" into hundreds of meat disks upon defeat, allowing the player to build a stack so high it goes off-screen, signaling the transition to Level 6 (The Frozen Tundra).

8. Technical Implementation: Single Script Three.js

To ensure maximum performance and portability (fitting for a "playable ad" prototype), the game is built within a single HTML file using the following architecture:

Core Framework

Engine: Three.js (via CDN).

Rendering: WebGLRenderer with shadows enabled and a WebXR compatible loop for future mobile VR/AR expansion.

Optimization: Object Pooling for projectiles, enemies, and "Meat" disks to ensure consistent 60FPS on mobile devices.

Script Structure

Scene Setup: Initialization of the PerspectiveCamera, Scene, and DirectionalLight (for crisp shadows).

Game State Manager: A central object tracking Level, Resources, Player Stats, and Building Unlocks.

Physics & Animation Loop:

Movement: Frame-rate independent lerp for camera following and player movement.

Jelly Stack: A custom algorithm that calculates the position of stack items based on the trailing historical positions of the player.

Arcs: Quadratic Bezier curve calculations for the "Magnetic Harvest" and "Drain" animations.

UI Layer: Pure HTML/CSS overlays for the joystick, HUD, and "Level Complete" screens, keeping the WebGL canvas focused on 3D rendering.

Asset Generation: All geometry (cylinders, capsules, boxes) is generated using Three.js BufferGeometry primitives, using procedural textures created via HTML5 Canvas to avoid external image dependencies.