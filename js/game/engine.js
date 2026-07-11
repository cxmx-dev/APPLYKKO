/**
 * APPLYKO - Game Engine
 * Owns the main game loop, state, and high-level coordination between
 * physics, rendering, and input.
 */

import { initRenderer, draw } from './renderer.js';
import { initPegs, updatePhysics } from './physics.js';
import { WIDTH, HEIGHT } from '../config.js';
import { state } from './state.js';
import { initBettingControls, updateBalanceUI, getSelectedBallCount } from '../ui/betting.js';
import * as Audio from '../audio/audio-manager.js';
import { loadAssets, assets, buildBoardCache } from './assets.js';

let canvas = null;
let animationFrame = null;

let dropBtn = null;
let autoBtn = null;

/**
 * Fit the fixed-resolution board into the canvas-stage (or viewport) on any device.
 * Keeps internal WIDTH×HEIGHT; only CSS size changes so physics stay consistent.
 */
function maximizeCanvasSize() {
    if (!canvas) return;

    const stage = canvas.closest('.canvas-stage') || canvas.parentElement;
    let maxW = window.innerWidth;
    let maxH = window.innerHeight;
    if (stage) {
        const r = stage.getBoundingClientRect();
        if (r.width > 40) maxW = r.width;
        if (r.height > 40) maxH = r.height;
    }

    maxW = Math.max(80, maxW - 4);
    maxH = Math.max(80, maxH - 4);

    if (window.DeviceProfile && typeof window.DeviceProfile.fitCanvas === 'function') {
        window.DeviceProfile.fitCanvas(canvas, {
            width: WIDTH,
            height: HEIGHT,
            maxW,
            maxH,
            pad: 0,
            allowUpscale: true
        });
        return;
    }

    const scale = Math.min(maxW / WIDTH, maxH / HEIGHT);
    canvas.style.width = Math.floor(WIDTH * scale) + 'px';
    canvas.style.height = Math.floor(HEIGHT * scale) + 'px';
}

/**
 * Called when a ball lands in a bucket (from physics)
 */
function spawnBurstFX(x, y, multiplier) {
    if (!assets.ready || !assets.burstStamps.length) return;
    if (!state.burstFX) state.burstFX = [];

    // Cap concurrent bursts for performance
    if (state.burstFX.length >= 6) return;

    const count = multiplier >= 8 ? 2 : 1;
    for (let i = 0; i < count; i++) {
        const maxLife = 22 + Math.floor(Math.random() * 12);
        state.burstFX.push({
            x: x + (Math.random() - 0.5) * 40,
            y: y + (Math.random() - 0.5) * 20,
            size: 100 + multiplier * 8 + Math.random() * 28,
            life: maxLife,
            maxLife,
            stampIndex: Math.floor(Math.random() * assets.burstStamps.length),
            rot: Math.random() * Math.PI * 2,
            rotV: (Math.random() - 0.5) * 0.04,
        });
    }
}

function updateBurstFX() {
    if (!state.burstFX || !state.burstFX.length) return;
    for (let i = state.burstFX.length - 1; i >= 0; i--) {
        const fx = state.burstFX[i];
        fx.life -= 1;
        fx.y -= 0.3;
        fx.size *= 1.01;
        if (fx.rotV) fx.rot = (fx.rot || 0) + fx.rotV;
        if (fx.life <= 0) state.burstFX.splice(i, 1);
    }
}

function onBallWin(x, y, winnings, multiplier) {
    const winColor = multiplier >= 8 ? '#22c55e' : (multiplier >= 1.8 ? '#eab308' : '#f97316');

    // Audio - tiered win sound
    Audio.playWin(multiplier);

    // Imagine jackpot VFX on meaningful hits
    if (multiplier >= 1.4) {
        spawnBurstFX(x, y, multiplier);
    }

    // Create particles at landing zone — keep light for high-res boards
    const ballCount = state.balls ? state.balls.length : 0;
    let winParticleCount = 8 + Math.floor(multiplier * 0.4);

    if (ballCount >= 3) {
        winParticleCount = Math.floor(winParticleCount * 0.45);
    }

    for (let i = 0; i < winParticleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 2.8;
        state.particles.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y + 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.2,
            life: 32 + Math.random() * 18,
            color: winColor,
            size: 2.2 + Math.random() * 2.0
        });
    }

    // Floating win text
    state.floatingTexts.push({
        x,
        y: y + 10,
        text: `+$${winnings.toLocaleString()}`,
        color: winColor,
        vy: -2.6,
        life: 72,
        alpha: 1
    });
}

