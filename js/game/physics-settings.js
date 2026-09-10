/**
 * APPLYKO - Physics Presets & Settings
 * Central place for different gravity / bounce feels.
 */

export const physicsPresets = {
  Earth: {
    name: "Earth",
    gravity: 0.165,
    damping: 0.992,
    bounce: 0.78,
    description: "Normal feel"
  },
  Moon: {
    name: "Moon",
    gravity: 0.055,
    damping: 0.985,
    bounce: 0.92,
    description: "Low gravity, floaty"
  },
  Jupiter: {
    name: "Jupiter",
    gravity: 0.29,      // Heavy but still playable (capped in physics for safety)
    damping: 0.975,     // Stronger velocity loss
    bounce: 0.71,       // Noticeably less bouncy / "stickier"
    description: "Heavy & sticky"
  },
  "Zero-G": {
    name: "Zero-G",
    gravity: 0.008,
    damping: 0.998,
    bounce: 0.96,
    description: "Almost no gravity"
  }
};

let currentPreset = "Earth";

export function getCurrentPhysics() {
  return physicsPresets[currentPreset];
}

export function setPhysicsPreset(presetName) {
  if (physicsPresets[presetName]) {
    currentPreset = presetName;
    return true;
  }
  return false;
}

export function getCurrentPresetName() {
  return currentPreset;
}