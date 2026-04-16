// GearworksMachine — extracted from MeshPresetsDiorama.js
// Registers the 'gearworks-machine' preset into MeshPresets.

import * as THREE from 'three';
import MeshPresets from '../../core/MeshPresets.js';
import ResourceRegistry from '../../core/ResourceRegistry.js';
import { yawToCamera } from '../../utils/FaceCamera.js';

// ── Internal builder helpers ──

function buildFrame(root, L, mats) {
    const { railMat, postMat, woodMat, plankLineMat, boltMat } = mats;
    const s = L.s;
    const WOOD_TOP = L.woodH;

    // Outer rail frame
    const frontRail = new THREE.Mesh(
        new THREE.BoxGeometry(L.frameW, L.railH, L.railT), railMat
    );
    frontRail.position.set(0, L.railH / 2 + 0.05 * s, L.frameD / 2);
    root.add(frontRail);

    const backRail = frontRail.clone();
    backRail.position.set(0, L.railH / 2 + 0.05 * s, -L.frameD / 2);
    root.add(backRail);

    const leftRail = new THREE.Mesh(
        new THREE.BoxGeometry(L.railT, L.railH, L.frameD + L.railT), railMat
    );
    leftRail.position.set(-L.frameW / 2, L.railH / 2 + 0.05 * s, 0);
    root.add(leftRail);

    const rightRail = leftRail.clone();
    rightRail.position.set(L.frameW / 2, L.railH / 2 + 0.05 * s, 0);
    root.add(rightRail);

    // Corner posts
    for (const [cx, cz] of [
        [-L.frameW / 2, -L.frameD / 2],
        [L.frameW / 2, -L.frameD / 2],
        [-L.frameW / 2, L.frameD / 2],
        [L.frameW / 2, L.frameD / 2]
    ]) {
        const post = new THREE.Mesh(
            new THREE.BoxGeometry(L.postSize, L.postH, L.postSize), postMat
        );
        post.position.set(cx, L.postH / 2 + 0.02 * s, cz);
        root.add(post);
    }

    // Wooden workbench slab
    const woodW = L.frameW - L.railT * 2 - 0.02 * s;
    const woodD = L.frameD - L.railT * 2 - 0.02 * s;
    const wood = new THREE.Mesh(
        new THREE.BoxGeometry(woodW, L.woodH, woodD), woodMat
    );
    wood.position.set(0, L.woodH / 2, 0);
    wood.receiveShadow = true;
    root.add(wood);

    // Plank grooves
    const plankDividers = 4;
    for (let i = 0; i < plankDividers; i++) {
        const groove = new THREE.Mesh(
            new THREE.BoxGeometry(0.025 * s, 0.03 * s, woodD + 0.02 * s), plankLineMat
        );
        const gx = -woodW / 2 + (woodW * (i + 1)) / (plankDividers + 1);
        groove.position.set(gx, WOOD_TOP - 0.01 * s, 0);
        root.add(groove);
    }

    // Edge bolts
    const edgeBoltGeo = new THREE.SphereGeometry(0.055 * s, 10, 8);
    for (const zSide of [-woodD / 2 + 0.08 * s, woodD / 2 - 0.08 * s]) {
        for (const xBolt of [-woodW / 2 + 0.18 * s, 0, woodW / 2 - 0.18 * s]) {
            const bolt = new THREE.Mesh(edgeBoltGeo, boltMat);
            bolt.position.set(xBolt, WOOD_TOP + 0.01 * s, zSide);
            root.add(bolt);
        }
    }
}