function updateAutoDrop() {
    if (!state.isAutoDropping) return;

    if (state.balls.length < 3 && Math.random() < 0.035) {
        if (state.balance >= state.bet * 4) {
            dropBalls();
        } else {
            // Stop auto if we can't afford more drops
            state.isAutoDropping = false;
            if (autoBtn) {
                autoBtn.textContent = "AUTO";
                autoBtn.style.backgroundColor = "#27272a";
            }
        }
    }
}

export function dropBalls(numBalls = 4) {
    Audio.initAudioOnUserGesture(); // Ensure audio context is awake

    // Hard cap at 5. 3–4 balls is strongly recommended for performance and clean audio.
    numBalls = Math.max(1, Math.min(5, Math.floor(numBalls)));
    const totalCost = state.bet * numBalls;

    // Reset special peg bonuses at the start of each drop sequence
    delete state._tempMultiplier;
    delete state._chainBonus;
    delete state._chainBonusUntil;

    if (state.balance < totalCost) {
        alert("Not enough balance!");
        return;
    }

    state.balance -= totalCost;

    // Progressive / Endless mode progression
    if (state.endlessMode) {
        state.dropsCompleted = (state.dropsCompleted || 0) + 1;

        if (state.dropsCompleted % 6 === 0 && (state.currentRows || 15) < 26) {
            state.currentRows = (state.currentRows || 15) + 1;
            // Rebuild pegs with more rows (now actually works)
            initPegs(state.currentRows);

            // Make multipliers more extreme in endless mode (slower growth)
            if (state.currentRows > 18) {
                state._multiplierScale = (state.currentRows - 15) * 0.06; // was 0.12
            }

            // Note: endless status label in betting UI will reflect on next interaction
            // (or we can expose a refresh function later)
        }
    }

    for (let i = 0; i < numBalls; i++) {
        const spread = (i - (numBalls - 1) / 2) * 18;
        const aimInfluence = (state.aimOffset || 0) * 2.8; // horizontal bias from aiming
        state.balls.push({
            x: WIDTH / 2 + spread,
            y: 62,
            vx: (Math.random() - 0.5) * 1.8 + spread * 0.035 + aimInfluence,
            vy: 2.8 + Math.random() * 0.9,
            trail: []
        });
    }

    state.aimOffset = 0; // reset after drop

    // Audio - satisfying drop sound (quieter when dropping many balls)
    const bounceIntensity = numBalls >= 4 ? 3.8 : 5.5;
    Audio.playBounce(bounceIntensity);

    // Drop burst particles - keep very low when using 4+ balls
    const particleCount = (numBalls <= 3) ? 8 : 2;

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 2.5;
        state.particles.push({
            x: WIDTH / 2,
            y: 68,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.8,
            life: 26 + Math.random() * 14,
            color: '#c084fc',
            size: 2.5 + Math.random() * 1.8
        });
    }
}

export function toggleAutoDrop() {
    Audio.initAudioOnUserGesture();

    state.isAutoDropping = !state.isAutoDropping;

    if (autoBtn) {
        autoBtn.textContent = state.isAutoDropping ? "STOP" : "AUTO";
        autoBtn.style.backgroundColor = state.isAutoDropping ? "#10b981" : "#27272a";
    }

    if (state.isAutoDropping && state.balls.length === 0) {
        dropBalls();
    }
}

let _lastBalanceUI = null;

