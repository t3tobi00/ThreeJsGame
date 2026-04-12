/**
 * Player Animation Lab — minimal viewer.
 *
 * Imports MeshPresets, ECSManager, Component_Animator, AnimationSystem
 * directly from src/. The character and the animation runtime here are
 * the same code that runs in the game — what plays here plays identically
 * in-game.
 *
 * UI: a list of animations from src/config/animations.json. Click a name
 * to play it. Stop button to stop. That's it. To tweak how an animation
 * looks, edit src/config/animations.json and reload the page.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import EventBus from '../../src/core/EventBus.js';
import MeshPresets from '../../src/core/MeshPresets.js';
import { ECSManager } from '../../src/ecs/ECSManager.js';
import { Component_Transform } from '../../src/ecs/components/Component_Transform.js';
import { Component_Animator } from '../../src/ecs/components/Component_Animator.js';
import { AnimationSystem } from '../../src/systems/AnimationSystem.js';

// ─── State ─────────────────────────────────────────────────────────────────
let scene, camera, renderer, controls;
let ecs, playerId, playerRoot;
let animator;
let animationSystem;
let clips = {};
let activeClipName = null;
const clock = new THREE.Clock();

// ─── Boot ──────────────────────────────────────────────────────────────────
init();

async function init() {
    initScene();
    buildPlayer();
    initECS();
    await loadClipsForUI();
    buildAnimList();
    bindStop();
    window.addEventListener('resize', onResize);
    animate();
}

function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1f2936);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(3.5, 2.4, 4.5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.7);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xaaccff, 0.3);
    fill.position.set(-4, 5, -3);
    scene.add(fill);

    const padGeo = new THREE.CircleGeometry(3.5, 48);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.9 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.receiveShadow = true;
    scene.add(pad);

    const grid = new THREE.GridHelper(7, 14, 0x3d4d5e, 0x2d3a4a);
    grid.position.y = 0.001;
    scene.add(grid);
}

function buildPlayer() {
    playerRoot = MeshPresets.create('character-player', { color: 0x3366ff });
    playerRoot.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(playerRoot);
}

function initECS() {
    ecs = new ECSManager();
    playerId = ecs.createEntity();

    ecs.addComponent(playerId, 'Transform', new Component_Transform(playerRoot));
    ecs.addComponent(playerId, 'Animator',  new Component_Animator());

    animator = ecs.getComponent(playerId, 'Animator');

    animationSystem = new AnimationSystem();
    ecs.registerSystem(animationSystem, ['Transform', 'Animator']);
}

/**
 * Wait for AnimationSystem to finish loading animations.json (it lazy-loads
 * via fetch in its constructor) so the lab UI can list the clips.
 */
async function loadClipsForUI() {
    while (!animationSystem.isLoaded()) {
        await new Promise(r => setTimeout(r, 30));
    }
    clips = animationSystem.getClips() || {};
}

// ─── UI ────────────────────────────────────────────────────────────────────
function buildAnimList() {
    const list = document.getElementById('anim-list');
    list.innerHTML = '';

    const names = Object.keys(clips);
    if (names.length === 0) {
        list.innerHTML = '<div style="font-size: 10px; color: #667; margin: 8px 6px;">No animations found in animations.json</div>';
        return;
    }

    for (const name of names) {
        const clip = clips[name];
        const flags = [];
        if (clip.loop) flags.push('LOOP');
        if (clip.hold) flags.push('HOLD');
        if (!clip.loop && !clip.hold) flags.push('ONCE');

        const btn = document.createElement('button');
        btn.className = 'anim-btn';
        btn.dataset.name = name;
        btn.innerHTML = `
            <span class="play-icon"></span>
            <span class="name">${name}</span>
            <span class="flags">${flags.join(' · ')}</span>
        `;
        btn.addEventListener('click', () => playClip(name));
        list.appendChild(btn);
    }
}

function bindStop() {
    document.getElementById('b-stop').addEventListener('click', () => {
        EventBus.emit('animation:stop', { entityId: playerId });
        activeClipName = null;
        refreshActiveButton();
    });
}

function playClip(name) {
    activeClipName = name;
    EventBus.emit('animation:play', { entityId: playerId, clipName: name });
    refreshActiveButton();
}

function refreshActiveButton() {
    const buttons = document.querySelectorAll('.anim-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.name === activeClipName);
    });
}

// ─── Loop ──────────────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    ecs.update(dt);
    controls.update();
    updateHud();
    renderer.render(scene, camera);

    // Auto-clear active highlight when a one-shot finishes
    if (activeClipName && !animator.activeClip && animator.finished) {
        activeClipName = null;
        refreshActiveButton();
    }
}

function updateHud() {
    const clip = animator.activeClip;
    document.getElementById('h-clip').textContent = animator.activeName || '—';
    document.getElementById('h-time').textContent = clip
        ? `${animator.time.toFixed(2)}s / ${(clip.duration || 0).toFixed(2)}s`
        : '—';
    document.getElementById('h-loop').textContent = clip
        ? (clip.loop ? 'LOOP' : (clip.hold ? 'HOLD' : 'ONCE'))
        : '—';
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
