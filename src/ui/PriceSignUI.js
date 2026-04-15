/**
 * PriceSignUI — Paints the canvas of a stall's price-sign mesh with a
 * single bold headline formed from the product price and label.
 *
 * The sign mesh is built blank by `mkt-price-sign`; call
 * `PriceSignUI.bind(stallMesh, "Zombie Candy", 3)` once per stall after
 * the entity is constructed. The sign re-paints only on bind.
 *
 * The output is deliberately austere: one centered headline reads
 * "$3 Zombie Candy" in a heavy condensed display face, with a chunky
 * ink outline for contrast against the cream card. No ribbon, no
 * secondary label, no tagline — everything a passerby needs is the
 * price and the product name.
 */

const PriceSignUI = {
    bind(stallMesh, productLabel, price, options = {}) {
        const sign = stallMesh && stallMesh.userData && stallMesh.userData.priceSignMesh;
        if (!sign) {
            console.warn('PriceSignUI.bind: stall mesh has no priceSignMesh anchor');
            return;
        }
        const canvas  = sign.userData.canvas;
        const texture = sign.userData.texture;
        if (!canvas || !texture) return;

        const inkColor     = options.inkColor     || '#1a1208';
        const cardColor    = options.cardColor    || '#fff7d6';
        const accentColor  = options.accentColor  || '#e0383a';
        const textColor    = options.textColor    || '#ffffff';
        const outlineWidth = options.outlineWidth || 14;
        const borderWidth  = options.borderWidth  || 18;

        const ctx = canvas.getContext('2d');
        ctx.save();

        // Logical 512×256 coordinate system — preset-side canvas can be
        // any size (currently 1024×512 for retina sharpness) without
        // touching the drawing math below.
        const LOGICAL_W = 512;
        const LOGICAL_H = 256;
        const sx = canvas.width  / LOGICAL_W;
        const sy = canvas.height / LOGICAL_H;
        ctx.scale(sx, sy);
        const W = LOGICAL_W;
        const H = LOGICAL_H;

        // ── 1. Card backdrop ──
        ctx.fillStyle = cardColor;
        ctx.fillRect(0, 0, W, H);

        // Chunky outer border — frames the headline.
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = borderWidth;
        const inset = borderWidth / 2;
        ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);

        // A thin accent bar along the bottom edge for brand color.
        ctx.fillStyle = accentColor;
        const barH = 10;
        ctx.fillRect(borderWidth, H - borderWidth - barH, W - borderWidth * 2, barH);

        // ── 2. Headline ──
        const headline = `$${price} ${productLabel || 'Product'}`;
        const maxTextW = W - borderWidth * 2 - 24;
        const baselineY = H / 2 + 4;

        // Heavy condensed display face. 'Impact' is narrow + tall which
        // lets a long string like "$3 Zombie Candy" fit at a big size.
        ctx.font = '900 108px "Impact","Arial Black","Oswald",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';

        // Outline (stroke) for contrast against any background.
        ctx.lineWidth = outlineWidth;
        ctx.strokeStyle = inkColor;
        ctx.strokeText(headline, W / 2, baselineY, maxTextW);

        // Fill.
        ctx.fillStyle = textColor;
        ctx.fillText(headline, W / 2, baselineY, maxTextW);

        ctx.restore();
        texture.needsUpdate = true;
    }
};

export default PriceSignUI;
