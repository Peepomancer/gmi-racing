/**
 * ConfigManager - Configuration storage and defaults
 * Extracted from renderer.js for modularity
 */

/**
 * Simple localStorage-based config storage (replaces Electron IPC)
 */
export const configStorage = {
  load(name) {
    try {
      const data = localStorage.getItem(`gmi-config-${name}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load config:', e);
      return null;
    }
  },
  save(name, data) {
    try {
      localStorage.setItem(`gmi-config-${name}`, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Failed to save config:', e);
      return false;
    }
  },
  list() {
    const configs = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('gmi-config-')) {
        configs.push(key.replace('gmi-config-', ''));
      }
    }
    return configs.length > 0 ? configs : ['default'];
  }
};

/**
 * Get the default game configuration
 */
export function getDefaultConfig() {
  return {
    race: { duration: 60, ballCount: 5 },
    balls: { radius: 15, density: 0.5, colors: [
      { name: "Red", color: "#ff4444" },
      { name: "Blue", color: "#4444ff" },
      { name: "Green", color: "#44ff44" },
      { name: "Yellow", color: "#ffff44" },
      { name: "Purple", color: "#ff44ff" }
    ]},
    map: { noiseScale: 50, platformDensity: 0.5, seed: 12345 },
    physics: { gravity: 8, bounce: 0.8, friction: 0.1, airResistance: 0.01 },  // gravity = ball speed
    items: { enabled: false, spawnRate: 5, types: [] }
  };
}
