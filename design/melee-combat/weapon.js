// weapon.js — Summoned sword: mesh + slash-combo scheduler.
//
// The sword mesh is hidden by default. When a swing is triggered, the
// controller plays a pre-scripted sequence of SlashEvents ("combos"):
// each SlashEvent spawns a sharp crescent arc + optional sword flicker
// + optional shockwave, and runs a cone-based hit test via the onSlash
// callback.
//
// This replaces the old persistent-sword pivot-sweep animation. There is
// NO idle/windup/recover state — swings are discrete events that finish
// and then disappear, exactly like a "summoned" weapon should.
//
// Public API (unchanged contract where possible):
//   createSwingController(anchor, scene) → controller
//
//   controller = {
//     trigger(),                 // start a swing (auto-skip if busy)
//     update(dt),                // advance the scheduler + flickers
//     config,                    // tunable — see DEFAULT_CONFIG below
//     onSlash(cb),               // cb({origin, direction, range, coneDeg,
//                                //     damageMul, isFinisher, slash})
//     sword,                     // the Three.Group (hidden between slashes)
//     phaseName,                 // 'idle' | 'playing'
//     isStriking,                // true during a combo
//     isFinisher,                // true if current combo is the finisher
//     swingId,                   // increments per trigger()
//     comboCount,                // running combo counter
//   }

import * as THREE from 'three';
import { spawnCrescentSlash, spawnShockwave } from './core/effects.js';

// ── Sword mesh (unchanged silhouette) ────────────────────────────────

export function buildSword() {
    const group = new THREE.Group();

    // Blade — tapered extruded shape. Local coords: grip at y=0, tip at y=1.0.
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.055, 0.02);
    bladeShape.lineTo( 0.055, 0.02);
    bladeShape.lineTo( 0.055, 0.08);
    bladeShape.lineTo( 0.045, 0.85);
    bladeShape.lineTo( 0.0,   1.00);
    bladeShape.lineTo(-0.045, 0.85);
    bladeShape.lineTo(-0.055, 0.08);
    bladeShape.lineTo(-0.055, 0.02);

    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.024, bevelEnabled: true,
        bevelSize: 0.008, bevelThickness: 0.004, bevelSegments: 2,
        curveSegments: 4,
    });
    bladeGeo.translate(0, 0, -0.012);
    const bladeMat = new THREE.MeshStandardMaterial({
        color: 0xe8f0ff,
        metalness: 0.9, roughness: 0.18,
        emissive: 0x88aaff, emissiveIntensity: 0.55,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.castShadow = true;
    group.add(blade);

    // Fuller — thin darker stripe
    const fullerGeo = new THREE.BoxGeometry(0.018, 0.72, 0.005);
    const fullerMat = new THREE.MeshStandardMaterial({
        color: 0x556677, metalness: 0.6, roughness: 0.4,
    });
    const fuller = new THREE.Mesh(fullerGeo, fullerMat);
    fuller.position.set(0, 0.45, 0.013);
    group.add(fuller);
    const fullerBack = new THREE.Mesh(fullerGeo, fullerMat);
    fullerBack.position.set(0, 0.45, -0.013);
    group.add(fullerBack);

    // Crossguard — gold bar
    const guardGeo = new THREE.BoxGeometry(0.34, 0.05, 0.09);
    const guardMat = new THREE.MeshStandardMaterial({
        color: 0xccaa55, metalness: 0.75, roughness: 0.25,
        emissive: 0x554422, emissiveIntensity: 0.4,
    });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    group.add(guard);

    // Grip
    const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.032, 0.22, 12),
        new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.9 })
    );
    grip.position.y = -0.13;
    group.add(grip);

    // Pommel
    const pommel = new THREE.Mesh(
        new THREE.SphereGeometry(0.048, 14, 10),
        guardMat
    );
    pommel.position.y = -0.26;
    pommel.scale.y = 0.85;
    group.add(pommel);

    return group;
}

// ── Combos ────────────────────────────────────────────────────────────
//
// Each SlashEvent:
//   tAt        — seconds from combo start to fire this slash
//   angleDeg   — direction offset from anchor forward (+Z), around Y
//   range      — slash reach in world units (also visual outer radius)
//   coneDeg    — hit cone width for this slash
//   spanDeg    — visual crescent angular span
//   tilt       — radians: rotate crescent around bisector for variety
//   thickness  — visual crescent width
//   color,
//   innerColor — visual colors (core + halo)
//   duration   — visual lifetime
//   damageMul  — damage multiplier
//   showSword  — flicker the sword mesh when this slash fires
//   shockwave  — spawn a ground shockwave (finisher punctuation)

