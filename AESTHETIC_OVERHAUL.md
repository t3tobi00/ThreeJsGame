# Aesthetic Overhaul & Mobile Optimization (Phase 5 - 7)

## Overview
This document summarizes the comprehensive visual enhancements and mobile scaling adjustments applied to Base Defense Tycoon. The goal of this overhaul was to bridge the visual gap between the early prototype and the target "Fake Ad" / Hyper-Casual aesthetic (e.g., *Kingshot*), ensuring the game looks polished, dense, and "juicy" on mobile portrait screens.

---

## Architectural Evolution: Single-File to Modular
*Note on the original `idea.md`:* The project was initially conceived as a monolithic, single-file HTML prototype for speed and simplicity. However, as the mechanics (stacking, magnetic harvesting, turret aggro, unlocking zones) and the visual requirements expanded, a single file became unmaintainable. 

We transitioned to a **Modular ES6 Architecture** because:
1. **Separation of Concerns:** Moving configurations (`gameConfig.js`), core engine logic (`Renderer.js`, `Camera.js`), rendering entities (`Player.js`, `UnlockZone.js`), and game rules (`CombatSystem.js`) into their own files prevents a 3,000-line "spaghetti code" file.
2. **Scalability:** It is now trivial to add new enemy types or weapons without breaking unrelated systems (e.g., just add a new file in `/entities/`).
3. **Performance:** A structured architecture allows for easier object pooling and cleaner frame loop updates (`main.js` just iterates through cleanly separated system files).

---

## 1. Camera & Perspective Improvements
* **Orthographic Projection:** Replaced the standard `PerspectiveCamera` with an `OrthographicCamera` (via highly narrowed `frustumSize`). This eliminates edge distortion and creates a true isometric, architectural look where parallel lines do not converge.
* **Shallow "Hero" Angle:** Lowered the camera's Y offset (e.g., from `y: 30` to `y: 12`) and reduced the look-distance. This shallow ~30°-35° angle reveals the front of the character (rather than just the top of their head) and provides clear visibility of incoming enemies over the back fences.
* **Micro-Scale Zoom:** Adjusted the frustum size down to `14`, making the player character occupy approximately 15% of the screen height. This shifted the feel from viewing an "ant in a parking lot" to controlling an "action figure in a diorama."

## 2. World Scale & Sizing adjustments
* **Physical World Shrinking:** Reduced the `WORLD_CONFIG.safeZoneSize` from `30` down to `10`. This ensures that on a narrow mobile portrait screen, the player can see the wooden barricades on the left and right, and the danger zone spreading beyond them.
* **Pacing Maintenance:** Because the world boundary became 3x smaller, all entity speeds were slowed down by ~50% (`PLAYER.speed` = 6, `ENEMY.speed` = 1.5, `PROJECTILE.speed` = 10) so the gameplay time and tactical pacing remain identical to the larger map.
* **Massive UI integration:** Scaled up the 3D ground text inside the `UnlockZone` by 1.8x, ensuring pricing numbers are bold, readable, and feel physically hefty in the world.

## 3. Lighting & Shadows
* **Ambient Fill:** Introduced a `HemisphereLight` to provide natural bounce lighting (using the terracotta sand color as the ground reflection). This prevents the undersides of objects from rendering pitch black.
* **Punchy Shadows:** Adjusted the `DirectionalLight` (sun) to `(10, 20, -5)` to cast distinct, diagonal short shadows directly beneath objects, grounding them firmly to the floor.
* **Mobile Shadow Fixes:** Reset `normalBias` to 0 and carefully tuned `bias` to `-0.001` to eliminate clipping and Peter-panning artifacts specifically observed on mobile GPU renderers.

## 4. Asset Geometry & "Chunkiness"
* **Player Model Breakdown:** Replaced the single basic capsule with a multi-part grouped mesh: a thick cylinder body, a blocky head, a stylized cape, and a floating crown.
* **Chunky Fences:** Replaced thin matchstick borders with heavy, overlapping thick wooden cylinder logs (`logRadius: 0.25`, `logHeight: 1.2`).
* **Juicy Resources:** Deepened the Geometry of the dropped "Meat" resources, turning them from flat wafers into thick poker chips/jelly disks that stack satisfyingly on the player's back.
* **Unlock Zone Brackets:** Replaced thin continuous dashed lines with thick, white, 90-degree corner brackets using a custom ShaderMaterial.

## 5. UI & Palette Polish
* **Candy Colors:** Boosted saturation universally. The safe zone is a lush emerald green, the danger zone is golden terracotta, and the player/UI elements heavily utilize primary colors (bright reds and blues).
* **Environment Textures:** Replaced the flat green plane with a soft, stylized checkerboard turf texture augmented with a dark gradient rim (Fake Ambient Occlusion) to ground the fence logs into the dirt.
* **Bubbly HUD:** Replaced standard HTML buttons with heavily styled `linear-gradient` pill shapes featuring hard `box-shadows` mimicking physical plastic buttons popping off the screen.
* **Thick Text Strokes:** Added thick black/dark-green canvas strokes to all 3D ground text (`strokeText`) to maintain contrast regardless of the background color.
