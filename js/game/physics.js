/**
 * APPLYKO - Physics & Collision System
 * Responsible for:
 *  - Peg initialization
 *  - Ball movement & wall bounces
 *  - Peg collisions
 *  - Bucket resolution & scoring
 *
 * This module should remain pure of DOM manipulation.
 */

import { WIDTH, HEIGHT, PEG_ROWS, PEG_RADIUS, BALL_RADIUS, multipliers } from '../config.js';
import { getCurrentPhysics } from './physics-settings.js';

// Internal board state
let pegs = [];

// Simple wind system
let wind = 0;
let lastWindChange = 0;

// Performance safety caps
const MAX_ACTIVE_BALLS = 12;   // including mini-balls from splitters
const MAX_PARTICLES = 48;      // tighter for 1720×1450 / 2560 displays

function updateWind() {
    const now = Date.now();
    if (now - lastWindChange > 3800) { // change every ~4 seconds
        wind = (Math.random() - 0.5) * 0.9; // -0.45 to +0.45
        lastWindChange = now;
    }
    // slowly decay wind
    wind *= 0.985;
}

export function initPegs(desiredRows = null) {
    pegs = [];

    const numRows = Math.max(8, Math.min(28, desiredRows || PEG_ROWS));
    currentRowCount = numRows; // track for external queries

    // Base layout (tuned for 15 rows on tall 1720x1450 board)
    let topMargin = 135;
    const horizontalPadding = 100;
    const spacingX = 98;
    let spacingY = 84;

    // === IMPORTANT: Keep pegs out of the output/exit zone ===
    // The bottom colored slots are the "output ball exits".
    // We want a clean drop zone with no pegs once balls enter the payout area.
    const bucketTop = HEIGHT - 165;           // Physics scoring line
    const minClearanceBelowLastPeg = 52;      // Space for balls to fall cleanly into slots
    const maxAllowedLastPegY = bucketTop - minClearanceBelowLastPeg;

    // Dynamic vertical compression for endless/progressive mode.
    if (numRows > 15) {
        const extra = numRows - 15;
        spacingY = Math.max(58, Math.round(spacingY * (1 - extra * 0.021)));
        topMargin = Math.max(70, 135 - Math.floor(extra * 2.8));
    }

    // Calculate actual spacing so the last peg row never enters the output zone
    if (numRows > 1) {
        const requiredSpacing = (maxAllowedLastPegY - topMargin) / (numRows - 1);
        if (requiredSpacing < spacingY) {
            spacingY = Math.max(52, requiredSpacing); // hard floor to avoid pegs getting too cramped
        }
    }

    for (let row = 0; row < numRows; row++) {
        const y = topMargin + row * spacingY;
        const offset = (row % 2) * (spacingX / 2);
        const startX = horizontalPadding + offset;

        for (let x = startX; x < WIDTH - horizontalPadding; x += spacingX) {
            // Variable peg properties: top rows bouncier, bottom rows stickier
            const rowFactor = numRows > 1 ? (row / (numRows - 1)) : 0;
            const pegBounce = 0.92 - (rowFactor * 0.35);

            // Assign special types occasionally.
            // Slightly lower special density on very tall boards to avoid chaos.
            let type = 'normal';
            const rand = Math.random();
            const specialChance = numRows > 20 ? 0.11 : 0.15;
            if (rand < 0.05) type = 'magnet';
            else if (rand < 0.09) type = 'splitter';
            else if (rand < specialChance) type = 'multiplier';

            pegs.push({ 
                x, 
                y,
                bounce: Math.max(0.55, pegBounce),
                type,
                row,
                activatedUntil: 0,   // for chain reactions / glow
                glowColor: null
            });
        }
    }
    return pegs;
}

// Internal tracking for current board height
let currentRowCount = PEG_ROWS;

export function getCurrentRowCount() {
    return currentRowCount;
}

export function getBucketIndex(ballX) {
    const bucketWidth = WIDTH / multipliers.length;
    let idx = Math.floor(ballX / bucketWidth);
    return Math.max(0, Math.min(multipliers.length - 1, idx));
}

/**
 * Runs one physics step on the provided game state.
 * Mutates state.balls, state.particles, state.floatingTexts, state.balance
 */
