// effects.js — reusable effect spawners ported from src/systems/SkillEffectSystem.js
//
// This is a tiny effect engine. Each spawner pushes an object into a shared
// active-effects list with { anchor, elapsed, duration, tick, onEnd? }.
// lab.js calls update(dt) once per frame to advance and dispose them.

import * as THREE from 'three';

const _active = [];
let _scene = null;

export function attachScene(scene) { _scene = scene; }

export function update(dt) {
    for (let i = _active.length - 1; i >= 0; i--) {
        const fx = _active[i];
        fx.elapsed += dt;
        if (fx.tick) fx.tick(dt, fx.elapsed, fx.duration);
        if (fx.elapsed >= fx.duration) {
            if (fx.onEnd) fx.onEnd();
            _scene.remove(fx.anchor);
            disposeAnchor(fx.anchor);
            _active.splice(i, 1);
        }
    }
}

export function clearAll() {
    while (_active.length) {
        const fx = _active.pop();
        _scene.remove(fx.anchor);
        disposeAnchor(fx.anchor);
    }
}

function disposeAnchor(anchor) {
    anchor.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    });
}

// ── Slash arc ────────────────────────────────────────────────────────
//
// Direct port of SkillEffectSystem._spawnSlashArc(). A curved torus segment
// at chest height that sweeps through the swing direction. Optional inner
// bright ribbon and finisher shockwave.
//
// opts: { color, scale, duration, radius, thickness, arcDeg, innerColor,
//         shockwave, sweepStartDeg, sweepEndDeg, yOffset }
export function spawnSlashArc(origin, direction, opts = {}) {
    const color     = opts.color ?? 0xbbeeff;
    const scale     = opts.scale ?? 1.0;
    const duration  = opts.duration ?? 0.18;
    const radius    = (opts.radius ?? 1.6);
    const thickness = (opts.thickness ?? 0.14);
    const arcSpan   = THREE.MathUtils.degToRad(opts.arcDeg ?? 140);
    const innerColor = opts.innerColor ?? 0xffffff;
    const yOffset   = opts.yOffset ?? 1.0;
    const sweepStart = THREE.MathUtils.degToRad(opts.sweepStartDeg ?? 25);
    const sweepEnd   = THREE.MathUtils.degToRad(opts.sweepEndDeg   ?? -25);

    const anchor = new THREE.Group();
    anchor.position.copy(origin);
    anchor.position.y += yOffset;
    anchor.rotation.y = Math.atan2(direction.x, direction.z);

    const arcGeo = new THREE.TorusGeometry(radius, thickness, 8, 32, arcSpan);
    arcGeo.rotateX(Math.PI / 2);
    arcGeo.rotateY(-arcSpan / 2 + Math.PI / 2);
    const arcMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.95, side: THREE.DoubleSide
    });
    const arc = new THREE.Mesh(arcGeo, arcMat);
    anchor.add(arc);

    const innerGeo = new THREE.TorusGeometry(radius, thickness * 0.35, 6, 24, arcSpan);
    innerGeo.rotateX(Math.PI / 2);
    innerGeo.rotateY(-arcSpan / 2 + Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({
        color: innerColor, transparent: true, opacity: 1.0
    });
    const innerArc = new THREE.Mesh(innerGeo, innerMat);
    anchor.add(innerArc);

    let shockMat = null, shock = null;
    if (opts.shockwave) {
        const shockGeo = new THREE.RingGeometry(0.2, 0.35, 24);
        shockMat = new THREE.MeshBasicMaterial({
            color: opts.shockwave.color ?? 0xffcc33,
            transparent: true, opacity: 0.9, side: THREE.DoubleSide
        });
        shock = new THREE.Mesh(shockGeo, shockMat);
        shock.rotation.x = -Math.PI / 2;
        shock.position.y = -yOffset + 0.05;
        anchor.add(shock);
    }

    _scene.add(anchor);

    _active.push({
        anchor, elapsed: 0, duration,
        tick: (dt, elapsed, dur) => {
            const t = elapsed / dur;
            const scalePhase = t < 0.25 ? (t / 0.25)
                              : (t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1);
            anchor.scale.setScalar(scalePhase * scale);

            arc.rotation.y      = sweepStart + (sweepEnd - sweepStart) * t;
            innerArc.rotation.y = arc.rotation.y;

            const opacity = t < 0.15 ? (t / 0.15) : 1 - (t - 0.15) / 0.85;
            arcMat.opacity   = Math.max(0, opacity * 0.95);
            innerMat.opacity = Math.max(0, opacity * 1.0);

            if (shockMat) {
                const s = 1 + t * (opts.shockwave.expand ?? 3.5);
                shock.scale.set(s, s, s);
                shockMat.opacity = 0.9 * (1 - t);
            }
        }
    });
}

