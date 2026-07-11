/**
 * APPLYKO - Application Entry Point
 * Bootstraps the modular game.
 */

import { initGame } from './game/engine.js';
import { initConsoleFilter } from './utils/console-filter.js';

// By default, completely silences console.warn + console.error to kill MetaMask/extension spam.
// To see the raw spam: set window.__APPLYKO_SHOW_EXTENSION_LOGS = true before the page loads, then hard refresh.
initConsoleFilter();

async function bootstrap() {
    console.log('%c[Main] Starting Applyko modular edition (v6) + Imagine dazzle...', 'color:#22c55e');

    await initGame();

    // Legend: slide in from right (L key, header Legend button, swipe optional)
    const legendPanel = document.getElementById('legend-panel');
    const legendBtn = document.getElementById('btn-legend');
    if (legendPanel) {
        const setLegendOpen = (open) => {
            legendPanel.classList.toggle('is-open', open);
            legendPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
            if (legendBtn) {
                legendBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
                legendBtn.classList.toggle('is-active', open);
            }
        };

        setLegendOpen(false);

        window.addEventListener('keydown', (e) => {
            if (e.key !== 'l' && e.key !== 'L') return;
            // Don't steal L while typing in bet field or other form controls
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
                return;
            }
            e.preventDefault();
            setLegendOpen(!legendPanel.classList.contains('is-open'));
        });

        if (legendBtn) {
            legendBtn.addEventListener('click', (e) => {
                e.preventDefault();
                setLegendOpen(!legendPanel.classList.contains('is-open'));
            });
        }

        // Click the [L] chip to close when open
        const hint = legendPanel.querySelector('.key-hint');
        if (hint) {
            hint.style.cursor = 'pointer';
            hint.addEventListener('click', () => setLegendOpen(false));
        }

        // Touch: fast swipe right→left opens legend (same idea as Pinball)
        let swipeX0 = 0;
        let swipeT0 = 0;
        document.addEventListener('touchstart', (e) => {
            if (!e.touches || !e.touches[0]) return;
            if (e.target && e.target.closest && (
                e.target.closest('#legend-panel') ||
                e.target.closest('button') ||
                e.target.closest('input') ||
                e.target.closest('select') ||
                e.target.closest('canvas')
            )) {
                swipeX0 = 0;
                return;
            }
            swipeX0 = e.touches[0].clientX;
            swipeT0 = performance.now();
        }, { passive: true });
        document.addEventListener('touchend', (e) => {
            if (!swipeX0 || !e.changedTouches || !e.changedTouches[0]) return;
            const dx = e.changedTouches[0].clientX - swipeX0;
            const dt = performance.now() - swipeT0;
            swipeX0 = 0;
            // Fast right-to-left swipe
            if (dt < 450 && dx < -70) setLegendOpen(true);
        }, { passive: true });

        window.APPLYKO = window.APPLYKO || {};
        window.APPLYKO.toggleLegend = () => setLegendOpen(!legendPanel.classList.contains('is-open'));
        window.APPLYKO.setLegendOpen = setLegendOpen;
    }

    // Developer / power-user helpers (merge so legend API stays if already set)
    window.APPLYKO = Object.assign(window.APPLYKO || {}, {
        toggleEndlessMode: () => {
            import('./game/state.js').then(mod => {
                const s = mod.state;
                s.endlessMode = !s.endlessMode;
                console.log('%c[Applyko] Endless mode:', 'color:#a78bfa', s.endlessMode ? 'ON (progressive rows + crazier multipliers)' : 'OFF');
            });
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    bootstrap().catch((err) => {
        console.log('%c[Main] Bootstrap error:', 'color:#f87171', err);
    });
});