// Exported so external code can reuse the gear geometry + material setup.
export function buildGears(root, L, mats, positions) {
    const { axleMat } = mats;
    const s = L.s || 1;
    const gs = L.gearScale || 1;
    const WOOD_TOP = L.woodH;
    const GEAR_Y = WOOD_TOP + L.gearOffset;

    const gearGlassMat = new THREE.MeshStandardMaterial({
        color: 0xbfe6ff, emissive: 0x3399ff, emissiveIntensity: 0.55,
        roughness: 0.12, metalness: 0.0,
        transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide
    });
    const gearHubGlassMat = new THREE.MeshStandardMaterial({
        color: 0xddf3ff, emissive: 0x66bbff, emissiveIntensity: 0.9,
        roughness: 0.08, metalness: 0.0,
        transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide
    });

    function makeGear(radius, toothCount) {
        const g = new THREE.Group();
        const thickness = radius * 0.327;
        const toothLen = radius * 0.34;
        const toothTangentW = (radius * 2 * Math.PI / toothCount) * 0.55;

        const disk = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, thickness, 32), gearGlassMat
        );
        g.add(disk);

        for (let i = 0; i < toothCount; i++) {
            const a = (i / toothCount) * Math.PI * 2;
            const tooth = new THREE.Mesh(
                new THREE.BoxGeometry(toothLen, thickness, toothTangentW), gearGlassMat
            );
            tooth.position.set(
                Math.cos(a) * (radius + toothLen * 0.45),
                0,
                -Math.sin(a) * (radius + toothLen * 0.45)
            );
            tooth.rotation.y = a;
            g.add(tooth);
        }

        const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, thickness * 1.25, 16),
            gearHubGlassMat
        );
        g.add(hub);
        return g;
    }

    // Axle posts
    const axleR = 0.055 * s * gs;
    const axleH = GEAR_Y - WOOD_TOP + 0.05 * s;
    function makeAxle(ax) {
        const m = new THREE.Mesh(
            new THREE.CylinderGeometry(axleR, axleR, axleH, 14), axleMat
        );
        m.position.set(ax, WOOD_TOP + axleH / 2, 0);
        return m;
    }
    root.add(makeAxle(positions.bigGearX));
    root.add(makeAxle(positions.smallGearX));

    const bigGear = makeGear(L.bigGearR, 10);
    bigGear.position.set(positions.bigGearX, GEAR_Y, 0);
    root.add(bigGear);

    const smallGear = makeGear(L.smallGearR, 8);
    smallGear.position.set(positions.smallGearX, GEAR_Y, 0);
    root.add(smallGear);

    return { bigGear, smallGear };
}