// Normal combo: a quick "back-and-forth" double slash in the SAME total time
// budget as a single slash. Slash 1 sweeps one way, slash 2 sweeps the
// opposite way with a mirrored tilt so it reads as the blade snapping back.
// Damage per slash is halved so the combined damage stays close to one swing.
const NORMAL_COMBO = [
    // Outgoing stroke
    {
        tAt: 0.00, angleDeg: 0,
        range: 2.6, coneDeg: 130, spanDeg: 135,
        tilt: 0.12, thickness: 0.42,
        color: 0xbbeeff, innerColor: 0xffffff,
        duration: 0.13, damageMul: 0.7,
        showSword: true,
        reverseSweep: false,
    },
    // Return stroke — mirrored tilt + opposite sweep direction, fired mid-fade
    // of slash 1 so the two merge into a single "woosh-woosh" beat.
    {
        tAt: 0.07, angleDeg: 0,
        range: 2.6, coneDeg: 130, spanDeg: 135,
        tilt: -0.12, thickness: 0.42,
        color: 0xbbeeff, innerColor: 0xffffff,
        duration: 0.13, damageMul: 0.7,
        showSword: true,
        reverseSweep: true,
    },
];

const FINISHER_COMBO = [
    // Diagonal slash — sweeps from top-right down to bottom-left (\)
    {
        tAt: 0.00, angleDeg: -24,
        range: 3.2, coneDeg: 150, spanDeg: 160,
        tilt: 0.55, thickness: 0.52,
        color: 0xffaa44, innerColor: 0xffeeaa,
        duration: 0.26, damageMul: 1.2,
        showSword: true,
        reverseSweep: false, // default direction
    },
    // Diagonal slash — sweeps from top-left down to bottom-right (/)
    // reverseSweep so it visibly cuts in the mirror direction → reads as an X
    {
        tAt: 0.11, angleDeg: 24,
        range: 3.2, coneDeg: 150, spanDeg: 160,
        tilt: -0.55, thickness: 0.52,
        color: 0xff7733, innerColor: 0xffcc88,
        duration: 0.26, damageMul: 1.2,
        showSword: true,
        reverseSweep: true,
    },
    // Horizontal power strike with shockwave (sweeps the other way again
    // for variety and a strong third beat)
    {
        tAt: 0.24, angleDeg: 0,
        range: 3.6, coneDeg: 115, spanDeg: 180,
        tilt: 0.0, thickness: 0.62,
        color: 0xff3322, innerColor: 0xffee66,
        duration: 0.34, damageMul: 1.6,
        showSword: true, shockwave: true,
        reverseSweep: false,
        trailWidth: 0.75,   // slightly fatter ribbon for the heavy finisher
    },
];

// Forward axis in anchor local frame: +Z points "into" the scene where
// the dummy is placed in lab.js. Slashes rotate this around Y by angleDeg.
const ANCHOR_FORWARD = new THREE.Vector3(0, 0, 1);
const WORLD_UP       = new THREE.Vector3(0, 1, 0);
const BLADE_LENGTH   = 1.0;

// ── Controller ────────────────────────────────────────────────────────

