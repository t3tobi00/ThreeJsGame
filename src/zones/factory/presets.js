// Factory Zone — mesh presets (extracted from MeshPresetsDiorama.js)
// Side-effect import: registers factory ground preset into MeshPresets.
//
// Only pad-factory remains. Building + props deleted.

import * as THREE from 'three';
import MeshPresets from '../../core/MeshPresets.js';
import { yawToCamera } from '../../utils/FaceCamera.js';

// ---------------------------------------------------------------------------
// Shared helpers (duplicated from MeshPresetsDiorama — kept local)
// ---------------------------------------------------------------------------

function groundPad(width, depth, mat) {
    const geo = new THREE.PlaneGeometry(width, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
}

// ---------------------------------------------------------------------------
// dio-pad-factory — industrial honeycomb metal grating
// ---------------------------------------------------------------------------

MeshPresets.register('dio-pad-factory', ({ size, width = 20, depth = 20 } = {}) => {
    const w = size ?? width;
    const d = size ?? depth;

    const S = 512;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    let _s = 77;
    const rng = () => { _s = (_s * 16807) % 2147483647; return (_s - 1) / 2147483646; };

    // ── 1. Deep void beneath the grating ──
    ctx.fillStyle = '#0d0e10';
    ctx.fillRect(0, 0, S, S);
    const underGlow = ctx.createRadialGradient(S * 0.5, S * 0.5, 0, S * 0.5, S * 0.5, S * 0.45);
    underGlow.addColorStop(0, 'rgba(30,35,25,0.15)');
    underGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = underGlow;
    ctx.fillRect(0, 0, S, S);

    // ── 2. Frame grid — 3x3 panels per tile ──
    const cols = 3, rows = 3;
    const frameW = 8;
    const panelW = (S - frameW * (cols + 1)) / cols;
    const panelH = (S - frameW * (rows + 1)) / rows;

    ctx.fillStyle = '#3a3d42';
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 1) {
        const a = 0.01 + rng() * 0.03;
        ctx.fillStyle = `rgba(200,205,210,${a})`;
        ctx.fillRect(0, y, S, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let c = 0; c <= cols; c++) ctx.fillRect(c * (panelW + frameW), 0, 2, S);
    for (let r = 0; r <= rows; r++) ctx.fillRect(0, r * (panelH + frameW), S, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let c = 0; c <= cols; c++) ctx.fillRect(c * (panelW + frameW) + frameW - 2, 0, 2, S);
    for (let r = 0; r <= rows; r++) ctx.fillRect(0, r * (panelH + frameW) + frameW - 2, S, 2);

    // ── 3. Panels with honeycomb mesh ──
    const hexR = 7;
    const spacingX = hexR * 2 * 0.82;
    const spacingY = hexR * Math.sqrt(3) * 0.88;

    function drawHex(cx, cy, r) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = Math.PI / 6 + (Math.PI / 3) * i;
            const vx = cx + r * Math.cos(a);
            const vy = cy + r * Math.sin(a);
            if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const px = frameW + c * (panelW + frameW);
            const py = frameW + r * (panelH + frameW);

            ctx.fillStyle = '#1e2024';
            ctx.fillRect(px, py, panelW, panelH);

            const tint = 22 + Math.floor(rng() * 10);
            ctx.fillStyle = `rgba(${tint},${tint + 1},${tint + 3},0.3)`;
            ctx.fillRect(px, py, panelW, panelH);

            ctx.save();
            ctx.beginPath();
            ctx.rect(px + 2, py + 2, panelW - 4, panelH - 4);
            ctx.clip();

            ctx.fillStyle = '#2a2d32';
            ctx.fillRect(px, py, panelW, panelH);

            for (let hy = py - hexR; hy < py + panelH + hexR * 2; hy += spacingY) {
                const rowIdx = Math.round((hy - py) / spacingY);
                const offX = (rowIdx % 2) * (spacingX / 2);
                for (let hx = px - hexR + offX; hx < px + panelW + hexR; hx += spacingX) {
                    drawHex(hx, hy, hexR - 3);
                    ctx.fillStyle = '#08090b';
                    ctx.fill();

                    drawHex(hx, hy, hexR - 2.5);
                    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    drawHex(hx, hy, hexR - 2);
                    ctx.strokeStyle = 'rgba(120,125,135,0.25)';
                    ctx.lineWidth = 0.8;
                    ctx.stroke();

                    if (rng() < 0.3) {
                        const gAngle = rng() * Math.PI * 2;
                        const gx = hx + Math.cos(gAngle) * (hexR - 2);
                        const gy = hy + Math.sin(gAngle) * (hexR - 2);
                        const gr = 2 + rng() * 2;
                        const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
                        gg.addColorStop(0, 'rgba(50,42,30,0.4)');
                        gg.addColorStop(1, 'rgba(50,42,30,0)');
                        ctx.fillStyle = gg;
                        ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
                    }
                }
            }
            ctx.restore();

            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px + panelW - 1, py + 3);
            ctx.lineTo(px + panelW - 1, py + panelH - 1);
            ctx.lineTo(px + 3, py + panelH - 1);
            ctx.stroke();
        }
    }

    // ── 4. Hex-head bolts at frame intersections ──
    const boltR = 4;
    for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
            const bx = c * (panelW + frameW) + frameW / 2;
            const by = r * (panelH + frameW) + frameW / 2;

            ctx.beginPath();
            ctx.arc(bx + 1, by + 1, boltR + 1, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fill();

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i;
                const vx = bx + boltR * Math.cos(a);
                const vy = by + boltR * Math.sin(a);
                if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
            }
            ctx.closePath();
            const bGrad = ctx.createRadialGradient(bx - 2, by - 2, 0, bx, by, boltR);
            bGrad.addColorStop(0, '#7a7e85');
            bGrad.addColorStop(0.5, '#55585e');
            bGrad.addColorStop(1, '#35383d');
            ctx.fillStyle = bGrad;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(bx - 1, by - 1, boltR * 0.55, Math.PI * 1.1, Math.PI * 1.8);
            ctx.strokeStyle = 'rgba(200,205,215,0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bx - 3, by); ctx.lineTo(bx + 3, by);
            ctx.moveTo(bx, by - 3); ctx.lineTo(bx, by + 3);
            ctx.stroke();

            if (rng() < 0.35) {
                ctx.beginPath();
                ctx.arc(bx, by, boltR + 2, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(160,80,25,${0.15 + rng() * 0.15})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }

    // ── 5. Rust patches ──
    for (let i = 0; i < 6; i++) {
        const rx = rng() * S, ry = rng() * S;
        const rr = 25 + rng() * 50;
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(rng() * Math.PI);
        ctx.scale(1, 0.6 + rng() * 0.8);
        const rGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
        const intensity = 0.12 + rng() * 0.18;
        rGrad.addColorStop(0, `rgba(170,85,30,${intensity})`);
        rGrad.addColorStop(0.4, `rgba(140,65,20,${intensity * 0.6})`);
        rGrad.addColorStop(0.7, `rgba(120,55,15,${intensity * 0.3})`);
        rGrad.addColorStop(1, 'rgba(120,55,15,0)');
        ctx.fillStyle = rGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, rr * 1.3, rr, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    for (let i = 0; i < 15; i++) {
        const px = rng() * S, py = rng() * S;
        const pr = 2 + rng() * 5;
        const pGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
        pGrad.addColorStop(0, `rgba(190,95,20,${0.2 + rng() * 0.2})`);
        pGrad.addColorStop(1, 'rgba(190,95,20,0)');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── 6. Oil drips & stains ──
    for (let i = 0; i < 4; i++) {
        const ox = 40 + rng() * (S - 80);
        const oy = 40 + rng() * (S - 80);
        ctx.save();
        ctx.globalAlpha = 0.18 + rng() * 0.12;
        ctx.strokeStyle = '#15171a';
        ctx.lineWidth = 4 + rng() * 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        let dx = ox, dy = oy;
        const dripLen = 20 + rng() * 40;
        for (let step = 0; step < dripLen; step += 4) {
            dx += (rng() - 0.5) * 6;
            dy += 3 + rng() * 3;
            ctx.lineTo(dx, dy);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
        const poolGrad = ctx.createRadialGradient(dx, dy, 0, dx, dy, 8 + rng() * 6);
        poolGrad.addColorStop(0, 'rgba(18,20,24,0.3)');
        poolGrad.addColorStop(1, 'rgba(18,20,24,0)');
        ctx.fillStyle = poolGrad;
        ctx.fillRect(dx - 15, dy - 15, 30, 30);
    }

    // ── 7. Scratch marks ──
    ctx.strokeStyle = 'rgba(90,95,105,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        const sx = rng() * S, sy = rng() * S;
        const len = 15 + rng() * 40;
        const angle = rng() * Math.PI;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
        ctx.stroke();
    }

    // ── 8. Dust accumulation in corners ──
    for (const [cx, cy] of [[0, 0], [S, 0], [0, S], [S, S]]) {
        const dGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70);
        dGrad.addColorStop(0, 'rgba(55,48,35,0.12)');
        dGrad.addColorStop(1, 'rgba(55,48,35,0)');
        ctx.fillStyle = dGrad;
        ctx.fillRect(cx - 70, cy - 70, 140, 140);
    }

    // ── Texture setup ──
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(w / 10, d / 10);
    const mat = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.5, metalness: 0.5
    });
    const pad = groundPad(w, d, mat);
    const group = new THREE.Group();
    group.add(pad);
    yawToCamera(group);
    return group;
});