function buildInputSlots(root, L, cost, positions) {
    const WOOD_TOP = L.woodH;
    const s = L.s;
    const ps = L.padScale;
    const { inputCenterX, inputW } = positions;

    const inputs = Object.entries(cost);
    const inputCount = inputs.length;

    // Each input gets an equal slice of the full input section width
    const cellW = inputW / inputCount;
    const cellStartX = inputCenterX - inputW / 2 + cellW / 2;

    // Thin divider lines between inputs (when multiple)
    if (inputCount > 1) {
        const dividerMat = new THREE.MeshStandardMaterial({
            color: 0x5a6068, roughness: 0.5, metalness: 0.4
        });
        const dividerD = L.frameD - L.railT * 2 - 0.3 * s;
        for (let i = 1; i < inputCount; i++) {
            const dx = inputCenterX - inputW / 2 + cellW * i;
            const divider = new THREE.Mesh(
                new THREE.BoxGeometry(0.04 * s, 0.25 * s, dividerD), dividerMat
            );
            divider.position.set(dx, WOOD_TOP + 0.125 * s, 0);
            root.add(divider);
        }
    }

    // (Section divider between input and process removed — cleaner look)

    // ── "Stand here" drop-off pad — flush with input section front edge ──
    const padW = inputW * ps;
    const padDepth = padW * 0.55;
    const padY = 0.03 * s;
    const padFrontZ = L.frameD / 2;
    const padCenterZ = padFrontZ + padDepth / 2;

    // Semi-transparent glowing ground pad
    const padMat = new THREE.MeshStandardMaterial({
        color: 0x225544, emissive: 0x33ff88, emissiveIntensity: 0.4,
        roughness: 0.6, metalness: 0.0,
        transparent: true, opacity: 0.3, depthWrite: false,
    });
    const pad = new THREE.Mesh(
        new THREE.BoxGeometry(padW, 0.04 * s, padDepth), padMat
    );
    pad.position.set(inputCenterX, padY, padCenterZ);
    root.add(pad);

    // Dashed border — small box segments around the perimeter
    const dashMat = new THREE.MeshStandardMaterial({
        color: 0x66ffaa, emissive: 0x44ff88, emissiveIntensity: 0.6,
        roughness: 0.3, metalness: 0.0,
        transparent: true, opacity: 0.5,
    });
    const dashLen = 0.35 * s, dashH = 0.06 * s, dashT = 0.05 * s, dashGap = 0.3 * s;
    const dashGeo = new THREE.BoxGeometry(dashLen, dashH, dashT);
    const dashGeoSide = new THREE.BoxGeometry(dashT, dashH, dashLen);

    // Top & bottom edges (along X)
    for (const zEdge of [padCenterZ - padDepth / 2, padCenterZ + padDepth / 2]) {
        for (let x = inputCenterX - padW / 2 + dashLen / 2; x <= inputCenterX + padW / 2 - dashLen / 2; x += dashLen + dashGap) {
            const d = new THREE.Mesh(dashGeo, dashMat);
            d.position.set(x, padY + dashH / 2, zEdge);
            root.add(d);
        }
    }
    // Left & right edges (along Z)
    for (const xEdge of [inputCenterX - padW / 2, inputCenterX + padW / 2]) {
        for (let z = padCenterZ - padDepth / 2 + dashLen / 2; z <= padCenterZ + padDepth / 2 - dashLen / 2; z += dashLen + dashGap) {
            const d = new THREE.Mesh(dashGeoSide, dashMat);
            d.position.set(xEdge, padY + dashH / 2, z);
            root.add(d);
        }
    }

    // Chevron arrows pointing toward machine (toward -Z)
    const arrowMat = new THREE.MeshStandardMaterial({
        color: 0x88ffcc, emissive: 0x44ff88, emissiveIntensity: 0.5,
        roughness: 0.3, metalness: 0.0,
        transparent: true, opacity: 0.55,
    });
    const arrowCount = Math.max(1, Math.floor(padW / 1.8));
    const arrowSpacing = padW / (arrowCount + 1);
    for (let i = 0; i < arrowCount; i++) {
        const ax = inputCenterX - padW / 2 + arrowSpacing * (i + 1);
        // Two rows of chevrons for depth
        for (const zOff of [padDepth * 0.25, padDepth * 0.6]) {
            const az = padFrontZ + zOff;
            const chevron = new THREE.Group();
            // Left arm of chevron
            const armGeo = new THREE.BoxGeometry(0.6 * s, 0.05 * s, 0.08 * s);
            const leftArm = new THREE.Mesh(armGeo, arrowMat);
            leftArm.rotation.y = Math.PI * 0.22;
            leftArm.position.set(-0.2 * s, 0, 0);
            chevron.add(leftArm);
            // Right arm
            const rightArm = new THREE.Mesh(armGeo, arrowMat);
            rightArm.rotation.y = -Math.PI * 0.22;
            rightArm.position.set(0.2 * s, 0, 0);
            chevron.add(rightArm);
            chevron.position.set(ax, padY + 0.04 * s, az);
            // Point toward -Z (into machine)
            chevron.rotation.y = Math.PI;
            root.add(chevron);
        }
    }

    // Gentle breathing animation — very slow, subtle
    const breatheStartMs = performance.now();
    pad.onBeforeRender = () => {
        const t = (performance.now() - breatheStartMs) * 0.001;
        const wave = Math.sin(t * 0.5);
        padMat.opacity = 0.22 + 0.06 * wave;
        padMat.emissiveIntensity = 0.3 + 0.1 * wave;
        dashMat.opacity = 0.38 + 0.08 * wave;
        arrowMat.opacity = 0.42 + 0.08 * wave;
    };

    root.userData.inputCounters = [];

    inputs.forEach(([type, count], i) => {
        const sx = cellStartX + i * cellW;
        const resScale = Math.min(2.4 * s, cellW * 0.7, (L.frameD - 0.4 * s) * 0.9) * L.inputScale;
        const halfD = (L.frameD - L.railT * 2) / 2;

        const display = buildInputDisplay(root, {
            type, required: count, scale: resScale,
            s, counterScale: L.counterScale, resourceRotY: L.resourceRotY,
            resX: sx, resY: WOOD_TOP + 0.25 * s, resZ: 0,
            counterX: sx, counterY: WOOD_TOP + 0.9 * s, counterZ: -halfD - 0.15 * s,
        });

        root.userData.inputCounters.push({
            type,
            required: count,
            current: 0,
            localPos: { x: sx, y: WOOD_TOP + 0.3 * s, z: 0 },
            texture: display.texture,
            update(newCurrent) {
                this.current = newCurrent;
                display.update(newCurrent);
            }
        });
    });
}

