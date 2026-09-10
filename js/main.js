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

    // Legend: L key, header button, right-edge swipe open, panel/backdrop swipe right close
    const legendPanel = document.getElementById('legend-panel');
    const legendBtn = document.getElementById('btn-legend');
    const legendEdge = document.getElementById('legend-edge-open');
    const legendBackdrop = document.getElementById('legend-backdrop');

    if (legendPanel) {
        const setLegendOpen = (open) => {
            legendPanel.classList.toggle('is-open', open);
            legendPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
            if (legendBtn) {
                legendBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
                legendBtn.classList.toggle('is-active', open);
            }
            if (legendBackdrop) {
                legendBackdrop.classList.toggle('is-open', open);
                legendBackdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
            }
            // Edge strip only while closed (so it doesn't sit under the open panel)
            if (legendEdge) {
                legendEdge.classList.toggle('is-hidden', open);
                legendEdge.setAttribute('aria-hidden', open ? 'true' : 'false');
            }
        };

        setLegendOpen(false);

        /**
         * Simple horizontal swipe on a dedicated element (pointer capture).
         * Does not fight canvas aim because edge/backdrop/panel own the pointers.
         */
        function bindHSwipe(el, { onLeft, onRight, minDx = 28 }) {
            if (!el) return;
            let x0 = 0;
            let y0 = 0;
            let t0 = 0;
            let pid = null;

            el.addEventListener('pointerdown', (e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                pid = e.pointerId;
                x0 = e.clientX;
                y0 = e.clientY;
                t0 = performance.now();
                try {
                    el.setPointerCapture(e.pointerId);
                } catch (err) { /* ignore */ }
            });

            const end = (e) => {
                if (pid != null && e.pointerId !== pid) return;
                const dx = e.clientX - x0;
                const dy = e.clientY - y0;
                const dt = performance.now() - t0;
                pid = null;
                if (dt > 900) return;
                if (Math.abs(dx) < minDx) return;
                // Mostly horizontal (loose)
                if (Math.abs(dx) < Math.abs(dy) * 0.65) return;
                if (dx < 0 && onLeft) onLeft(e);
                if (dx > 0 && onRight) onRight(e);
            };

            el.addEventListener('pointerup', end);
            el.addEventListener('pointercancel', () => { pid = null; });
            // Lost capture still ends swipe
            el.addEventListener('lostpointercapture', (e) => {
                if (pid != null) end(e);
            });
        }

        // OPEN: swipe left on right-edge strip (wide, always hittable)
        bindHSwipe(legendEdge, {
            minDx: 24,
            onLeft: () => setLegendOpen(true)
        });
        // Also tap/click the edge strip = open (fallback if swipe feels weird)
        if (legendEdge) {
            legendEdge.addEventListener('click', (e) => {
                e.preventDefault();
                setLegendOpen(true);
            });
        }

        // CLOSE: swipe right on panel or backdrop; tap backdrop
        bindHSwipe(legendPanel, {
            minDx: 32,
            onRight: () => setLegendOpen(false)
        });
        bindHSwipe(legendBackdrop, {
            minDx: 24,
            onRight: () => setLegendOpen(false),
            onLeft: () => { /* ignore */ }
        });
        if (legendBackdrop) {
            legendBackdrop.addEventListener('click', (e) => {
                e.preventDefault();
                setLegendOpen(false);
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.key !== 'l' && e.key !== 'L') return;
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
                return;
            }
            e.preventDefault();
            setLegendOpen(!legendPanel.classList.contains('is-open'));
        });

        // Esc closes
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && legendPanel.classList.contains('is-open')) {
                setLegendOpen(false);
            }
        });

        if (legendBtn) {
            legendBtn.addEventListener('click', (e) => {
                e.preventDefault();
                setLegendOpen(!legendPanel.classList.contains('is-open'));
            });
        }

        const hint = legendPanel.querySelector('.key-hint');
        if (hint) {
            hint.style.cursor = 'pointer';
            hint.addEventListener('click', () => setLegendOpen(false));
        }

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