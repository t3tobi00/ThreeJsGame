// GearworksMachine — extracted from MeshPresetsDiorama.js
// Registers the 'gearworks-machine' preset into MeshPresets.

import * as THREE from 'three';
import MeshPresets from '../../core/MeshPresets.js';
import ResourceRegistry from '../../core/ResourceRegistry.js';

// ── Internal builder helpers ──

function buildFrame(root, L, mats) {
    const { railMat, postMat, woodMat, plankLineMat, boltMat } = mats;
    const WOOD_TOP = L.woodH;

    // Outer rail frame
    const frontRail = new THREE.Mesh(
        new THREE.BoxGeometry(L.frameW, L.railH, L.railT), railMat
    );
    frontRail.position.set(0, L.railH / 2 + 0.05, L.frameD / 2);
    root.add(frontRail);

    const backRail = frontRail.clone();
    backRail.position.set(0, L.railH / 2 + 0.05, -L.frameD / 2);
    root.add(backRail);

    const leftRail = new THREE.Mesh(
        new THREE.BoxGeometry(L.railT, L.railH, L.frameD + L.railT), railMat
    );
    leftRail.position.set(-L.frameW / 2, L.railH / 2 + 0.05, 0);
    root.add(leftRail);

    const rightRail = leftRail.clone();
    rightRail.position.set(L.frameW / 2, L.railH / 2 + 0.05, 0);
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
        post.position.set(cx, L.postH / 2 + 0.02, cz);
        root.add(post);
    }

    // Wooden workbench slab
    const woodW = L.frameW - L.railT * 2 - 0.02;
    const woodD = L.frameD - L.railT * 2 - 0.02;
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
            new THREE.BoxGeometry(0.025, 0.03, woodD + 0.02), plankLineMat
        );
        const gx = -woodW / 2 + (woodW * (i + 1)) / (plankDividers + 1);
        groove.position.set(gx, WOOD_TOP - 0.01, 0);
        root.add(groove);
    }

    // Edge bolts
    const edgeBoltGeo = new THREE.SphereGeometry(0.055, 10, 8);
    for (const zSide of [-woodD / 2 + 0.08, woodD / 2 - 0.08]) {
        for (const xBolt of [-woodW / 2 + 0.18, 0, woodW / 2 - 0.18]) {
            const bolt = new THREE.Mesh(edgeBoltGeo, boltMat);
            bolt.position.set(xBolt, WOOD_TOP + 0.01, zSide);
            root.add(bolt);
        }
    }
}

