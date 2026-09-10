/**
 * Console Filter - Hides extremely noisy warnings from browser extensions (mainly MetaMask).
 * These warnings are harmless and unrelated to Applyko.
 * This is purely for developer sanity during local development.
 *
 * By default this aggressively suppresses MetaMask noise.
 * To see the raw spam: set window.__APPLYKO_SHOW_EXTENSION_LOGS = true before the page loads.
 */

const NOISY_PATTERNS = [
  'MaxListenersExceededWarning',
  'ObjectMultiplex',
  'contentscript.js',
  'memory leak detected',
  'EventEmitter',
  'orphaned data',
  'malformed chunk',
  'liveness',
  'app-init-liveness',
  'background-liveness'
];

function shouldSuppress(arg) {
  if (typeof arg === 'string') {
    return NOISY_PATTERNS.some(pattern => arg.includes(pattern));
  }
  if (arg && typeof arg === 'object') {
    try {
      const str = JSON.stringify(arg) + ' ' + (arg.message || '') + ' ' + (arg.stack || '');
      return NOISY_PATTERNS.some(pattern => str.includes(pattern));
    } catch (e) {
      return false;
    }
  }
  return false;
}

export function initConsoleFilter() {
  // By default: completely silence console.warn and console.error.
  // This kills virtually all MetaMask / wallet extension spam.
  // Only our own clean logs will appear.
  if (window.__APPLYKO_SHOW_EXTENSION_LOGS !== true) {
    const noop = () => {};
    console.warn = console.error = console.info = console.debug = noop;

    // Keep a very strict console.log that only allows our own messages
    const originalLog = console.log;
    console.log = (...args) => {
      const first = String(args[0] || '');
      if (first.includes('[Console]') || 
          first.includes('[Main]') || 
          first.includes('[Engine]') || 
          first.includes('[Betting]') ||
          first.includes('[Applyko]') ||
          first.includes('Live reload')) {
        originalLog.apply(console, args);
      }
    };

    return; // silent success
  }

  // User explicitly wants raw logs
  console.log('%c[Console] Raw extension logs mode enabled (window.__APPLYKO_SHOW_EXTENSION_LOGS = true)', 'color:#64748b;font-size:10px');
}