// ── Hit spark ────────────────────────────────────────────────────────
//
// Port of _spawnHitSpark. Cheap omnidirectional particle burst at the
// impact point. Bigger + hotter on finishers.
//
// opts: { color, count, speed, duration, gravity }
export function spawnHitSpark(position, opts = {}) {
    const count    = opts.count    ?? 6;
    const color    = opts.color    ?? 0xffffaa;
    const speed    = opts.speed    ?? 3;
    const duration = opts.duration ?? 0.22;
    const gravity  = opts.gravity  ?? 9;

    const anchor = new THREE.Group();
    anchor.position.copy(position);
    _scene.add(anchor);

    const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 1.0
    });
    const particles = [];
    for (let i = 0; i < count; i++) {
        const geo = new THREE.SphereGeometry(0.08, 4, 4);
        const p = new THREE.Mesh(geo, mat);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(1 - Math.random() * 1.4);
        const dir = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta)
        );
        p.userData.velocity = dir.multiplyScalar(speed * (0.6 + Math.random() * 0.6));
        anchor.add(p);
        particles.push(p);
    }

    _active.push({
        anchor, elapsed: 0, duration,
        tick: (dt, elapsed, dur) => {
            const t = elapsed / dur;
            mat.opacity = 1 - t;
            for (const p of particles) {
                p.position.addScaledVector(p.userData.velocity, dt);
                p.userData.velocity.y -= gravity * dt;
                p.scale.setScalar(1 - t * 0.6);
            }
        }
    });
}

// ── Ground shockwave ─────────────────────────────────────────────────
//
// Standalone expanding ring at floor level. Used by hammer slam and as a
// generic AOE punctuation.
//
// opts: { color, duration, startInner, startOuter, expand, height }
export function spawnShockwave(position, opts = {}) {
    const color     = opts.color     ?? 0xffcc33;
    const duration  = opts.duration  ?? 0.45;
    const startInner = opts.startInner ?? 0.3;
    const startOuter = opts.startOuter ?? 0.55;
    const expand    = opts.expand    ?? 6;
    const height    = opts.height    ?? 0.05;

    const geo = new THREE.RingGeometry(startInner, startOuter, 32);
    const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9, side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position);
    ring.position.y = height;

    _scene.add(ring);

    _active.push({
        anchor: ring, elapsed: 0, duration,
        tick: (dt, elapsed, dur) => {
            const t = elapsed / dur;
            const s = 1 + t * expand;
            ring.scale.set(s, s, s);
            mat.opacity = 0.9 * (1 - t);
        }
    });
}

// ── Falling impact bar ───────────────────────────────────────────────
//
// A vertical column that snaps down from the sky onto a point. Used as the
// hammer's "weight" punctuation. Adapted from _spawnChopAt.
export function spawnImpactBar(position, opts = {}) {
    const color    = opts.color    ?? 0xfff2b3;
    const radius   = opts.radius   ?? 0.18;
    const height   = opts.height   ?? 3.2;
    const duration = opts.duration ?? 0.5;

    const anchor = new THREE.Group();
    anchor.position.copy(position);
    anchor.position.y = 0;

    const barGeo = new THREE.CylinderGeometry(radius, radius, height, 8);
    const barMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 1.0
    });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.y = height / 2 + 3.0;
    anchor.add(bar);

    const coreGeo = new THREE.CylinderGeometry(radius * 0.4, radius * 0.4, height, 6);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 1.0
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = height / 2 + 3.0;
    anchor.add(core);

    _scene.add(anchor);

    _active.push({
        anchor, elapsed: 0, duration,
        tick: (dt, elapsed, dur) => {
            if (elapsed < 0.08) {
                const k = elapsed / 0.08;
                const y0 = height / 2 + 3.0;
                const y1 = height / 2;
                bar.position.y  = y0 + (y1 - y0) * k;
                core.position.y = bar.position.y;
            } else {
                const k = (elapsed - 0.08) / (dur - 0.08);
                barMat.opacity  = Math.max(0, 1 - k * 1.5);
                coreMat.opacity = Math.max(0, 1 - k * 1.3);
                const s = 1 + k * 0.3;
                bar.scale.set(s, 1, s);
            }
        }
    });
}

