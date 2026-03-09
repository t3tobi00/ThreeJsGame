# Achieving the "Fake Ad" Hyper-Casual Isometric Look in Three.js

## The Target Aesthetic

The goal is the miniature diorama look seen in games like Kingshot, Mob Control, and other hyper-casual mobile ads: a small, cute world viewed from above at an angle, where the entire play area fits on a phone screen with room to spare. Everything is tiny, colorful, and proportional.

---

## The Golden Rules (Read This First)

### Rule 1: Use OrthographicCamera, Not PerspectiveCamera
PerspectiveCamera distorts edges and makes nearby objects look huge. Orthographic gives the clean, parallel-line isometric look where a fence post at the edge of the screen is the same size as one in the center. This is non-negotiable for this aesthetic.

### Rule 2: Zoom Out, Don't Shrink The World
When things look too big on mobile, the instinct is to shrink the world (reduce safe zone size, shrink entities). **This is always wrong.** It makes the world feel cramped and forces you to slow down all speeds to compensate. Instead, increase the camera's `frustumSize` to see more of the world. The world size should be dictated by gameplay needs, the camera should adapt to show it.

### Rule 3: The Base Should Fill ~50-60% of the Screen
On a mobile portrait screen, the diamond-shaped base (rotated square) should leave visible danger zone on all 4 sides. If the base fills more than 65% of the screen, you're too zoomed in. If it fills less than 40%, the player character becomes too tiny to read.

### Rule 4: Camera Angle is ~50° From Ground
The angle between the ground plane and the camera's line of sight should be approximately 50 degrees. This is steep enough to see the layout from above, but shallow enough to see the front faces of characters and buildings. Shallower angles (30°) make fences look like walls and hide the ground layout. Steeper angles (70°+) lose the 3D depth and look like a flat map.

---

## The Exact Camera Setup That Works

```javascript
// OrthographicCamera config
const CAMERA_CONFIG = {
    frustumSize: 22,          // How many world units fit vertically on screen
    near: -100,               // Negative near plane needed for ortho
    far: 1000,
    offset: { x: 12, y: 20, z: 12 },  // Camera position relative to target
    lerpFactor: 0.08          // Smooth follow speed
};
```

### Why These Exact Numbers

**frustumSize = 22**: With a safe zone of 18 units, the ortho camera shows 22 units vertically. The isometric diamond of an 18-unit square has a diagonal of ~25.5 units, which fits within the horizontal frustum on most phones (aspect ~0.45-0.56 gives horizontal range of ~9.9-12.3 units per side). This means the full base diamond is visible with danger zone margins.

**offset (12, 20, 12)**:
- The camera sits at position (playerX + 12, playerY + 20, playerZ + 12)
- The angle from ground = atan2(20, sqrt(12² + 12²)) = atan2(20, 17) ≈ **50°**
- Equal X and Z offsets (12, 12) create a true 45° isometric rotation around the Y axis
- This means the diamond sits with corners pointing up/down/left/right on screen

**How to calculate the angle**: `angleDegrees = Math.atan2(offsetY, Math.sqrt(offsetX² + offsetZ²)) * (180/Math.PI)`

### Camera Class Implementation

```javascript
import * as THREE from 'three';

class Camera {
    constructor() {
        const aspect = window.innerWidth / window.innerHeight;
        const s = CAMERA_CONFIG.frustumSize;

        this.camera = new THREE.OrthographicCamera(
            s * aspect / -2,   // left
            s * aspect / 2,    // right
            s / 2,             // top
            s / -2,            // bottom
            CAMERA_CONFIG.near,
            CAMERA_CONFIG.far
        );

        this.camera.position.set(
            CAMERA_CONFIG.offset.x,
            CAMERA_CONFIG.offset.y,
            CAMERA_CONFIG.offset.z
        );
        this.camera.lookAt(0, 0, 0);
    }

    onResize() {
        const aspect = window.innerWidth / window.innerHeight;
        const s = CAMERA_CONFIG.frustumSize;
        this.camera.left = s * aspect / -2;
        this.camera.right = s * aspect / 2;
        this.camera.top = s / 2;
        this.camera.bottom = s / -2;
        this.camera.updateProjectionMatrix();
    }
}
```

### Camera Follow System

```javascript
update(deltaTime) {
    const targetPos = this.player.position.clone();
    const idealPos = targetPos.clone().add(new THREE.Vector3(
        CAMERA_CONFIG.offset.x,
        CAMERA_CONFIG.offset.y,
        CAMERA_CONFIG.offset.z
    ));
    // Frame-rate independent smoothing
    const smoothing = 1 - Math.pow(1 - CAMERA_CONFIG.lerpFactor, deltaTime * 60);
    this.camera.position.lerp(idealPos, smoothing);
    this.camera.lookAt(targetPos);
}
```

---

## World & Entity Proportions

These ratios matter more than absolute numbers. If you change one, scale the others.

### The Ratio Table (for safeZoneSize = 18)

