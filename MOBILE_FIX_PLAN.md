# Mobile Visual & Input Fix Plan

## Reference vs Current: Side-by-Side Analysis

### Reference Game (Kingshot Fake Ad)
- Camera is zoomed out — entire base visible with generous surrounding terrain
- Player character is **small** (~5% of screen height)
- Base occupies ~40% of screen, surrounded by visible danger zone on all sides
- Unlock zones are compact, proportional, don't dominate the view
- Fence/wall borders are thin and decorative
- Enemies visible from far away approaching the base
- Joystick is compact, responsive, bottom-right area
- Isometric angle is steep (roughly 50-60 degrees from ground), giving good overview
- Overall feel: miniature diorama you're looking down at

### Current Game (Our Build)
- Camera is WAY too close — safe zone fills the entire screen
- Player character is **huge** (~15-20% of screen height)
- Safe zone fills 80%+ of viewport, can't see edges or danger zone
- Unlock zones are massive dark-green rectangles dominating the view
- Aggro range circle is enormous, fills visible area
- Enemies appear only when already very close — no anticipation
- Joystick is oversized, movement feels sluggish with sliding after release
- Camera angle makes everything feel flat and cramped
- Overall feel: zoomed into a corner, claustrophobic

---

## Root Cause Analysis

### Problem 1: Camera Too Close (CRITICAL)
**Config:** `FOV: 35`, `offset: {x:0, y:20, z:15}`
- FOV of 35 is extremely narrow — like a telephoto lens
- Camera height 20 with forward offset 15 means camera is close to ground
- On mobile (portrait mode, tall aspect ratio), vertical FOV is even more constrained
- **Result:** Only ~10 world units visible horizontally on a phone screen

**Fix:** Increase FOV to ~50-60 and increase camera height/distance. The reference game shows roughly 30-40 world units visible horizontally.

### Problem 2: Player & Entities Too Large Relative to World
**Config:** Player capsule radius 0.4, height 0.8 (total height ~1.6 units). Safe zone is 20x20.
- Player is 1.6 units tall in a 20-unit world = 8% of world width
- With the close camera, this makes the player appear enormous
- Enemy size 0.8 is also proportionally large

**Fix:** Either shrink entities OR (better) increase the world size. Increasing world size + zooming out camera achieves the reference look.

### Problem 3: Unlock Zones Too Large & Visually Heavy
**Config:** Zone size 1.8 units, dark green background (0x224422), white dashed border
- 1.8 unit zones in a 20-unit world = each zone covers ~9% of world width
- The dark green fill makes them look like heavy UI blocks dropped on the ground
- Reference game zones are subtle outlines, not filled rectangles

**Fix:** Reduce zone visual weight — use outline-only borders (no filled background), make them smaller proportionally, or use subtle semi-transparent markers.

### Problem 4: Joystick Movement - Sluggish + Sliding (CRITICAL)
**Root cause in `MovementSystem.js` line 13:**
```js
this.velocity.lerp(targetVelocity, PLAYER_CONFIG.acceleration); // 0.15
```
- `lerp(target, 0.15)` means velocity changes by only 15% toward target per FRAME
- This is NOT frame-rate independent — at 60fps it's slow, at 30fps it's even slower
- When joystick releases (target=0), velocity lerps toward 0 at 15% per frame
- At 60fps: after 10 frames (167ms), velocity is still at `0.85^10 = 20%` of original
- **This is the sliding bug** — takes ~30+ frames to effectively stop

**Also:** `acceleration: 0.15` makes starting movement feel sluggish too.

**Fix:**
1. Make acceleration frame-rate independent using `1 - Math.pow(1 - factor, deltaTime * 60)`
2. Increase acceleration factor to 0.3-0.5 for snappier response
3. Add a velocity deadzone — if speed < threshold, snap to zero (eliminates drift)
4. Increase base speed from 8 to 10-12

### Problem 5: Joystick Touch UX
**Issues:**
- No deadzone — even tiny finger movements register as input
- `maxDist: 60px` is not responsive to screen size (too big on small phones, too small on tablets)
- No `touch-action: none` CSS — browser may intercept touches for scrolling/gestures
- Pointer events on the container compete with browser default touch behaviors

**Fix:**
1. Add deadzone (ignore input if distance < 8-10px)
2. Make maxDist responsive (e.g., `Math.min(60, screenWidth * 0.08)`)
3. Add `touch-action: none` to joystick container and canvas
4. Call `e.preventDefault()` on pointer events

### Problem 6: Camera Lerp Not Frame-Rate Independent
**In `CameraSystem.js` line 22:**
```js
this.camera.instance.position.lerp(idealPos, CAMERA_CONFIG.lerpFactor); // 0.1
```
- Same lerp-per-frame issue as movement — camera follow feels different at different FPS
- At low mobile FPS, camera lag is more pronounced

**Fix:** Use frame-rate independent smoothing: `1 - Math.pow(1 - 0.1, deltaTime * 60)`

### Problem 7: No Portrait Mode Camera Adjustment
- Camera FOV/distance doesn't adapt to aspect ratio
- Portrait mode (phone) has tall narrow viewport but same FOV
- Reference game clearly adjusts camera for portrait to show more of the world

**Fix:** Adjust camera distance or FOV based on aspect ratio. When `aspect < 1` (portrait), increase camera height or FOV to compensate.

---