// Exported so external code can attach the same resource mesh +
// "0/N" counter billboard pattern.
export function buildInputDisplay(root, {
    type, required, scale, s = 1, counterScale = 1, resourceRotY = 0,
    resX = 0, resY = 0.25, resZ = 0,
    counterX = 0, counterY = 0.9, counterZ = -1.05,
}) {
    const resMesh = ResourceRegistry.createMesh(type, 'stacked');
    const resGroup = new THREE.Group();
    resGroup.add(resMesh);
    resGroup.position.set(resX, resY, resZ);
    resGroup.scale.setScalar(scale);
    if (resourceRotY) resGroup.rotation.y = resourceRotY;
    root.add(resGroup);

    const cCanvas = document.createElement('canvas');
    cCanvas.width = 512; cCanvas.height = 512;
    const cCtx = cCanvas.getContext('2d');

    function drawCounter(current) {
        cCtx.clearRect(0, 0, 512, 512);
        cCtx.save();
        cCtx.translate(256, 260);
        cCtx.scale(1, 2.5);
        cCtx.font = 'bold 160px system-ui, -apple-system, sans-serif';
        cCtx.textAlign = 'center';
        cCtx.textBaseline = 'middle';
        cCtx.shadowColor = '#22ff66';
        cCtx.shadowBlur = 36;
        cCtx.fillStyle = '#44ff88';
        cCtx.fillText(current + '/' + required, 0, 0);
        cCtx.shadowBlur = 8;
        cCtx.fillStyle = '#55ffaa';
        cCtx.fillText(current + '/' + required, 0, 0);
        cCtx.restore();
    }
    drawCounter(0);

    const cTex = new THREE.CanvasTexture(cCanvas);
    cTex.anisotropy = 4;
    const counterPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2 * s * counterScale, 1.8 * s * counterScale),
        new THREE.MeshBasicMaterial({ map: cTex, transparent: true, side: THREE.DoubleSide })
    );
    counterPlane.position.set(counterX, counterY, counterZ);
    counterPlane.rotation.x = 0;
    root.add(counterPlane);

    return {
        resourceGroup: resGroup,
        counterPlane,
        texture: cTex,
        update(newCurrent) {
            drawCounter(newCurrent);
            cTex.needsUpdate = true;
        },
    };
}

function buildOutput(root, L, positions, outputType) {
    const WOOD_TOP = L.woodH;
    const s = L.s;

    // Display preview mesh — hidden once first output is produced
    const outMesh = ResourceRegistry.createMesh(outputType, 'stacked');
    const outGroup = new THREE.Group();
    outGroup.add(outMesh);
    outGroup.position.set(positions.outputCenterX, WOOD_TOP + 0.1 * s, 0);
    outGroup.scale.setScalar(L.coinScale);
    if (L.resourceRotY) outGroup.rotation.y = L.resourceRotY;
    root.add(outGroup);

    root.userData.outputDisplayGroup = outGroup;
}

