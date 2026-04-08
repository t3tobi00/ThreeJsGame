// lab.js — Melee weapon lab.
//
// Scene + anchor + summoned sword controller + one stationary dummy +
// impact feedback stack. Hit detection is per-slash cone test: when the
// controller fires a slash, we check all dummies in the slash's forward
// cone and trigger impact for each one inside. No per-frame sampling.
//
// Impact stack (unchanged): hitstop, hit sparks, ground shockwave, dummy
// flash + knockback, damage popup.

import * as THREE from 'three';
import {
    attachScene,
    update as updateEffects,
    clearAll as clearEffects,
    spawnHitSpark,
    spawnShockwave,
} from './core/effects.js';
import { createSwingController } from './weapon.js';

// ── Scene / renderer / camera ────────────────────────────────────────

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6a86a0);
scene.fog = new THREE.Fog(0x6a86a0, 30, 80);

const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 11;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2, frustumSize * aspect / 2,
    frustumSize / 2, frustumSize / -2,
    -100, 1000
);
camera.position.set(12, 20, 12);
camera.lookAt(0, 0.8, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    const a = window.innerWidth / window.innerHeight;
    camera.left   = frustumSize * a / -2;
    camera.right  = frustumSize * a / 2;
    camera.top    = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
scene.add(sun);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x4f6f4f, roughness: 0.9 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(20, 20, 0x223322, 0x223322);
grid.position.y = 0.01;
scene.add(grid);

attachScene(scene);

// ── Anchor ───────────────────────────────────────────────────────────

const anchor = new THREE.Group();
anchor.position.set(0, 0, 0);
scene.add(anchor);

const anchorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.42, 32),
    new THREE.MeshBasicMaterial({
        color: 0x88aacc, transparent: true, opacity: 0.5, side: THREE.DoubleSide
    })
);
anchorRing.rotation.x = -Math.PI / 2;
anchorRing.position.y = 0.02;
anchor.add(anchorRing);

// ── Weapon ───────────────────────────────────────────────────────────

const controller = createSwingController(anchor, scene);

// ── Dummy ────────────────────────────────────────────────────────────

const MAX_HP = 100;
const FLASH_TIME = 0.15;
const REGEN_DELAY = 1.5;
const REGEN_RATE = 35;
const CHEST_Y = 0.95;

function buildDummy() {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xa14d4d, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 8), bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);

    const headMat = new THREE.MeshStandardMaterial({ color: 0x9c8b7a, roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), headMat);
    head.position.y = 1.25;
    head.castShadow = true;
    group.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.05, 4, 4);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const left = new THREE.Mesh(eyeGeo, eyeMat);
    left.position.set(-0.09, 1.27, 0.19);
    group.add(left);
    const right = new THREE.Mesh(eyeGeo, eyeMat);
    right.position.set(0.09, 1.27, 0.19);
    group.add(right);

    group.userData = {
        bodyMat,
        baseBody: 0xa14d4d,
        flashLeft: 0,
        hp: MAX_HP,
        regenTimer: 0,
        homeX: 0,
        homeZ: 0,
    };

    return group;
}

const dummy = buildDummy();
scene.add(dummy);

function placeDummy(distance) {
    // Dummy sits directly in front of anchor (+Z = ANCHOR_FORWARD in weapon.js)
    dummy.position.set(0.0, 0, distance);
    dummy.userData.homeX = dummy.position.x;
    dummy.userData.homeZ = dummy.position.z;
}
placeDummy(2.0);

// ── Hit detection — per-slash cone test ─────────────────────────────
//
// Called once per slash event when the controller fires it. For each
// dummy: in-range && inside cone → impact. Each slash hits each dummy at
// most once, but a multi-slash finisher naturally triples the hits.

function handleSlashHits(info) {
    const dummies = [dummy]; // lab has exactly one for now
    for (const d of dummies) {
        const dx = d.position.x - info.origin.x;
        const dz = d.position.z - info.origin.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > info.range || dist < 0.0001) continue;

        // Cone test
        const nx = dx / dist;
        const nz = dz / dist;
        const dot = info.direction.x * nx + info.direction.z * nz;
        const halfCone = THREE.MathUtils.degToRad(info.coneDeg) / 2;
        const cosHalf = Math.cos(halfCone);
        if (dot < cosHalf) continue;

        // Impact point — project blade onto the dummy along the slash direction
        const impactPos = new THREE.Vector3(
            d.position.x,
            CHEST_Y,
            d.position.z
        );
        handleImpact(d, impactPos, info);
    }
}

