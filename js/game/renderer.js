/**
 * APPLYKO - Rendering System
 * Owns all Canvas drawing:
 *  - Cached Imagine board background
 *  - Multiplier buckets
 *  - Pegs (sprite + procedural fallback)
 *  - Balls + trails (sprite + fallback)
 *  - Particles + soft jackpot burst stamps
 *  - Floating win text
 *
 * Perf notes: avoid ctx.shadowBlur (very expensive on large canvases);
 * board is pre-composited once in assets.boardCache.
 */

import { WIDTH, HEIGHT, PEG_RADIUS, BALL_RADIUS, multipliers } from '../config.js';
import { pegs, wind } from './physics.js';
import { assets, pegSpriteForType, buildBoardCache } from './assets.js';

let ctx = null;

export function initRenderer(canvasContext) {
    ctx = canvasContext;
    ctx.imageSmoothingEnabled = true;
    // medium is much cheaper than high on 1720×1450
    ctx.imageSmoothingQuality = 'medium';
}

function ensureBoardCache() {
    if (!assets.boardCache && assets.boardBg) {
        buildBoardCache(WIDTH, HEIGHT);
    }
}

function drawBoardBackground() {
    ensureBoardCache();

    if (assets.boardCache) {
        ctx.drawImage(assets.boardCache, 0, 0);
        // Cheap neon lip (no full-frame gradients every frame)
        ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
        ctx.fillRect(0, 0, WIDTH, 6);
        ctx.fillStyle = 'rgba(96, 165, 250, 0.08)';
        ctx.fillRect(0, HEIGHT - 6, WIDTH, 6);
        return;
    }

    // Procedural fallback
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, '#111113');
    grad.addColorStop(1, '#0a0a0b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawSpriteCentered(sprite, x, y, size, alpha = 1) {
    if (!sprite) return false;
    if (alpha < 1) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
        ctx.globalAlpha = prev;
    } else {
        ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
    return true;
}

function drawBucketGlass(x, bucketY, bucketW, bucketHeight, color, m, bet) {
    // Flat fill (gradients per bucket every frame is costly)
    ctx.fillStyle = color;
    ctx.fillRect(x, bucketY, bucketW - 1, bucketHeight);

    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x + 2, bucketY + 2, bucketW - 5, 8);

    if (m >= 5) {
        ctx.strokeStyle = m >= 8 ? 'rgba(134, 239, 172, 0.5)' : 'rgba(253, 224, 71, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 4, bucketY + 1);
        ctx.lineTo(x + bucketW - 5, bucketY + 1);
        ctx.stroke();
    }

    ctx.fillStyle = (m >= 8) ? '#86efac' : (m >= 1.8 ? '#fde047' : '#d1d5db');
    ctx.font = '600 24px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${m}×`, x + bucketW / 2, bucketY + 42);

    ctx.font = '500 15px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(`$${Math.floor((bet || 25) * m)}`, x + bucketW / 2, bucketY + 65);
}