## Fix Plan — Ordered Tasks

### Task 1: Camera Overhaul (Highest Impact)
**Files:** `src/config/gameConfig.js`, `src/core/Camera.js`, `src/systems/CameraSystem.js`

1. Change `CAMERA_CONFIG`:
   - `fov`: 35 → **55**
   - `offset.y`: 20 → **30** (higher up)
   - `offset.z`: 15 → **22** (further back)
   - `lerpFactor`: 0.1 → **0.08** (slightly smoother trail)
   - Add `lookAtOffset.y`: **-2** (look slightly ahead of player, not at feet)

2. In `Camera.js` / `CameraSystem.js`:
   - Add portrait mode compensation: if `aspect < 1`, multiply camera Y offset by `1.3` and increase FOV by 10
   - Make camera lerp frame-rate independent

### Task 2: Fix Movement System (Highest Impact)
**Files:** `src/systems/MovementSystem.js`, `src/config/gameConfig.js`

1. Change `PLAYER_CONFIG`:
   - `speed`: 8 → **12**
   - `acceleration`: 0.15 → **0.35**
   - Add `deceleration`: **0.5** (faster stop than start)
   - Add `velocityDeadzone`: **0.1** (snap to zero below this)

2. In `MovementSystem.js`:
   - Make lerp frame-rate independent: `const smoothing = 1 - Math.pow(1 - factor, deltaTime * 60)`
   - Use `deceleration` factor when input is zero (faster stopping)
   - Add velocity deadzone check — if `this.velocity.length() < deadzone`, set velocity to zero

### Task 3: Fix Joystick Touch Handling
**Files:** `src/ui/Joystick.js`, `styles/main.css`

1. In `Joystick.js`:
   - Add input deadzone: ignore if `dist < 8` pixels
   - Call `e.preventDefault()` on pointerdown/pointermove
   - Make maxDist responsive: `Math.min(60, Math.min(window.innerWidth, window.innerHeight) * 0.08)`
   - Scale visual size of joystick base/stick proportionally

2. In CSS:
   - Add `touch-action: none` to `#joystick-container`, `canvas`, and `body`
   - Reduce joystick base from 120px to 100px
   - Reduce joystick stick from 60px to 44px

### Task 4: Scale Down Entity Sizes
**Files:** `src/config/gameConfig.js`, `src/entities/Player.js`

1. Player:
   - Capsule radius: 0.4 → **0.3**
   - Capsule height: 0.8 → **0.6**
   - Adjust crown and position.y accordingly

2. Enemy:
   - `size`: 0.8 → **0.6**

3. Combat:
   - `projectileSize`: 0.15 → **0.12**

### Task 5: Unlock Zone Visual Cleanup
**Files:** `src/config/gameConfig.js`, unlock zone rendering code

1. Change `ZONE_CONFIG`:
   - `size`: 1.8 → **1.5** (slightly smaller)
   - `textScale`: 1.5 → **1.0** (smaller floating text)

2. Visual changes:
   - Remove or heavily reduce the dark green fill (make it very subtle, opacity 0.1-0.15)
   - Make dashed border thinner
   - Scale down hologram preview size
   - Make floating cost UI smaller (font-size, padding)

### Task 6: Aggro Range Visual
**Files:** `src/systems/CombatSystem.js` or wherever the white circle is drawn

1. Either remove the permanent aggro range indicator or make it much more subtle
2. If keeping it: reduce line width, lower opacity, use dashed line

### Task 7: World Scale Adjustment (Optional but Recommended)
**Files:** `src/config/gameConfig.js`

If after Tasks 1-6 things still feel cramped:
- Increase `safeZoneSize`: 20 → **25-30**
- Adjust unlock zone positions in level layout accordingly
- Increase `enemySpawnDistance` proportionally

---

## Quick Reference: Config Value Changes Summary

```
CAMERA_CONFIG.fov:           35  → 55
CAMERA_CONFIG.offset.y:      20  → 30
CAMERA_CONFIG.offset.z:      15  → 22
CAMERA_CONFIG.lerpFactor:    0.1 → 0.08

PLAYER_CONFIG.speed:         8   → 12
PLAYER_CONFIG.acceleration:  0.15→ 0.35
+ PLAYER_CONFIG.deceleration:     0.5
+ PLAYER_CONFIG.velocityDeadzone: 0.1

Player capsule radius:       0.4 → 0.3
Player capsule height:       0.8 → 0.6

ENEMY_CONFIG.size:           0.8 → 0.6

ZONE_CONFIG.size:            1.8 → 1.5
ZONE_CONFIG.textScale:       1.5 → 1.0

Joystick base:               120px → 100px
Joystick stick:              60px  → 44px
Joystick maxDist:            60px  → responsive
+ Joystick deadzone:              8px
+ CSS touch-action:               none (on body, canvas, joystick)
```

## Implementation Priority

1. **Camera + Movement** (Tasks 1-2) — fixes the two biggest complaints immediately
2. **Joystick** (Task 3) — fixes the touch input issues
3. **Entity scaling + Zone visuals** (Tasks 4-6) — polish to match reference look
4. **World scale** (Task 7) — only if needed after above changes

## Key Principle
The reference game looks like a **miniature diorama** viewed from above. Everything is small, cute, and fits comfortably on screen. Our game currently looks like the camera is strapped to the player's head. The single biggest fix is zooming the camera out significantly.