controller.onSlash(handleSlashHits);

// ── Impact handling ──────────────────────────────────────────────────

let hitstopLeft = 0;
let totalHits = 0;

function handleImpact(target, hitPos, info) {
    const baseDmg = info.isFinisher ? 22 : 10;
    const dmg = Math.round(baseDmg * info.damageMul);

    // Flash + damage
    target.userData.flashLeft = FLASH_TIME;
    target.userData.hp = Math.max(0, target.userData.hp - dmg);
    target.userData.regenTimer = 0;

    // Knockback away from anchor
    const dx = target.position.x - anchor.position.x;
    const dz = target.position.z - anchor.position.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const kb = info.isFinisher ? 0.45 : 0.16;
    target.position.x += (dx / len) * kb;
    target.position.z += (dz / len) * kb;

    // Hit sparks at the impact point
    spawnHitSpark(hitPos, {
        color: info.isFinisher ? 0xff7733 : 0xffeeaa,
        count: info.isFinisher ? 14 : 8,
        speed: info.isFinisher ? 6.5 : 4,
        duration: info.isFinisher ? 0.42 : 0.26,
    });

    // Ground shockwave under the dummy
    const groundPos = new THREE.Vector3(target.position.x, 0.05, target.position.z);
    spawnShockwave(groundPos, {
        color: info.isFinisher ? 0xff5522 : 0xffe0a0,
        duration: info.isFinisher ? 0.5 : 0.3,
        startInner: info.isFinisher ? 0.28 : 0.2,
        startOuter: info.isFinisher ? 0.5 : 0.34,
        expand: info.isFinisher ? 6 : 3.5,
    });

    // Damage popup
    showDamagePopup(
        new THREE.Vector3(target.position.x, 1.8, target.position.z),
        dmg,
        info.isFinisher
    );

    // Hitstop — shorter for normal slashes, longer only on the final
    // finisher strike so the chain feels like [thud, thud, THUD].
    // Normal swing is now a 2-slash back-and-forth: first slash gets a
    // tiny micro-stop so the return slash doesn't get its timing eaten,
    // second slash (the snap-back) gets the real impact stop.
    if (info.isFinisher && info.slash.shockwave) {
        hitstopLeft = 0.11;
    } else if (!info.isFinisher && info.slashIdx === 0) {
        hitstopLeft = 0.015;
    } else {
        hitstopLeft = 0.04;
    }

    totalHits += 1;
    hud.hits.textContent = totalHits;
    if (info.isFinisher && info.slashIdx === 0) flashFinisherHud();
}

// ── Dummy update ─────────────────────────────────────────────────────

function updateDummy(dt) {
    const ud = dummy.userData;
    if (ud.flashLeft > 0) {
        ud.flashLeft -= dt;
        const k = Math.max(0, ud.flashLeft / FLASH_TIME);
        ud.bodyMat.color.setHex(lerpColor(ud.baseBody, 0xffffff, k));
    } else if (ud.bodyMat.color.getHex() !== ud.baseBody) {
        ud.bodyMat.color.setHex(ud.baseBody);
    }

    const dx = ud.homeX - dummy.position.x;
    const dz = ud.homeZ - dummy.position.z;
    dummy.position.x += dx * dt * 2.5;
    dummy.position.z += dz * dt * 2.5;

    ud.regenTimer += dt;
    if (ud.regenTimer > REGEN_DELAY && ud.hp < MAX_HP) {
        ud.hp = Math.min(MAX_HP, ud.hp + REGEN_RATE * dt);
    }
}

function lerpColor(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (Math.round(ar + (br - ar) * t) << 16)
         | (Math.round(ag + (bg - ag) * t) << 8)
         |  Math.round(ab + (bb - ab) * t);
}

// ── Damage popup ─────────────────────────────────────────────────────

function showDamagePopup(worldPos, amount, isCrit) {
    const v = worldPos.clone().project(camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;

    const el = document.createElement('div');
    el.className = 'dmg-popup' + (isCrit ? ' crit' : '');
    el.textContent = amount;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    document.body.appendChild(el);

    const duration = 0.7;
    const startY = y;
    let elapsed = 0;
    let lastTime = performance.now();
    function tick(now) {
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        elapsed += dt;
        const t = elapsed / duration;
        if (t >= 1) { el.remove(); return; }
        el.style.top = (startY - t * 60) + 'px';
        el.style.opacity = 1 - t;
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ── Input ────────────────────────────────────────────────────────────

renderer.domElement.addEventListener('mousedown', () => controller.trigger());
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); controller.trigger(); }
});