export function draw(state) {
    if (!ctx) return;

    const { balls = [], particles = [], floatingTexts = [], burstFX = [] } = state;
    // Date.now() must match physics (peg.activatedUntil); performance.now() only for cheap animation phase
    const now = Date.now();
    const animT = performance.now();

    // Opaque clear — faster than clearRect + transparent composite on large boards
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawBoardBackground();

    // === Wind Arrows (top) - animated ===
    if (Math.abs(wind) > 0.015) {
        const t = animT / 180;
        const dir = wind > 0 ? 1 : -1;
        const strength = Math.min(Math.abs(wind) * 42, 62);

        ctx.strokeStyle = dir > 0 ? '#f472b6' : '#60a5fa';
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = Math.min(0.9, Math.abs(wind) * 2.1 + 0.15);

        const arrowY = 26;
        for (let i = 0; i < 6; i++) {
            const ax = 120 + i * 260 + (Math.sin(t + i) * 8 * dir);
            ctx.beginPath();
            ctx.moveTo(ax - (dir * 12), arrowY);
            ctx.lineTo(ax + (dir * strength), arrowY);
            ctx.lineTo(ax + (dir * (strength - 10)), arrowY - 4);
            ctx.moveTo(ax + (dir * strength), arrowY);
            ctx.lineTo(ax + (dir * (strength - 10)), arrowY + 4);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // Aim bias indicator
    const aim = state.aimOffset || 0;
    if (Math.abs(aim) > 0.04) {
        const aimX = WIDTH / 2 + aim * 95;
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(WIDTH / 2, 58);
        ctx.lineTo(aimX, 115);
        ctx.stroke();

        ctx.fillStyle = 'rgba(196, 181, 253, 0.7)';
        ctx.beginPath();
        ctx.moveTo(aimX, 115);
        ctx.lineTo(aimX - (aim > 0 ? 5 : -5), 108);
        ctx.lineTo(aimX - (aim > 0 ? 5 : -5), 122);
        ctx.fill();
    }

    // Bottom multiplier buckets
    const bucketHeight = 115;
    const bucketY = HEIGHT - bucketHeight;
    const bucketW = WIDTH / multipliers.length;

    for (let i = 0; i < multipliers.length; i++) {
        const x = i * bucketW;
        const m = multipliers[i];

        let color = '#3f3f46';
        if (m >= 8) color = '#14532d';
        else if (m >= 3) color = '#713f12';
        else if (m >= 1.8) color = '#3f3f46';
        else color = '#27272a';

        drawBucketGlass(x, bucketY, bucketW, bucketHeight, color, m, state.bet);
    }

    // Pegs — no shadowBlur (major GPU cost on 1720×1450)
    for (const peg of pegs) {
        let color = '#e4e4e7';
        let size = PEG_RADIUS;
        let glow = false;
        let drawExtra = null;
        let spriteSize = PEG_RADIUS * 2.6;

        if (peg.activatedUntil && now < peg.activatedUntil) {
            glow = true;
            color = peg.glowColor || '#a5b4fc';
            size = PEG_RADIUS * 1.2;
            spriteSize = PEG_RADIUS * 3.4;
        } else if (peg.type === 'magnet') {
            color = '#f472b6';
            drawExtra = 'magnet';
            spriteSize = PEG_RADIUS * 4.2;
        } else if (peg.type === 'splitter') {
            color = '#fbbf24';
            drawExtra = 'splitter';
            spriteSize = PEG_RADIUS * 4.2;
        } else if (peg.type === 'multiplier') {
            color = '#34d399';
            drawExtra = 'multiplier';
            spriteSize = PEG_RADIUS * 4.2;
        }

        const sprite = pegSpriteForType(peg.type);

        // Cheap activated pulse: soft disc under peg (no shadowBlur)
        if (glow) {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, size + 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        const drew = drawSpriteCentered(sprite, peg.x, peg.y, spriteSize, glow ? 1 : 0.95);
        if (!drew) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, size, 0, Math.PI * 2);
            ctx.fill();

            if (drawExtra) {
                ctx.fillStyle = '#fff';
                if (drawExtra === 'magnet') {
                    ctx.fillRect(peg.x - 1.5, peg.y - 7, 3, 14);
                    ctx.fillRect(peg.x - 4, peg.y - 4, 8, 3);
                }
                if (drawExtra === 'splitter') {
                    ctx.fillRect(peg.x - 4, peg.y - 1, 8, 2);
                    ctx.fillRect(peg.x - 1, peg.y - 4, 2, 8);
                }
                if (drawExtra === 'multiplier') {
                    ctx.beginPath();
                    ctx.moveTo(peg.x, peg.y - 5);
                    ctx.lineTo(peg.x + 1.5, peg.y - 1.5);
                    ctx.lineTo(peg.x + 5, peg.y - 1.5);
                    ctx.lineTo(peg.x + 2, peg.y + 1);
                    ctx.lineTo(peg.x + 3, peg.y + 5);
                    ctx.lineTo(peg.x, peg.y + 2.5);
                    ctx.lineTo(peg.x - 3, peg.y + 5);
                    ctx.lineTo(peg.x - 2, peg.y + 1);
                    ctx.lineTo(peg.x - 5, peg.y - 1.5);
                    ctx.lineTo(peg.x - 1.5, peg.y - 1.5);
                    ctx.fill();
                }
            }
        }
    }

    // Balls + trails
    for (const b of balls) {
        const trail = b.trail || [];
        if (trail.length > 1) {
            const trailColor = b.isMini
                ? 'rgba(253, 224, 71, 0.38)'
                : 'rgba(192, 132, 252, 0.4)';
            ctx.strokeStyle = trailColor;
            ctx.lineWidth = b.isMini ? 2.4 : 3.4;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let t = 0; t < trail.length; t++) {
                const p = trail[t];
                if (t === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }

        const br = b.radius || BALL_RADIUS;
        const ballSprite = b.isMini ? assets.ballMini : assets.ballNormal;
        const spriteSize = br * 2.85;

        // Soft halo without shadowBlur
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = b.isMini ? '#fde047' : '#c084fc';
        ctx.beginPath();
        ctx.arc(b.x, b.y, br + 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        const drew = assets.ready && drawSpriteCentered(ballSprite, b.x, b.y, spriteSize);

        if (!drew) {
            ctx.fillStyle = b.isMini ? '#fde047' : '#c084fc';
            ctx.beginPath();
            ctx.arc(b.x, b.y, br, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.beginPath();
            ctx.arc(b.x - 3.5, b.y - 3.5, br * 0.38, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Particles (batch color changes loosely)
    for (const p of particles) {
        ctx.globalAlpha = Math.max(0.12, p.life / 45);
        ctx.fillStyle = p.color || '#a1a1aa';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Soft Imagine jackpot bursts (additive + pre-masked circular stamps)
    if (burstFX.length && assets.ready && assets.burstStamps.length) {
        const prevComp = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighter';
        for (const fx of burstFX) {
            const stamp = assets.burstStamps[fx.stampIndex % assets.burstStamps.length];
            const lifeT = Math.max(0, fx.life / fx.maxLife);
            // Ease out alpha so the mask edge never hard-cuts at end of life
            const alpha = lifeT * lifeT * 0.9;
            ctx.globalAlpha = alpha;
            const size = fx.size * (1.05 + (1 - lifeT) * 0.35);
            const rot = fx.rot || 0;
            if (rot) {
                ctx.save();
                ctx.translate(fx.x, fx.y);
                ctx.rotate(rot);
                ctx.drawImage(stamp, -size / 2, -size / 2, size, size);
                ctx.restore();
            } else {
                ctx.drawImage(stamp, fx.x - size / 2, fx.y - size / 2, size, size);
            }
        }
        ctx.globalCompositeOperation = prevComp;
        ctx.globalAlpha = 1;
    }

    // Floating win texts — no shadowBlur
    ctx.textAlign = 'center';
    for (const t of floatingTexts) {
        ctx.globalAlpha = t.alpha ?? 1;
        ctx.fillStyle = t.color || '#fff';

        let displayText = t.text;
        const match = t.text.match(/^\+\$?([\d.]+)/);
        if (match) {
            const num = parseFloat(match[1]);
            if (num >= 1_000_000_000) {
                displayText = `+$${(num / 1_000_000_000).toFixed(2)}B`;
            } else if (num >= 1_000_000) {
                displayText = `+$${(num / 1_000_000).toFixed(1)}M`;
            } else if (num >= 10_000) {
                displayText = `+$${(num / 1000).toFixed(0)}k`;
            }
        }

        ctx.font = '700 32px Inter, system-ui, sans-serif';
        ctx.fillText(displayText, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
}