// ── Crescent slash ───────────────────────────────────────────────────
//
// A sharp tapered crescent arc mesh that's *drawn along its own curve* as
// it appears — so the eye reads the direction of the sword stroke, not
// "a glowing shape materialized here."
//
// Geometry: the crescent is built from a custom Shape with two offset
// curves — an outer arc of radius `range` and an inner arc whose inset
// tapers with sin(πt) so both tips come to sharp points. Then extruded
// thin, laid flat in the XZ plane, and rotated so its bisector points
// along `direction`.
//
// Reveal: a ShaderMaterial animates a ribbon-shaped window that sweeps
// along the arc. Each vertex's parametric position `t` along the curve is
// recovered in the vertex shader from its local XZ angle (no custom
// attribute needed — the shape is a perfect arc around the origin). Two
// uniforms drive the animation: `uLeadingEdge` sweeps across the arc,
// `uTrailPos` follows at a fixed lag, and only vertices inside the
// [trail, leading] window are drawn. A brightness boost near the leading
// edge gives the stroke a "hot tip."
//
// Two shader materials share the reveal uniforms (opaque core + additive
// halo) so both layers animate as one ribbon.
//
// opts:
//   color          halo / outer color
//   innerColor     core color (default white)
//   range          outer radius in world units (also the hit reach)
//   thickness      radial width of the crescent at the middle (tips sharp)
//   spanDeg        angular span of the arc in degrees
//   tilt           radians to rotate around the bisector (0 = flat)
//   duration       seconds visible
//   yOffset        height above ground (default 1.0 = chest)
//   reverseSweep   if true, reveal sweeps tip-1 → tip-0 (opposite direction)
//   trailWidth     width of the visible ribbon window along the arc (0..1)
//   revealFrac     [0..1] of duration the reveal phase occupies; rest = fade
export function spawnCrescentSlash(origin, direction, opts = {}) {
    const color        = opts.color        ?? 0xbbeeff;
    const innerColor   = opts.innerColor   ?? 0xffffff;
    const range        = opts.range        ?? 2.6;
    const thickness    = opts.thickness    ?? 0.42;
    const spanDeg      = opts.spanDeg      ?? 135;
    const tilt         = opts.tilt         ?? 0.0;
    const duration     = opts.duration     ?? 0.22;
    const yOffset      = opts.yOffset      ?? 1.0;
    const reverseSweep = opts.reverseSweep ?? false;
    const trailWidth   = opts.trailWidth   ?? 0.55;
    const revealFrac   = opts.revealFrac   ?? 0.55;

    // ── Build 2D crescent shape ──
    const span = THREE.MathUtils.degToRad(spanDeg);
    const segments = 40;
    const shape = new THREE.Shape();
    const pts = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const a = -span / 2 + t * span;
        pts.push(new THREE.Vector2(Math.cos(a) * range, Math.sin(a) * range));
    }
    for (let i = segments; i >= 0; i--) {
        const t = i / segments;
        const a = -span / 2 + t * span;
        const taper = Math.sin(t * Math.PI); // 0 at ends, 1 at middle
        const r = range - thickness * taper;
        pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    shape.setFromPoints(pts);

    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.05,
        bevelEnabled: true,
        bevelSize: 0.015,
        bevelThickness: 0.008,
        bevelSegments: 2,
        curveSegments: 2,
    });
    geo.translate(0, 0, -0.025);
    geo.rotateX(Math.PI / 2);

    // ── Shared reveal uniforms (both meshes animate together) ──
    // Intentionally share {value} objects by reference so one write
    // updates both materials. uRange + uMaxThickness let the shader
    // compute each vertex's RADIAL position across the crescent's
    // thickness, so we can fade the alpha at both radial edges and
    // eliminate the hard core-vs-halo seam.
    const uLeadingEdge  = { value: -0.2 };
    const uTrailPos     = { value: -0.2 - trailWidth };
    const uSpan         = { value: span };
    const uSweepSign    = { value: reverseSweep ? -1.0 : 1.0 };
    const uEdgeSoft     = { value: 0.035 };
    const uRange        = { value: range };
    const uMaxThickness = { value: thickness };

    // Tint the core slightly toward the halo color — pure white next to a
    // saturated halo reads as two distinct arcs. A subtle tint on the core
    // blends the two visual bands into one glowing stroke.
    const coreTinted = new THREE.Color(innerColor).lerp(new THREE.Color(color), 0.25);

    const coreUniforms = {
        uLeadingEdge, uTrailPos, uSpan, uSweepSign, uEdgeSoft,
        uRange, uMaxThickness,
        uColor:        { value: coreTinted },
        uOpacity:      { value: 1.0 },
        uLeadingBoost: { value: 1.6 },
        uProfileMode:  { value: 0.0 }, // 0 = core (sharp plateau)
    };
    const haloUniforms = {
        uLeadingEdge, uTrailPos, uSpan, uSweepSign, uEdgeSoft,
        uRange, uMaxThickness,
        uColor:        { value: new THREE.Color(color) },
        uOpacity:      { value: 1.1 },
        uLeadingBoost: { value: 0.8 },
        uProfileMode:  { value: 1.0 }, // 1 = halo (parabolic bell)
    };

    const coreMat = new THREE.ShaderMaterial({
        uniforms: coreUniforms,
        vertexShader:   CRESCENT_VS,
        fragmentShader: CRESCENT_FS,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const haloMat = new THREE.ShaderMaterial({
        uniforms: haloUniforms,
        vertexShader:   CRESCENT_VS,
        fragmentShader: CRESCENT_FS,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
    });

    const core = new THREE.Mesh(geo, coreMat);
    const halo = new THREE.Mesh(geo, haloMat);
    // Small halo scale keeps the glow close to the core silhouette so the
    // two layers overlap instead of separating into distinct rings.
    halo.scale.setScalar(1.10);

    // Parent group handles position + orientation.
    const group = new THREE.Group();
    group.rotation.order = 'YXZ';
    group.position.copy(origin);
    group.position.y += yOffset;
    group.rotation.y = Math.atan2(-direction.z, direction.x);
    group.rotation.x = tilt;

    group.add(halo);
    group.add(core);

    _scene.add(group);

    _active.push({
        anchor: group, elapsed: 0, duration,
        tick: (dt, elapsed, dur) => {
            const t = elapsed / dur;

            if (t < revealFrac) {
                // Phase A — reveal: leading edge sweeps across the arc,
                // trail follows at a fixed lag. easeOutQuad makes the
                // leading edge move fastest early, like a real blade
                // biting into the cut.
                const k = t / revealFrac;
                const eased = 1 - (1 - k) * (1 - k);
                // Start slightly before the arc and end slightly past it
                // so the leading edge enters and exits cleanly.
                const leading = -0.15 + eased * 1.35;
                uLeadingEdge.value = leading;
                uTrailPos.value    = leading - trailWidth;
                coreUniforms.uOpacity.value = 1.0;
                haloUniforms.uOpacity.value = 0.75;
                group.scale.setScalar(1.0);
            } else {
                // Phase B — hold + fade the trailing ribbon
                const k = (t - revealFrac) / (1 - revealFrac);
                const fade = Math.max(0, 1 - k);
                uLeadingEdge.value = 1.2;
                uTrailPos.value    = 1.2 - trailWidth;
                coreUniforms.uOpacity.value = fade;
                haloUniforms.uOpacity.value = fade * 0.75;
                group.scale.setScalar(1.0 + k * 0.18);
            }
        },
        onEnd: () => {
            coreMat.dispose();
            haloMat.dispose();
        },
    });
}

// ── Crescent shaders ─────────────────────────────────────────────────
//
// VS: passes two per-vertex varyings to the fragment shader.
//
//   vT      — parametric position along the arc (0 at one tip → 1 at the
//             other), recovered from the vertex's local XZ angle.
//
//   vRadial — position across the arc's THICKNESS. 0 = outer edge (the
//             sharp convex side at radius `uRange`), 1 = inner bulge
//             midpoint. Computed from the vertex's distance to origin,
//             normalized by the shape's max thickness.
//
// Because the crescent geometry was built in the XY plane centered on
// (0,0) then rotated flat in XZ, every vertex's shape angle =
// atan2(position.z, position.x) and its shape radius = length(position.xz).
const CRESCENT_VS = /* glsl */`
uniform float uSpan;
uniform float uSweepSign;
uniform float uRange;
uniform float uMaxThickness;
varying float vT;
varying float vRadial;

void main() {
    // Longitudinal position along the arc
    float angle = atan(position.z, position.x);
    float t = (angle + uSpan * 0.5) / uSpan;
    t = clamp(t, 0.0, 1.0);
    vT = uSweepSign > 0.0 ? t : 1.0 - t;

    // Radial position across the thickness: 0 at outer edge, 1 at max
    // inner bulge. Clamped so halo vertices outside the core's [uRange -
    // uMaxThickness, uRange] band resolve cleanly.
    float r = length(position.xz);
    vRadial = clamp((uRange - r) / uMaxThickness, 0.0, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// FS: two visibility terms multiplied together.
//
//   longitudinal — the ribbon-window reveal animation along the arc
//                  (unchanged — drives the sweep effect)
//
//   radial       — alpha profile across the thickness:
//                  CORE mode (0): flat bright plateau in the middle 50%,
//                                 soft edges → a sharp centerline stroke
//                  HALO mode (1): parabolic bell, zero at both radial
//                                 edges → a proper soft glow
//
// Both modes fade to 0 at the outer and inner edges of the shape, so the
// core and halo layers meet the silhouette smoothly and there's no
// visible rim or hard border between them.
const CRESCENT_FS = /* glsl */`
uniform vec3  uColor;
uniform float uOpacity;
uniform float uLeadingEdge;
uniform float uTrailPos;
uniform float uEdgeSoft;
uniform float uLeadingBoost;
uniform float uProfileMode;   // 0 = core, 1 = halo
varying float vT;
varying float vRadial;

void main() {
    // ── Longitudinal reveal window ──
    float headFade = 1.0 - smoothstep(uLeadingEdge - uEdgeSoft, uLeadingEdge + uEdgeSoft, vT);
    float tailFade = smoothstep(uTrailPos - uEdgeSoft, uTrailPos + uEdgeSoft, vT);
    float longitudinal = headFade * tailFade;

    // ── Radial profile ──
    float radial;
    if (uProfileMode < 0.5) {
        // Core: flat plateau in the middle 50% of thickness, soft fades
        // at both radial edges so the core alpha gracefully meets the
        // halo's inner alpha without a visible seam.
        radial = smoothstep(0.12, 0.32, vRadial) *
                 (1.0 - smoothstep(0.68, 0.88, vRadial));
    } else {
        // Halo: parabolic bell — 0 at both radial edges, peak at mid.
        // Raised to a small power to widen the plateau slightly.
        float bell = 4.0 * vRadial * (1.0 - vRadial);
        radial = pow(max(bell, 0.0), 0.7);
    }

    float visible = longitudinal * radial;

    // Brightness boost near the leading edge ("hot tip")
    float boostMask = smoothstep(uLeadingEdge - 0.14, uLeadingEdge - 0.02, vT) * headFade;
    vec3 color = uColor + vec3(boostMask * uLeadingBoost);

    float a = uOpacity * visible;
    if (a < 0.005) discard;
    gl_FragColor = vec4(color, a);
}
`;

// ── Trail (line) ─────────────────────────────────────────────────────
//
// A short-lived ribbon between two points. (Legacy — was used for the old
// per-frame blade trail before crescent slashes replaced it.)
export function spawnLineFlash(from, to, opts = {}) {
    const color = opts.color ?? 0xffffff;
    const duration = opts.duration ?? 0.18;
    const thickness = opts.thickness ?? 0.05;

    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 0.0001) return;

    const geo = new THREE.CylinderGeometry(thickness, thickness, len, 8);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 1.0
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.lookAt(to);

    _scene.add(mesh);

    _active.push({
        anchor: mesh, elapsed: 0, duration,
        tick: (dt, elapsed, dur) => {
            const t = elapsed / dur;
            mat.opacity = 1 - t;
            mesh.scale.x = 1 + t * 1.5;
            mesh.scale.y = 1 + t * 1.5;
        }
    });
}
