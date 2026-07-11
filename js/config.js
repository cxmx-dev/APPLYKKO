/**
 * APPLYKO - Configuration & Constants
 * Single source of truth for game dimensions and tuning values.
 * Extracted from original monolithic pliko.html
 */

export const WIDTH = 1720;
export const HEIGHT = 1450;

// Board sizing tuned for large high-res display (2560x1440 friendly)
export const PEG_ROWS = 15;        // Default starting rows (endless mode can grow this)
export const PEG_RADIUS = 7.5;
export const BALL_RADIUS = 9.5;

// NOTE: GRAVITY / DAMPING / BOUNCE below are legacy and no longer used.
// All runtime physics values come from physics-settings.js presets (Earth/Moon/etc).
// They are kept only for reference / potential future tools.
export const GRAVITY = 0.165;
export const DAMPING = 0.992;
export const BOUNCE = 0.78;

export const multipliers = [8, 5, 2.5, 1.4, 0.7, 0.3, 0.7, 1.4, 2.5, 5, 8];