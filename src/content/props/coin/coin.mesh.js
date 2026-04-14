import * as THREE from 'three';

function makeCanvas(size = 1024) {
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

function buildFaceTexture() {
  const { c, ctx } = makeCanvas(1024);
  const cx = 512, cy = 512;

  const base = ctx.createRadialGradient(cx - 120, cy - 160, 60, cx, cy, 540);
  base.addColorStop(0, '#fbd884');
  base.addColorStop(0.55, '#dba23a');
  base.addColorStop(1, '#a26a18');
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(cx, cy, 500, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(70, 40, 5, 0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy, 480, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 240, 180, 0.7)';
  ctx.beginPath();
  ctx.arc(cx, cy, 462, 0, Math.PI * 2);
  ctx.stroke();

  const drawCurvedText = (text, radius, centerAngle, fontPx, flip = false) => {
    ctx.save();
    ctx.fillStyle = '#5a3408';
    ctx.font = `bold ${fontPx}px "Trajan Pro", "Cinzel", "Times New Roman", serif`;
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
      const ch = text[i];
      const charSpan = (widths[i] + 6) / radius;
      a += charSpan / 2;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      if (flip) ctx.rotate(a - Math.PI / 2);
      else      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = 'rgba(255, 235, 170, 0.55)';
      ctx.fillText(ch, 0, -1.5);
      ctx.fillStyle = '#5a3408';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      a += charSpan / 2;
    }
    ctx.restore();
  };

  drawCurvedText('UNITED STATES OF AMERICA', 410, -Math.PI / 2, 50, false);
  drawCurvedText('ONE DOLLAR',               410,  Math.PI / 2, 56, true);

  const drawStar = (x, y, r) => {
    ctx.save();
    ctx.translate(x, y);
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

  ctx.save();
  ctx.translate(cx + 40, cy + 20);

  const drawEagle = (offsetY, fillStyle) => {
    ctx.save();
    ctx.translate(0, offsetY);
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.ellipse(0, 0, 50, 22, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-58, -12, 22, 16, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-78, -12);
    ctx.lineTo(-94, -8);
    ctx.lineTo(-78, -2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.bezierCurveTo(40, -130, 140, -200, 220, -150);
    ctx.bezierCurveTo(180, -120, 110, -60, 30, -10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.bezierCurveTo(30, 110, 130, 140, 200, 110);
    ctx.bezierCurveTo(150, 80, 80, 30, 20, 12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(40, -5);
    ctx.lineTo(95, -25);
    ctx.lineTo(105, 0);
    ctx.lineTo(95, 25);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  drawEagle(-2, 'rgba(255, 235, 170, 0.75)');
  drawEagle(0, '#6a3e0a');

  ctx.strokeStyle = 'rgba(255, 235, 170, 0.5)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    ctx.beginPath();
    ctx.moveTo(0 + t * 30, -10 - t * 30);
    ctx.lineTo(40 + t * 130, -120 - t * 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0 + t * 25, 10 + t * 20);
    ctx.lineTo(30 + t * 120, 80 + t * 20);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = '#5a3408';
  ctx.font = 'bold 30px "Trajan Pro", "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E',        cx - 200, cy - 80);
  ctx.font = 'bold 26px "Trajan Pro", "Times New Roman", serif';
  ctx.fillText('PLURIBUS', cx - 200, cy - 40);
  ctx.fillText('UNUM',     cx - 200, cy);

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

  return texFromCanvas(c);
}

export function build(opts = {}) {
  const r = 0.78, h = 0.16;
  const faceTex = buildFaceTexture();

  const sideMat = new THREE.MeshStandardMaterial({
    color: 0xc88a28, metalness: 0.95, roughness: 0.32
  });
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex, metalness: 0.9, roughness: 0.32
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe8b04a, metalness: 1.0, roughness: 0.25
  });

  const torus = new THREE.TorusGeometry(r, h * 0.5, 12, 80);
  torus.rotateX(Math.PI / 2);

  return {
    parts: [
      {
        name: 'body',
        geometry: new THREE.CylinderGeometry(r, r, h, 64),
        material: [sideMat, faceMat, faceMat],
        offset: [0, 0, 0]
      },
      {
        name: 'rim',
        geometry: torus,
        material: rimMat,
        offset: [0, 0, 0]
      }
    ]
  };
}

export const shaderParams = {
  spinRate: 1.2,
  bobHeight: 0.05
};