export function createSwingController(anchor, scene) {
    const sword = buildSword();
    sword.visible = false;
    anchor.add(sword);

    const state = {
        phase: 'idle',        // 'idle' | 'playing'
        combo: null,          // current combo array
        elapsed: 0,
        firedIdx: 0,
        isFinisher: false,
        swingId: 0,
        comboCount: 0,
        flickers: [],         // active sword flickers
    };

    const config = {
        finisherEvery:      4,
        normalTrailColor:   0xbbeeff,   // overrides the first slash of a normal combo
        finisherTrailColor: 0xff5522,   // overrides the first slash of a finisher combo
        normalRangeMul:     1.0,        // slider-tunable reach multiplier
        finisherRangeMul:   1.0,
        slashSpeedMul:      1.0,        // >1 = faster combos, <1 = slower
        swordFlickerTime:   0.08,       // how long the sword stays visible per slash
    };

    let onSlashCb = null;

    function trigger() {
        if (state.phase !== 'idle') return;
        state.comboCount += 1;
        state.isFinisher = config.finisherEvery > 0
            && (state.comboCount % config.finisherEvery === 0);
        state.combo = state.isFinisher ? FINISHER_COMBO : NORMAL_COMBO;
        state.phase = 'playing';
        state.elapsed = 0;
        state.firedIdx = 0;
        state.swingId += 1;
    }

    function update(dt) {
        // Tick sword flickers (these run even in idle, so a flicker can
        // outlast the combo's end-of-playing).
        for (let i = state.flickers.length - 1; i >= 0; i--) {
            const f = state.flickers[i];
            f.elapsed += dt;
            if (f.elapsed >= f.duration) {
                sword.visible = false;
                state.flickers.splice(i, 1);
            }
        }

        if (state.phase !== 'playing') return;

        state.elapsed += dt * config.slashSpeedMul;

        // Fire any slashes whose tAt has come due
        while (state.firedIdx < state.combo.length
               && state.combo[state.firedIdx].tAt <= state.elapsed) {
            fireSlash(state.combo[state.firedIdx], state.firedIdx);
            state.firedIdx += 1;
        }

        // End of combo: after the last slash has fully visually played
        if (state.firedIdx >= state.combo.length) {
            const last = state.combo[state.combo.length - 1];
            if (state.elapsed >= last.tAt + last.duration + 0.02) {
                state.phase = 'idle';
                state.elapsed = 0;
            }
        }
    }

    function fireSlash(ev, slashIdx) {
        // Compute slash direction in world space: rotate anchor forward
        // by ev.angleDeg around Y, then by anchor's own yaw.
        const dir = ANCHOR_FORWARD.clone()
            .applyAxisAngle(WORLD_UP, THREE.MathUtils.degToRad(ev.angleDeg));
        if (anchor.rotation.y !== 0) {
            dir.applyAxisAngle(WORLD_UP, anchor.rotation.y);
        }
        dir.normalize();

        // Origin = anchor world position (assumed at ground)
        const origin = anchor.getWorldPosition(new THREE.Vector3());

        // Color overrides: first slash of each combo uses the configured
        // "normalTrailColor" / "finisherTrailColor" so the sidebar color
        // pickers actually visibly affect the swing. Subsequent finisher
        // slashes keep their embedded orange→red gradient for variety.
        let color      = ev.color;
        let innerColor = ev.innerColor;
        if (slashIdx === 0) {
            color = state.isFinisher
                ? config.finisherTrailColor
                : config.normalTrailColor;
        }

        // Apply reach multiplier (slider)
        const rangeMul = state.isFinisher
            ? config.finisherRangeMul
            : config.normalRangeMul;
        const range = ev.range * rangeMul;

        // Spawn the crescent arc
        spawnCrescentSlash(origin, dir, {
            color, innerColor,
            range,
            thickness:    ev.thickness,
            spanDeg:      ev.spanDeg,
            tilt:         ev.tilt,
            duration:     ev.duration,
            yOffset:      1.0,
            reverseSweep: ev.reverseSweep ?? false,
            trailWidth:   ev.trailWidth,    // undefined → spawner default
        });

        // Optional shockwave (finisher punctuation)
        if (ev.shockwave) {
            const groundPos = origin.clone();
            groundPos.y = 0.05;
            spawnShockwave(groundPos, {
                color: 0xff5522,
                duration: 0.55,
                startInner: 0.35,
                startOuter: 0.60,
                expand: 7,
            });
        }

        // Sword flicker — briefly show the mesh oriented along the slash
        if (ev.showSword) {
            flickerSword(origin, dir, range, ev.tilt);
        }

        // Hit-test callback (lab.js handles impact effects)
        if (onSlashCb) {
            onSlashCb({
                origin: origin.clone(),
                direction: dir.clone(),
                range,
                coneDeg: ev.coneDeg,
                damageMul: ev.damageMul,
                isFinisher: state.isFinisher,
                slashIdx,
                slash: ev,
            });
        }
    }

    function flickerSword(origin, direction, range, tilt) {
        // Position the sword inside anchor's local frame so its blade
        // extends along the slash direction with the tip near the outer
        // edge of the crescent.
        const bladeMid = BLADE_LENGTH * 0.5;
        const worldMid = origin.clone().addScaledVector(direction, range - bladeMid);
        worldMid.y += 1.0; // chest height

        // Convert to anchor-local
        anchor.updateMatrixWorld();
        sword.position.copy(anchor.worldToLocal(worldMid.clone()));

        // Orient blade local +Y → slash direction
        const q = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction
        );
        // Roll around the blade axis by `tilt` so diagonal slashes look diagonal
        if (tilt !== 0) {
            const roll = new THREE.Quaternion().setFromAxisAngle(direction, tilt);
            q.premultiply(roll);
        }
        sword.quaternion.copy(q);

        sword.visible = true;

        // Replace any existing flicker (new slash cancels the previous flicker)
        state.flickers.length = 0;
        state.flickers.push({
            elapsed: 0,
            duration: config.swordFlickerTime,
        });
    }

    return {
        trigger, update, config, sword,
        onSlash(cb) { onSlashCb = cb; },
        get phaseName()  { return state.phase; },
        get isStriking() { return state.phase === 'playing'; },
        get isFinisher() { return state.isFinisher; },
        get swingId()    { return state.swingId; },
        get comboCount() { return state.comboCount; },
    };
}