// Exported spin-only animation so sandbox/variant presets can attach
// the exact same rotation rhythm (1.6 / -2.4 rad/s) without pulling
// in the LED/breath logic. Optional speedMultiplier scales both rates.
export function attachGearSpinAnimation({ bigGear, smallGear }, speedMultiplier = 1) {
    const animTarget = bigGear.children[0];
    const animState = { lastMs: performance.now() };
    animTarget.onBeforeRender = () => {
        const now = performance.now();
        const dt = Math.min(0.1, (now - animState.lastMs) * 0.001);
        animState.lastMs = now;
        bigGear.rotation.y += dt * 1.6 * speedMultiplier;
        smallGear.rotation.y -= dt * 2.4 * speedMultiplier;
    };
}

function buildAnimation(root, L, mats, refs) {
    const { inputStatusMat, outputStatusMat } = mats;
    const s = L.s;

    // Status LEDs on front corner posts
    const statusGeo = new THREE.SphereGeometry(0.07 * s, 12, 10);
    const inputStatus = new THREE.Mesh(statusGeo, inputStatusMat);
    inputStatus.position.set(-L.frameW / 2, L.postH + 0.06 * s, L.frameD / 2);
    root.add(inputStatus);
    const outputStatus = new THREE.Mesh(statusGeo, outputStatusMat);
    outputStatus.position.set(L.frameW / 2, L.postH + 0.06 * s, L.frameD / 2);
    root.add(outputStatus);

    // Gears spin (single-source rhythm shared with variant presets).
    attachGearSpinAnimation(refs, L.gearSpinSpeed);

    // LEDs breathe out of phase with each other.
    const startMs = performance.now();
    inputStatus.onBeforeRender = () => {
        const t = (performance.now() - startMs) * 0.001;
        const breathe = 0.5 + 0.5 * Math.sin(t * 1.6);
        inputStatusMat.emissiveIntensity = 0.6 + breathe * 1.2;
        outputStatusMat.emissiveIntensity = 0.6 + (1 - breathe) * 1.2;
    };
}

// ── Register preset ──
//
// JSON-configurable overrides (all multipliers default to 1.0):
//   sectionRatio  — [input%, process%, output%] width split (must sum to 1)
//   gearScale     — gear radii + axle size
//   gearSpinSpeed — rotation rate multiplier
//   inputScale    — input resource mesh size
//   outputScale   — output resource mesh size
//   counterScale  — "0/N" counter plane size
//   postScale     — corner post height + thickness
//   padScale      — drop-off pad dimensions
//   resourceRotY  — Y-axis rotation (radians) for input + output resource meshes
//                    0 = default flat, 1.5708 = 90° perpendicular, 3.1416 = 180°, etc.

