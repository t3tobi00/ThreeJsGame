# Phase 1 Documentation: Foundation

## 1. Overview
Phase 1 established the technical and aesthetic foundation for **Base Defense Tycoon**. This phase focused on creating a robust, modular framework using Three.js, implementing smooth player movement, and establishing the "hyper-casual" visual style.

## 2. Technical Architecture
The project follows a modular ES6 architecture as defined in the `CLAUDE.md` guidelines.

- **`src/core/`**: Core engine wrappers for Three.js (Renderer, Scene, Camera, Lighting).
- **`src/entities/`**: 3D game objects (Environment, Player).
- **`src/systems/`**: Logic layers handling specific concerns (Input, Movement, Camera Follow).
- **`src/ui/`**: HTML/CSS overlays (Joystick, HUD).
- **`src/config/`**: Centralized game-tunable values (`gameConfig.js`).
- **`src/utils/`**: Shared helper functions.

## 3. Core Engine Components

### Renderer (`src/core/Renderer.js`)
- Uses `WebGLRenderer` with PCFSoftShadowMap for high-quality, smooth shadows.
- Implements pixel ratio clamping (max 2) for performance on high-DPI screens.
- Automatic window resize handling.

### Lighting (`src/core/Lighting.js`)
- **Sun (DirectionalLight)**: High-altitude light source with a wide shadow frustration to cover the play area.
- **Ambient Light**: Soft blue-toned ambient light to ensure Danger Zones aren't too dark.

### Camera (`src/core/Camera.js` & `src/systems/CameraSystem.js`)
- Perspective Camera set to an isometric-style top-down angle.
- **Rubber-band Follow**: The camera uses a lerp function to follow the player with a soft trailing delay, creating a smooth "weighty" feel.

## 4. Visual Entities

### Environment (`src/entities/Environment.js`)
- **Safe Zone**: 20x20 green ground plane with a procedural grid texture generated via HTML5 Canvas.
- **Danger Zone**: A larger 100x100 sandy-colored plane surrounding the core.

### Player (`src/entities/Player.js`)
- **Body**: A blue capsule mesh.
- **Crown**: A floating, rotating golden torus crown.
- **Visual Feedback**:
  - **Squash & Stretch**: The capsule body dynamically scales (compresses on Y, stretches on XZ) based on velocity.
  - **Instant Rotation**: The player snaps rotation to the movement vector.

## 5. Input & Movement Systems

### Virtual Joystick (`src/ui/Joystick.js`)
- **Dynamic Placement**: The joystick base appears anywhere the user clicks/touches.
- **Visuals**: Modern glassmorphism style (blur + low opacity) with a solid white thumbstick.

### Systems Interface
1. **`InputSystem`**: Polls the joystick UI and converts 2D screen input into a 3D movement vector.
2. **`MovementSystem`**: 
   - Applies an acceleration curve to the input vector.
   - Calculates frame-rate independent movement using `delta`.
   - Manages player entity speed and internal state updates.

## 6. How to Run
1. Serve the project root using a local static server (e.g., `npx serve .`).
2. Open the URL in a browser.
3. Use your mouse or touch to drag anywhere on the screen to move the player.

## 7. Performance Note
- No external textures are used; all visuals are procedural or primitive-based.
- Minimal draw calls for the initial scene (~5-10).
- Shadow map resolution is balanced for mobile performance.
