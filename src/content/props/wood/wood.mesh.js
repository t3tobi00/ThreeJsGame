import * as THREE from 'three';

function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d') };
}

function texFromCanvas(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function buildBarkTexture() {
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
}

function buildRingTexture() {
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
}

export function build(opts = {}) {
  const radius = opts.radius ?? 0.18;
  const length = opts.length ?? 0.5;

  const sideMat = new THREE.MeshStandardMaterial({ map: buildBarkTexture(), roughness: 0.85 });
  const capMat = new THREE.MeshStandardMaterial({ map: buildRingTexture(), roughness: 0.7 });

  const geo = new THREE.CylinderGeometry(radius, radius, length, 28, 1, false);
  geo.rotateZ(Math.PI / 2);

  return {
    parts: [
      {
        name: 'log',
        geometry: geo,
        material: [sideMat, capMat, capMat],
        offset: [0, radius, 0]
      }
    ]
  };
}

export const shaderParams = {
  spinRate: 0.6,
  bobHeight: 0.04
};
