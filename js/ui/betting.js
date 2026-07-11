/**
 * APPLYKO - Betting & UI Controls
 * Handles quick bet buttons, bet input, and balance display.
 * Wires up to the game engine's state.
 */

import { state } from '../game/state.js';
import { setPhysicsPreset } from '../game/physics-settings.js';

let betInput = null;

export function updateBalanceUI(balance) {
    const el = document.getElementById('balance');
    if (el) el.textContent = '$' + (balance ?? state.balance).toLocaleString();
}

export function quickBet(amount) {
    if (amount === 500) {
        amount = Math.max(25, Math.floor(state.balance * 0.4));
    }
    state.bet = amount;

    if (betInput) {
        betInput.value = state.bet;
    }
}

function handleQuickBetClick(e) {
    const btn = e.currentTarget;
    const amount = parseInt(btn.dataset.bet, 10);
    if (!isNaN(amount)) {
        quickBet(amount);
    }
}

export function initBettingControls() {
    betInput = document.getElementById('bet-input');

    // Wire all quick bet buttons using data-bet attributes
    const quickButtons = document.querySelectorAll('.bet-controls .quick-bet');
    quickButtons.forEach(btn => {
        btn.addEventListener('click', handleQuickBetClick);
    });

    // Sync initial bet value
    if (betInput) {
        betInput.value = state.bet;

        betInput.addEventListener('change', () => {
            const val = parseInt(betInput.value, 10);
            if (!isNaN(val) && val >= 1) {
                state.bet = val;
            } else {
                betInput.value = state.bet;
            }
        });
    }

    // Multi-ball slider
    const ballSlider = document.getElementById('ball-count');
    const ballValue = document.getElementById('ball-count-value');

    if (ballSlider && ballValue) {
        ballValue.textContent = ballSlider.value;

        ballSlider.addEventListener('input', () => {
            ballValue.textContent = ballSlider.value;
        });
    }

    // Physics Preset selector
    const presetSelect = document.getElementById('physics-preset');
    if (presetSelect) {
        presetSelect.addEventListener('change', () => {
            setPhysicsPreset(presetSelect.value);
        });
    }

    // Endless Mode Toggle
    const endlessBtn = document.getElementById('endless-toggle');
    const endlessStatus = document.getElementById('endless-status');

    if (endlessBtn && endlessStatus) {
        const updateEndlessUI = () => {
            const active = !!state.endlessMode;
            endlessBtn.classList.toggle('active', active);

            if (active) {
                const rows = state.currentRows || 15;
                endlessStatus.textContent = `L${rows - 14}`;
                endlessStatus.style.fontSize = '0.55rem';
            } else {
                endlessStatus.textContent = 'OFF';
                endlessStatus.style.fontSize = '0.6rem';
            }
        };

        endlessBtn.addEventListener('click', () => {
            state.endlessMode = !state.endlessMode;

            if (state.endlessMode) {
                state.dropsCompleted = state.dropsCompleted || 0;
                state.currentRows = state.currentRows || 15;
            }

            updateEndlessUI();
            console.log('%c[Applyko] Endless mode:', 'color:#4ade80', state.endlessMode ? 'ON' : 'OFF');
        });

        // Initial state
        updateEndlessUI();
    }

    // Initial balance display
    updateBalanceUI(state.balance);

    console.log('[Betting] Betting controls initialized and wired');
}

export function getSelectedBallCount() {
    const slider = document.getElementById('ball-count');
    return slider ? parseInt(slider.value, 10) || 4 : 4;
}