/**
 * Shared base for all resource previews.
 * Loaded via <script src="_base.js"> AFTER Three.js UMD.
 * Exposes: window.makeStage, window.makeCanvas, window.texFromCanvas, window.initPreview
 */

/* =========================================================
   Per-canvas scene with minimal mouse-orbit controls
   ========================================================= */
window.makeStage = function makeStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setClearColor(0x0e1424, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 6, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-4, 2, -3);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const target = new THREE.Vector3(0, 0, 0);

  let yaw = Math.PI * 0.25;
  let pitch = Math.PI * 0.22;
  let dist = 4.2;

  function applyCamera() {
    const cy = Math.cos(pitch);
    camera.position.set(
      target.x + Math.sin(yaw) * cy * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * cy * dist
    );
    camera.lookAt(target);
  }

  function render() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * renderer.getPixelRatio() || canvas.height !== h * renderer.getPixelRatio()) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  }

  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    yaw   -= dx * 0.01;
    pitch += dy * 0.01;
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
    applyCamera();
    render();
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    dist *= e.deltaY > 0 ? 1.1 : 0.9;
    dist = Math.max(1.2, Math.min(20, dist));
    applyCamera();
    render();
  }, { passive: false });

  window.addEventListener('resize', () => { applyCamera(); render(); });
  applyCamera();

  return {
    scene, camera, render, applyCamera,
    setContent(group) {
      for (let i = scene.children.length - 1; i >= 0; i--) {
        const c = scene.children[i];
        if (c.isLight) continue;
        scene.remove(c);
        c.traverse?.((n) => {
          if (n.geometry) n.geometry.dispose?.();
          if (n.material) {
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            for (const m of mats) {
              if (m.map) m.map.dispose?.();
              m.dispose?.();
            }
          }
        });
      }
      scene.add(group);
      render();
    }
  };
};

/* =========================================================
   Canvas-texture helpers
   ========================================================= */
window.makeCanvas = function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d') };
};

window.texFromCanvas = function texFromCanvas(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
};

/* =========================================================
   initPreview — builds the full page from a meta descriptor
   meta = { title, sub, panels: [{ mod, ttl, sub, build }] }
   ========================================================= */
window.initPreview = function initPreview(meta) {
  document.getElementById('title').textContent    = meta.title;
  document.getElementById('subtitle').textContent = meta.sub;

  const container = document.getElementById('panels');
  const count = meta.panels.length;
  container.style.gridTemplateColumns = `repeat(${count}, 1fr)`;
  container.innerHTML = '';

  const stages = [];

  for (let i = 0; i < count; i++) {
    const p = meta.panels[i];

    const panel = document.createElement('div');
    panel.className = `panel ${p.mod}`;

    const header = document.createElement('header');
    header.innerHTML = `<div class="ttl">${p.ttl}</div><div class="sub">${p.sub}</div>`;
    panel.appendChild(header);

    const stageDiv = document.createElement('div');
    stageDiv.className = 'stage';
    const canvas = document.createElement('canvas');
    stageDiv.appendChild(canvas);
    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.textContent = 'Drag to orbit \u00b7 scroll to zoom';
    stageDiv.appendChild(tip);
    panel.appendChild(stageDiv);

    container.appendChild(panel);

    const stage = makeStage(canvas);
    stages.push(stage);

    const group = new THREE.Group();
    group.add(p.build());
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    group.add(ground);

    stage.setContent(group);
  }

  requestAnimationFrame(() => stages.forEach(s => s.render()));
  window.addEventListener('load', () => stages.forEach(s => s.render()));

  // Sidebar navigation
  const NAV_MAP = { meat:'meat.html', coin:'coin.html', wood:'wood.html', stone:'stone.html', essence:'essence.html', essenceCandy:'essenceCandy.html' };
  document.querySelectorAll('#nav li').forEach(li => {
    li.addEventListener('click', () => { window.location.href = NAV_MAP[li.dataset.key]; });
  });
};
