import * as THREE from 'three';

const _presets = new Map();

const MeshPresets = {
    register(name, builderFn) {
        _presets.set(name, builderFn);
    },

    create(name, options = {}) {
        const builder = _presets.get(name);
        if (!builder) {
            console.warn(`MeshPresets: unknown preset '${name}', using fallback box`);
            const geo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
            const mat = new THREE.MeshStandardMaterial({ color: 0x999999 });
            return new THREE.Mesh(geo, mat);
        }
        return builder(options);
    },

    has(name) {
        return _presets.has(name);
    }
};

// --- Shared geometry/materials for characters (enemies, player, villagers) ---
// Cached once at module scope — all character meshes share these GPU buffers.
const _charBodyGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
const _charHeadGeo = new THREE.SphereGeometry(0.2, 8, 6);
const _charHeadGeoHero = new THREE.SphereGeometry(0.22, 16, 12); // smoother + slightly larger; hero-only
const _charEyeGeo  = new THREE.SphereGeometry(0.05, 4, 4);
const _charLimbGeo = new THREE.CapsuleGeometry(0.08, 0.32, 4, 6);
const _charHandGeo = new THREE.SphereGeometry(0.09, 8, 6);
const _charFootGeo = new THREE.BoxGeometry(0.17, 0.07, 0.24);
const _charNeckGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.1, 10);
const _charShoulderGeo = new THREE.SphereGeometry(0.11, 8, 6);
const _charMouthGeo = new THREE.BoxGeometry(0.07, 0.012, 0.04);
const _charEarGeo = new THREE.SphereGeometry(0.05, 8, 6);
const _charHeadMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.6 });
const _charEyeMat  = new THREE.MeshStandardMaterial({ color: 0x000000 });
const _charMouthMat = new THREE.MeshStandardMaterial({ color: 0x331a14, roughness: 0.7 });

// ── Hero-only body geometry/materials (slim, tailored — "John Wick" silhouette) ──
// Lathe profile: narrow hip/waist/shoulders, slight chest taper. Centered on
// Y=0 so it sits at body.position.y like the capsule does (preserves
// PlayerAnimSystem's bodyRestY for bob).
const _heroTorsoPts = [
    new THREE.Vector2(0,    -0.50),
    new THREE.Vector2(0.18, -0.50),
    new THREE.Vector2(0.20, -0.30),
    new THREE.Vector2(0.21,  0.00),
    new THREE.Vector2(0.23,  0.25),
    new THREE.Vector2(0.15,  0.45),
    new THREE.Vector2(0,     0.50)
];
const _charBodyGeoHero = new THREE.LatheGeometry(_heroTorsoPts, 14);
const _charShoulderGeoHero = new THREE.SphereGeometry(0.10, 10, 8);
// Wayfarer-style sunglasses — two flat rectangular lenses + a thin bridge +
// temple arms going back to the ears. Big lens area so it reads from the
// isometric camera even though only the top edge faces the camera directly.
const _heroLensGeo = new THREE.BoxGeometry(0.14, 0.10, 0.018);
const _heroLensBridgeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.085, 8);
const _heroTempleGeo = new THREE.BoxGeometry(0.22, 0.014, 0.014);
const _heroLensMat = new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.6, roughness: 0.18 });

// --- Built-in Presets ---

MeshPresets.register('character', ({ color = 0xaaaaaa } = {}) => {
    const group = new THREE.Group();

    // Only bodyMat is per-character (unique color)
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const body = new THREE.Mesh(_charBodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(_charHeadGeo, _charHeadMat);
    head.position.y = 1.1;
    head.castShadow = true;
    group.add(head);

    const leftEye = new THREE.Mesh(_charEyeGeo, _charEyeMat);
    leftEye.position.set(-0.08, 1.12, 0.18);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(_charEyeGeo, _charEyeMat);
    rightEye.position.set(0.08, 1.12, 0.18);
    group.add(rightEye);

    return group;
});

MeshPresets.register('character-player', ({
    color = 0x3366ff,
    pantsColor = null,
    hero = false
} = {}) => {
    // EntityFactory only parses the top-level `color` key; other color args
    // come through as hex strings ("0x..."), so normalize them here.
    if (typeof pantsColor === 'string') pantsColor = parseInt(pantsColor, 16);
    // ── Rig hierarchy ──
    //   root
    //   ├── torso  (body, head pivot, arm shoulder pivots, neck, shoulder caps)
    //   │    ├── body
    //   │    ├── neck                  ← skin-colored bridge
    //   │    ├── head                  ← named pivot, holds head sphere + eyes (+ mouth/hair when hero)
    //   │    ├── leftArm               ← shoulder pivot (+ shoulder cap mesh)
    //   │    │    ├── upper arm mesh
    //   │    │    └── leftElbow       ← elbow pivot
    //   │    │         ├── forearm mesh
    //   │    │         └── leftHand    ← skin sphere at fingertip
    //   │    └── rightArm / rightElbow / rightHand (mirror)
    //   ├── leftLeg                    ← hip pivot
    //   │    ├── thigh mesh
    //   │    └── leftKnee              ← knee pivot
    //   │         ├── shin mesh
    //   │         └── leftFoot         ← shoe box at ankle
    //   └── rightLeg / rightKnee / rightFoot (mirror)
    //
    // Bones AnimationSystem can target by name:
    //   torso, body, head, leftArm, rightArm, leftElbow, rightElbow,
    //   leftLeg, rightLeg, leftKnee, rightKnee
    //
    // Backward compatible: rotating leftArm still rotates the whole arm
    // (hand + forearm are children of the elbow). Workers / soldiers wrap
    // this preset; their hat goes on `head` and tool/weapon on `rightElbow`,
    // both still resolve fine.
    //
    // Params:
    //   color       — shirt color
    //   pantsColor  — optional, splits leg color from shirt. Default: same as shirt.
    //   hero        — opt-in cosmetic accents: smoother head, eye whites + pupils,
    //                 mouth, hair, slightly upturned mouth. Off by default so
    //                 workers/soldiers (who wrap this preset) keep the chunky
    //                 placeholder face.
    //   hairColor   — only used when hero=true

    const root = new THREE.Group();
    const torso = new THREE.Group();
    torso.name = 'torso';
    root.add(torso);

    // ── Pelvis pivot ──
    // Sits between root and the legs at hip Y. Lowering pelvis.position.y in
    // an animation drags both legs (and visually the body, since the body is
    // anchored above) downward together — needed for sit / crouch / lunge.
    const pelvis = new THREE.Group();
    pelvis.name = 'pelvis';
    pelvis.position.y = 0.55;
    root.add(pelvis);

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    // Arms = sleeves = shirt color. Legs = pants color (or fall back to shirt).
    const armMat = bodyMat;
    const legMat = pantsColor !== null
        ? new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 })
        : bodyMat;
    // Feet: every character gets dark boots regardless of pantsColor so workers /
    // soldiers (who inherit this preset without pantsColor) still look grounded.
    // Hero gets slightly darker for contrast.
    const footMat = new THREE.MeshStandardMaterial({
        color: hero ? 0x1a1208 : 0x2a1f14,
        roughness: 0.6
    });

    // ── Body ──
    // Hero gets a tapered (lathe) torso — broad shoulders, narrow waist —
    // so the silhouette reads as humanoid hero from any angle, including
    // top-down. Workers/soldiers keep the simple capsule.
    const body = new THREE.Mesh(hero ? _charBodyGeoHero : _charBodyGeo, bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    body.name = 'body';
    torso.add(body);

    // ── Neck ── small skin-colored cylinder bridging body top (~1.35) and head bottom.
    const neck = new THREE.Mesh(_charNeckGeo, _charHeadMat);
    neck.position.y = 1.40;
    neck.castShadow = true;
    neck.name = 'neck';
    torso.add(neck);

    // ── Head pivot ──
    // Raised from 1.45 → 1.62 so the neck (~5–7 cm tall in world units) is
    // actually visible above the body capsule top at y=1.35. Workers / soldiers
    // wrap this preset (hat is parented to head, so it lifts together) and
    // zombies have their own preset, so this lift doesn't affect them adversely.
    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = 1.62;
    torso.add(head);

    const headMesh = new THREE.Mesh(hero ? _charHeadGeoHero : _charHeadGeo, _charHeadMat);
    headMesh.castShadow = true;
    head.add(headMesh);

    // ── Ears ── small skin-tone ovals on each side of the head. Universal
    // (placed before the hero/non-hero split) so workers/soldiers also get
    // them — they look slightly inhuman without ears. Hero's sunglasses
    // temple arms hook over these.
    const leftEar = new THREE.Mesh(_charEarGeo, _charHeadMat);
    leftEar.position.set(-0.21, 0.04, -0.02);
    leftEar.scale.set(0.6, 1.0, 0.4);
    leftEar.castShadow = true;
    leftEar.name = 'leftEar';
    head.add(leftEar);

    const rightEar = new THREE.Mesh(_charEarGeo, _charHeadMat);
    rightEar.position.set( 0.21, 0.04, -0.02);
    rightEar.scale.set(0.6, 1.0, 0.4);
    rightEar.castShadow = true;
    rightEar.name = 'rightEar';
    head.add(rightEar);

    // ── Eyes ──
    if (hero) {
        // Tilt head forward so the face angles toward the isometric top-down
        // camera. Without this, the player's face points sideways and is
        // hidden behind the hair from a top-down view.
        head.rotation.x = 0.18;

        // ── Sunglasses ── two big black lenses + thin cylindrical nose bridge
        // + temple arms angling back from the outer lens edges to the ears.
        // Parented to head so the head tilt (0.18 rad fwd) angles the lens
        // faces toward the isometric camera.
        const sunglasses = new THREE.Group();
        sunglasses.name = 'sunglasses';

        const leftLens  = new THREE.Mesh(_heroLensGeo, _heroLensMat);
        leftLens.position.set(-0.11, 0.07, 0.20);
        leftLens.castShadow = true;
        const rightLens = new THREE.Mesh(_heroLensGeo, _heroLensMat);
        rightLens.position.set( 0.11, 0.07, 0.20);
        rightLens.castShadow = true;

        const bridge = new THREE.Mesh(_heroLensBridgeGeo, _heroLensMat);
        bridge.rotation.z = Math.PI / 2;        // lay the cylinder horizontal
        bridge.position.set(0, 0.075, 0.20);

        // Temple arms — from each outer lens edge (x=±0.18, z=0.20) back to
        // the corresponding ear (x=±0.21, z=-0.02). atan2(dz, dx) gives the
        // rotation around Y so the box's long axis points from lens to ear.
        const TEMPLE_ANGLE = Math.atan2(0.22, 0.03);  // ≈ 1.43 rad — almost side-to-back

        const rightTemple = new THREE.Mesh(_heroTempleGeo, _heroLensMat);
        rightTemple.position.set( 0.195, 0.055, 0.09);
        rightTemple.rotation.y = TEMPLE_ANGLE;
        rightTemple.castShadow = true;

        const leftTemple = new THREE.Mesh(_heroTempleGeo, _heroLensMat);
        leftTemple.position.set(-0.195, 0.055, 0.09);
        leftTemple.rotation.y = Math.PI - TEMPLE_ANGLE;
        leftTemple.castShadow = true;

        sunglasses.add(leftLens, rightLens, bridge, leftTemple, rightTemple);
        head.add(sunglasses);

        // Mouth — thin grim slit, dropped low toward the chin.
        const mouth = new THREE.Mesh(_charMouthGeo, _charMouthMat);
        mouth.position.set(0, -0.08, 0.205);
        mouth.name = 'mouth';
        head.add(mouth);

    } else {
        // Placeholder eyes — preserved for workers/soldiers
        const leftEye  = new THREE.Mesh(_charEyeGeo, _charEyeMat);
        leftEye.position.set(-0.08, 0.02, 0.18);
        const rightEye = new THREE.Mesh(_charEyeGeo, _charEyeMat);
        rightEye.position.set( 0.08, 0.02, 0.18);
        head.add(leftEye, rightEye);
    }

    // ── Two-segment limb builder ──
    // Returns { shoulder, joint }. Caller can drop a hand/foot on joint at y=-SEG_LEN.
    // mat = limb material (shirt for arms, pants for legs).
    const SEG_LEN = 0.32;            // length of one limb segment (cylinder portion)
    const SEG_HALF = SEG_LEN / 2;

    const makeTwoSegmentLimb = (xOrigin, yOrigin, mat) => {
        const shoulder = new THREE.Group();
        shoulder.position.set(xOrigin, yOrigin, 0);

        // Upper segment hangs straight down from shoulder
        const upper = new THREE.Mesh(_charLimbGeo, mat);
        upper.position.y = -SEG_HALF;
        upper.castShadow = true;
        shoulder.add(upper);

        // Joint pivot at the bottom of the upper segment
        const joint = new THREE.Group();
        joint.position.y = -SEG_LEN;
        shoulder.add(joint);

        // Lower segment hangs from joint
        const lower = new THREE.Mesh(_charLimbGeo, mat);
        lower.position.y = -SEG_HALF;
        lower.castShadow = true;
        joint.add(lower);

        return { shoulder, joint };
    };

    // ── Arms ── attach to torso so they bob with the body
    const leftArmPair = makeTwoSegmentLimb(-0.32, 1.15, armMat);
    leftArmPair.shoulder.name = 'leftArm';
    leftArmPair.joint.name    = 'leftElbow';
    torso.add(leftArmPair.shoulder);

    const rightArmPair = makeTwoSegmentLimb(0.32, 1.15, armMat);
    rightArmPair.shoulder.name = 'rightArm';
    rightArmPair.joint.name    = 'rightElbow';
    torso.add(rightArmPair.shoulder);

    // Shoulder caps — child of the arm pivot so they rotate naturally with
    // the swing (no visual seam). Hero gets larger pauldrons (0.14 vs 0.11)
    // for a broader-shouldered silhouette readable from above.
    const shoulderCapGeo = hero ? _charShoulderGeoHero : _charShoulderGeo;
    const leftShoulderCap = new THREE.Mesh(shoulderCapGeo, bodyMat);
    leftShoulderCap.castShadow = true;
    leftArmPair.shoulder.add(leftShoulderCap);
    const rightShoulderCap = new THREE.Mesh(shoulderCapGeo, bodyMat);
    rightShoulderCap.castShadow = true;
    rightArmPair.shoulder.add(rightShoulderCap);

    // Hands — skin-colored spheres at the end of each forearm. Worker tools
    // and soldier weapons are also parented to rightElbow at (0.04, -0.30, 0.04),
    // so the hand sphere sits just behind the grip — no visual conflict.
    const leftHand = new THREE.Mesh(_charHandGeo, _charHeadMat);
    leftHand.position.y = -SEG_LEN;
    leftHand.castShadow = true;
    leftHand.name = 'leftHand';
    leftArmPair.joint.add(leftHand);

    const rightHand = new THREE.Mesh(_charHandGeo, _charHeadMat);
    rightHand.position.y = -SEG_LEN;
    rightHand.castShadow = true;
    rightHand.name = 'rightHand';
    rightArmPair.joint.add(rightHand);

    // ── Legs ── attach to PELVIS (not root) so the pelvis pivot can lower
    // the whole hip column. yOrigin = 0 because pelvis is already at y=0.55.
    const leftLegPair = makeTwoSegmentLimb(-0.13, 0, legMat);
    leftLegPair.shoulder.name = 'leftLeg';
    leftLegPair.joint.name    = 'leftKnee';
    pelvis.add(leftLegPair.shoulder);

    const rightLegPair = makeTwoSegmentLimb(0.13, 0, legMat);
    rightLegPair.shoulder.name = 'rightLeg';
    rightLegPair.joint.name    = 'rightKnee';
    pelvis.add(rightLegPair.shoulder);

    // Feet — flat boxes at the bottom of each shin, offset forward so toe points ahead.
    const leftFoot = new THREE.Mesh(_charFootGeo, footMat);
    leftFoot.position.set(0, -SEG_LEN + 0.035, 0.05);
    leftFoot.castShadow = true;
    leftFoot.name = 'leftFoot';
    leftLegPair.joint.add(leftFoot);

    const rightFoot = new THREE.Mesh(_charFootGeo, footMat);
    rightFoot.position.set(0, -SEG_LEN + 0.035, 0.05);
    rightFoot.castShadow = true;
    rightFoot.name = 'rightFoot';
    rightLegPair.joint.add(rightFoot);

    // Stash rest-Y for PlayerAnimSystem body bob
    root.userData.bodyRestY = body.position.y;

    return root;
});

