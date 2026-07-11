/**
 * APPLYKO - Audio Manager (Web Audio API)
 * 
 * Procedural sound generation (no external files).
 * Features:
 *  - Velocity-sensitive bounce sounds
 *  - Tiered win jingles
 *  - Volume controls (master + sfx)
 */

let audioContext = null;
let masterGain = null;
let sfxGain = null;
let isInitialized = false;

function ensureAudioContext() {
    if (audioContext) return true;

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Master volume
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.85;
        masterGain.connect(audioContext.destination);

        // SFX bus
        sfxGain = audioContext.createGain();
        sfxGain.gain.value = 0.9;
        sfxGain.connect(masterGain);

        isInitialized = true;
        return true;
    } catch (e) {
        console.warn('[Audio] Web Audio API not available');
        return false;
    }
}

function resumeIfNeeded() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
    }
}

/**
 * Play a short bounce sound. Pitch scales with velocity.
 */
let lastBounceTime = 0;

export function playBounce(velocity = 3.5) {
    if (!ensureAudioContext()) return;
    resumeIfNeeded();

    const now = audioContext.currentTime;
    // Light throttle on bounce sounds too
    if (now - lastBounceTime < 0.03) {
        return;
    }
    lastBounceTime = now;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    // Velocity affects pitch (higher speed = higher pitch, more "impact")
    const speed = Math.min(Math.max(velocity, 1.5), 9);
    const baseFreq = 180 + (speed - 1.5) * 38;   // ~180Hz → ~460Hz

    osc.type = 'triangle';
    osc.frequency.value = baseFreq;

    filter.type = 'lowpass';
    filter.frequency.value = 1200 + speed * 80;

    gain.gain.value = 0.28;

    // Short decay envelope
    const decay = 0.09 + (speed * 0.012);

    const noise = audioContext.createBufferSource();
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.12, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;

    const noiseGain = audioContext.createGain();
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800 + speed * 60;
    noiseGain.gain.value = 0.18;

    // Connect graph
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(sfxGain);

    // Envelopes
    const t = now;
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0.0001, t + decay);

    noiseGain.gain.setValueAtTime(noiseGain.gain.value, t);
    noiseGain.gain.linearRampToValueAtTime(0.0001, t + decay * 0.7);

    osc.start(t);
    osc.stop(t + decay + 0.02);
    noise.start(t);
    noise.stop(t + decay + 0.03);
}

/**
 * Subtle peg hit sound (lighter than full bounce)
 * Throttled to prevent audio stacking when many balls are in play.
 */
let lastPegHitTime = 0;

export function playPegHit(intensity = 1) {
    if (!ensureAudioContext()) return;
    resumeIfNeeded();

    const now = audioContext.currentTime;

    // Throttle peg hits more aggressively to avoid deafening stacking
    // Especially important when 4–5 balls are flying
    if (now - lastPegHitTime < 0.11) {
        return;
    }
    lastPegHitTime = now;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.value = 620 + (intensity - 1) * 80;

    // Reduce volume when many sounds are trying to play
    const volumeMultiplier = 0.7;
    gain.gain.value = 0.065 * Math.min(intensity, 1.3);  // noticeably quieter to prevent loud stacking with 4+ balls

    osc.connect(gain);
    gain.connect(sfxGain);

    const duration = 0.038 + intensity * 0.015;  // slightly shorter sounds
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.008);
}

/**
 * Win jingle based on multiplier tier
 */
export function playWin(multiplier) {
    if (!ensureAudioContext()) return;
    resumeIfNeeded();

    const now = audioContext.currentTime;

    if (multiplier >= 8) {
        // High tier — celebratory
        playArpeggio([780, 930, 1040, 1240], 0.09, 0.55, 'sawtooth');
    } else if (multiplier >= 3) {
        // Medium tier — nice positive
        playArpeggio([520, 660, 780], 0.11, 0.42, 'triangle');
    } else {
        // Low tier — soft confirmation
        playArpeggio([380, 480], 0.14, 0.28, 'sine');
    }
}

function playArpeggio(frequencies, noteDuration, volume, type = 'triangle') {
    const now = audioContext.currentTime;

    frequencies.forEach((freq, index) => {
        const startTime = now + index * (noteDuration * 0.65);

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        osc.type = type;
        osc.frequency.value = freq;

        filter.type = 'lowpass';
        filter.frequency.value = 1800;

        gain.gain.value = volume;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(sfxGain);

        const release = noteDuration * 1.6;

        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.linearRampToValueAtTime(0.0001, startTime + release);

        osc.start(startTime);
        osc.stop(startTime + release + 0.05);
    });
}

export function setMasterVolume(value) {
    if (!masterGain) return;
    masterGain.gain.value = Math.max(0, Math.min(1, value));
}

export function setSfxVolume(value) {
    if (!sfxGain) return;
    sfxGain.gain.value = Math.max(0, Math.min(1.5, value));
}

export function initAudioOnUserGesture() {
    // Call this on first click / keypress anywhere
    ensureAudioContext();
    resumeIfNeeded();
}

// Expose for debugging
window.__applykoAudio = { setMasterVolume, setSfxVolume };