function buildGears(root, L, mats, positions) {
    const { axleMat } = mats;
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
        const thickness = 0.18;
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
    const axleR = 0.055;
    const axleH = GEAR_Y - WOOD_TOP + 0.05;
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
        const dividerD = L.frameD - L.railT * 2 - 0.3;
        for (let i = 1; i < inputCount; i++) {
            const dx = inputCenterX - inputW / 2 + cellW * i;
            const divider = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, 0.25, dividerD), dividerMat
            );
            divider.position.set(dx, WOOD_TOP + 0.125, 0);
            root.add(divider);
        }
    }

    // Section divider between inputs and gear section
    const sectionDivMat = new THREE.MeshStandardMaterial({
        color: 0x5a6068, roughness: 0.5, metalness: 0.4
    });
    const sectionDivD = L.frameD - L.railT * 2 - 0.3;
    const sectionDiv = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.25, sectionDivD), sectionDivMat
    );
    sectionDiv.position.set(inputCenterX + inputW / 2, WOOD_TOP + 0.125, 0);
    root.add(sectionDiv);

    // ── "Stand here" drop-off pad — flush with input section front edge ──
    const padDepth = inputW * 0.55;
    const padY = 0.03;                 // just above ground
    const padFrontZ = L.frameD / 2;    // machine front edge
    const padCenterZ = padFrontZ + padDepth / 2;

    // Semi-transparent glowing ground pad
    const padMat = new THREE.MeshStandardMaterial({
        color: 0x225544, emissive: 0x33ff88, emissiveIntensity: 0.4,
        roughness: 0.6, metalness: 0.0,
        transparent: true, opacity: 0.3, depthWrite: false,
    });
    const pad = new THREE.Mesh(
        new THREE.BoxGeometry(inputW, 0.04, padDepth), padMat
    );
    pad.position.set(inputCenterX, padY, padCenterZ);
    root.add(pad);

    // Dashed border — small box segments around the perimeter
    const dashMat = new THREE.MeshStandardMaterial({
        color: 0x66ffaa, emissive: 0x44ff88, emissiveIntensity: 0.6,
        roughness: 0.3, metalness: 0.0,
        transparent: true, opacity: 0.5,
    });
    const dashLen = 0.35, dashH = 0.06, dashT = 0.05, dashGap = 0.3;
    const dashGeo = new THREE.BoxGeometry(dashLen, dashH, dashT);
    const dashGeoSide = new THREE.BoxGeometry(dashT, dashH, dashLen);

    // Top & bottom edges (along X)
    for (const zEdge of [padCenterZ - padDepth / 2, padCenterZ + padDepth / 2]) {
        for (let x = inputCenterX - inputW / 2 + dashLen / 2; x <= inputCenterX + inputW / 2 - dashLen / 2; x += dashLen + dashGap) {
            const d = new THREE.Mesh(dashGeo, dashMat);
            d.position.set(x, padY + dashH / 2, zEdge);
            root.add(d);
        }
    }
    // Left & right edges (along Z)
    for (const xEdge of [inputCenterX - inputW / 2, inputCenterX + inputW / 2]) {
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
    const arrowCount = Math.max(1, Math.floor(inputW / 1.8));
    const arrowSpacing = inputW / (arrowCount + 1);
    for (let i = 0; i < arrowCount; i++) {
        const ax = inputCenterX - inputW / 2 + arrowSpacing * (i + 1);
        // Two rows of chevrons for depth
        for (const zOff of [padDepth * 0.25, padDepth * 0.6]) {
            const az = padFrontZ + zOff;
            const chevron = new THREE.Group();
            // Left arm of chevron
            const armGeo = new THREE.BoxGeometry(0.6, 0.05, 0.08);
            const leftArm = new THREE.Mesh(armGeo, arrowMat);
            leftArm.rotation.y = Math.PI * 0.22;
            leftArm.position.set(-0.2, 0, 0);
            chevron.add(leftArm);
            // Right arm
            const rightArm = new THREE.Mesh(armGeo, arrowMat);
            rightArm.rotation.y = -Math.PI * 0.22;
            rightArm.position.set(0.2, 0, 0);
            chevron.add(rightArm);
            chevron.position.set(ax, padY + 0.04, az);
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

        // Resource mesh — sized to fill the cell
        const resMesh = ResourceRegistry.createMesh(type, 'stacked');
        const resGroup = new THREE.Group();
        resGroup.add(resMesh);
        resGroup.position.set(sx, WOOD_TOP + 0.25, 0);
        const resScale = Math.min(2.4, cellW * 0.7, (L.frameD - 0.4) * 0.9);
        resGroup.scale.setScalar(resScale);
        root.add(resGroup);

        // "0/N" counter billboard
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
            cCtx.fillText(current + '/' + count, 0, 0);
            cCtx.shadowBlur = 8;
            cCtx.fillStyle = '#55ffaa';
            cCtx.fillText(current + '/' + count, 0, 0);
            cCtx.restore();
        }
        drawCounter(0);

        const cTex = new THREE.CanvasTexture(cCanvas);
        cTex.anisotropy = 4;
        const counterPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(2.2, 1.8),
            new THREE.MeshBasicMaterial({ map: cTex, transparent: true, side: THREE.DoubleSide })
        );
        const halfD = (L.frameD - L.railT * 2) / 2;
        counterPlane.position.set(sx, WOOD_TOP + 0.9, -halfD - 0.15);
        counterPlane.rotation.x = 0;
        root.add(counterPlane);

        root.userData.inputCounters.push({
            type,
            required: count,
            current: 0,
            localPos: { x: sx, y: WOOD_TOP + 0.3, z: 0 },
            texture: cTex,
            update(newCurrent) {
                this.current = newCurrent;
                drawCounter(newCurrent);
                this.texture.needsUpdate = true;
            }
        });
    });
}