// ── Sidebar bindings ─────────────────────────────────────────────────

function bindSlider(id, valId, prop, format, scale = 1) {
    const el  = document.getElementById(id);
    const val = document.getElementById(valId);
    el.value = controller.config[prop] * scale;
    val.textContent = format(controller.config[prop]);
    el.addEventListener('input', () => {
        const v = parseFloat(el.value) / scale;
        controller.config[prop] = v;
        val.textContent = format(v);
    });
}

bindSlider('r-normalreach',   'v-normalreach',   'normalRangeMul',
    (v) => (v * 100).toFixed(0) + '%', 100);
bindSlider('r-finisherreach', 'v-finisherreach', 'finisherRangeMul',
    (v) => (v * 100).toFixed(0) + '%', 100);
bindSlider('r-slashspeed',    'v-slashspeed',    'slashSpeedMul',
    (v) => v.toFixed(2) + 'x', 100);

// Finisher every N
{
    const el  = document.getElementById('r-finisher');
    const val = document.getElementById('v-finisher');
    el.value = controller.config.finisherEvery;
    val.textContent = controller.config.finisherEvery === 0
        ? 'off' : 'every ' + controller.config.finisherEvery;
    el.addEventListener('input', () => {
        const v = parseInt(el.value, 10);
        controller.config.finisherEvery = v;
        val.textContent = v === 0 ? 'off' : 'every ' + v;
    });
}

// Color pickers
const normColor = document.getElementById('r-trailcolor');
normColor.value = '#' + controller.config.normalTrailColor.toString(16).padStart(6, '0');
normColor.addEventListener('input', () => {
    controller.config.normalTrailColor = parseInt(normColor.value.slice(1), 16);
});
const finColor = document.getElementById('r-finishercolor');
finColor.value = '#' + controller.config.finisherTrailColor.toString(16).padStart(6, '0');
finColor.addEventListener('input', () => {
    controller.config.finisherTrailColor = parseInt(finColor.value.slice(1), 16);
});

// Dummy distance
{
    const el  = document.getElementById('r-dummy');
    const val = document.getElementById('v-dummy');
    el.value = 2.0;
    val.textContent = '2.0';
    el.addEventListener('input', () => {
        const v = parseFloat(el.value);
        placeDummy(v);
        val.textContent = v.toFixed(1);
    });
}

// Auto-swing toggle
const autoBtn = document.getElementById('b-auto');
let autoSwing = false;
autoBtn.addEventListener('click', () => {
    autoSwing = !autoSwing;
    autoBtn.classList.toggle('on', autoSwing);
    autoBtn.textContent = 'AUTO-SWING: ' + (autoSwing ? 'ON' : 'OFF');
});

// Reset
document.getElementById('b-reset').addEventListener('click', () => {
    dummy.userData.hp = MAX_HP;
    dummy.userData.flashLeft = 0;
    dummy.userData.regenTimer = 0;
    dummy.position.set(dummy.userData.homeX, 0, dummy.userData.homeZ);
    totalHits = 0;
    hud.hits.textContent = totalHits;
    clearEffects();
});

const hud = {
    phase:    document.getElementById('h-phase'),
    combo:    document.getElementById('h-combo'),
    hits:     document.getElementById('h-hits'),
    finisher: document.getElementById('h-finisher'),
};

function flashFinisherHud() {
    hud.finisher.classList.remove('show');
    void hud.finisher.offsetWidth;
    hud.finisher.classList.add('show');
    setTimeout(() => hud.finisher.classList.remove('show'), 500);
}

// ── Render loop ──────────────────────────────────────────────────────

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    let dt = Math.min(clock.getDelta(), 0.05);

    if (hitstopLeft > 0) {
        hitstopLeft -= dt;
        dt = 0;
    }

    if (autoSwing && controller.phaseName === 'idle') {
        controller.trigger();
    }

    controller.update(dt);
    updateDummy(dt);
    updateEffects(dt);

    hud.phase.textContent = controller.phaseName.toUpperCase();
    hud.combo.textContent = controller.comboCount;

    renderer.render(scene, camera);
}

animate();