function gameLoop() {
    // Run physics (this also updates particles & floating texts)
    updatePhysics(state, onBallWin, Audio.playPegHit);
    updateBurstFX();

    // Auto drop logic
    updateAutoDrop();

    // DOM only when balance actually changes (avoids layout thrash every frame)
    if (state.balance !== _lastBalanceUI) {
        _lastBalanceUI = state.balance;
        updateBalanceUI(state.balance);
    }

    // Render everything
    draw(state);

    animationFrame = requestAnimationFrame(gameLoop);
}

export async function initGame() {
    canvas = document.getElementById('canvas');
    // desynchronized + opaque path: less compositor work on large boards
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
        || canvas.getContext('2d', { alpha: false })
        || canvas.getContext('2d');

    initRenderer(ctx);

    // Imagine dazzle pack (board, sprites, win VFX) — non-blocking fallback if missing
    document.body?.classList.add('applyko-loading');
    await loadAssets();
    // Pre-bake board cache after assets (one-time full-res composite)
    if (assets.ready && assets.boardBg) {
        buildBoardCache(WIDTH, HEIGHT);
    }
    document.body?.classList.remove('applyko-loading');
    document.body?.classList.add('applyko-ready');

    // Initialize pegs (stored inside physics module)
    initPegs(state.currentRows || undefined);

    // Cache UI elements
    dropBtn = document.getElementById('drop-btn');
    autoBtn = document.getElementById('auto-btn');

    // Wire core buttons
    if (dropBtn) {
        dropBtn.addEventListener('click', () => {
            const count = getSelectedBallCount();
            dropBalls(count);
        });
    }
    if (autoBtn) {
        autoBtn.addEventListener('click', toggleAutoDrop);
    }

    // Initialize betting UI (quick bets + input)
    initBettingControls();

    // Start the game loop
    if (animationFrame) cancelAnimationFrame(animationFrame);
    gameLoop();

    maximizeCanvasSize();
    window.addEventListener('resize', maximizeCanvasSize);
    window.addEventListener('orientationchange', () => {
        setTimeout(maximizeCanvasSize, 80);
        setTimeout(maximizeCanvasSize, 280);
    });
    document.addEventListener('fullscreenchange', maximizeCanvasSize);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', maximizeCanvasSize);
    }
    if (window.DeviceProfile && typeof window.DeviceProfile.onChange === 'function') {
        window.DeviceProfile.onChange(() => maximizeCanvasSize());
    }

    // Aiming: pointer events (mouse + touch + pen)
    setupAiming();

    // Nice startup visual + optional Imagine burst
    setTimeout(() => {
        for (let i = 0; i < 22; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.8 + Math.random() * 3;
            state.particles.push({
                x: WIDTH / 2,
                y: 230,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                life: 38 + Math.random() * 18,
                color: '#a855f7',
                size: 2.5 + Math.random() * 1.5
            });
        }
        spawnBurstFX(WIDTH / 2, 280, 5);
    }, 420);

    console.log('%c[Engine] Applyko modular engine running — all 8 Enhanced Gameplay & Physics features active', 'color:#22c55e;font-weight:600');
}

export { dropBtn, autoBtn };

function setupAiming() {
    if (!canvas) return;

    let isAiming = false;
    let activePointerId = null;

    function updateAim(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const centerX = rect.left + rect.width / 2;
        const delta = (e.clientX - centerX) / (rect.width / 2);
        state.aimOffset = Math.max(-1, Math.min(1, delta));
    }

    canvas.addEventListener('pointerdown', (e) => {
        // Primary button only for mouse; all touches OK
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        isAiming = true;
        activePointerId = e.pointerId;
        try {
            canvas.setPointerCapture(e.pointerId);
        } catch (err) { /* ignore */ }
        updateAim(e);
        e.preventDefault();
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!isAiming) return;
        if (activePointerId != null && e.pointerId !== activePointerId) return;
        updateAim(e);
        e.preventDefault();
    });

    function endAim(e) {
        if (activePointerId != null && e && e.pointerId !== activePointerId) return;
        isAiming = false;
        activePointerId = null;
    }

    canvas.addEventListener('pointerup', endAim);
    canvas.addEventListener('pointercancel', endAim);
    canvas.addEventListener('lostpointercapture', endAim);
}