MeshPresets.register('character-zombie', ({ color = 0x6a8a4a } = {}) => {
    // Same rig as character-player so PlayerAnimSystem + LungeAnimSystem can
    // drive joints by name. Differences vs player:
    //   - arms pre-rotated forward (zombie reach pose)
    //   - torso slightly hunched
    //   - head tilted forward
    //   - sickly green/gray skin
    // PlayerAnimSystem reads WalkAnim.style === 'zombie' to lock arms forward
    // and use a stiff-leg lurch instead of the human swing cycle.

    const root = new THREE.Group();

    const torso = new THREE.Group();
    torso.name = 'torso';
    torso.rotation.x = 0.12;          // hunch
    root.add(torso);

    const pelvis = new THREE.Group();
    pelvis.name = 'pelvis';
    pelvis.position.y = 0.55;
    root.add(pelvis);

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const limbMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8aa874, roughness: 0.8 });

    const body = new THREE.Mesh(_charBodyGeo, bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    body.name = 'body';
    torso.add(body);

    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = 1.45;
    head.rotation.x = 0.18;           // tilted forward
    torso.add(head);

    const headMesh = new THREE.Mesh(_charHeadGeo, skinMat);
    headMesh.castShadow = true;
    head.add(headMesh);

    const leftEye  = new THREE.Mesh(_charEyeGeo, _charEyeMat);
    leftEye.position.set(-0.08, 0.02, 0.18);
    const rightEye = new THREE.Mesh(_charEyeGeo, _charEyeMat);
    rightEye.position.set( 0.08, 0.02, 0.18);
    head.add(leftEye, rightEye);

    const SEG_LEN = 0.32;
    const SEG_HALF = SEG_LEN / 2;

    const makeTwoSegmentLimb = (xOrigin, yOrigin) => {
        const shoulder = new THREE.Group();
        shoulder.position.set(xOrigin, yOrigin, 0);

        const upper = new THREE.Mesh(_charLimbGeo, limbMat);
        upper.position.y = -SEG_HALF;
        upper.castShadow = true;
        shoulder.add(upper);

        const joint = new THREE.Group();
        joint.position.y = -SEG_LEN;
        shoulder.add(joint);

        const lower = new THREE.Mesh(_charLimbGeo, limbMat);
        lower.position.y = -SEG_HALF;
        lower.castShadow = true;
        joint.add(lower);

        return { shoulder, joint };
    };

    // Arms — locked forward in classic zombie reach
    const ARM_REACH_X = -Math.PI / 2 + 0.18;

    const leftArmPair = makeTwoSegmentLimb(-0.32, 1.15);
    leftArmPair.shoulder.name = 'leftArm';
    leftArmPair.joint.name    = 'leftElbow';
    leftArmPair.shoulder.rotation.x = ARM_REACH_X;
    leftArmPair.shoulder.rotation.z = 0.12;
    torso.add(leftArmPair.shoulder);

    const rightArmPair = makeTwoSegmentLimb(0.32, 1.15);
    rightArmPair.shoulder.name = 'rightArm';
    rightArmPair.joint.name    = 'rightElbow';
    rightArmPair.shoulder.rotation.x = ARM_REACH_X;
    rightArmPair.shoulder.rotation.z = -0.12;
    torso.add(rightArmPair.shoulder);

    // Legs — neutral stance, animated stiff by zombie walk
    const leftLegPair = makeTwoSegmentLimb(-0.13, 0);
    leftLegPair.shoulder.name = 'leftLeg';
    leftLegPair.joint.name    = 'leftKnee';
    pelvis.add(leftLegPair.shoulder);

    const rightLegPair = makeTwoSegmentLimb(0.13, 0);
    rightLegPair.shoulder.name = 'rightLeg';
    rightLegPair.joint.name    = 'rightKnee';
    pelvis.add(rightLegPair.shoulder);

    root.userData.bodyRestY = body.position.y;
    root.userData.zombieArmRestX = ARM_REACH_X;
    root.userData.zombieTorsoRestX = 0.12;

    return root;
});

MeshPresets.register('table', ({ color = 0x8B4513, width = 2, depth = 2, height = 0.6 } = {}) => {
    const group = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(width, height, depth);
    const boxMat = new THREE.MeshStandardMaterial({ color });
    const top = new THREE.Mesh(boxGeo, boxMat);
    top.position.y = height / 2;
    top.castShadow = true;
    group.add(top);
    return group;
});

MeshPresets.register('disk', ({ color = 0xff3333, radius = 0.3, height = 0.1 } = {}) => {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 12);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
});

