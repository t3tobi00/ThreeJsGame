// GearworksMachineSandbox2 — industrial-cabinet visual experiment.
//
// Cabinet now reads as a working machine: dark steel body bolted to a
// wider iron mounting flange (with anchor hex bolts at the corners),
// a heavy iron bezel framing a tinted inspection window, a brushed-
// steel top plate with hex bolts at every corner, recessed cooling
// vents on the side walls, and rivet seams along the front edges —
// the silhouette of a piece of factory equipment, not furniture.
//
// The front face is dressed with three interlocking vertical brass
// gears (cylinder axis aligned with local +Z, so the gear face points
// out the camera-facing side). Sizes follow a clear rhythm —
// big > third > second — and adjacent gears spin in opposite
// directions at scaled mesh ratios.
//
// The essence-resource mesh + "0/N" counter still sit on the top
// plank, untouched by this update.
//
// `yawToCamera(root)` at the end matches the market stall's camera
// facing so the glass front + top plank point at the iso camera.
//
// Registered preset name: 'gearworks-machine-sandbox2'.

import * as THREE from 'three';
import MeshPresets from '../../core/MeshPresets.js';
import { yawToCamera } from '../../utils/Billboard3D.js';
import { buildInputDisplay } from './GearworksMachine.js';

MeshPresets.register('gearworks-machine-sandbox2', () => {
    const root = new THREE.Group();

    // ── Cabinet dimensions ──
    const cabW = 3;      // along local X — "front face" width
    const cabH = 2;      // along local Y — cabinet height
    const cabD = 1.5;    // along local Z — depth (front to back)
    const wallT = 0.05;  // wall thickness

    // ── Industrial palette ──
    const steelDarkMat = new THREE.MeshStandardMaterial({
        color: 0x363c44, roughness: 0.55, metalness: 0.7,
    });
    const steelMidMat = new THREE.MeshStandardMaterial({
        color: 0x5e6671, roughness: 0.45, metalness: 0.8,
    });
    const ironMat = new THREE.MeshStandardMaterial({
        color: 0x22262b, roughness: 0.55, metalness: 0.85,
    });
    const boltMat = new THREE.MeshStandardMaterial({
        color: 0x808691, roughness: 0.32, metalness: 0.95,
    });
    const ventMat = new THREE.MeshStandardMaterial({
        color: 0x0a0c10, roughness: 0.85, metalness: 0.1,
    });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xc8e0e8, roughness: 0.08, metalness: 0.0,
        transparent: true, opacity: 0.28, depthWrite: false,
        side: THREE.DoubleSide,
    });
    const gearBodyMat = new THREE.MeshStandardMaterial({
        color: 0xb88a36, roughness: 0.42, metalness: 0.85,
    });
    const gearTeethMat = new THREE.MeshStandardMaterial({
        color: 0x8a6020, roughness: 0.45, metalness: 0.9,
    });
    const gearHubMat = new THREE.MeshStandardMaterial({
        color: 0x3a2818, roughness: 0.55, metalness: 0.7,
    });
    const pipeMat = new THREE.MeshStandardMaterial({
        color: 0x8a5a26, roughness: 0.4, metalness: 0.7,
    });

    // ── Base mounting flange ──
    // A wider iron pad sits under the cabinet, anchored down with four
    // hex bolts. Sets the local origin for the cabinet body above it.
    const flangeW = cabW + 0.30;
    const flangeD = cabD + 0.30;
    const flangeH = 0.06;
    const flange = new THREE.Mesh(
        new THREE.BoxGeometry(flangeW, flangeH, flangeD), ironMat
    );
    flange.position.set(0, flangeH / 2, 0);
    flange.receiveShadow = true;
    root.add(flange);

    for (const bx of [-flangeW / 2 + 0.10, flangeW / 2 - 0.10]) {
        for (const bz of [-flangeD / 2 + 0.10, flangeD / 2 - 0.10]) {
            const stem = new THREE.Mesh(
                new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8), boltMat
            );
            stem.position.set(bx, flangeH + 0.025, bz);
            root.add(stem);
            const hex = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.06, 0.03, 6), boltMat
            );
            hex.position.set(bx, flangeH + 0.065, bz);
            root.add(hex);
        }
    }

    // Cabinet body sits on top of the flange — bodyY0 is the local
    // y at which the cabinet bottom rests.
    const bodyY0 = flangeH;

    // ── Cabinet body: bottom / back / left / right walls ──
    const bottom = new THREE.Mesh(
        new THREE.BoxGeometry(cabW, wallT, cabD), steelDarkMat
    );
    bottom.position.set(0, bodyY0 + wallT / 2, 0);
    bottom.receiveShadow = true;
    root.add(bottom);

    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(cabW, cabH, wallT), steelDarkMat
    );
    backWall.position.set(0, bodyY0 + cabH / 2, -cabD / 2 + wallT / 2);
    root.add(backWall);

    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallT, cabH, cabD), steelDarkMat
    );
    leftWall.position.set(-cabW / 2 + wallT / 2, bodyY0 + cabH / 2, 0);
    root.add(leftWall);

    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallT, cabH, cabD), steelDarkMat
    );
    rightWall.position.set(cabW / 2 - wallT / 2, bodyY0 + cabH / 2, 0);
    root.add(rightWall);

    // ── Side ventilation grilles — 5 recessed dark slots per side ──
    function addVentGrille(xSign) {
        const ventX = xSign * (cabW / 2 + 0.005);
        const slotCount = 5;
        const slotW = wallT + 0.02;
        const slotH = 0.07;
        const slotD = cabD * 0.5;
        const startY = bodyY0 + cabH * 0.30;
        const stepY = 0.13;
        for (let i = 0; i < slotCount; i++) {
            const slot = new THREE.Mesh(
                new THREE.BoxGeometry(slotW, slotH, slotD), ventMat
            );
            slot.position.set(ventX, startY + i * stepY, -cabD * 0.05);
            root.add(slot);
        }
    }
    addVentGrille(-1);
    addVentGrille(1);

    // ── Side panel rivets — 4 along each side wall, near front edge ──
    const sideRivetGeo = new THREE.SphereGeometry(0.035, 10, 8);
    for (const xSign of [-1, 1]) {
        const rx = xSign * (cabW / 2 - 0.005);
        for (let i = 0; i < 4; i++) {
            const ry = bodyY0 + 0.18 + i * (cabH - 0.36) / 3;
            const rivet = new THREE.Mesh(sideRivetGeo, boltMat);
            rivet.position.set(rx, ry, cabD / 2 - 0.06);
            root.add(rivet);
        }
    }

    // ── Tinted inspection window (translucent glass) ──
    const frontGlassZ = cabD / 2 - wallT * 0.2;
    const glass = new THREE.Mesh(
        new THREE.BoxGeometry(cabW - wallT * 2, cabH - wallT, wallT * 0.4),
        glassMat
    );
    glass.position.set(0, bodyY0 + (cabH + wallT) / 2, frontGlassZ);
    root.add(glass);

    // ── Heavy iron bezel framing the inspection window ──
    const bezelW = 0.10;        // bar width (in-plane)
    const bezelDepth = 0.07;    // protrusion forward of glass surface
    const bezelZ = frontGlassZ + bezelDepth / 2;
    const bezelTop = new THREE.Mesh(
        new THREE.BoxGeometry(cabW, bezelW, bezelDepth), ironMat
    );
    bezelTop.position.set(0, bodyY0 + cabH - bezelW / 2, bezelZ);
    root.add(bezelTop);
    const bezelBot = new THREE.Mesh(
        new THREE.BoxGeometry(cabW, bezelW, bezelDepth), ironMat
    );
    bezelBot.position.set(0, bodyY0 + bezelW / 2, bezelZ);
    root.add(bezelBot);
    const bezelLeft = new THREE.Mesh(
        new THREE.BoxGeometry(bezelW, cabH - bezelW * 2, bezelDepth), ironMat
    );
    bezelLeft.position.set(-cabW / 2 + bezelW / 2, bodyY0 + cabH / 2, bezelZ);
    root.add(bezelLeft);
    const bezelRight = new THREE.Mesh(
        new THREE.BoxGeometry(bezelW, cabH - bezelW * 2, bezelDepth), ironMat
    );
    bezelRight.position.set(cabW / 2 - bezelW / 2, bodyY0 + cabH / 2, bezelZ);
    root.add(bezelRight);

    // Bezel corner bolts — the rivet that visually pins the glass frame
    const bezelBoltGeo = new THREE.SphereGeometry(0.05, 12, 10);
    for (const bx of [-cabW / 2 + bezelW / 2, cabW / 2 - bezelW / 2]) {
        for (const by of [bodyY0 + bezelW / 2, bodyY0 + cabH - bezelW / 2]) {
            const bolt = new THREE.Mesh(bezelBoltGeo, boltMat);
            bolt.position.set(bx, by, bezelZ + bezelDepth / 2 + 0.005);
            root.add(bolt);
        }
    }

    // ── Brushed-steel top plate with hex bolts at the corners ──
    const topPlankW = cabW + 0.12;
    const topPlankH = 0.08;
    const topPlankD = cabD + 0.12;
    const topPlank = new THREE.Mesh(
        new THREE.BoxGeometry(topPlankW, topPlankH, topPlankD),
        steelMidMat
    );
    const topPlankBottomY = bodyY0 + cabH;
    topPlank.position.set(0, topPlankBottomY + topPlankH / 2, 0);
    topPlank.castShadow = true;
    topPlank.receiveShadow = true;
    root.add(topPlank);
    const topPlankTopY = topPlankBottomY + topPlankH;

    const topHexGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.04, 6);
    for (const tx of [-topPlankW / 2 + 0.12, topPlankW / 2 - 0.12]) {
        for (const tz of [-topPlankD / 2 + 0.12, topPlankD / 2 - 0.12]) {
            const hex = new THREE.Mesh(topHexGeo, boltMat);
            hex.position.set(tx, topPlankTopY + 0.018, tz);
            root.add(hex);
        }
    }

    // ── Mechanical front: vertical brass gears mounted on the bezel ──
    const gearMountZ = frontGlassZ + 0.15;

    // Build a gear whose face points along +Z (cabinet front).
    // userData.spinner is the inner group rotated by the animation;
    // wrapper.rotation.x = PI/2 turns the cylinder axis (local Y) into
    // world Z, then spinning around spinner local Y rotates the gear
    // face in its own plane.
    function makeVerticalGear(radius, toothCount) {
        const wrapper = new THREE.Group();
        const spinner = new THREE.Group();
        wrapper.add(spinner);

        const thickness = 0.10;
        const toothLen = radius * 0.32;
        const toothTangentW = (radius * 2 * Math.PI / toothCount) * 0.55;

        const disk = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, thickness, 32),
            gearBodyMat
        );
        spinner.add(disk);

        for (let i = 0; i < toothCount; i++) {
            const a = (i / toothCount) * Math.PI * 2;
            const tooth = new THREE.Mesh(
                new THREE.BoxGeometry(toothLen, thickness, toothTangentW),
                gearTeethMat
            );
            tooth.position.set(
                Math.cos(a) * (radius + toothLen * 0.42),
                0,
                -Math.sin(a) * (radius + toothLen * 0.42)
            );
            tooth.rotation.y = a;
            spinner.add(tooth);
        }

        // 4 raised spoke arms across the disk for visual depth
        for (let i = 0; i < 4; i++) {
            const arm = new THREE.Mesh(
                new THREE.BoxGeometry(radius * 1.45, thickness * 0.55, radius * 0.18),
                gearBodyMat
            );
            arm.position.y = thickness * 0.55;
            arm.rotation.y = (i / 4) * Math.PI * 2;
            spinner.add(arm);
        }

        const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 0.32, radius * 0.32, thickness * 1.4, 18),
            gearHubMat
        );
        spinner.add(hub);

        const centerBolt = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 0.09, radius * 0.09, thickness * 1.7, 10),
            boltMat
        );
        spinner.add(centerBolt);

        wrapper.rotation.x = Math.PI / 2;
        wrapper.userData.spinner = spinner;
        return wrapper;
    }

    // ── Three vertical gears across the front face ──
    // big > third > second, in chain order big → second → third.
    const bigR = 0.46;
    const secondR = 0.28;
    const thirdR = 0.34;

    // Center distance for two meshing gears: outer radii (≈ R*1.29 incl.
    // teeth) summed, minus a small overlap so teeth visibly interlock.
    const meshDist = (r1, r2) => r1 * 1.29 + r2 * 1.29 - 0.05;

    const bigCx = -0.55;
    const bigCy = bodyY0 + 1.30;
    const bigGear = makeVerticalGear(bigR, 12);
    bigGear.position.set(bigCx, bigCy, gearMountZ);
    root.add(bigGear);

    const meshD1 = meshDist(bigR, secondR);
    const meshAng1 = -Math.PI * 0.30;
    const secondCx = bigCx + Math.cos(meshAng1) * meshD1;
    const secondCy = bigCy + Math.sin(meshAng1) * meshD1;
    const secondGear = makeVerticalGear(secondR, 10);
    secondGear.position.set(secondCx, secondCy, gearMountZ);
    root.add(secondGear);

    const meshD2 = meshDist(secondR, thirdR);
    const meshAng2 = Math.PI * 0.15;
    const thirdCx = secondCx + Math.cos(meshAng2) * meshD2;
    const thirdCy = secondCy + Math.sin(meshAng2) * meshD2;
    const thirdGear = makeVerticalGear(thirdR, 11);
    thirdGear.position.set(thirdCx, thirdCy, gearMountZ);
    root.add(thirdGear);

    // Adjacent gears spin opposite at scaled mesh ratios
    const baseSpeed = 0.9;
    const bigSpeed = baseSpeed;
    const secondSpeed = -baseSpeed * (bigR / secondR);
    const thirdSpeed = -secondSpeed * (secondR / thirdR);

    const gearAnimState = { lastMs: performance.now() };
    bigGear.userData.spinner.children[0].onBeforeRender = () => {
        const now = performance.now();
        const dt = Math.min(0.1, (now - gearAnimState.lastMs) * 0.001);
        gearAnimState.lastMs = now;
        bigGear.userData.spinner.rotation.y += dt * bigSpeed;
        secondGear.userData.spinner.rotation.y += dt * secondSpeed;
        thirdGear.userData.spinner.rotation.y += dt * thirdSpeed;
    };

    // ── External side pipes — copper conduits running up each side ──
    function addSidePipe(xSign) {
        const pipeR = 0.06;
        const pipeLen = cabH * 0.85;
        const pipeX = xSign * (cabW / 2 + 0.06);   // outboard of cabinet
        const pipeY = bodyY0 + cabH * 0.5;
        const pipeZ = cabD / 2 - 0.20;             // toward front of side

        const pipe = new THREE.Mesh(
            new THREE.CylinderGeometry(pipeR, pipeR, pipeLen, 14), pipeMat
        );
        pipe.position.set(pipeX, pipeY, pipeZ);
        root.add(pipe);

        // Iron clamp brackets attaching pipe to the side wall
        for (const yOff of [-pipeLen * 0.4, 0, pipeLen * 0.4]) {
            const bracket = new THREE.Mesh(
                new THREE.BoxGeometry(0.16, 0.05, 0.10), ironMat
            );
            bracket.position.set(xSign * (cabW / 2 + 0.01), pipeY + yOff, pipeZ);
            root.add(bracket);
        }

        const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(pipeR * 1.5, pipeR * 1.5, 0.06, 14), ironMat
        );
        cap.position.set(pipeX, pipeY + pipeLen / 2 + 0.03, pipeZ);
        root.add(cap);

        const elbow = new THREE.Mesh(
            new THREE.SphereGeometry(pipeR * 1.6, 12, 10), pipeMat
        );
        elbow.position.set(pipeX, pipeY - pipeLen / 2 - 0.02, pipeZ);
        root.add(elbow);
    }
    addSidePipe(-1);
    addSidePipe(1);

    // ── Essence tube + "0/10" counter on the top plank ──
    const displayScale = Math.min(
        2.4, topPlankW * 0.7, (topPlankD - 0.4) * 0.9
    );
    buildInputDisplay(root, {
        type: 'essence',
        required: 10,
        scale: displayScale,
        resX: 0, resY: topPlankTopY + 0.22, resZ: 0,
        counterX: 0, counterY: topPlankTopY + 0.85,
        counterZ: -topPlankD / 2 - 0.15,
    });

    // Camera facing — matches the market stall convention.
    yawToCamera(root);

    return root;
});
