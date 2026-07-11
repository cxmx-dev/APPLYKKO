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
    aimOffset: 0
};