function buildOutput(root, L, positions, outputType) {
    const WOOD_TOP = L.woodH;

    const slotMat = new THREE.MeshStandardMaterial({
        color: 0xffe088, emissive: 0xffaa22, emissiveIntensity: 1.0,
        roughness: 0.28, metalness: 0.3
    });
    const slot = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.032, 10, 36), slotMat
    );
    slot.position.set(positions.outputCenterX, WOOD_TOP + 0.012, 0);
    slot.rotation.x = Math.PI / 2;
    root.add(slot);

    // Display preview mesh — hidden once first output is produced
    const outMesh = ResourceRegistry.createMesh(outputType, 'stacked');
    const outGroup = new THREE.Group();
    outGroup.add(outMesh);
    outGroup.position.set(positions.outputCenterX, WOOD_TOP + 0.1, 0);
    outGroup.scale.setScalar(L.coinScale);
    root.add(outGroup);

    root.userData.outputDisplayGroup = outGroup;
}

function buildAnimation(root, L, mats, refs) {
    const { bigGear, smallGear } = refs;
    const { inputStatusMat, outputStatusMat } = mats;
    const WOOD_TOP = L.woodH;

    // Status LEDs on front corner posts
    const statusGeo = new THREE.SphereGeometry(0.07, 12, 10);
    const inputStatus = new THREE.Mesh(statusGeo, inputStatusMat);
    inputStatus.position.set(-L.frameW / 2, L.postH + 0.06, L.frameD / 2);
    root.add(inputStatus);
    const outputStatus = new THREE.Mesh(statusGeo, outputStatusMat);
    outputStatus.position.set(L.frameW / 2, L.postH + 0.06, L.frameD / 2);
    root.add(outputStatus);

    // Gears spin, LEDs breathe out of phase
    const animTarget = bigGear.children[0];
    const startMs = performance.now();
    const animState = { lastMs: startMs };
    animTarget.onBeforeRender = () => {
        const now = performance.now();
        const dt = Math.min(0.1, (now - animState.lastMs) * 0.001);
        animState.lastMs = now;
        const t = (now - startMs) * 0.001;

        bigGear.rotation.y += dt * 1.6;
        smallGear.rotation.y -= dt * 2.4;

        const breathe = 0.5 + 0.5 * Math.sin(t * 1.6);
        inputStatusMat.emissiveIntensity = 0.6 + breathe * 1.2;
        outputStatusMat.emissiveIntensity = 0.6 + (1 - breathe) * 1.2;
    };
}

// ── Register preset ──

MeshPresets.register('gearworks-machine', ({
    cost = { essence: 10, coin: 5 }, output = 'coin', outputCount = 1,
    frameWidth = 14, frameDepth = 3.6,
    sectionRatio = [0.3, 0.4, 0.3],
} = {}) => {
    const root = new THREE.Group();

    const L = {
        frameW: frameWidth,
        frameD: frameDepth,
        railH: 0.15,
        railT: 0.12,
        woodH: 0.2,
        postSize: 0.18,
        postH: 0.5,
        gearOffset: 0.8,
        bigGearR: 0.55,
        smallGearR: 0.38,
        gearGap: 1.1,
        coinScale: 2.4,
    };

    // Section X centers
    const usableW = L.frameW - L.railT * 2;
    const inputW = usableW * sectionRatio[0];
    const processW = usableW * sectionRatio[1];
    const inputCenterX = -usableW / 2 + inputW / 2;
    const processCenterX = -usableW / 2 + inputW + processW / 2;
    const outputCenterX = usableW / 2 - usableW * sectionRatio[2] / 2;

    const bigGearX = processCenterX - L.gearGap * 0.45;
    const smallGearX = processCenterX + L.gearGap * 0.55;

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
    const padDepth = positions.inputW * 0.55;
    root.userData.padLocalCenter = {
        x: positions.inputCenterX,
        z: L.frameD / 2 + padDepth / 2
    };

    // Expose output center in local coords for placing produced resources
    root.userData.outputLocalCenter = {
        x: positions.outputCenterX,
        y: L.woodH + 0.3,
        z: 0
    };

    return root;
});