MeshPresets.register('wood-log', ({ radius = 0.18, length = 0.5 } = {}) => {
    const group = new THREE.Group();

    const makeCanvas = (size) => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        return { c, ctx: c.getContext('2d') };
    };
    const texFromCanvas = (c) => {
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        t.needsUpdate = true;
        return t;
    };

    // Bark texture — vertical fiber streaks with knots
    const bark = (() => {
        const { c, ctx } = makeCanvas(512);
        ctx.fillStyle = '#6b3e1c';
        ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 60; i++) {
            const x = Math.random() * 512;
            ctx.strokeStyle = 'rgba(' + (30 + Math.random() * 30) + ', ' + (15 + Math.random() * 20) + ', 5, ' + (0.3 + Math.random() * 0.4) + ')';
            ctx.lineWidth = 1 + Math.random() * 3;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.bezierCurveTo(
                x + (Math.random() - 0.5) * 30, 170,
                x + (Math.random() - 0.5) * 30, 340,
                x + (Math.random() - 0.5) * 20, 512
            );
            ctx.stroke();
        }
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * 512;
            ctx.strokeStyle = 'rgba(180, 130, 70, ' + (0.15 + Math.random() * 0.2) + ')';
            ctx.lineWidth = 1 + Math.random() * 2;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + (Math.random() - 0.5) * 20, 512);
            ctx.stroke();
        }
        for (let i = 0; i < 4; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            const grd = ctx.createRadialGradient(x, y, 1, x, y, 18);
            grd.addColorStop(0, '#1a0d04');
            grd.addColorStop(1, 'rgba(60,30,10,0)');
            ctx.fillStyle = grd;
            ctx.fillRect(x - 20, y - 20, 40, 40);
        }
        const t = texFromCanvas(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(2, 1);
        return t;
    })();

    // Growth-ring end-cap texture
    const rings = (() => {
        const { c, ctx } = makeCanvas(512);
        ctx.fillStyle = '#c89060';
        ctx.fillRect(0, 0, 512, 512);
        for (let i = 12; i > 0; i--) {
            ctx.beginPath();
            ctx.arc(256, 256, i * 18 + Math.random() * 5, 0, Math.PI * 2);
            ctx.strokeStyle = i % 2 === 0
                ? 'rgba(60, 30, 10, ' + (0.45 + Math.random() * 0.2) + ')'
                : 'rgba(150, 90, 40, ' + (0.3 + Math.random() * 0.2) + ')';
            ctx.lineWidth = 2 + Math.random() * 3;
            ctx.stroke();
        }
        for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2;
            ctx.strokeStyle = 'rgba(40, 20, 5, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(256, 256);
            ctx.lineTo(256 + Math.cos(a) * 230, 256 + Math.sin(a) * 230);
            ctx.stroke();
        }
        ctx.fillStyle = '#3a1f08';
        ctx.beginPath();
        ctx.arc(256, 256, 6, 0, Math.PI * 2);
        ctx.fill();
        return texFromCanvas(c);
    })();

    const sideMat = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.85 });
    const capMat = new THREE.MeshStandardMaterial({ map: rings, roughness: 0.7 });

    const logGeo = new THREE.CylinderGeometry(radius, radius, length, 28, 1, false);
    const log = new THREE.Mesh(logGeo, [sideMat, capMat, capMat]);
    log.rotation.z = Math.PI / 2;
    log.position.y = radius;
    log.castShadow = true;
    log.receiveShadow = true;
    group.add(log);

    return group;
});