MeshPresets.register('gearworks-machine', ({
    cost = { essence: 10, coin: 5 }, output = 'coin', outputCount = 1,
    frameWidth = 14, frameDepth = 3.6,
    sectionRatio = [0.3, 0.4, 0.3],
    gearScale = 1, gearSpinSpeed = 1,
    inputScale = 1, outputScale = 1, counterScale = 1,
    postScale = 1, padScale = 1,
    resourceRotY = 0,
} = {}) => {
    const root = new THREE.Group();

    // Scale factor: reference frame is 14 × 3.6 — at that size s=1
    // and all internal dimensions match the original hardcoded values.
    const REF_W = 14, REF_D = 3.6;
    const s = Math.min(frameWidth / REF_W, frameDepth / REF_D);

    const L = {
        frameW: frameWidth,
        frameD: frameDepth,
        s,
        gearScale,
        gearSpinSpeed,
        inputScale,
        counterScale,
        padScale,
        resourceRotY,
        railH: 0.15 * s,
        railT: 0.12 * s,
        woodH: 0.2 * s,
        postSize: 0.18 * s * postScale,
        postH: 0.5 * s * postScale,
        gearOffset: 0.8 * s,
        bigGearR: 0.55 * s * gearScale,
        smallGearR: 0.38 * s * gearScale,
        gearGap: 1.1 * s * gearScale,
        coinScale: 2.4 * s * outputScale,
    };

    // Section X layout
    const usableW = L.frameW - L.railT * 2;
    const inputW = usableW * sectionRatio[0];
    const processW = usableW * sectionRatio[1];
    const outputW = usableW * sectionRatio[2];
    const inputCenterX = -usableW / 2 + inputW / 2;
    const processCenterX = -usableW / 2 + inputW + processW / 2;
    const outputCenterX = usableW / 2 - outputW / 2;

    // ── Gear position clamping: keep gears inside process section ──
    const processLeftX = -usableW / 2 + inputW;
    const processRightX = processLeftX + processW;
    const sectionPad = 0.1 * s;
    // Tooth reach ≈ 1.4× disk radius
    const bigReach = L.bigGearR * 1.4;
    const smallReach = L.smallGearR * 1.4;

    let bigGearX = processCenterX - L.gearGap * 0.45;
    let smallGearX = processCenterX + L.gearGap * 0.55;

    // Clamp each gear within its section edge + padding
    bigGearX = Math.max(bigGearX, processLeftX + bigReach + sectionPad);
    smallGearX = Math.min(smallGearX, processRightX - smallReach - sectionPad);

    // If clamping pushed them past each other, stack at center
    if (bigGearX > smallGearX) {
        const mid = (processLeftX + processRightX) / 2;
        bigGearX = mid;
        smallGearX = mid;
    }

    const positions = { inputCenterX, processCenterX, outputCenterX, bigGearX, smallGearX, inputW };

    // Materials shared across builders
    const mats = {
        railMat: new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.55, metalness: 0.35 }),
        postMat: new THREE.MeshStandardMaterial({ color: 0x2a2f34, roughness: 0.75, metalness: 0.25 }),
        woodMat: new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.92, metalness: 0.0 }),
        plankLineMat: new THREE.MeshStandardMaterial({ color: 0x3e2a15, roughness: 0.95, metalness: 0.0 }),
        axleMat: new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.4, metalness: 0.85 }),
        boltMat: new THREE.MeshStandardMaterial({ color: 0x6a6f76, roughness: 0.35, metalness: 0.9 }),
        inputStatusMat: new THREE.MeshStandardMaterial({
            color: 0xddffdd, emissive: 0x44ff88, emissiveIntensity: 1.4,
            roughness: 0.2, metalness: 0.0
        }),
        outputStatusMat: new THREE.MeshStandardMaterial({
            color: 0xfff0dd, emissive: 0xffc044, emissiveIntensity: 1.4,
            roughness: 0.2, metalness: 0.0
        }),
    };

    buildFrame(root, L, mats);
    const gearRefs = buildGears(root, L, mats, positions);
    buildInputSlots(root, L, cost, positions);
    buildOutput(root, L, positions, output);
    buildAnimation(root, L, mats, gearRefs);

    // Expose pad center in local coords for ECS zone positioning
    const padW = positions.inputW * L.padScale;
    const padDepth = padW * 0.55;
    root.userData.padLocalCenter = {
        x: positions.inputCenterX,
        z: L.frameD / 2 + padDepth / 2
    };

    // Expose output center in local coords for placing produced resources
    root.userData.outputLocalCenter = {
        x: positions.outputCenterX,
        y: L.woodH + 0.3 * s,
        z: 0
    };

    // Face the whole machine toward the isometric camera (Y-axis only).
    // Remove this single line to revert to JSON rotY behavior.
    yawToCamera(root);

    return root;
});