export function updatePhysics(state, onWin, onPegHit = () => {}) {
    const { balls, particles, floatingTexts, bet } = state;

    // --- BALL PHYSICS ---
    const phys = getCurrentPhysics();
    updateWind();   // once per frame, not per ball

    for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];

        // Safety clamp for extreme presets (prevents "Jupiter" from making balls fall through the floor instantly)
        const safeGravity = Math.min(phys.gravity, 0.32);

        b.vy += safeGravity;
        b.vx *= phys.damping;
        b.vy *= phys.damping;

        // Apply wind
        b.vx += wind * 0.035;

        b.x += b.vx;
        b.y += b.vy;

        // Trail
        b.trail = b.trail || [];
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 5) b.trail.shift();

        // Wall bounces
        const br = b.radius || BALL_RADIUS;
        const safeBounce = Math.max(0.5, Math.min(0.98, phys.bounce));

        if (b.x < br + 20) {
            b.x = br + 20;
            b.vx = Math.abs(b.vx) * safeBounce;
            if (onPegHit) onPegHit(0.55);
        }
        if (b.x > WIDTH - br - 20) {
            b.x = WIDTH - br - 20;
            b.vx = -Math.abs(b.vx) * safeBounce;
            if (onPegHit) onPegHit(0.55);
        }

        // Peg collisions
        const ballRadius = b.radius || BALL_RADIUS;

        for (let p = 0; p < pegs.length; p++) {
            const peg = pegs[p];
            const dx = b.x - peg.x;
            const dy = b.y - peg.y;
            const distSq = dx * dx + dy * dy;
            const minDist = ballRadius + PEG_RADIUS + 0.5;

            if (distSq < minDist * minDist && distSq > 0.0001) {
                const dist = Math.sqrt(distSq);
                const nx = dx / dist;
                const ny = dy / dist;

                const overlap = minDist - dist;
                b.x += nx * overlap * 0.9;
                b.y += ny * overlap * 0.9;

                const dot = b.vx * nx + b.vy * ny;
                const pegBounce = Math.max(0.5, Math.min(0.98, peg.bounce ?? phys.bounce));
                b.vx = (b.vx - 2 * dot * nx) * pegBounce;
                b.vy = (b.vy - 2 * dot * ny) * pegBounce;

                b.vx += (Math.random() - 0.5) * 0.6;
                b.vy += (Math.random() - 0.5) * 0.3;

                // === Special Peg Behaviors ===
                const now = Date.now();

                if (peg.type === 'magnet') {
                    // Pull the ball toward the peg
                    const pull = 0.8;
                    b.vx += (peg.x - b.x) * 0.0008 * pull;
                    b.vy += (peg.y - b.y) * 0.0008 * pull;
                    peg.activatedUntil = now + 300;
                    peg.glowColor = '#f472b6';
                }

                if (peg.type === 'splitter') {
                    // Mini balls have much lower chance to trigger splitters (prevents explosion)
                    const isMini = b.isMini === true;
                    const spawnChance = isMini ? 0.12 : 0.32;

                    if (Math.random() < spawnChance) {
                        const cooldown = isMini ? 420 : 260;
                        const canSplit = !peg.lastSplit || (now - peg.lastSplit) > cooldown;

                        if (canSplit && state.balls && state.balls.length < MAX_ACTIVE_BALLS) {
                            state.balls.push({
                                x: peg.x,
                                y: peg.y - 8,
                                vx: (Math.random() - 0.5) * 3.2,
                                vy: -1.6 - Math.random() * 1.0,
                                trail: [],
                                radius: 5.5,
                                isMini: true
                            });
                            peg.lastSplit = now;
                        }
                    }

                    peg.activatedUntil = now + 380;
                    peg.glowColor = '#fbbf24';
                }

                if (peg.type === 'multiplier') {
                    // Temporary score boost for this hit — much more conservative
                    let tm = (state._tempMultiplier || 1) * 1.4;
                    state._tempMultiplier = Math.min(tm, 20); // lowered cap
                    peg.activatedUntil = now + 600;
                    peg.glowColor = '#34d399';
                }

                // Chain reaction bonus — much more conservative
                if (peg.activatedUntil && now < peg.activatedUntil && peg.type !== 'normal') {
                    let cb = (state._chainBonus || 1) + 0.35;
                    state._chainBonus = Math.min(cb, 8); // significantly lowered cap
                    state._chainBonusUntil = now + 1000;
                }

                // Chain reaction glow
                if (peg.type !== 'normal' || Math.random() < 0.25) {
                    peg.activatedUntil = now + 450;
                    if (!peg.glowColor) peg.glowColor = '#a5b4fc';
                }

                // Light hit particles - very conservative when load is high
                let particleChance = 0.35;
                const ballCount = state.balls ? state.balls.length : 0;
                const entityLoad = ballCount + (state.particles ? state.particles.length / 10 : 0);

                if (entityLoad > 12) {
                    particleChance = 0.08;
                } else if (ballCount >= 4) {
                    particleChance = 0.15;
                }

                if (Math.random() < particleChance && state.particles && state.particles.length < MAX_PARTICLES) {
                    state.particles.push({
                        x: peg.x, y: peg.y,
                        vx: (Math.random() - 0.5) * 2,
                        vy: (Math.random() - 0.5) * 2 - 0.5,
                        life: 16 + Math.random() * 8,
                        color: '#a1a1aa',
                        size: 1.6 + Math.random() * 1.0
                    });
                }

                // Audio callback for peg hits
                if (onPegHit) onPegHit(1.0);
            }
        }

        // Bottom buckets
        const bucketTop = HEIGHT - 165;
        if (b.y > bucketTop) {
            const idx = getBucketIndex(b.x);
            let mult = multipliers[idx];

            // Progressive / Endless scaling (much more conservative now)
            if (state._multiplierScale) {
                mult = mult * (1 + state._multiplierScale * 0.5);
            }

            // Apply temporary bonuses from special pegs / chains
            if (state._tempMultiplier) mult *= state._tempMultiplier;
            if (state._chainBonus && Date.now() < (state._chainBonusUntil || 0)) {
                mult *= state._chainBonus;
            }

            // Final hard cap on any single win (much lower now for sane economy)
            mult = Math.min(mult, 40);

            const winnings = Math.floor(bet * mult);

            state.balance += winnings;
            if (onWin) onWin(b.x, bucketTop, winnings, mult);

            balls.splice(i, 1);

            // Clear one-time bonuses after scoring
            delete state._tempMultiplier;
            if (Date.now() > (state._chainBonusUntil || 0)) {
                delete state._chainBonus;
            }

            continue;
        }

        if (b.y > HEIGHT + 80) {
            balls.splice(i, 1);
        }
    }

    // --- PARTICLES ---
    if (particles.length > MAX_PARTICLES) {
        particles.length = MAX_PARTICLES;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= 1;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // --- FLOATING TEXTS ---
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const t = floatingTexts[i];
        t.y += t.vy;
        t.vy *= 0.985;
        t.life -= 1;
        t.alpha = Math.max(0, t.life / 68);
        if (t.life <= 0) floatingTexts.splice(i, 1);
    }

    return state;
}

export { pegs, multipliers, wind };