MeshPresets.register('coin', ({ radius = 0.78, height = 0.16 } = {}) => {
    const group = new THREE.Group();

    // ── Face texture: Sacagawea-style $1 coin ──
    const faceTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 1024;
        const ctx = c.getContext('2d');
        const cx = 512, cy = 512;

        // Base brassy gold gradient
        const base = ctx.createRadialGradient(cx - 120, cy - 160, 60, cx, cy, 540);
        base.addColorStop(0, '#fbd884');
        base.addColorStop(0.55, '#dba23a');
        base.addColorStop(1, '#a26a18');
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.arc(cx, cy, 500, 0, Math.PI * 2);
        ctx.fill();

        // Outer dark rim ring
        ctx.lineWidth = 14;
        ctx.strokeStyle = 'rgba(70, 40, 5, 0.55)';
        ctx.beginPath();
        ctx.arc(cx, cy, 480, 0, Math.PI * 2);
        ctx.stroke();

        // Inner highlight ring
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 240, 180, 0.7)';
        ctx.beginPath();
        ctx.arc(cx, cy, 462, 0, Math.PI * 2);
        ctx.stroke();

        // Curved text helper
        const drawCurvedText = (text, radius, centerAngle, fontPx, flip = false) => {
            ctx.save();
            ctx.fillStyle = '#5a3408';
            ctx.font = `bold ${fontPx}px "Times New Roman", serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const widths = [];
            let total = 0;
            for (const ch of text) {
                const w = ctx.measureText(ch).width;
                widths.push(w);
                total += w + 6;
            }
            const span = total / radius;
            let a = centerAngle - span / 2;
            for (let i = 0; i < text.length; i++) {
                const charSpan = (widths[i] + 6) / radius;
                a += charSpan / 2;
                ctx.save();
                ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
                if (flip) ctx.rotate(a - Math.PI / 2);
                else      ctx.rotate(a + Math.PI / 2);
                ctx.fillStyle = 'rgba(255, 235, 170, 0.55)';
                ctx.fillText(text[i], 0, -1.5);
                ctx.fillStyle = '#5a3408';
                ctx.fillText(text[i], 0, 0);
                ctx.restore();
                a += charSpan / 2;
            }
            ctx.restore();
        };

        drawCurvedText('UNITED STATES OF AMERICA', 410, -Math.PI / 2, 50, false);
        drawCurvedText('ONE DOLLAR', 410, Math.PI / 2, 56, true);

        // Stars
        const drawStar = (sx, sy, r) => {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const ra = i % 2 === 0 ? r : r * 0.45;
                const aa = (i / 10) * Math.PI * 2 - Math.PI / 2;
                const px = Math.cos(aa) * ra, py = Math.sin(aa) * ra;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 235, 170, 0.6)';
            ctx.fill();
            ctx.translate(0, 1.5);
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const ra = i % 2 === 0 ? r : r * 0.45;
                const aa = (i / 10) * Math.PI * 2 - Math.PI / 2;
                const px = Math.cos(aa) * ra, py = Math.sin(aa) * ra;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = '#5a3408';
            ctx.fill();
            ctx.restore();
        };

        const starR = 350;
        const sideAngles = [
            -Math.PI * 0.22, -Math.PI * 0.10, -Math.PI * 0.02,
             Math.PI * 0.08,  Math.PI * 0.18,  Math.PI * 0.28,
             Math.PI - 0.22,  Math.PI - 0.10,  Math.PI - 0.02,
            -Math.PI + 0.08, -Math.PI + 0.18, -Math.PI + 0.28
        ];
        for (const a of sideAngles) {
            drawStar(cx + Math.cos(a) * starR, cy + Math.sin(a) * starR, 9);
        }

        // Eagle
        ctx.save();
        ctx.translate(cx + 40, cy + 20);
        const drawEagle = (offsetY, fillStyle) => {
            ctx.save();
            ctx.translate(0, offsetY);
            ctx.fillStyle = fillStyle;
            ctx.beginPath(); ctx.ellipse(0, 0, 50, 22, -0.15, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-58, -12, 22, 16, -0.1, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-78, -12); ctx.lineTo(-94, -8); ctx.lineTo(-78, -2); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-10, -10); ctx.bezierCurveTo(40, -130, 140, -200, 220, -150); ctx.bezierCurveTo(180, -120, 110, -60, 30, -10); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-10, 10); ctx.bezierCurveTo(30, 110, 130, 140, 200, 110); ctx.bezierCurveTo(150, 80, 80, 30, 20, 12); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(40, -5); ctx.lineTo(95, -25); ctx.lineTo(105, 0); ctx.lineTo(95, 25); ctx.closePath(); ctx.fill();
            ctx.restore();
        };
        drawEagle(-2, 'rgba(255, 235, 170, 0.75)');
        drawEagle(0, '#6a3e0a');
        ctx.strokeStyle = 'rgba(255, 235, 170, 0.5)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
            const t = i / 7;
            ctx.beginPath(); ctx.moveTo(t * 30, -10 - t * 30); ctx.lineTo(40 + t * 130, -120 - t * 30); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(t * 25, 10 + t * 20); ctx.lineTo(30 + t * 120, 80 + t * 20); ctx.stroke();
        }
        ctx.restore();

        // Motto
        ctx.fillStyle = '#5a3408';
        ctx.font = 'bold 30px "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('E', cx - 200, cy - 80);
        ctx.font = 'bold 26px "Times New Roman", serif';
        ctx.fillText('PLURIBUS', cx - 200, cy - 40);
        ctx.fillText('UNUM', cx - 200, cy);

        // Highlight crescent
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 478, 0, Math.PI * 2);
        ctx.clip();
        const hl = ctx.createRadialGradient(cx - 200, cy - 220, 30, cx - 200, cy - 220, 360);
        hl.addColorStop(0, 'rgba(255, 250, 220, 0.45)');
        hl.addColorStop(1, 'rgba(255, 250, 220, 0)');
        ctx.fillStyle = hl;
        ctx.fillRect(0, 0, 1024, 1024);
        ctx.restore();

        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.needsUpdate = true;
        return tex;
    })();

    // Coin body — high-segment cylinder, warm brass
    const bodyGeo = new THREE.CylinderGeometry(radius, radius, height, 64);
    const bodySideMat = new THREE.MeshStandardMaterial({
        color: 0xdaa520, metalness: 0.5, roughness: 0.3, emissive: 0x3a2800, emissiveIntensity: 0.3
    });
    const faceMat = new THREE.MeshStandardMaterial({
        map: faceTex, metalness: 0.5, roughness: 0.3, emissive: 0x3a2800, emissiveIntensity: 0.2
    });
    const body = new THREE.Mesh(bodyGeo, [bodySideMat, faceMat, faceMat]);
    group.add(body);

    // Beveled rim — torus around the edge
    const rim = new THREE.Mesh(
        new THREE.TorusGeometry(radius, height * 0.5, 12, 80),
        new THREE.MeshStandardMaterial({ color: 0xf0c050, metalness: 0.5, roughness: 0.25, emissive: 0x4a3000, emissiveIntensity: 0.3 })
    );
    rim.rotation.x = Math.PI / 2;
    group.add(rim);

    return group;
});

MeshPresets.register('rock', ({ color = 0x999999, scale = 1.0 } = {}) => {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(
        (0.5 + Math.random()) * scale,
        (0.3 + Math.random() * 0.5) * scale,
        (0.5 + Math.random()) * scale
    );
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
});

// stone — sculpted irregular pebble, ported from design/resource-preview/stone.html.
// Subdivided icosahedron with vertical squash, capped top/bottom, and lateral
// noise to make organic lumps. Uses a procedural mottled-stone texture.
// Default radius 0.22 keeps the chunk size compatible with the wood-log /
// essence-tube stack scale (~0.4-0.6u silhouette).
let _stoneTexCache = null;
function _makeStoneTexture() {
    if (_stoneTexCache) return _stoneTexCache;
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#888a8e';
    ctx.fillRect(0, 0, 512, 512);
    // Soft mottled blotches.
    for (let i = 0; i < 800; i++) {
        const x = Math.random() * 512, y = Math.random() * 512;
        const r = 4 + Math.random() * 18;
        const g = 80 + Math.random() * 70;
        ctx.fillStyle = `rgba(${g}, ${g}, ${g + 5}, ${0.06 + Math.random() * 0.12})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // Dark grain speckles.
    for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(40, 40, 45, ${0.4 + Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(Math.random() * 512, Math.random() * 512, 0.7 + Math.random() * 1.8, 0, Math.PI * 2);
        ctx.fill();
    }
    // Light dust speckles.
    for (let i = 0; i < 120; i++) {
        ctx.fillStyle = `rgba(220, 220, 225, ${0.25 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(Math.random() * 512, Math.random() * 512, 0.6 + Math.random() * 1.4, 0, Math.PI * 2);
        ctx.fill();
    }
    // A few hairline cracks.
    for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = 'rgba(40, 40, 45, 0.5)';
        ctx.lineWidth = 1.2;
        const x = Math.random() * 512, y = Math.random() * 512;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + 20, y + 5, x + 40, y - 10, x + 60, y + 8);
        ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    _stoneTexCache = t;
    return t;
}

MeshPresets.register('stone', ({ radius = 0.22 } = {}) => {
    const group = new THREE.Group();
    const geo = new THREE.IcosahedronGeometry(radius, 4);

    // Squash + cap + lateral lump displacement (per-vertex).
    const halfHeight = radius * 0.41;
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        v.y *= 0.45;
        if (v.y >  halfHeight * 0.92) v.y =  halfHeight;
        if (v.y < -halfHeight * 0.92) v.y = -halfHeight;
        const capDist = Math.max(0, 1 - Math.abs(v.y) / halfHeight);
        const noise =
            Math.sin(v.x * 4.1 + v.z * 2.3) * 0.06 +
            Math.sin(v.z * 3.5 + v.x * 4.7) * 0.04 +
            Math.sin(v.x * 5.2 + v.z * 1.9) * 0.03;
        const lateral = 1 + noise * capDist;
        v.x *= lateral;
        v.z *= lateral;
        pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        map: _makeStoneTexture(),
        roughness: 0.92,
        metalness: 0.0,
        color: 0xffffff
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
});

MeshPresets.register('dead-tree', ({ color = 0x5d4037 } = {}) => {
    const trunkMat = new THREE.MeshStandardMaterial({ color, roughness: 1.0 });
    const tree = new THREE.Group();

    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.2, 3, 6);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5;
    trunk.rotation.x = (Math.random() - 0.5) * 0.2;
    trunk.rotation.z = (Math.random() - 0.5) * 0.2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    for (let j = 0; j < 3; j++) {
        const branch = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.1, 1.5, 4),
            trunkMat
        );
        branch.position.y = 1.5 + j * 0.5;
        branch.rotation.z = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random());
        branch.rotation.y = Math.random() * Math.PI * 2;
        tree.add(branch);
    }

    return tree;
});

// living-tree — leafy evergreen used by tree.json. Three stacked cones of
// decreasing radius give a tidy "Christmas-tree" silhouette that reads as a
// living tree (vs the bare-branch dead-tree silhouette). Foliage meshes are
// flagged userData.isFoliage = true so NextStepIndicator can target only the
// crown for the pulse hint, leaving the trunk untouched.
MeshPresets.register('living-tree', ({
    color = 0x5d4037,
    foliageColor = 0x2e7d32
} = {}) => {
    if (typeof foliageColor === 'string') foliageColor = parseInt(foliageColor, 16);

    const tree = new THREE.Group();

    const trunkMat = new THREE.MeshStandardMaterial({ color, roughness: 1.0 });
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.9, 6);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.45;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const foliageMat = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.85 });
    const layers = [
        { radius: 0.95, height: 1.20, y: 1.30 },
        { radius: 0.78, height: 1.00, y: 2.00 },
        { radius: 0.56, height: 0.85, y: 2.65 }
    ];
    for (const L of layers) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(L.radius, L.height, 8), foliageMat);
        cone.position.y = L.y;
        cone.rotation.y = Math.random() * Math.PI * 2;
        cone.castShadow = true;
        cone.receiveShadow = true;
        cone.userData.isFoliage = true;
        tree.add(cone);
    }

    tree.scale.setScalar(0.92 + Math.random() * 0.16);
    tree.rotation.y = Math.random() * Math.PI * 2;
    return tree;
});

MeshPresets.register('fence-log', ({ color = 0x8b4513 } = {}) => {
    const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const log = new THREE.Mesh(geo, mat);
    log.scale.y = 0.8 + Math.random() * 0.4;
    log.rotation.y = Math.random() * Math.PI;
    log.rotation.x = (Math.random() - 0.5) * 0.1;
    log.rotation.z = (Math.random() - 0.5) * 0.1;
    log.castShadow = true;
    log.receiveShadow = true;
    return log;
});

// Tall palisade log — chest-high cylinder + pointed cone cap. Used by the
// prototype perimeter to read as a defensive wall while keeping the rustic
// hand-built feel of the level-1 fence. Per-instance scale/lean/tint
// variation gives the row a "wonky cute" silhouette instead of a sterile bar.
MeshPresets.register('palisade-log', ({
    color = 0x8d6239,
    capColor = 0x6e4520,
    height = 1.8,
    radius = 0.18,
    capHeight = 0.30
} = {}) => {
    const group = new THREE.Group();

    // Subtle per-log tint so the row doesn't look stamped from one mold.
    const tintHsl = { h: 0, s: 0, l: 0 };
    const tintColor = new THREE.Color(color);
    tintColor.getHSL(tintHsl);
    tintHsl.l += (Math.random() - 0.5) * 0.10;
    tintHsl.h += (Math.random() - 0.5) * 0.02;
    const bodyColor = new THREE.Color().setHSL(
        Math.max(0, Math.min(1, tintHsl.h)),
        tintHsl.s,
        Math.max(0, Math.min(1, tintHsl.l))
    );

    const bodyGeo = new THREE.CylinderGeometry(radius, radius * 1.05, height, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.92, metalness: 0 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const capGeo = new THREE.ConeGeometry(radius * 1.10, capHeight, 8);
    const capMat = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.95, metalness: 0 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = height + capHeight / 2;
    cap.castShadow = true;
    group.add(cap);

    // Wonky-cute variation: random height (±8%), slight lean, random spin.
    group.scale.y = 0.92 + Math.random() * 0.16;
    group.rotation.y = Math.random() * Math.PI * 2;
    group.rotation.x = (Math.random() - 0.5) * 0.08;
    group.rotation.z = (Math.random() - 0.5) * 0.08;

    return group;
});

MeshPresets.register('wall', ({ color = 0x888888, size = { x: 2, y: 1.5, z: 0.8 } } = {}) => {
    const group = new THREE.Group();

    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = size.y / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const capGeo = new THREE.BoxGeometry(size.x + 0.2, 0.2, size.z + 0.2);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = size.y;
    group.add(cap);

    return group;
});

// storage-pad: same silhouette as `wall`, but the top cap is the resource's
// rim color instead of grey. A floating resource-icon (real wood-log /
// essence-tube mesh) is attached separately by EntityFactory via the
// archetype's top-level `iconResource` field — we can't import
// ResourceRegistry here without a circular dependency.
MeshPresets.register('storage-pad', ({
    color = 0x888888,
    rimColor = 0xcccccc,
    size = { x: 2.4, y: 0.4, z: 2.4 }
} = {}) => {
    const group = new THREE.Group();
    const c  = (typeof color    === 'string') ? parseInt(color,    16) : color;
    const rc = (typeof rimColor === 'string') ? parseInt(rimColor, 16) : rimColor;

    const bodyGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const bodyMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, metalness: 0.15 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = size.y / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Rim cap — a slightly oversized lip in the resource color sitting on top.
    // Brighter + lower roughness so it pops under the prototype's flat lighting.
    const capGeo = new THREE.BoxGeometry(size.x + 0.18, 0.16, size.z + 0.18);
    const capMat = new THREE.MeshStandardMaterial({ color: rc, roughness: 0.4, metalness: 0.1 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = size.y;
    cap.receiveShadow = true;
    group.add(cap);

    return group;
});

MeshPresets.register('turret', ({ color = 0xaaaaaa } = {}) => {
    const group = new THREE.Group();

    const baseGeo = new THREE.BoxGeometry(1.5, 0.4, 1.5);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const towerGeo = new THREE.CylinderGeometry(0.5, 0.7, 1.2, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const head = new THREE.Mesh(towerGeo, towerMat);
    head.position.y = 1.0;
    head.castShadow = true;
    group.add(head);

    const cannonGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const cannon = new THREE.Mesh(cannonGeo, cannonMat);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.z = 0.5;
    cannon.position.y = 0.2;
    head.add(cannon);

    return group;
});

MeshPresets.register('gate', ({ width = 8.0 } = {}) => {
    const group = new THREE.Group();

    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });

    const postLeft = new THREE.Mesh(postGeo, postMat);
    postLeft.position.set(-width / 2, 0.4, 0);
    postLeft.castShadow = true;
    group.add(postLeft);

    const postRight = new THREE.Mesh(postGeo, postMat);
    postRight.position.set(width / 2, 0.4, 0);
    postRight.castShadow = true;
    group.add(postRight);

    const doorGeo = new THREE.BoxGeometry(width, 0.15, 0.08);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xac7339 });
    const door = new THREE.Mesh(doorGeo, doorMat);

    const doorGroup = new THREE.Group();
    doorGroup.name = 'doorGroup';
    doorGroup.position.set(-width / 2, 0.5, 0);
    door.position.set(width / 2, 0, 0);

    const plankGeo = new THREE.BoxGeometry(0.1, 0.4, 0.05);
    for (let i = 0; i < 3; i++) {
        const plank = new THREE.Mesh(plankGeo, doorMat);
        plank.position.set((i * (width / 2)) - (width / 2) + 0.1, -0.1, 0.05);
        door.add(plank);
    }

    doorGroup.add(door);
    group.add(doorGroup);

    return group;
});

MeshPresets.register('unlock-zone', ({ color = 0x00aaff, size = 4.0 } = {}) => {
    const group = new THREE.Group();

    const baseGeo = new THREE.PlaneGeometry(size, size);
    const baseMat = new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.3
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.order = 'YXZ';
    base.rotation.set(-Math.PI / 2, Math.PI / 4, 0);
    base.position.y = 0.005;
    group.add(base);

    return group;
});

MeshPresets.register('unlock-zone-flat', ({ color = 0x00aaff, size = 4.0 } = {}) => {
    const group = new THREE.Group();

    const baseGeo = new THREE.PlaneGeometry(size, size);
    const baseMat = new THREE.MeshBasicMaterial({
        color: 0x9aa6b0,
        transparent: true,
        opacity: 0.45
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.005;
    group.add(base);

    return group;
});

MeshPresets.register('stall', ({ color = 0x8b6914, width = 2.5, depth = 1.5 } = {}) => {
    const group = new THREE.Group();

    // Counter
    const counterGeo = new THREE.BoxGeometry(width, 0.6, depth);
    const counterMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.y = 0.3;
    counter.castShadow = true;
    counter.receiveShadow = true;
    group.add(counter);

    // Awning posts (4 corners)
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const positions = [
        [-width / 2 + 0.1, 0.9, -depth / 2 + 0.1],
        [width / 2 - 0.1, 0.9, -depth / 2 + 0.1],
        [-width / 2 + 0.1, 0.9, depth / 2 - 0.1],
        [width / 2 - 0.1, 0.9, depth / 2 - 0.1]
    ];
    for (const [x, y, z] of positions) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, y, z);
        post.castShadow = true;
        group.add(post);
    }

    // Awning (flat roof)
    const awningGeo = new THREE.BoxGeometry(width + 0.4, 0.08, depth + 0.4);
    const awningMat = new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.9 });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.y = 1.8;
    awning.castShadow = true;
    awning.receiveShadow = true;
    group.add(awning);

    return group;
});

// --- Essence resource presets (ported from resources-preview.html) ---
const ESSENCE_GREEN    = 0x6dff28; // body color
const ESSENCE_EMISSIVE = 0x44cc15; // glow
const ESSENCE_BUBBLE   = 0xddffdd; // bubble color (unused but kept for parity)

MeshPresets.register('essence-puddle', () => {
    const group = new THREE.Group();

    // Irregular blob outline using multi-frequency wobble — organic splat
    const shape = new THREE.Shape();
    const N = 64;
    const baseR = 0.95;
    const pts = [];
    for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const wobble =
            Math.sin(a * 3 + 1.2) * 0.18 +
            Math.sin(a * 5 + 0.4) * 0.10 +
            Math.sin(a * 7 + 2.1) * 0.06 +
            Math.sin(a * 11 + 3.3) * 0.03;
        const r = baseR + wobble;
        pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    shape.setFromPoints(pts);

    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.06,
        bevelEnabled: true,
        bevelSegments: 5,
        bevelSize: 0.05,
        bevelThickness: 0.05,
        curveSegments: 32,
        steps: 1
    });
    geo.center();
    geo.rotateX(-Math.PI / 2); // lay flat on the ground

    const puddleMat = new THREE.MeshPhysicalMaterial({
        color: ESSENCE_GREEN,
        emissive: ESSENCE_EMISSIVE,
        emissiveIntensity: 0.55,
        metalness: 0.0,
        roughness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        transmission: 0.35,
        thickness: 0.25,
        transparent: true,
        opacity: 0.92
    });
    const puddle = new THREE.Mesh(geo, puddleMat);
    puddle.position.y = 0.02; // sit just above the ground plane
    puddle.castShadow = true;
    group.add(puddle);

    // Half-buried bubble bumps on top of the puddle
    const bubbleMat = new THREE.MeshPhysicalMaterial({
        color: 0x9dff60,
        emissive: ESSENCE_EMISSIVE,
        emissiveIntensity: 0.5,
        metalness: 0.0,
        roughness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        transmission: 0.4,
        transparent: true,
        opacity: 0.9
    });
    const bumps = [
        { x:  0.22, z: -0.12, r: 0.10 },
        { x: -0.32, z:  0.18, r: 0.07 },
        { x:  0.05, z:  0.28, r: 0.06 },
        { x: -0.18, z: -0.22, r: 0.08 },
        { x:  0.40, z:  0.05, r: 0.05 }
    ];
    for (const b of bumps) {
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(b.r, 16, 12), bubbleMat);
        bubble.position.set(b.x, 0.06 + b.r * 0.4, b.z);
        bubble.scale.y = 0.55;
        group.add(bubble);
    }

    // Tiny drip "tail"
    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), puddleMat);
    drip.position.set(-1.05, 0.03, 0.12);
    drip.scale.set(1.1, 0.35, 0.7);
    group.add(drip);

    // Scale the puddle down so its footprint matches a meat disk's pickup feel
    group.scale.setScalar(0.45);

    return group;
});

MeshPresets.register('essence-tube', () => {
    const group = new THREE.Group();

    const tubeLen = 1.6;
    const tubeR = 0.24;

    // "lite" glass — cheap MeshStandardMaterial; full transmission is too
    // expensive when 30+ tubes are stacked on the player's back.
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xddffe5,
        roughness: 0.08,
        metalness: 0.0,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    // Body — open-ended cylinder
    const bodyGeo = new THREE.CylinderGeometry(tubeR, tubeR, tubeLen, 32, 1, true);
    const body = new THREE.Mesh(bodyGeo, glassMat);
    body.rotation.z = Math.PI / 2;
    group.add(body);

    // Closed (rounded) bottom hemisphere
    const bottomGeo = new THREE.SphereGeometry(tubeR, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const bottom = new THREE.Mesh(bottomGeo, glassMat);
    bottom.rotation.z = Math.PI / 2;
    bottom.position.x = -tubeLen / 2;
    group.add(bottom);

    // Open-end lip
    const lipGeo = new THREE.TorusGeometry(tubeR + 0.012, 0.018, 12, 32);
    const lip = new THREE.Mesh(lipGeo, glassMat);
    lip.rotation.y = Math.PI / 2;
    lip.position.x = tubeLen / 2;
    group.add(lip);

    // ===== Essence liquid inside =====
    const liquidR = tubeR - 0.025;
    const liquidLen = tubeLen * 0.9;
    const cylPortion = Math.max(0.01, liquidLen - 2 * liquidR);

    const liquidMat = new THREE.MeshStandardMaterial({
        color: ESSENCE_GREEN,
        emissive: ESSENCE_EMISSIVE,
        emissiveIntensity: 0.8,
        metalness: 0.0,
        roughness: 0.22
    });

    const liquidGeo = new THREE.CapsuleGeometry(liquidR, cylPortion, 8, 16);
    const liquid = new THREE.Mesh(liquidGeo, liquidMat);
    liquid.rotation.z = Math.PI / 2;
    liquid.position.x = -tubeLen / 2 + liquidLen / 2;
    group.add(liquid);

    // ===== Bubbles trapped in the liquid =====
    const liquidBubbleMat = new THREE.MeshStandardMaterial({
        color: ESSENCE_BUBBLE,
        emissive: 0xaaffaa,
        emissiveIntensity: 0.5,
        metalness: 0.0,
        roughness: 0.15
    });

    const bubbles = [
        { x: -0.55, y:  0.06, z:  0.04, r: 0.05  },
        { x: -0.20, y: -0.08, z: -0.04, r: 0.065 },
        { x:  0.15, y:  0.05, z:  0.06, r: 0.045 },
        { x:  0.45, y: -0.04, z:  0.03, r: 0.04  }
    ];
    for (const b of bubbles) {
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(b.r, 16, 12), liquidBubbleMat);
        bubble.position.set(b.x, b.y, b.z);
        group.add(bubble);
    }

    // ===== Black rubber stopper =====
    const stopperMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.85,
        metalness: 0.0
    });

    const plug = new THREE.Mesh(
        new THREE.CylinderGeometry(tubeR - 0.008, tubeR - 0.022, 0.11, 24),
        stopperMat
    );
    plug.rotation.z = -Math.PI / 2;
    plug.position.x = tubeLen / 2 - 0.04;
    group.add(plug);

    const flange = new THREE.Mesh(
        new THREE.CylinderGeometry(tubeR + 0.03, tubeR + 0.03, 0.05, 24),
        stopperMat
    );
    flange.rotation.z = Math.PI / 2;
    flange.position.x = tubeLen / 2 + 0.045;
    group.add(flange);

    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), stopperMat);
    knob.position.x = tubeLen / 2 + 0.095;
    knob.scale.y = 0.85;
    group.add(knob);

    // Scale so a single tube reads at roughly the same volume as a meat disk
    group.scale.setScalar(0.45);

    return group;
});

// --- Essence Candy resource preset (lollipop) ---
const CANDY_GREEN      = 0x7aff3a;
const CANDY_GREEN_DARK = 0x3abf10;
const CANDY_EMISSIVE   = 0x50dd18;

MeshPresets.register('essence-candy-lollipop', () => {
    const group = new THREE.Group();
    const candyR = 0.48;

    // Candy ball — glossy sphere
    const ballMat = new THREE.MeshPhysicalMaterial({
        color: CANDY_GREEN,
        emissive: CANDY_EMISSIVE,
        emissiveIntensity: 0.4,
        metalness: 0.0,
        roughness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        transmission: 0.1,
        thickness: 0.6,
        transparent: true,
        opacity: 0.95
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(candyR, 32, 24), ballMat);
    ball.position.y = 0.6;
    group.add(ball);

    // Spiral stripe wrapping the sphere
    const swirlMat = new THREE.MeshStandardMaterial({
        color: CANDY_GREEN_DARK,
        emissive: 0x228800,
        emissiveIntensity: 0.3,
        metalness: 0.0,
        roughness: 0.2
    });
    const swirlPts = [];
    for (let i = 0; i < 160; i++) {
        const t = i / 159;
        const phi = t * Math.PI;
        const theta = t * Math.PI * 10;
        const r = candyR * 1.005;
        swirlPts.push(new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * r,
            0.6 + Math.cos(phi) * r,
            Math.sin(phi) * Math.sin(theta) * r
        ));
    }
    const swirlCurve = new THREE.CatmullRomCurve3(swirlPts);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(swirlCurve, 100, 0.028, 6, false), swirlMat));

    // Stick
    const stickMat = new THREE.MeshStandardMaterial({
        color: 0xf5f0e0,
        roughness: 0.6,
        metalness: 0.0
    });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 1.1, 12), stickMat);
    stick.position.y = -0.05;
    group.add(stick);

    // Glossy highlights
    const highlightMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xeeffee,
        emissiveIntensity: 0.5,
        metalness: 0.2,
        roughness: 0.05,
        transparent: true,
        opacity: 0.7
    });
    const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), highlightMat);
    hl1.position.set(-0.14, 0.78, candyR * 0.38);
    group.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 6), highlightMat);
    hl2.position.set(-0.06, 0.9, candyR * 0.3);
    group.add(hl2);

    // Lay horizontal and scale to match other resource sizes
    group.rotation.z = Math.PI / 2;
    group.rotation.y = 0.3;
    group.scale.setScalar(0.45);

    return group;
});

// ─── Worker hat / tool helpers (Act 3, PR #3.1) ──────────────────────
//
// Workers reuse the `character-player` rig but get a tinted body + a hat on
// the head + a tool in the right hand. Each helper returns a small group
// with all geometry inside; the caller positions it on the rig.

function _makeWorkerHat(kind) {
    const g = new THREE.Group();
    if (kind === 'cap') {
        // Wood worker — flat cap (low cylinder + flat brim disc)
        const crown = new THREE.Mesh(
            new THREE.CylinderGeometry(0.21, 0.22, 0.1, 12),
            new THREE.MeshStandardMaterial({ color: 0x6b4123, roughness: 0.85 })
        );
        crown.position.y = 0.18;
        g.add(crown);
        const brim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.30, 0.30, 0.025, 16),
            new THREE.MeshStandardMaterial({ color: 0x4d2e18, roughness: 0.85 })
        );
        brim.position.set(0, 0.13, 0.06);
        g.add(brim);
    } else if (kind === 'hood') {
        // Essence collector — pointed hood / cone over the head
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.27, 0.42, 14),
            new THREE.MeshStandardMaterial({ color: 0x1d4a6b, roughness: 0.9 })
        );
        cone.position.y = 0.24;
        g.add(cone);
        // Tiny tip dot for personality
        const tip = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0x66ddff, emissive: 0x33aadd, emissiveIntensity: 0.6 })
        );
        tip.position.y = 0.46;
        g.add(tip);
    } else if (kind === 'hardhat') {
        // Builder — half-sphere dome + flat brim
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(0.23, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0xeebb22, roughness: 0.5 })
        );
        dome.position.y = 0.16;
        g.add(dome);
        const brim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.30, 0.30, 0.04, 18),
            new THREE.MeshStandardMaterial({ color: 0xeebb22, roughness: 0.5 })
        );
        brim.position.set(0, 0.16, 0.07);
        g.add(brim);
    }
    return g;
}

function _makeWorkerTool(kind) {
    const g = new THREE.Group();
    if (kind === 'axe') {
        // Stylized woodsman axe — chunky cartoon proportions, BIG size
        // (total length ~0.95u).
        //
        // GEOMETRY LAYOUT — the GRIP sits at local y = 0. This is the
        // rotation pivot used by the chop animation: when the axe
        // swings, it pivots around the worker's hand without the
        // worker's arm needing to move. Head extends to high +Y,
        // pommel sits below the grip at low -Y.
        //
        // BLADE FACES FORWARD (+Z): at rest the cutting edge points in
        // the +Z direction. Chop animation rotates around X axis, so
        // the head sweeps from straight-up (rest) to forward-down (90°
        // strike) and back to rest.
        //
        // The whole group is offset DOWN (g.position.y) so the grip
        // lands at the worker's hand position.

        // Haft — fat cartoon cylinder, warm brown.
        const haft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.09, 0.10, 0.82, 12),
            new THREE.MeshStandardMaterial({ color: 0x8a5026, roughness: 0.85 })
        );
        haft.position.y = +0.36;
        g.add(haft);

        // Leather grip wrap — at the pivot point (worker's hand).
        const grip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.13, 0.13, 0.22, 12),
            new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.95 })
        );
        grip.position.y = 0;
        g.add(grip);

        // Pommel — chunky knob just below the grip.
        const pommel = new THREE.Mesh(
            new THREE.SphereGeometry(0.10, 12, 10),
            new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.85 })
        );
        pommel.position.y = -0.18;
        g.add(pommel);

        // Iron head — stylized chunky blade at top of haft. BLADE FACES +Z.
        const ironMat = new THREE.MeshStandardMaterial({
            color: 0x4a4a52, roughness: 0.35, metalness: 0.85
        });
        const ironLight = new THREE.MeshStandardMaterial({
            color: 0xa6acb6, roughness: 0.25, metalness: 0.95
        });
        const headY = 0.78;

        // Eye — chunky cube wrapping the haft where the head mounts.
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), ironMat);
        eye.position.y = headY;
        g.add(eye);

        // Forward blade — wide wedge in +Z direction (faces forward).
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.58), ironMat);
        blade.position.set(0, headY, 0.40);
        g.add(blade);

        // Cutting edge — bright leading strip at the front face.
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.07), ironLight);
        edge.position.set(0, headY, 0.73);
        g.add(edge);

        // Offset DOWN so the grip lands at the worker's hand.
        g.position.y = -0.36;

        // At-rest pose: axe straight up (head over hand). No tilt — the
        // chop animation will pivot it forward and back from this pose.
        g.rotation.x = 0;
        g.rotation.z = 0;

        // Tag so LungeAnimSystem can find this group at chop time.
        g.userData.isWorkerAxe = true;
        g.name = 'workerAxe';
    } else if (kind === 'jar') {
        // Essence collector — small handle + glowing wisp jar on top
        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.30, 8),
            new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7 })
        );
        handle.position.y = -0.08;
        g.add(handle);
        const jar = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 12, 10),
            new THREE.MeshStandardMaterial({
                color: 0x66ddff, emissive: 0x33aadd, emissiveIntensity: 0.9,
                roughness: 0.3, metalness: 0.1
            })
        );
        jar.position.y = 0.08;
        g.add(jar);
    } else if (kind === 'wrench') {
        // Builder — handle (vertical) + open-end (two prongs at the top)
        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8),
            new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.7 })
        );
        handle.position.y = -0.10;
        g.add(handle);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.4, metalness: 0.7 });
        const prongL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.08), headMat);
        prongL.position.set(-0.05, 0.16, 0);
        g.add(prongL);
        const prongR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.08), headMat);
        prongR.position.set(0.05, 0.16, 0);
        g.add(prongR);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.08), headMat);
        back.position.set(0, 0.13, 0);
        g.add(back);
    }
    return g;
}

/**
 * Public wrapper around the internal axe builder so other modules (e.g.
 * PlayerAxe) can reuse the worker's exact axe mesh without duplicating
 * the geometry. Returns a fresh Group on each call — the caller owns it.
 */
export function buildWorkerAxe() {
    return _makeWorkerTool('axe');
}

// ─── Soldier weapons (PR #5 attack-anim polish) ───────────────────────
//
// Held weapons for Scout (spear) and Bruiser (sword), attached to the
// rightElbow pivot the same way worker tools are. Local +Y points up
// along the held weapon, so when the arm swings forward (rotation.x +)
// the weapon thrusts/cleaves forward with it.
//
// Each weapon's root group is tagged userData.isWeapon = true so
// LungeAnimSystem can look it up by traversal if it needs per-weapon
// motion (e.g., sword-grip the left hand, lengthen the spear during
// the strike).

function _makeSoldierWeapon(kind) {
    const g = new THREE.Group();
    g.userData.isWeapon = true;
    g.userData.weaponKind = kind;

    if (kind === 'spear') {
        // Long heavy shaft + wide tip — sized for legibility during flight
        // (the projectile is the visual focus during the chained throw).
        // Held vertical at rest; whole weapon thrusts forward when the
        // arm rotates.
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 });
        const tipMat   = new THREE.MeshStandardMaterial({ color: 0xc8c8d0, roughness: 0.30, metalness: 0.75 });

        const SHAFT_LEN    = 1.50;
        const SHAFT_RADIUS = 0.060;
        const TIP_LEN      = 0.30;
        const TIP_RADIUS   = 0.12;
        const SHAFT_Y      = 0.45;   // shaft center y; grip sits below

        const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(SHAFT_RADIUS, SHAFT_RADIUS * 1.2, SHAFT_LEN, 8),
            shaftMat
        );
        shaft.position.y = SHAFT_Y;
        shaft.castShadow = true;
        g.add(shaft);

        const tip = new THREE.Mesh(new THREE.ConeGeometry(TIP_RADIUS, TIP_LEN, 8), tipMat);
        tip.position.y = SHAFT_Y + SHAFT_LEN / 2 + TIP_LEN / 2;
        tip.castShadow = true;
        g.add(tip);

        // Bronze haft-collar at the grip for visual punctuation
        const collar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.085, 0.085, 0.08, 8),
            new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.5, metalness: 0.6 })
        );
        collar.position.y = SHAFT_Y - SHAFT_LEN / 2 - 0.04;
        g.add(collar);
    } else if (kind === 'sword') {
        // Two-handed cleaver. Grip at bottom (in the right hand), broad
        // crossguard, tapering blade going up. Bruiser anim grips the
        // hilt with both hands by also rotating the left arm to match.
        const gripMat   = new THREE.MeshStandardMaterial({ color: 0x3a2210, roughness: 0.85 });
        const guardMat  = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.45, metalness: 0.6 });
        const bladeMat  = new THREE.MeshStandardMaterial({ color: 0xd0d0d8, roughness: 0.30, metalness: 0.75 });

        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), gripMat);
        grip.position.y = -0.12;
        grip.castShadow = true;
        g.add(grip);

        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.05, 0.06), guardMat);
        guard.position.y = 0.0;
        guard.castShadow = true;
        g.add(guard);

        const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), guardMat);
        pommel.position.y = -0.24;
        g.add(pommel);

        // Blade: a tapering box (wide near guard, narrow at tip)
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.75, 0.025), bladeMat);
        blade.position.y = 0.40;
        blade.castShadow = true;
        // Tilt the blade slightly so it doesn't look like a flat slab
        blade.rotation.z = 0.04;
        g.add(blade);

        // Pointed blade tip — small cone
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.15, 4), bladeMat);
        tip.position.y = 0.85;
        tip.castShadow = true;
        g.add(tip);
    } else if (kind === 'bow') {
        // Sharpshooter bow — large vertical recurve with a visible
        // bowstring and a nocked golden arrow pointing forward (+Z).
        // The bow STAYS visible during attacks; only the arrow projectile
        // leaves the bowstring on attack (CombatVFXSystem.spawnPierceArrow
        // spawns a separate world-space arrow). Grip sits at local y=0,
        // limbs extend ±0.7u up/down. Arc bulges toward -Z (behind the
        // soldier's facing) so the curve "points away" like a real recurve.
        const bowMat   = new THREE.MeshStandardMaterial({ color: 0x4a2e1a, roughness: 0.80 });
        const stringMat = new THREE.MeshBasicMaterial({ color: 0xddc88a });
        const arrowShaftMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.7 });
        const arrowTipMat   = new THREE.MeshStandardMaterial({
            color: 0xb8b8c0, roughness: 0.25, metalness: 0.85,
            emissive: 0xddeeff, emissiveIntensity: 0.20
        });

        // Bow body: parabolic curve from bottom limb to top limb, bulging
        // backward. TubeGeometry along a Catmull-Rom curve.
        const ARC_HEIGHT = 1.40;
        const ARC_BACK   = 0.30;
        const SEGMENTS   = 10;
        const TUBE_R     = 0.040;
        const points = [];
        for (let i = 0; i <= SEGMENTS; i++) {
            const t = i / SEGMENTS;
            const y = (t - 0.5) * ARC_HEIGHT;
            const z = -ARC_BACK * 4 * t * (1 - t);
            points.push(new THREE.Vector3(0, y, z));
        }
        const curve = new THREE.CatmullRomCurve3(points);
        const arc = new THREE.Mesh(
            new THREE.TubeGeometry(curve, SEGMENTS * 2, TUBE_R, 6, false),
            bowMat
        );
        arc.castShadow = true;
        g.add(arc);

        // Bowstring — straight thin cylinder running between the limb tips.
        const string = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, ARC_HEIGHT, 4),
            stringMat
        );
        string.position.set(0, 0, 0);
        g.add(string);

        // Nocked arrow — small shaft + golden cone tip, pointing forward
        // (+Z). The shaft sits at the bowstring's midpoint at rest; on
        // attack, CombatVFX spawns its own clone and flies it down-range.
        // The nocked-arrow group here is purely visual at-rest decoration.
        const arrow = new THREE.Group();
        const ARROW_LEN = 0.55;
        const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, ARROW_LEN, 6),
            arrowShaftMat
        );
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = ARROW_LEN / 2;
        arrow.add(shaft);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), arrowTipMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.z = ARROW_LEN + 0.07;
        arrow.add(tip);
        arrow.userData.isNockedArrow = true;
        g.add(arrow);
    }
    return g;
}

// ─── character-soldier preset ─────────────────────────────────────────
//
// Wraps `character-player` so soldiers inherit the full animation rig
// and pick up a held weapon on `rightElbow` (so it tracks the hand
// when arms swing).
//
// Options:
//   color  — body tint (passed through to character-player)
//   weapon — 'spear' | 'sword' | null
//
// Used by scout.json / bruiser.json.

MeshPresets.register('character-soldier', ({ color = 0xbbbbbb, weapon = null } = {}) => {
    const root = MeshPresets.create('character-player', { color });

    if (weapon) {
        const rightElbow = root.getObjectByName('rightElbow');
        const w = _makeSoldierWeapon(weapon);
        // Sit the weapon roughly where the hand would be; slight forward
        // offset so the shaft doesn't z-fight with the forearm capsule.
        w.position.set(0.04, -0.30, 0.04);
        if (rightElbow) rightElbow.add(w);
    }

    return root;
});

// ─── character-worker preset ──────────────────────────────────────────
//
// Wraps `character-player` so workers inherit the full animation rig
// (named bones: head, leftArm, rightArm, leftLeg, etc.) and pick up a
// hat on `head` + a tool on `rightElbow` (so the tool tracks the hand
// when arms swing).
//
// Options:
//   color       — body tint, passed through to character-player
//   hat         — 'cap' | 'hood' | 'hardhat' | null
//   tool        — 'axe' | 'jar' | 'wrench' | null
//
// Used by wood-worker.json / essence-collector.json / worker-builder.json.

MeshPresets.register('character-worker', ({ color = 0xbbbbbb, hat = null, tool = null } = {}) => {
    const root = MeshPresets.create('character-player', { color });

    if (hat) {
        const head = root.getObjectByName('head');
        if (head) head.add(_makeWorkerHat(hat));
    }
    if (tool) {
        const rightElbow = root.getObjectByName('rightElbow');
        // Tool dangles from the hand. Slight forward + outward offset so it
        // doesn't z-fight with the forearm capsule.
        const t = _makeWorkerTool(tool);
        t.position.set(0.04, -0.30, 0.04);
        if (rightElbow) rightElbow.add(t);
    }

    return root;
});

// ─── Worker base buildings (Act 3, PR #4.2) ───────────────────────
//
// One small building per worker role, color-matched to the worker's tint.
// Each base spawns its associated worker via the OnSpawn helper attached
// in the archetype JSON.

MeshPresets.register('worker-base-wood', () => {
    // Brown log cabin: box body + simple slanted plank roof
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5b3a1c, roughness: 0.8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), wallMat);
    body.position.y = 0.6;
    body.castShadow = true;
    g.add(body);

    // Slanted roof — a flattened, scaled box rotated to look like a peaked top
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.7, 4), roofMat);
    roof.position.y = 1.55;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);

    // Door — small dark recess on the south face
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2210, roughness: 0.9 });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.7), doorMat);
    door.position.set(0, 0.45, 0.81);
    g.add(door);

    return g;
});

MeshPresets.register('worker-base-essence', () => {
    // Cyan crystalline pillar: tall narrow body + glowing orb on top
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x224466, roughness: 0.45, metalness: 0.1
    });
    const orbMat = new THREE.MeshStandardMaterial({
        color: 0x66ddff, emissive: 0x33aadd, emissiveIntensity: 0.9,
        roughness: 0.3, metalness: 0.2
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 1.8, 6), wallMat);
    body.position.y = 0.9;
    body.castShadow = true;
    g.add(body);

    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), orbMat);
    orb.position.y = 2.05;
    orb.castShadow = true;
    g.add(orb);

    // Faint base ring
    const ringMat = new THREE.MeshStandardMaterial({
        color: 0x66ddff, emissive: 0x33aadd, emissiveIntensity: 0.4
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);

    return g;
});

MeshPresets.register('worker-base-builder', () => {
    // Yellow construction shed: box body + slanted scaffold beam + flag
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xddcc22, roughness: 0.6 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x886600, roughness: 0.7 });
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xff6633, roughness: 0.5 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), wallMat);
    body.position.y = 0.5;
    body.castShadow = true;
    g.add(body);

    // Diagonal scaffold beam over the roof — tells the eye "construction"
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 0.12), trimMat);
    beam.position.set(0.5, 1.4, 0);
    beam.rotation.z = Math.PI / 5;
    beam.castShadow = true;
    g.add(beam);

    // Pole + flag on top
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), trimMat);
    pole.position.set(-0.5, 1.45, 0);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28), flagMat);
    flag.position.set(-0.27, 1.7, 0);
    flag.rotation.y = Math.PI / 2;
    g.add(flag);

    return g;
});

// ─── Military base buildings (Act 3, PR #4.4) ─────────────────────
//
// Replace the generic unlock-turret look on the scout/bruiser spawn pads
// with proper green/red military bunkers. Player walks within ~2u carrying
// enough essence and the existing UnlockZoneSystem drain (tuned snappy)
// auto-pays + spawns a troop from the base.

MeshPresets.register('military-base-green', () => {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c5e2c, roughness: 0.85 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x5a8a4d, roughness: 0.85 });

    // King-fort body — bumped to 2.0 × 1.7 × 2.0 (was 1.6 × 1.4 × 1.6).
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.7, 2.0), wallMat);
    body.position.y = 0.85;
    body.castShadow = true;
    g.add(body);

    // Sandbag-look trim ring around the base
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.2, 2.3), trimMat);
    trim.position.y = 0.10;
    g.add(trim);

    // Roof slab — flat platform extending slightly beyond the body footprint.
    // PR #4.4 polish: gives a clear surface for the cost display + grounds
    // the battlements above the body silhouette.
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1f4a1f, roughness: 0.8 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 2.4), roofMat);
    roof.position.y = 1.78;
    roof.castShadow = true;
    g.add(roof);

    // Corner battlements — four small forts on top of the roof slab
    const battleMat = new THREE.MeshStandardMaterial({ color: 0x1a4a1a, roughness: 0.85 });
    const battleGeo = new THREE.BoxGeometry(0.4, 0.42, 0.4);
    for (const [x, z] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) {
        const b = new THREE.Mesh(battleGeo, battleMat);
        b.position.set(x, 2.08, z);
        b.castShadow = true;
        g.add(b);
    }

    // Door — dark recess on the south face
    const door = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x1a2a1a, roughness: 0.95 })
    );
    door.position.set(0, 0.6, 1.01);
    g.add(door);

    return g;
});

MeshPresets.register('military-base-red', () => {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x6a2222, roughness: 0.85 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x3a1010, roughness: 0.85 });

    // Taller fortified bunker — bumped to 2.0 × 1.7 × 2.0.
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.7, 2.0), wallMat);
    body.position.y = 0.85;
    body.castShadow = true;
    g.add(body);

    // Trim ring (matches green base's silhouette)
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.2, 2.3), trimMat);
    trim.position.y = 0.10;
    g.add(trim);

    // Roof slab — flat platform for the cost display + battlements
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a1010, roughness: 0.8 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 2.4), roofMat);
    roof.position.y = 1.78;
    roof.castShadow = true;
    g.add(roof);

    // Corner battlements
    const battleMat = new THREE.MeshStandardMaterial({ color: 0x4a1818, roughness: 0.85 });
    const battleGeo = new THREE.BoxGeometry(0.4, 0.42, 0.4);
    for (const [x, z] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) {
        const b = new THREE.Mesh(battleGeo, battleMat);
        b.position.set(x, 2.08, z);
        b.castShadow = true;
        g.add(b);
    }

    // Door
    const door = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x2a0a0a, roughness: 0.95 })
    );
    door.position.set(0, 0.6, 1.01);
    g.add(door);

    return g;
});

// flag-pole: central Kingdom Flag — slim wooden pole + sloped banner with
// a finial cap. The banner is parented to a `flagPivot` Object3D and exposed
// via mesh.userData.flagPivot so the main loop (or any system) can apply a
// gentle wave by mutating flagPivot.rotation.y. The pole base is a stone
// disc that reads as "permanent fixture" rather than a buildable.
MeshPresets.register('flag-pole', ({
    color = 0xc89b3c,
    bannerColor = 0xd83a3a,
    poleHeight = 4.2,
    poleRadius = 0.09,
    bannerSize = { x: 1.2, y: 0.7 }
} = {}) => {
    const group = new THREE.Group();

    const c   = (typeof color       === 'string') ? parseInt(color,       16) : color;
    const bcl = (typeof bannerColor === 'string') ? parseInt(bannerColor, 16) : bannerColor;

    // Stone disc base — sells "permanent fixture, not built"
    const baseGeo = new THREE.CylinderGeometry(0.55, 0.7, 0.18, 18);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x6e6e6e, roughness: 0.95, metalness: 0.05 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.09;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Pole
    const poleGeo = new THREE.CylinderGeometry(poleRadius, poleRadius * 1.05, poleHeight, 10);
    const poleMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.35 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 0.18 + poleHeight / 2;
    pole.castShadow = true;
    group.add(pole);

    // Spherical finial cap
    const finialGeo = new THREE.SphereGeometry(poleRadius * 2.2, 12, 10);
    const finialMat = new THREE.MeshStandardMaterial({ color: 0xf2d27a, roughness: 0.35, metalness: 0.6 });
    const finial = new THREE.Mesh(finialGeo, finialMat);
    finial.position.y = 0.18 + poleHeight + poleRadius * 1.6;
    group.add(finial);

    // Banner — parented to a pivot at the pole top so we can wave it later.
    // Pivot sits at the pole's RIGHT edge, banner offset half its width so
    // its inboard edge meets the pole.
    const bannerPivot = new THREE.Object3D();
    bannerPivot.position.set(poleRadius, 0.18 + poleHeight - 0.4, 0);
    group.add(bannerPivot);

    const bannerGeo = new THREE.PlaneGeometry(bannerSize.x, bannerSize.y, 6, 1);
    const bannerMat = new THREE.MeshStandardMaterial({
        color: bcl, roughness: 0.85, metalness: 0,
        side: THREE.DoubleSide, emissive: bcl, emissiveIntensity: 0.10
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.x = bannerSize.x / 2;
    banner.position.y = -bannerSize.y / 2;
    banner.castShadow = true;
    bannerPivot.add(banner);

    // Triangular pennant accent below the main banner — sells "kingdom" silhouette.
    const pennantShape = new THREE.Shape();
    pennantShape.moveTo(0, 0);
    pennantShape.lineTo(0.55, -0.18);
    pennantShape.lineTo(0, -0.36);
    pennantShape.lineTo(0, 0);
    const pennantGeo = new THREE.ShapeGeometry(pennantShape);
    const pennantMat = new THREE.MeshStandardMaterial({
        color: 0xf2d27a, roughness: 0.7, side: THREE.DoubleSide
    });
    const pennant = new THREE.Mesh(pennantGeo, pennantMat);
    pennant.position.y = -bannerSize.y - 0.05;
    bannerPivot.add(pennant);

    // Expose the pivot so callers can wave the banner each frame.
    group.userData.flagPivot = bannerPivot;
    group.userData.bannerMesh = banner;

    return group;
});

// Cemetery / Lava Hole — visible, indestructible zombie spawn point.
// Reads as "the dead are crawling out of a hellish opening in the earth":
// scorched ground decal → cracked rocky rim → red lava ring → bright molten
// core. Lava layers use MeshBasicMaterial so they glow regardless of
// scene lighting. Pivots are exposed via group.userData so LavaHoleSystem
// can pulse the core, flash on emerge, and spawn embers from the bowl.
MeshPresets.register('lava-hole', () => {
    const group = new THREE.Group();

    // 1. Scorched ground decal — wide dark patch around the rim, sells
    //    "ground around the hole is burnt black".
    const scorchGeo = new THREE.CircleGeometry(2.4, 40);
    const scorchMat = new THREE.MeshStandardMaterial({
        color: 0x141008, roughness: 1.0, metalness: 0
    });
    const scorch = new THREE.Mesh(scorchGeo, scorchMat);
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.y = 0.005;
    scorch.receiveShadow = true;
    group.add(scorch);

    // 2. Outer rocky rim — 9 dark broken stones around the perimeter,
    //    angled randomly. Built from a low-poly dodecahedron so the
    //    silhouette reads as broken volcanic rock, not smooth pebbles.
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x2a2018, roughness: 0.95, metalness: 0.1, flatShading: true
    });
    const rimRocks = 9;
    for (let i = 0; i < rimRocks; i++) {
        const angle = (i / rimRocks) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const r = 1.55 + Math.random() * 0.18;
        const size = 0.32 + Math.random() * 0.22;
        const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(size, 0),
            rockMat
        );
        rock.position.set(Math.cos(angle) * r, size * 0.55, Math.sin(angle) * r);
        rock.rotation.set(Math.random() * 2, Math.random() * Math.PI * 2, Math.random() * 2);
        rock.castShadow = true;
        rock.receiveShadow = true;
        group.add(rock);
    }

    // 3. Crater inner wall — short cylinder sunk slightly so the inner
    //    rim catches light from the lava and the silhouette feels deeper
    //    than a flat decal. OpenEnded so we don't render a top cap that
    //    would block the lava layers below.
    const craterGeo = new THREE.CylinderGeometry(1.45, 1.25, 0.40, 28, 1, true);
    const craterMat = new THREE.MeshStandardMaterial({
        color: 0x1a0d05, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide
    });
    const crater = new THREE.Mesh(craterGeo, craterMat);
    crater.position.y = 0.20;
    group.add(crater);

    // 4. Outer lava ring — wide bright reddish disc that fills the bowl.
    //    MeshBasicMaterial means it glows regardless of lights and reads
    //    "molten" against the dark crater walls.
    const lavaOuterGeo = new THREE.CircleGeometry(1.30, 40);
    const lavaOuterMat = new THREE.MeshBasicMaterial({ color: 0xc8341a });
    const lavaOuter = new THREE.Mesh(lavaOuterGeo, lavaOuterMat);
    lavaOuter.rotation.x = -Math.PI / 2;
    lavaOuter.position.y = 0.04;
    group.add(lavaOuter);

    // 5. Lava middle — mid-orange, sits just above the outer disc so the
    //    color gradient pops.
    const lavaMidGeo = new THREE.CircleGeometry(0.95, 36);
    const lavaMidMat = new THREE.MeshBasicMaterial({ color: 0xff5a18 });
    const lavaMid = new THREE.Mesh(lavaMidGeo, lavaMidMat);
    lavaMid.rotation.x = -Math.PI / 2;
    lavaMid.position.y = 0.06;
    group.add(lavaMid);

    // 6. Lava core — brightest yellow-orange, the visual "bottom of the
    //    hole" the player's eye lands on. LavaHoleSystem pulses this
    //    layer's color brightness sinusoidally and spikes it on emerge.
    const lavaCoreGeo = new THREE.CircleGeometry(0.55, 30);
    const lavaCoreMat = new THREE.MeshBasicMaterial({ color: 0xffc750 });
    const lavaCore = new THREE.Mesh(lavaCoreGeo, lavaCoreMat);
    lavaCore.rotation.x = -Math.PI / 2;
    lavaCore.position.y = 0.075;
    group.add(lavaCore);

    // 7. A few embedded glowing cracks radiating outward from the rim —
    //    thin red stripes in the scorched ground that sell "the lava is
    //    leaking out". Static; cheap.
    const crackMat = new THREE.MeshBasicMaterial({ color: 0xb02810 });
    const crackCount = 5;
    for (let i = 0; i < crackCount; i++) {
        const angle = (i / crackCount) * Math.PI * 2 + Math.random() * 0.6;
        const len = 0.55 + Math.random() * 0.45;
        const crack = new THREE.Mesh(
            new THREE.PlaneGeometry(len, 0.08),
            crackMat
        );
        crack.rotation.x = -Math.PI / 2;
        crack.rotation.z = angle;
        crack.position.set(
            Math.cos(angle) * (1.75 + len * 0.5),
            0.012,
            Math.sin(angle) * (1.75 + len * 0.5)
        );
        group.add(crack);
    }

    // 8. Heat haze cap — a translucent orange disc that floats just above
    //    the lava and slowly oscillates opacity (driven by LavaHoleSystem).
    //    Reads as a shimmer / heat distortion.
    const hazeGeo = new THREE.CircleGeometry(1.20, 32);
    const hazeMat = new THREE.MeshBasicMaterial({
        color: 0xffaa44,
        transparent: true,
        opacity: 0.16,
        depthWrite: false
    });
    const haze = new THREE.Mesh(hazeGeo, hazeMat);
    haze.rotation.x = -Math.PI / 2;
    haze.position.y = 0.55;
    group.add(haze);

    // Expose pivots for LavaHoleSystem.
    //   lavaCore    — modulated emissive-style brightness (color lerp).
    //   lavaMid     — secondary brightness layer.
    //   haze        — opacity oscillation.
    //   emergePos   — world-space target for ember bursts (computed in update).
    group.userData.lavaCore = lavaCore;
    group.userData.lavaMid  = lavaMid;
    group.userData.haze     = haze;
    group.userData.isLavaHole = true;

    return group;
});

// ─── tree-stump preset ────────────────────────────────────────────────
// Cut-trunk scar left on the ground when a tree-prototype is felled.
// Squat vertical cylinder + lighter "freshly cut" cap with darker rings
// — reads as permanent ground feature, NOT a pickup. No userData hooks.
MeshPresets.register('tree-stump', ({
    radius = 0.45,
    height = 0.32,
    barkColor = 0x4a3326,
    coreColor = 0xb38a5e
} = {}) => {
    const group = new THREE.Group();

    const barkMat = new THREE.MeshStandardMaterial({ color: barkColor, roughness: 0.95 });
    const coreMat = new THREE.MeshStandardMaterial({ color: coreColor, roughness: 0.85 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x6e5039, roughness: 0.9 });

    // Tapered trunk (slightly fatter at base) — reads as rooted stump
    const trunkGeo = new THREE.CylinderGeometry(radius, radius * 1.18, height, 14);
    const trunk = new THREE.Mesh(trunkGeo, [barkMat, coreMat, ringMat]);
    trunk.position.y = height / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Concentric growth rings on the cut top — subtle visual differentiator
    // from a "pickup" disc. Two thin discs, slightly inset and recessed.
    const ringMat2 = new THREE.MeshStandardMaterial({ color: 0x8a6845, roughness: 0.85 });
    for (let i = 0; i < 2; i++) {
        const rr = radius * (0.65 - i * 0.28);
        const ringGeo = new THREE.RingGeometry(rr - 0.02, rr, 16);
        const ring = new THREE.Mesh(ringGeo, ringMat2);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = height + 0.005;
        group.add(ring);
    }

    return group;
});

export default MeshPresets;
