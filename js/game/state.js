/**
 * APPLYKO - Shared Game State
 * Single source of truth for game data.
 * Imported by engine, physics, betting UI, etc.
 */

export const state = {
    balls: [],
    particles: [],
    floatingTexts: [],
    /** Imagine jackpot burst stamps (renderer + engine) */
    burstFX: [],
    balance: 1000,
    bet: 25,
    isAutoDropping: false,

    // Endless / Progressive mode
    endlessMode: false,
    dropsCompleted: 0,
    currentRows: 15,

    // Aiming (set by engine, read by renderer for visual feedback)
    aimOffset: 0,

    /** Playfield charge shot: hold to fill power 0–1 (10 segments, 0.5s to max) */
    isCharging: false,
    chargePower: 0,
    chargeStartMs: 0
};