| Element | Size | Ratio to World | Notes |
|---------|------|-----------------|-------|
| Safe zone | 18 units | 1.0x | The reference size |
| Danger zone | 100 units | 5.5x | Large enough to never see the edge |
| Player height | ~1.2 units | 0.067x | ~7% of world width — small and cute |
| Player radius | 0.3 units | 0.017x | Thin enough to navigate between things |
| Enemy size | 0.6 units | 0.033x | Readable but not dominating |
| Fence post height | 0.5 units | 0.028x | Knee-height, doesn't block overhead view |
| Fence post radius | 0.08 units | 0.004x | Thin individual posts with visible gaps |
| Fence spacing | 0.35 units | 0.019x | Posts are distinct, not a solid wall |
| Unlock zone | 1.6 units | 0.089x | ~9% of world — compact square |
| Unlock text plane | 1.44 units | 0.08x | Readable number without dominating |
| frustumSize | 22 units | 1.22x | Shows 22% more than the base vertically |

### The Critical Insight: Fence Height vs Camera Angle

The fence is the most common thing that goes wrong. At a 30° camera angle, a 1.2-unit tall fence post on a 10-unit world looks like a fortress wall because:
1. You're viewing it almost from the side, so its full height is visible
2. It's proportionally huge (12% of world width)
3. Thick posts at close spacing create a solid wall effect

At a 50° camera angle with thin 0.5-unit posts on an 18-unit world:
1. You're looking down enough that posts appear as short stubs
2. They're only 2.8% of world width
3. Gaps between posts are visible, creating a decorative border feel

**Formula for "does the fence look like a wall?"**: If `(fenceHeight / safeZoneSize) > 0.05` AND camera angle < 40°, it WILL look like a wall. Keep the ratio under 0.03 and angle above 45°.

---

## Common Mistakes and Why They Happen

### Mistake 1: Shrinking the World Instead of Zooming Out
**Symptom**: World feels cramped, speeds are slow, everything is close together.
**Why it happens**: On mobile, things look too big, so you reduce `safeZoneSize` from 20 to 10.
**What actually fixes it**: Increase `frustumSize`. The world size should stay large enough for comfortable gameplay. The camera adapts to show it.

### Mistake 2: Making Fence Logs "Chunky" for Visual Appeal
**Symptom**: Fence looks like a castle wall, blocks the view, makes the base feel like a cage.
**Why it happens**: "Chunky" geometry is a hyper-casual aesthetic principle, so you make thick logs.
**What actually fixes it**: Fences are the ONE thing that should be thin and delicate. Their job is to be a visual border, not a gameplay element. Chunky applies to player, enemies, structures — not fences.

### Mistake 3: Using a "Hero Angle" (Low Camera)
**Symptom**: Can't see the ground layout, fences look tall, no overview of approaching enemies.
**Why it happens**: Low camera angles (30°) look dramatic in third-person games, so it seems like a good idea.
**What actually fixes it**: Hyper-casual isometric games are NOT third-person games. The camera should be a surveillance camera looking down at a diorama, not a cinematic camera at shoulder height. 50° is the sweet spot.

### Mistake 4: Placing Game Elements Outside the Safe Zone
**Symptom**: Unlock zones overlap the fence or float on sand, layout looks broken.
**Why it happens**: Coordinates are set before the world size is finalized, or are copied from a different world size.
**What actually fixes it**: All interactive elements must satisfy: `abs(position.x) + elementSize/2 < safeZoneSize/2 - marginFromFence`. Use at least 1 unit margin from the fence.

### Mistake 5: Making UI/Zone Elements Too Large
**Symptom**: Unlock zones dominate the screen, text is huge, zones overlap each other.
**Why it happens**: You want numbers to be "readable on mobile" so you crank up size and text scale.
**What actually fixes it**: On mobile, the screen is held close to the face. A zone that's 9% of world width (1.6 units on 18-unit world) with a 1.0 text scale is perfectly readable. The numbers don't need to be billboard-sized.

---

## Quick-Start Template

If starting a new hyper-casual isometric Three.js game from scratch, use these values:

```javascript
// World
const WORLD_SIZE = 18;        // Safe zone side length
const DANGER_ZONE = 100;      // Background extends far

// Camera (Orthographic)
const FRUSTUM = 22;           // Vertical world units visible
const CAM_OFFSET = { x: 12, y: 20, z: 12 };  // 50° angle, 45° rotation

// Player
const PLAYER_SPEED = 10;      // Units per second
const PLAYER_RADIUS = 0.3;    // Body width
const PLAYER_HEIGHT = 1.2;    // Total height including head

// Fence
const FENCE_HEIGHT = 0.5;     // Short decorative posts
const FENCE_RADIUS = 0.08;    // Thin posts
const FENCE_SPACING = 0.35;   // Visible gaps between posts

// Interactive zones
const ZONE_SIZE = 1.6;        // ~9% of world width
const ZONE_TEXT_SCALE = 1.0;  // Don't over-scale text
const ZONE_OPACITY = 0.3;     // Subtle, not heavy

// Enemies
const ENEMY_SIZE = 0.6;       // Smaller than player
const ENEMY_SPEED = 2.5;      // Slower than player
const SPAWN_DISTANCE = 35;    // Visible before they arrive
```

### The Verification Checklist

Open on a phone in portrait mode and check:
- [ ] All 4 fence sides visible simultaneously
- [ ] Danger zone visible on all sides outside fence
- [ ] Player is small (~5% of screen height), cute, readable
- [ ] Fence posts look like a decorative border, not a wall
- [ ] Interactive zones are inside the fence, compact, not overlapping
- [ ] Incoming enemies visible well before reaching the fence
- [ ] Numbers on zones are readable without squinting
- [ ] Feels like looking down at a miniature diorama, not standing inside a room
