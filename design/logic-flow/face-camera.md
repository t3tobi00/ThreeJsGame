# Face Camera — Logic Flow

How to make any object face the isometric camera.

## Quick Recipe

```js
import { yawToCamera } from '../utils/FaceCamera.js';

// After building your mesh/group:
yawToCamera(mesh);
```

That's it. One import, one line.

## Important Rule

If the object has `"rotY"` in the level JSON, **remove it** — the scene loader applies `rotY` after build and will overwrite `yawToCamera`.

## Decision Flow

```mermaid
flowchart TD
    A[You have a mesh/group<br>that should face the camera] --> B{Does it need to<br>stay flat on ground?}

    B -- Yes --> C[Use yawToCamera]
    B -- No, tilt toward camera --> D[Use faceToCamera]

    C --> E{Is rotY set in<br>level JSON?}
    D --> E

    E -- Yes --> F[Remove rotY from JSON<br>— loader overwrites code rotation]
    E -- No --> G[Good to go]

    F --> G

    G --> H[Add one line after<br>mesh is built]
    H --> I["yawToCamera(mesh)<br>or faceToCamera(mesh)"]

    style C fill:#225544,color:#44ff88
    style D fill:#1a3a5c,color:#4fc3f7
    style F fill:#5a3322,color:#ffaa44
```

## File Map

```
src/utils/FaceCamera.js          <-- Single source of truth
│
├── yawTo(mesh, offset)           Raw Y-axis rotation (manual offset)
├── faceTo(mesh, offset)          Yaw + pitch (manual offset)
├── pitchTo(mesh, offset)         Pitch only (manual offset)
├── faceCameraLive(mesh, camera)  Per-frame tracking (moving cameras)
│
├── yawToCamera(mesh)             Auto-reads CAMERA_CONFIG — USE THIS
└── faceToCamera(mesh)            Auto-reads CAMERA_CONFIG + pitch
```

```
src/utils/Billboard3D.js          <-- Re-exports from FaceCamera.js
                                       (backward compat only, use FaceCamera.js for new code)
```

```
src/config/gameConfig.js
└── CAMERA_CONFIG.offset = { x:12, y:20, z:12 }   <-- The isometric angle
```

## Function Cheat Sheet

```mermaid
flowchart LR
    subgraph "FaceCamera.js — what to use"
        Y["yawToCamera(mesh)<br>Ground objects<br>machines, stalls, gates"]
        F["faceToCamera(mesh)<br>Flat panels<br>signs, billboards"]
        L["faceCameraLive(mesh, cam)<br>Moving camera<br>per-frame only"]
    end

    Y -.- |"most common"| USE["Import from<br>src/utils/FaceCamera.js"]
    F -.- USE
    L -.- USE

    style Y fill:#225544,color:#44ff88
    style USE fill:#24242c,color:#4fc3f7
```

## Lessons Learned

| Mistake | Why it failed | Avoid by |
|---|---|---|
| `faceCameraLive` on root | Tilts mesh off ground (applies pitch) | Use `yawToCamera` for ground objects |
| Per-frame `yawTo` tracking camera position | Machine rotates when player moves | Use one-time `yawToCamera` at build |
| `yawToCamera` with `rotY` in JSON | Loader overwrites rotation.y after build | Remove `rotY` from JSON |
| Applied to child only (e.g. gears) | Rest of machine didn't rotate | Apply to the root group |
