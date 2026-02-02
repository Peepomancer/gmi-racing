import { Game } from './game/Game.js';
import { SVGMapLoader } from './game/systems/SVGMapLoader.js';
import { getMapLoader } from './game/systems/MapLoader.js';
import { volumeSystem, VolumeSystem } from './game/systems/VolumeSystem.js';
import { gameLog } from './game/systems/GameLog.js';
import { renderVolumeBallsList, updateVolumeBallAmounts, renderVolumeRankings } from './ui/VolumeUI.js';
import { updateStatsDashboard } from './ui/StatsUI.js';
import { showChainCompleteScreen } from './ui/ChainCompleteScreen.js';
import { bettingSystem } from './game/systems/BettingSystem.js';
import { pointSystem } from './game/systems/PointSystem.js';
import { statisticsSystem } from './game/systems/StatisticsSystem.js';
import { simulationSystem } from './game/systems/SimulationSystem.js';
import { mapChain, CHAIN_RACE_MAPS, CHAIN_BOSS_MAPS, CHAIN_MIXED, CHAIN_WEAPONS_TEST } from './game/systems/MapChain.js';
import { getMapStorage } from './shared/MapStorage.js';

// Global state
let game = null;
let config = null;
let svgMapLoader = null;
let customMapData = null;
let mapLoader = null;

// DOM Elements
const elements = {
  tabs: document.querySelectorAll('.tab-btn'),
  panels: document.querySelectorAll('.tab-panel'),
  btnStart: document.getElementById('btn-start'),
  btnReset: document.getElementById('btn-reset'),
  btnNewMap: document.getElementById('btn-new-map'),
  btnExportLogs: document.getElementById('btn-export-logs'),
  raceTimer: document.getElementById('race-timer'),
  standings: document.getElementById('standings'),
  configSelect: document.getElementById('config-select')
};

// Slider configurations - maps slider IDs to config paths and display formatting
const sliderConfigs = {
  'slider-ball-count': { path: 'race.ballCount', display: v => v },
  'slider-race-duration': { path: 'race.duration', display: v => v },
  'slider-ball-radius': { path: 'balls.radius', display: v => v },
  'slider-ball-density': { path: 'balls.density', display: v => (v / 100).toFixed(2), transform: v => v / 100 },
  'slider-noise-scale': { path: 'map.noiseScale', display: v => v },
  'slider-platform-density': { path: 'map.platformDensity', display: v => (v / 100).toFixed(2), transform: v => v / 100 },
  'slider-seed': { path: 'map.seed', display: v => v },
  'slider-gravity': { path: 'physics.gravity', display: v => v },  // Ball speed (no transform)
  'slider-bounce': { path: 'map.platformDensity', display: v => (v / 100).toFixed(2), transform: v => v / 100 }  // Reused for obstacle density
};

// Simple localStorage-based config storage (replaces Electron IPC)
const configStorage = {
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

// Initialize app
async function init() {
  // Load default config
  config = configStorage.load('default');
  if (!config) {
    console.log('No saved config, using defaults');
    config = getDefaultConfig();
    configStorage.save('default', config);
  }

  // Initialize game
  game = new Game('game-container', config);
  window.game = game; // Expose for chain system and debugging

  // Initialize SVG loader
  svgMapLoader = new SVGMapLoader(null);

  // Set up event listeners
  setupTabNavigation();
  setupSliders();
  setupButtons();
  setupConfigManager();
  setupSVGImport();
  await setupEditorMaps();
  setupVolumePanel();
  gameLog.init();
  setupMapChain();

  // Update UI from config
  updateUIFromConfig();

  // Check for test map from editor
  checkTestMap();

  // Start game loop for UI updates
  requestAnimationFrame(updateLoop);
}

function getDefaultConfig() {
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

function setupTabNavigation() {
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;

      // Update tab buttons
      elements.tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update panels
      elements.panels.forEach(p => p.classList.add('hidden'));
      document.getElementById(`panel-${tabName}`).classList.remove('hidden');

      // Update stats dashboard when stats tab is clicked
      if (tabName === 'stats') {
        updateStatsDashboard();
      }
    });
  });
}

function setupSliders() {
  Object.entries(sliderConfigs).forEach(([sliderId, sliderConfig]) => {
    const slider = document.getElementById(sliderId);
    if (!slider) return;

    const valueId = sliderId.replace('slider-', 'val-');
    const valueEl = document.getElementById(valueId);

    slider.addEventListener('input', () => {
      const rawValue = parseInt(slider.value);
      const displayValue = sliderConfig.display(rawValue);
      const configValue = sliderConfig.transform ? sliderConfig.transform(rawValue) : rawValue;

      // Update display
      if (valueEl) valueEl.textContent = displayValue;

      // Update config
      setConfigValue(sliderConfig.path, configValue);

      // Notify game of config change
      if (game) {
        game.updateConfig(config);
      }
    });
  });
}

function setupButtons() {
  elements.btnStart.addEventListener('click', () => {
    if (game) {
      if (game.isRacing) {
        game.stopRace();
        elements.btnStart.textContent = 'Start Race';
      } else {
        game.startRace();
        elements.btnStart.textContent = 'Stop Race';
      }
    }
  });

  elements.btnReset.addEventListener('click', () => {
    if (game) {
      game.reset();
      elements.btnStart.textContent = 'Start Race';
    }
  });

  elements.btnNewMap.addEventListener('click', () => {
    // Clear custom map if any
    customMapData = null;
    updateSVGStatus(null);

    // Generate new random seed
    const newSeed = Math.floor(Math.random() * 99999);
    config.map.seed = newSeed;

    // Update slider
    const seedSlider = document.getElementById('slider-seed');
    const seedValue = document.getElementById('val-seed');
    if (seedSlider) seedSlider.value = newSeed;
    if (seedValue) seedValue.textContent = newSeed;

    // Regenerate map
    if (game) {
      game.updateConfig(config);
      game.regenerateMap();
    }
  });

  // Export bounce logs button
  const exportBtn = document.getElementById('btn-export-logs');
  console.log('Export logs button found:', exportBtn);

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      console.log('Export button clicked!');

      if (!game) {
        alert('Game not initialized!');
        return;
      }

      const scene = game.getScene();
      console.log('Scene:', scene);
      console.log('BounceLog:', scene?.bounceLog);

      if (scene && scene.bounceLog && scene.bounceLog.length > 0) {
        const exportData = {
          timestamp: new Date().toISOString(),
          totalBounces: scene.bounceLog.length,
          bounces: scene.bounceLog,
          summary: analyzeBounces(scene.bounceLog)
        };

        // Download as JSON
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bounce-logs-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Bounce logs exported:', exportData.summary);
        alert(`Exported ${scene.bounceLog.length} bounce logs!`);
      } else {
        alert('No bounce logs available. Run a race first!\n\nBounce logs: ' + (scene?.bounceLog?.length || 0));
      }
    });
  } else {
    console.error('Export logs button not found!');
  }

  // Debug panel toggle
  const debugPanel = document.getElementById('debug-panel');
  const debugContent = document.getElementById('debug-content');
  const debugBtn = document.getElementById('btn-toggle-debug');

  if (debugBtn && debugPanel) {
    debugBtn.addEventListener('click', () => {
      const isVisible = debugPanel.style.display !== 'none';
      debugPanel.style.display = isVisible ? 'none' : 'block';
      debugBtn.style.background = isVisible ? '#4a2a2a' : '#8a4a4a';
    });

    // Update debug info every 500ms
    setInterval(() => {
      if (debugPanel.style.display === 'none') return;

      const scene = game?.getScene();
      if (!scene) {
        debugContent.textContent = 'Scene not available';
        return;
      }

      const info = [];
      info.push(`=== TIMING ===`);
      info.push(`Game.isRacing: ${game?.isRacing}`);
      info.push(`Game.raceStartTime: ${game?.raceStartTime}`);
      info.push(`Game.raceTime: ${game?.raceTime}`);
      info.push(`Scene.isRacing: ${scene.isRacing}`);
      info.push(`Scene.raceStartTime: ${scene.raceStartTime}`);
      info.push(`Controller: ${scene.controller ? 'YES' : 'NO'}`);

      if (game?.isRacing) {
        const elapsed = (Date.now() - game.raceStartTime) / 1000;
        info.push(`Elapsed: ${elapsed.toFixed(2)}s`);
      }

      info.push(`\n=== BALLS (${scene.balls?.length || 0}) ===`);
      scene.balls?.forEach((ball, i) => {
        info.push(`${ball.name}: pos=${ball.finishPosition || '-'} time=${ball.finishTime?.toFixed(2) || '-'} finished=${ball.finished}`);
      });

      info.push(`\n=== SYSTEMS ===`);
      info.push(`Inventory: ${scene.inventorySystem ? 'YES' : 'NO'}`);
      info.push(`Roulette: ${scene.rouletteSystem ? 'YES' : 'NO'}`);
      info.push(`Roulette spinning: ${scene.rouletteSystem?.isSpinning || false}`);

      info.push(`\n=== DIMENSIONS ===`);
      info.push(`Scene: ${scene.gameWidth}x${scene.gameHeight}`);

      if (scene.inventorySystem) {
        info.push(`\n=== INVENTORY ===`);
        const summary = scene.inventorySystem.getSummary();
        summary.forEach(inv => {
          info.push(`${inv.ballName}: ${inv.weaponCount} weapons, ${inv.buffCount} buffs`);
        });
      }

      debugContent.textContent = info.join('\n');
    }, 500);
  }
}

// Analyze bounce logs for patterns
function analyzeBounces(logs) {
  if (!logs || logs.length === 0) {
    return { total: 0, walls: 0, obstacles: 0, corners: 0, suspicious: 0 };
  }

  const walls = logs.filter(b => b.hitType === 'wall').length;
  const corners = logs.filter(b => b.hitType === 'CORNER').length;
  const obstacles = logs.filter(b => b.hitType === 'obstacle').length;
  const suspicious = logs.filter(b => {
    const diff = Math.abs(parseFloat(b.angleDiff));
    return b.hitType === 'wall' && diff < 15;
  }).length;

  return {
    total: logs.length,
    walls,
    obstacles,
    corners,
    suspicious,
    suspiciousPercent: ((suspicious / Math.max(walls, 1)) * 100).toFixed(1) + '%'
  };
}

function setupSVGImport() {
  const dropZone = document.getElementById('svg-drop-zone');
  const fileInput = document.getElementById('svg-file-input');
  const clearBtn = document.getElementById('btn-clear-svg');

  console.log('[SVG Import] Setting up. dropZone:', !!dropZone, 'fileInput:', !!fileInput);

  if (!dropZone || !fileInput) {
    console.error('[SVG Import] Missing elements! dropZone:', dropZone, 'fileInput:', fileInput);
    return;
  }

  // Click to browse
  dropZone.addEventListener('click', () => {
    console.log('[SVG Import] Drop zone clicked, opening file picker');
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    console.log('[SVG Import] File input changed, files:', e.target.files.length);
    if (e.target.files.length > 0) {
      handleSVGFile(e.target.files[0]);
    }
  });

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    console.log('[SVG Import] File dropped');

    const files = e.dataTransfer.files;
    console.log('[SVG Import] Dropped files:', files.length, files[0]?.name);
    if (files.length > 0) {
      if (files[0].name.endsWith('.svg')) {
        handleSVGFile(files[0]);
      } else {
        console.error('[SVG Import] Not an SVG file:', files[0].name);
        updateSVGStatus('Error: Please drop an SVG file');
      }
    }
  });

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      customMapData = null;
      updateSVGStatus(null);

      // Regenerate procedural map
      if (game) {
        const scene = game.getScene();
        if (scene) {
          scene.setCustomMap(null);
          scene.regenerateMap();
        }
      }
    });
  }
}

async function handleSVGFile(file) {
  console.log('[SVG Import] handleSVGFile called with:', file.name, file.size, 'bytes');
  try {
    updateSVGStatus('Loading...');

    console.log('[SVG Import] Calling svgMapLoader.loadFromFile...');
    const mapData = await svgMapLoader.loadFromFile(file);
    console.log('[SVG Import] Parsed mapData:', mapData);
    customMapData = mapData;

    updateSVGStatus(`Loaded: ${mapData.obstacles.length} obstacles`);

    // Apply to game
    if (game) {
      console.log('[SVG Import] Applying to game...');
      const scene = game.getScene();
      console.log('[SVG Import] Got scene:', !!scene, 'has setCustomMap:', !!(scene && scene.setCustomMap));
      if (scene && scene.setCustomMap) {
        scene.setCustomMap(mapData);
        console.log('[SVG Import] Custom map set, regenerating...');
        scene.regenerateMap();
        console.log('[SVG Import] Map regenerated successfully');
      } else {
        console.error('[SVG Import] Scene or setCustomMap not available');
      }
    } else {
      console.error('[SVG Import] Game not initialized');
    }

    console.log('[SVG Import] SVG map loaded successfully:', mapData);
  } catch (err) {
    console.error('[SVG Import] Failed to load SVG:', err);
    updateSVGStatus('Error: ' + err.message);
  }
}

function updateSVGStatus(message) {
  const status = document.getElementById('svg-status');
  const clearBtn = document.getElementById('btn-clear-svg');

  if (status) {
    status.textContent = message || '';
  }

  if (clearBtn) {
    clearBtn.style.display = message && !message.startsWith('Error') ? 'inline-block' : 'none';
  }
}

// ---- Editor Map Integration ----

async function setupEditorMaps() {
  mapLoader = getMapLoader();
  await mapLoader.init();

  // Populate map dropdown
  await refreshEditorMapList();

  // Load button handler
  const loadBtn = document.getElementById('btn-load-editor-map');
  if (loadBtn) {
    loadBtn.addEventListener('click', loadSelectedEditorMap);
  }

  // Also load on select change for convenience
  const select = document.getElementById('editor-map-select');
  if (select) {
    select.addEventListener('change', () => {
      // Auto-load on selection change
      loadSelectedEditorMap();
    });
  }
}

// Built-in test map - PHYSICS CRUSH TEST v2
// Narrow corridor | thin red wall | TRAP ZONE (yellow area)
// If balls phase through the thin wall, they get trapped in the yellow zone as proof
const BUILTIN_CRUSHER_MAP = {
  id: "builtin-crusher-test",
  name: "Crush Physics Test (Built-in)",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  width: 800,
  height: 600,
  startZone: { x: 200, y: 540, width: 100, height: 40 },
  finishZone: { x: -100, y: -100, width: 10, height: 10 }, // Off-screen, unreachable - test runs forever

  obstacles: [
    // ========== LEFT WALL (solid) ==========
    { id: "wall-left", type: "rectangle", x: 0, y: 0, width: 100, height: 600, color: "#1a202c", behavior: "static" },

    // ========== CORRIDOR AREA (x: 100-400) ==========
    // Top wall of corridor
    { id: "corridor-top", type: "rectangle", x: 100, y: 0, width: 310, height: 30, color: "#2d3748", behavior: "static" },
    // Bottom wall of corridor
    { id: "corridor-bottom", type: "rectangle", x: 100, y: 570, width: 310, height: 30, color: "#2d3748", behavior: "static" },

    // ========== THIN RED CRUSH WALL (x: 380-390, separates corridor from trap) ==========
    // Made thin (10px) for testing physics breach
    { id: "crush-wall", type: "rectangle", x: 380, y: 30, width: 10, height: 540, color: "#ff0000", behavior: "static" },

    // ========== TRAP ZONE (x: 390-800) - Yellow "nothing zone" ==========
    // Trap zone boundaries - balls can't escape once inside
    { id: "trap-top", type: "rectangle", x: 390, y: 0, width: 410, height: 30, color: "#f6e05e", behavior: "static" },
    { id: "trap-bottom", type: "rectangle", x: 390, y: 570, width: 410, height: 30, color: "#f6e05e", behavior: "static" },
    { id: "trap-right", type: "rectangle", x: 790, y: 30, width: 10, height: 540, color: "#f6e05e", behavior: "static" },

    // ========== CRUSHER - Full height, no gaps ==========
    // One big crusher covering entire corridor height
    { id: "crusher1", type: "rectangle", x: 110, y: 35, width: 60, height: 530, color: "#e74c3c", behavior: "crusher", crusherDirection: "right", crusherSpeed: 100, crusherResetDelay: 1200 }
  ]
};

// Built-in test map - BOSS FIGHT ARENA
// Open arena with boss spawn area at top, balls spawn at bottom
const BUILTIN_BOSS_MAP = {
  id: "builtin-boss-test",
  name: "Boss Fight Arena (Built-in)",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  width: 800,
  height: 700,
  startZone: { x: 100, y: 600, width: 600, height: 60 },
  finishZone: { x: -100, y: -100, width: 10, height: 10 }, // Off-screen - boss fight has no finish

  // Boss config (used by scene to spawn boss)
  bossConfig: {
    x: 400,
    y: 100,
    width: 100,
    height: 80,
    health: 150,
    pattern: 'spiral',
    color: 0xcc3300
  },

  obstacles: [
    // ========== ARENA WALLS ==========
    { id: "wall-left", type: "rectangle", x: 0, y: 0, width: 20, height: 700, color: "#1a202c", behavior: "static" },
    { id: "wall-right", type: "rectangle", x: 780, y: 0, width: 20, height: 700, color: "#1a202c", behavior: "static" },
    { id: "wall-top", type: "rectangle", x: 20, y: 0, width: 760, height: 20, color: "#1a202c", behavior: "static" },
    { id: "wall-bottom", type: "rectangle", x: 20, y: 680, width: 760, height: 20, color: "#1a202c", behavior: "static" },

    // ========== COVER OBSTACLES (to dodge projectiles) ==========
    { id: "cover-left", type: "rectangle", x: 100, y: 350, width: 80, height: 20, color: "#4a5568", behavior: "static" },
    { id: "cover-right", type: "rectangle", x: 620, y: 350, width: 80, height: 20, color: "#4a5568", behavior: "static" },
    { id: "cover-center", type: "rectangle", x: 360, y: 400, width: 80, height: 20, color: "#4a5568", behavior: "static" },

    // ========== DEFLECTOR RAMPS (to aim at boss) ==========
    { id: "ramp-left", type: "rectangle", x: 80, y: 500, width: 120, height: 15, color: "#3498db", behavior: "static", angle: -30 },
    { id: "ramp-right", type: "rectangle", x: 600, y: 500, width: 120, height: 15, color: "#3498db", behavior: "static", angle: 30 },

    // ========== BUMPERS (for chaotic bouncing) ==========
    { id: "bumper-1", type: "circle", x: 200, y: 280, radius: 25, color: "#f39c12", behavior: "static" },
    { id: "bumper-2", type: "circle", x: 600, y: 280, radius: 25, color: "#f39c12", behavior: "static" },
    { id: "bumper-3", type: "circle", x: 400, y: 220, radius: 20, color: "#e74c3c", behavior: "static" },

    // ========== ROTATING HAZARD ==========
    { id: "spinner", type: "rectangle", x: 400, y: 300, width: 100, height: 12, color: "#9b59b6", behavior: "rotating", rotationSpeed: 1.5, rotationDirection: "cw" }
  ]
};

// Built-in test map - BREAKABLE BARRIER TEST
// Finish zone blocked by breakable obstacles with different health and color restrictions
const BUILTIN_BREAKABLE_MAP = {
  id: "builtin-breakable-test",
  name: "Breakable Barrier Test (Built-in)",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  width: 800,
  height: 700,
  startZone: { x: 50, y: 50, width: 700, height: 80 },
  finishZone: { x: 200, y: 620, width: 400, height: 60 },

  obstacles: [
    // ========== BREAKABLE BARRIER (blocking finish) ==========
    { id: "break-1", type: "rectangle", x: 50, y: 550, width: 150, height: 25, color: "#e74c3c", behavior: "breakable", health: 1, maxHealth: 1, breakableBy: [] },
    { id: "break-2", type: "rectangle", x: 220, y: 550, width: 150, height: 25, color: "#3498db", behavior: "breakable", health: 2, maxHealth: 2, breakableBy: [] },
    { id: "break-3", type: "rectangle", x: 390, y: 550, width: 150, height: 25, color: "#9b59b6", behavior: "breakable", health: 3, maxHealth: 3, breakableBy: [] },
    { id: "break-4", type: "rectangle", x: 560, y: 550, width: 190, height: 25, color: "#2ecc71", behavior: "breakable", health: 2, maxHealth: 2, breakableBy: [] },

    // ========== COLOR-LOCKED BREAKABLES ==========
    { id: "color-red", type: "rectangle", x: 150, y: 480, width: 120, height: 20, color: "#ff6b6b", behavior: "breakable", health: 1, maxHealth: 1, breakableBy: ["Red"] },
    { id: "color-blue", type: "rectangle", x: 340, y: 480, width: 120, height: 20, color: "#4dabf7", behavior: "breakable", health: 1, maxHealth: 1, breakableBy: ["Blue"] },
    { id: "color-green", type: "rectangle", x: 530, y: 480, width: 120, height: 20, color: "#51cf66", behavior: "breakable", health: 1, maxHealth: 1, breakableBy: ["Green"] },

    // ========== STATIC OBSTACLES FOR CHAOS ==========
    { id: "deflector-1", type: "rectangle", x: 100, y: 300, width: 150, height: 15, color: "#4a5568", behavior: "static", angle: 20 },
    { id: "deflector-2", type: "rectangle", x: 550, y: 300, width: 150, height: 15, color: "#4a5568", behavior: "static", angle: -20 },
    { id: "center-plat", type: "rectangle", x: 300, y: 350, width: 200, height: 15, color: "#4a5568", behavior: "static" },
    { id: "bumper-left", type: "circle", x: 200, y: 420, radius: 30, color: "#f39c12", behavior: "static" },
    { id: "bumper-right", type: "circle", x: 600, y: 420, radius: 30, color: "#f39c12", behavior: "static" },
    { id: "rotating", type: "rectangle", x: 400, y: 250, width: 120, height: 15, color: "#3498db", behavior: "rotating", rotationSpeed: 2, rotationDirection: "cw" }
  ]
};

async function refreshEditorMapList() {
  const select = document.getElementById('editor-map-select');
  if (!select) return;

  const maps = await mapLoader.listMaps();

  // Keep the procedural option and add built-in test maps
  let html = '<option value="">-- Procedural Map --</option>';
  html += '<option value="builtin-crusher-test">Crusher Gauntlet (Built-in)</option>';
  html += '<option value="builtin-breakable-test">Breakable Barrier Test (Built-in)</option>';
  html += '<option value="builtin-boss-test">Boss Fight Arena (Built-in)</option>';

  maps.forEach(map => {
    html += `<option value="${map.id}">${map.name} (${map.width}x${map.height})</option>`;
  });

  select.innerHTML = html;
}

async function loadSelectedEditorMap() {
  try {
    const select = document.getElementById('editor-map-select');
    if (!select) return;

    const mapId = select.value;

    if (!mapId) {
      // Clear editor map, return to procedural
      if (game) {
        const scene = game.getScene();
        if (scene) {
          scene.clearEditorMap();
          scene.regenerateMap();
        }
      }
      return;
    }

    // Check for built-in maps
    if (mapId === 'builtin-crusher-test') {
      if (game) {
        const scene = game.getScene();
        if (scene) {
          scene.loadEditorMapData(BUILTIN_CRUSHER_MAP);
        }
      }
      return;
    }

    if (mapId === 'builtin-breakable-test') {
      if (game) {
        const scene = game.getScene();
        if (scene) {
          scene.loadEditorMapData(BUILTIN_BREAKABLE_MAP);
        }
      }
      return;
    }

    if (mapId === 'builtin-boss-test') {
      if (game) {
        const scene = game.getScene();
        if (scene) {
          scene.loadEditorMapData(BUILTIN_BOSS_MAP);
          // Spawn the boss after map loads
          setTimeout(() => {
            const cfg = BUILTIN_BOSS_MAP.bossConfig;
            if (scene.bossSystem) {
              scene.bossSystem.spawn(cfg.x, cfg.y, {
                width: cfg.width,
                height: cfg.height,
                health: cfg.health,
                color: cfg.color
              });
              scene.bossSystem.setPattern(cfg.pattern);
              document.getElementById('boss-status').textContent = `Boss spawned! HP: ${cfg.health}, Pattern: ${cfg.pattern}`;
            }
          }, 100);
        }
      }
      return;
    }

    // Load the editor map from storage
    if (game) {
      const scene = game.getScene();
      if (scene) {
        await scene.loadEditorMap(mapId);
      }
    }
  } catch (error) {
    console.error('[Renderer] Error loading map:', error);
    alert('Error loading map. Reverting to procedural map.');
    // Fall back to procedural
    if (game) {
      const scene = game.getScene();
      if (scene) {
        scene.clearEditorMap();
        scene.regenerateMap();
      }
    }
    // Reset dropdown
    const select = document.getElementById('editor-map-select');
    if (select) select.value = '';
  }
}

function checkTestMap() {
  // Check URL params for test map or chain from editor
  const urlParams = new URLSearchParams(window.location.search);
  const testMapId = urlParams.get('testMap');
  const testChainId = urlParams.get('testChain');

  if (testChainId) {
    // Load chain from localStorage
    setTimeout(() => {
      loadTestChain();
    }, 1000);

    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  if (testMapId) {
    // Set the dropdown
    const select = document.getElementById('editor-map-select');
    if (select) {
      select.value = testMapId;
    }

    // Load after a short delay to let game initialize
    setTimeout(async () => {
      await loadSelectedEditorMap();
    }, 1000);

    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

async function loadTestChain() {
  try {
    const chainData = localStorage.getItem('gmi-test-chain');
    if (!chainData) {
      console.error('No test chain found');
      return;
    }

    const chain = JSON.parse(chainData);
    console.log('[TestChain] Loading chain:', chain.name, 'with', chain.maps.length, 'maps');

    // Build chain map data from map IDs
    const mapStorage = getMapStorage();
    await mapStorage.init();

    const chainMaps = [];
    for (const mapId of chain.maps) {
      const map = await mapStorage.loadMap(mapId);
      if (map && map.data) {
        const mapData = {
          id: map.id,
          name: map.name,
          width: map.width,
          height: map.height,
          startZone: map.data.startZone,
          finishZone: map.data.finishZone,
          obstacles: map.data.obstacles || [],
          bossConfig: map.data.bossConfig || null,
          animations: map.data.animations || null
        };
        chainMaps.push(mapData);
      }
    }

    if (chainMaps.length === 0) {
      console.error('No valid maps in chain');
      return;
    }

    // Set up the chain
    mapChain.setChain(chainMaps);
    mapChain.onMapChange = (map, index) => {
      console.log('[TestChain] Loading map', index + 1);
      loadChainMap(map);
    };
    mapChain.onChainComplete = () => {
      console.log('[TestChain] Chain complete!');
      alert('Chain complete!');
    };

    // Load first map
    const firstMap = mapChain.getCurrentMap();
    if (firstMap) {
      loadChainMap(firstMap);
      updateChainUI();

      // Start the race
      setTimeout(() => {
        const scene = window.game?.getScene();
        if (scene) {
          window.game.startRace();
        }
      }, 500);
    }

    // Clean up test chain data
    localStorage.removeItem('gmi-test-chain');

  } catch (e) {
    console.error('Failed to load test chain:', e);
  }
}

function setupConfigManager() {
  // Load config list
  loadConfigList();

  document.getElementById('btn-save-config').addEventListener('click', () => {
    const name = elements.configSelect.value || 'default';
    configStorage.save(name, config);
    loadConfigList();
    console.log('Config saved:', name);
  });

  document.getElementById('btn-load-config').addEventListener('click', () => {
    const name = elements.configSelect.value;
    const loaded = configStorage.load(name);
    if (loaded) {
      config = loaded;
      updateUIFromConfig();
      if (game) {
        game.updateConfig(config);
        game.reset();
      }
      console.log('Config loaded:', name);
    }
  });
}

function loadConfigList() {
  const configs = configStorage.list();
  elements.configSelect.innerHTML = configs.map(c =>
    `<option value="${c}">${c}</option>`
  ).join('');
}

function setConfigValue(path, value) {
  const parts = path.split('.');
  let obj = config;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
}

function getConfigValue(path) {
  const parts = path.split('.');
  let obj = config;
  for (const part of parts) {
    obj = obj[part];
  }
  return obj;
}

function updateUIFromConfig() {
  Object.entries(sliderConfigs).forEach(([sliderId, sliderConfig]) => {
    const slider = document.getElementById(sliderId);
    const valueId = sliderId.replace('slider-', 'val-');
    const valueEl = document.getElementById(valueId);

    if (!slider) return;

    const configValue = getConfigValue(sliderConfig.path);
    const sliderValue = sliderConfig.transform
      ? Math.round(configValue * 100)
      : configValue;

    slider.value = sliderValue;
    if (valueEl) {
      valueEl.textContent = sliderConfig.display(sliderValue);
    }
  });
}

function updateLoop() {
  if (game) {
    // Update timer
    const time = game.getRaceTime();
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const tenths = Math.floor((time % 1) * 10);
    elements.raceTimer.textContent =
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;

    // Update standings
    updateStandings();

    // Update pump panel cooldowns
    updatePumpPanel();

    // Update start button state
    if (!game.isRacing && elements.btnStart.textContent !== 'Start Race') {
      elements.btnStart.textContent = 'Start Race';
    }
  }

  requestAnimationFrame(updateLoop);
}

function updateStandings() {
  const scene = game.getScene();
  const isBossLevel = scene?.bossWinCondition === 'boss' || scene?.bossWinCondition === 'either';
  const isChainActive = mapChain.isChainActive();

  let standings = game.getStandings();

  // Get cumulative points if chain is active
  const getPoints = (ballName) => isChainActive ? pointSystem.getPoints(ballName) : 0;

  // For boss levels, sort by damage dealt instead of progress
  if (isBossLevel) {
    standings = [...standings].sort((a, b) => (b.damageDealtToBoss || 0) - (a.damageDealtToBoss || 0));

    // Find max damage for percentage calculation
    const maxDamage = Math.max(...standings.map(b => b.damageDealtToBoss || 0), 1);

    elements.standings.innerHTML = standings.map((ball, index) => {
      const damage = ball.damageDealtToBoss || 0;
      const damagePercent = (damage / maxDamage) * 100;
      const pts = getPoints(ball.name);
      return `
        <div class="standing-item">
          <span class="standing-pos">${index + 1}</span>
          <div class="standing-ball" style="background: ${ball.color}"></div>
          <span class="standing-name">${ball.name}</span>
          <div class="standing-progress" title="${damage} damage">
            <div class="standing-progress-fill" style="width: ${damagePercent}%; background: #ff6b6b;"></div>
          </div>
          <span style="font-size: 10px; color: #ff6b6b; min-width: 30px; text-align: right;">${damage}</span>
          ${isChainActive ? `<span style="font-size: 10px; color: #ffd700; min-width: 30px; text-align: right;">${pts}p</span>` : ''}
        </div>
      `;
    }).join('');
  } else {
    // Normal race - show progress
    elements.standings.innerHTML = standings.map((ball, index) => {
      const pts = getPoints(ball.name);
      return `
        <div class="standing-item">
          <span class="standing-pos">${index + 1}</span>
          <div class="standing-ball" style="background: ${ball.color}"></div>
          <span class="standing-name">${ball.name}</span>
          <div class="standing-progress">
            <div class="standing-progress-fill" style="width: ${ball.progress}%"></div>
          </div>
          ${isChainActive ? `<span style="font-size: 10px; color: #ffd700; min-width: 30px; text-align: right;">${pts}p</span>` : ''}
        </div>
      `;
    }).join('');
  }
}

// ============================================
// VOLUME PANEL SYSTEM
// ============================================

function setupVolumePanel() {
  // Initialize volume system with default balls
  volumeSystem.initialize();

  // Render initial UI
  renderVolumeBallsList();
  renderVolumeRankings();

  // Set up change listener
  volumeSystem.onChange((ranks) => {
    renderVolumeRankings();
    updateVolumeBallAmounts();
  });

  // Set up button listeners
  document.getElementById('btn-randomize-volume')?.addEventListener('click', () => {
    volumeSystem.randomizeAll();
    renderVolumeBallsList();
  });

  document.getElementById('chk-auto-fluctuate')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      volumeSystem.startAutoFluctuate();
    } else {
      volumeSystem.stopAutoFluctuate();
    }
  });

  // Boss test buttons
  document.getElementById('btn-spawn-boss')?.addEventListener('click', () => {
    const scene = window.game?.getScene();
    if (!scene || !scene.bossSystem) {
      console.error('[BossTest] Scene or bossSystem not found');
      return;
    }

    const pattern = document.getElementById('boss-pattern')?.value || 'spiral';
    const hp = parseInt(document.getElementById('boss-hp')?.value) || 100;

    // Spawn boss near top center of screen
    const x = scene.gameWidth / 2;
    const y = 100;

    scene.bossSystem.spawn(x, y, {
      health: hp,
      width: 80,
      height: 80,
      color: 0xcc3300,
      shape: 'rectangle'
    });

    scene.bossSystem.setPattern(pattern);

    document.getElementById('boss-status').textContent = `Boss spawned! HP: ${hp}, Pattern: ${pattern}`;
    console.log('[BossTest] Boss spawned with pattern:', pattern);
  });

  document.getElementById('btn-remove-boss')?.addEventListener('click', () => {
    const scene = window.game?.getScene();
    if (!scene || !scene.bossSystem) {
      console.error('[BossTest] Scene or bossSystem not found');
      return;
    }

    scene.bossSystem.cleanup();
    document.getElementById('boss-status').textContent = 'No boss spawned';
    console.log('[BossTest] Boss removed');
  });

  // Stats panel buttons
  document.getElementById('btn-export-stats')?.addEventListener('click', () => {
    statisticsSystem.exportStats();
    console.log('[Stats] Exported statistics');
  });

  document.getElementById('btn-reset-stats')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
      statisticsSystem.resetStats();
      updateStatsDashboard();
      console.log('[Stats] Statistics reset');
    }
  });

  // Turbo Mode controls
  let turboState = {
    active: false,
    targetChains: 0,
    completedChains: 0,
    speed: 4
  };

  document.getElementById('btn-start-turbo')?.addEventListener('click', () => {
    const speed = parseInt(document.getElementById('turbo-speed')?.value || '4');
    const chainCount = parseInt(document.getElementById('turbo-chain-count')?.value || '5');

    turboState = {
      active: true,
      targetChains: chainCount,
      completedChains: 0,
      speed: speed
    };

    // Store original chain complete callback
    const originalOnChainComplete = mapChain.onChainComplete;

    // Set turbo chain complete handler
    mapChain.onChainComplete = (results) => {
      turboState.completedChains++;

      // Update progress
      const percent = (turboState.completedChains / turboState.targetChains) * 100;
      document.getElementById('turbo-progress-bar').style.width = `${percent}%`;
      document.getElementById('turbo-status').textContent = `Chain ${turboState.completedChains}/${turboState.targetChains} - Winner: ${results[0]?.name || '?'}`;

      // Update stats
      updateStatsDashboard();

      // Check if more chains to run
      if (turboState.active && turboState.completedChains < turboState.targetChains) {
        // Start next chain after short delay
        setTimeout(() => {
          if (turboState.active) {
            startTurboChain();
          }
        }, 500);
      } else {
        // Done!
        turboState.active = false;
        document.getElementById('btn-start-turbo').disabled = false;
        document.getElementById('btn-stop-turbo').disabled = true;
        document.getElementById('turbo-status').textContent = `Complete! ${turboState.completedChains} chains run`;

        // Restore normal speed
        const scene = game?.getScene();
        if (scene) {
          scene.setTurboMode(false);
        }

        // Restore original callback
        mapChain.onChainComplete = originalOnChainComplete;
      }
    };

    // UI updates
    document.getElementById('btn-start-turbo').disabled = true;
    document.getElementById('btn-stop-turbo').disabled = false;
    document.getElementById('turbo-progress').style.display = 'block';
    document.getElementById('turbo-status').textContent = 'Starting...';

    // Enable turbo mode on scene
    const scene = game?.getScene();
    if (scene) {
      scene.setTurboMode(true, speed);
    }

    // Auto-skip betting
    bettingSystem.autoSkip = true;

    // Start first chain
    startTurboChain();
  });

  function startTurboChain() {
    // Get selected chain type
    const chainSelect = document.getElementById('select-chain');
    const chainType = chainSelect?.value || 'weapons';

    let chain;
    switch (chainType) {
      case 'race':
        chain = CHAIN_RACE_MAPS;
        break;
      case 'boss':
        chain = CHAIN_BOSS_MAPS;
        break;
      case 'mixed':
        chain = CHAIN_MIXED;
        break;
      case 'weapons':
      default:
        chain = CHAIN_WEAPONS_TEST;
        break;
    }

    // Check for custom chains
    if (chainType.startsWith('chain-')) {
      const savedChains = JSON.parse(localStorage.getItem('gmi-chains') || '[]');
      const customChain = savedChains.find(c => c.id === chainType);
      if (customChain?.maps) {
        chain = customChain.maps;
      }
    }

    // Reset transitioning flag
    isLevelTransitioning = false;

    mapChain.setChain(chain);

    // Clear onMapChange - we handle loading directly in proceedToNextLevel
    mapChain.onMapChange = null;

    // Initialize point system for chain
    pointSystem.startLevel(0, chain.length);

    // Load first map
    const firstMap = mapChain.getCurrentMap();
    if (firstMap) {
      loadChainMap(firstMap);
      updateChainUI();

      // Start statistics tracking for first race
      statisticsSystem.startRace(0, firstMap?.name || 'Unknown', !!firstMap?.bossConfig);
    }

    // Enable turbo mode on scene after map is loaded
    setTimeout(() => {
      const scene = game?.getScene();
      if (scene) {
        scene.setTurboMode(true, turboState.speed);
        console.log('[Turbo] Turbo mode enabled on scene at', turboState.speed + 'x');
      }
    }, 100);

    // Auto-start race after short delay
    setTimeout(() => {
      if (turboState.active && game) {
        console.log('[Turbo] Starting first race');
        game.startRace();
      }
    }, 500);
  }

  document.getElementById('btn-stop-turbo')?.addEventListener('click', () => {
    turboState.active = false;

    // Restore normal speed
    const scene = game?.getScene();
    if (scene) {
      scene.setTurboMode(false);
    }

    // Disable auto-skip
    bettingSystem.autoSkip = false;

    document.getElementById('btn-start-turbo').disabled = false;
    document.getElementById('btn-stop-turbo').disabled = true;
    document.getElementById('turbo-status').textContent = 'Stopped';
  });

  console.log('[VolumePanel] Initialized');
}

// ============================================
// MAP CHAIN SYSTEM
// ============================================

function setupMapChain() {
  const selectChain = document.getElementById('select-chain');
  const btnStartChain = document.getElementById('btn-start-chain');
  const btnStopChain = document.getElementById('btn-stop-chain');
  const chainProgress = document.getElementById('chain-progress');

  // Initialize betting system
  bettingSystem.init();

  // Create pump panel for live betting during race
  createPumpPanel();

  // Betting system callbacks
  bettingSystem.onBettingEnd = (skipped, bets) => {
    console.log('[MapChain] Betting ended, skipped:', skipped, 'bets:', bets);
    gameLog.log(skipped ? 'Betting skipped' : `Betting complete! ${bets.length} bets placed`, 'system');

    // Clear any existing inventory from previous chains (balls start fresh)
    const scene = window.game?.getScene();
    if (scene && scene.inventorySystem) {
      scene.inventorySystem.clear();
      console.log('[MapChain] Cleared inventory for new chain - balls start with no weapons');
    }

    // Initialize point system for this chain
    const ballNames = volumeSystem.getAllBalls().map(b => b.name);
    pointSystem.initChain(ballNames);

    // Load first map and start race
    const firstMap = mapChain.getCurrentMap();
    loadChainMap(firstMap);
    updateChainUI();

    // Start level tracking
    pointSystem.startLevel(0, mapChain.getTotalLevels());

    btnStartChain.style.display = 'none';
    btnStopChain.style.display = 'block';

    // Auto-start race after map loads
    setTimeout(() => {
      const scene = window.game?.getScene();
      if (scene) {
        scene.reset();
        setTimeout(() => {
          isLevelTransitioning = false; // Reset guard for first race

          // Start statistics tracking for this race
          const currentMap = mapChain.getCurrentMap();
          statisticsSystem.startRace(
            mapChain.getCurrentLevel() - 1,
            currentMap?.name || 'Unknown',
            !!currentMap?.bossConfig
          );

          // Record each ball's weapons
          if (scene.inventorySystem && scene.balls) {
            scene.balls.forEach(ball => {
              const weapons = scene.inventorySystem.getWeapons(ball.name);
              statisticsSystem.recordBallWeapons(ball.name, weapons);
            });
          }

          window.game.startRace();
          gameLog.log('Race started!', 'system');
        }, 500);
      }
    }, 800);
  };

  bettingSystem.onPump = (ballName, amount) => {
    gameLog.log(`${ballName} PUMPED +${bettingSystem.formatVolume(amount)}!`, 'victory');

    // Apply temporary boost to the ball
    const scene = window.game?.getScene();
    if (scene && scene.inventorySystem) {
      scene.inventorySystem.addBuff(ballName, 'speed', 3000, { multiplier: 1.3 });
      scene.inventorySystem.addBuff(ballName, 'damage', 5000, { multiplier: 1.5 });
    }
  };

  // Chain selection
  selectChain?.addEventListener('change', (e) => {
    const chainType = e.target.value;
    if (chainType) {
      chainProgress.style.display = 'block';
      btnStartChain.style.display = 'block';
    } else {
      chainProgress.style.display = 'none';
    }
  });

  // Start chain button - now shows betting phase first
  btnStartChain?.addEventListener('click', () => {
    const chainType = selectChain?.value;
    if (!chainType) return;

    let chain;
    switch (chainType) {
      case 'race':
        chain = CHAIN_RACE_MAPS;
        break;
      case 'boss':
        chain = CHAIN_BOSS_MAPS;
        break;
      case 'mixed':
        chain = CHAIN_MIXED;
        break;
      case 'weapons':
        chain = CHAIN_WEAPONS_TEST;
        break;
      default:
        return;
    }

    // Set up the chain
    mapChain.setChain(chain);

    // Set up callbacks
    mapChain.onMapChange = (nextMap, index) => {
      loadChainMap(nextMap);
      updateChainUI();
    };

    mapChain.onChainComplete = () => {
      console.log('[MapChain] onChainComplete callback triggered!');
      console.log('[MapChain] Stack trace:', new Error().stack);
      showChainCompleteScreen(() => {
        isLevelTransitioning = false;
      });
      btnStartChain.style.display = 'block';
      btnStopChain.style.display = 'none';
    };

    console.log('[MapChain] Starting betting phase for chain:', chainType);

    // Start betting phase instead of immediately loading map
    bettingSystem.startBettingPhase(30); // 30 seconds for testing, change to 120 for production
  });

  // Stop chain button
  btnStopChain?.addEventListener('click', () => {
    mapChain.stop();
    btnStartChain.style.display = 'block';
    btnStopChain.style.display = 'none';
    gameLog.log('Chain stopped', 'system');
  });

  console.log('[MapChain] Initialized');
}

function loadChainMap(mapData) {
  if (!mapData) return;

  const scene = window.game?.getScene();
  if (!scene) {
    console.error('[MapChain] Scene not found!');
    return;
  }

  console.log('[MapChain] Loading map:', mapData.name);

  // IMPORTANT: Clean up old boss before loading new map
  if (scene.bossSystem) {
    scene.bossSystem.cleanup();
    console.log('[MapChain] Cleaned up old boss');
  }

  // Load the map
  scene.loadEditorMapData(mapData);

  // Spawn boss if map has boss config
  if (mapData.bossConfig) {
    // Set win condition from boss config (defaults to 'boss' for backwards compatibility)
    scene.bossWinCondition = mapData.bossConfig.winCondition || 'boss';
    console.log('[MapChain] Boss win condition:', scene.bossWinCondition);

    setTimeout(() => {
      const cfg = mapData.bossConfig;
      if (scene.bossSystem) {
        scene.bossSystem.spawn(cfg.x, cfg.y, {
          width: cfg.width,
          height: cfg.height,
          health: cfg.health,
          color: cfg.color
        });
        scene.bossSystem.setPattern(cfg.pattern);
        if (cfg.attackCooldown) {
          scene.bossSystem.setAttackCooldown(cfg.attackCooldown);
        }
        console.log('[MapChain] Boss spawned:', cfg.pattern, 'HP:', cfg.health);
      }
    }, 300); // Slightly longer delay to ensure map is loaded
  } else {
    // No boss - default to finish zone win condition
    scene.bossWinCondition = 'finish';
  }
}

function updateChainUI() {
  const progress = mapChain.getProgress();
  const currentMap = mapChain.getCurrentMap();

  document.getElementById('chain-level-text').textContent = `Level ${progress.current}/${progress.total}`;
  document.getElementById('chain-map-name').textContent = currentMap?.name || 'Unknown';
  document.getElementById('chain-progress-bar').style.width = `${progress.percent}%`;

  // Update pump panel if visible
  updatePumpPanel();
}

/**
 * Create and show pump panel during race
 */
function createPumpPanel() {
  let panel = document.getElementById('pump-panel');
  if (panel) return;

  panel = document.createElement('div');
  panel.id = 'pump-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    padding: 15px 25px;
    border-radius: 12px;
    display: none;
    gap: 15px;
    z-index: 100;
    border: 2px solid #4a5568;
  `;

  const balls = volumeSystem.getAllBalls();
  panel.innerHTML = `
    <span style="color: #888; font-size: 0.9em; margin-right: 10px;">PUMP:</span>
    ${balls.map(ball => `
      <button class="pump-btn" data-ball="${ball.name}" style="
        padding: 8px 15px;
        background: ${ball.color};
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        position: relative;
      ">
        ${ball.name}
        <span class="pump-cooldown" style="
          position: absolute;
          top: -8px;
          right: -8px;
          background: #ff6b6b;
          color: white;
          font-size: 10px;
          padding: 2px 5px;
          border-radius: 10px;
          display: none;
        "></span>
      </button>
    `).join('')}
  `;

  document.body.appendChild(panel);

  // Add click handlers
  panel.querySelectorAll('.pump-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ballName = btn.dataset.ball;
      const result = bettingSystem.pumpBall(ballName, 1000);

      if (!result.success) {
        // Show cooldown feedback
        btn.style.opacity = '0.5';
        setTimeout(() => { btn.style.opacity = '1'; }, 200);
      }
    });
  });
}

/**
 * Update pump panel cooldown displays
 */
function updatePumpPanel() {
  const panel = document.getElementById('pump-panel');
  if (!panel) return;

  const scene = window.game?.getScene();
  const isRacing = scene?.isRacing && mapChain.isChainActive();

  panel.style.display = isRacing ? 'flex' : 'none';

  if (isRacing) {
    panel.querySelectorAll('.pump-btn').forEach(btn => {
      const ballName = btn.dataset.ball;
      const cooldown = bettingSystem.getPumpCooldown(ballName);
      const cooldownEl = btn.querySelector('.pump-cooldown');

      if (cooldown > 0) {
        cooldownEl.textContent = cooldown + 's';
        cooldownEl.style.display = 'block';
        btn.style.opacity = '0.6';
      } else {
        cooldownEl.style.display = 'none';
        btn.style.opacity = '1';
      }
    });
  }
}

// Guard against double completion
let isLevelTransitioning = false;

// Called when a level is completed (race finish or boss death)
function onLevelComplete() {
  if (!mapChain.isChainActive()) {
    console.log('[Chain] onLevelComplete called but chain not active, ignoring');
    return;
  }

  if (isLevelTransitioning) {
    console.log('[Chain] onLevelComplete called but already transitioning, ignoring');
    return;
  }

  isLevelTransitioning = true;
  console.log('[Chain] onLevelComplete called, setting transitioning flag');

  const currentLevel = mapChain.getCurrentLevel();
  const totalLevels = mapChain.getTotalLevels();
  const isFinalLevel = currentLevel >= totalLevels;
  const levelIndex = currentLevel - 1; // 0-indexed

  gameLog.log(`Level ${currentLevel} complete!`, 'victory');
  console.log('[Chain] Level complete, transitioning... (Final:', isFinalLevel, ')');

  const scene = window.game?.getScene();

  // Record level results with point system
  if (scene?.balls) {
    const standings = scene.balls
      .filter(b => !b.eliminated)
      .sort((a, b) => {
        if (a.finished && b.finished) return a.finishPosition - b.finishPosition;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.progress - a.progress;
      })
      .map((ball, index) => ({
        name: ball.name,
        position: index + 1,
        damageDealtToBoss: ball.damageDealtToBoss || 0,
        color: ball.color
      }));

    // Get most pumped ball for bonus
    const mostPumped = bettingSystem.getMostPumpedBall();

    // Record points
    const levelResults = pointSystem.recordLevelResults(standings, levelIndex, totalLevels, {
      mostPumpedBall: mostPumped?.ballName
    });

    // Record statistics for this race
    const statsResults = scene.balls
      .filter(b => !b.eliminated)
      .sort((a, b) => {
        if (a.finished && b.finished) return a.finishPosition - b.finishPosition;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.progress - a.progress;
      })
      .map((ball, index) => {
        const levelResult = levelResults?.results?.find(r => r.name === ball.name);
        return {
          name: ball.name,
          position: index + 1,
          levelTotal: levelResult?.levelTotal || 0,
          damageDealtToBoss: ball.damageDealtToBoss || 0,
          timedOut: ball.timedOut || false,
          previousPosition: pointSystem.lastLevelPositions?.get(ball.name) || null
        };
      });

    statisticsSystem.recordRaceResults(statsResults, {
      mostPumpedBall: mostPumped?.ballName,
      bossKiller: pointSystem.bossKiller,
      firstBlood: pointSystem.firstBloodClaimed ? null : null // TODO: track who got first blood
    });

    // Reset pump tracking for next level
    bettingSystem.resetForNewRace();
  }

  // Function to proceed to next level
  const proceedToNextLevel = () => {
    console.log('[Chain] proceedToNextLevel called');
    console.log('[Chain] Current state: index=', mapChain.currentIndex, 'total=', mapChain.maps.length, 'active=', mapChain.isActive);

    const nextMap = mapChain.nextMap();
    console.log('[Chain] nextMap returned:', nextMap ? nextMap.name : 'NULL');

    if (nextMap) {
      console.log('[Chain] Loading next map:', nextMap.name);

      // Serialize inventory before loading new map
      let inventoryData = null;
      if (scene?.inventorySystem) {
        inventoryData = scene.inventorySystem.serialize();
        console.log('[Chain] Saved inventory data');
      }

      // Load the new map (cleans up old boss, spawns new one)
      loadChainMap(nextMap);
      updateChainUI();

      // Start tracking for next level
      pointSystem.startLevel(mapChain.getCurrentLevel() - 1, totalLevels);

      // Determine delays based on turbo mode
      const isTurbo = scene?.turboMode || false;
      const loadDelay = isTurbo ? 200 : 800;
      const startDelay = isTurbo ? 100 : 800;

      // Auto-start race after map is fully loaded
      setTimeout(() => {
        const newScene = window.game?.getScene();
        if (newScene) {
          console.log('[Chain] Resetting scene...');

          // Restore inventory from previous level
          if (inventoryData && newScene.inventorySystem) {
            newScene.inventorySystem.deserialize(inventoryData);
            console.log('[Chain] Restored inventory data');
          }

          // Re-apply turbo mode after loading new map
          if (isTurbo) {
            newScene.setTurboMode(true, scene?.timeScale || 4);
          }

          newScene.reset(); // Reset balls to spawn positions

          setTimeout(() => {
            console.log('[Chain] Starting race...');
            isLevelTransitioning = false; // Reset the guard

            // Start statistics tracking for this race
            statisticsSystem.startRace(
              mapChain.getCurrentLevel() - 1,
              nextMap?.name || 'Unknown',
              !!nextMap?.bossConfig
            );

            // Record each ball's weapons
            if (newScene.inventorySystem && newScene.balls) {
              newScene.balls.forEach(ball => {
                const weapons = newScene.inventorySystem.getWeapons(ball.name);
                statisticsSystem.recordBallWeapons(ball.name, weapons);
              });
            }

            window.game.startRace();
            gameLog.log('Race started!', 'system');
          }, startDelay);
        }
      }, loadDelay); // Wait for boss spawn (300ms) + buffer
    }
  };

  // Skip roulette on final level - show final results instead
  if (isFinalLevel) {
    console.log('[Chain] Final level complete - showing final results');
    const delay = scene?.turboMode ? 100 : 2500;
    setTimeout(() => {
      showChainCompleteScreen(() => {
        isLevelTransitioning = false;
      });
    }, delay);
    return;
  }

  // Check if roulette system is available
  if (scene?.rouletteSystem && scene.balls) {
    // Get all balls sorted by position for roulette
    const sortedBalls = scene.balls
      .filter(b => !b.eliminated)
      .sort((a, b) => {
        if (a.finished && b.finished) return a.finishPosition - b.finishPosition;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.progress - a.progress;
      });

    if (sortedBalls.length > 0) {
      // Convert to standings format for roulette
      const standings = sortedBalls.map((ball, index) => ({
        name: ball.name,
        color: ball.body?.render?.fillStyle || ball.color || 0xff0000,
        position: index + 1
      }));

      console.log('[Chain] Showing roulette for all balls:', standings.map(s => s.name).join(', '));

      // Check for turbo mode - skip animation but still assign weapons
      if (scene.turboMode) {
        console.log('[Chain] Turbo mode - instant roulette');
        scene.rouletteSystem.showAllInstant(standings, (results) => {
          console.log('[Chain] Instant roulette complete, weapons assigned');
          // Minimal delay in turbo mode
          setTimeout(proceedToNextLevel, 100);
        });
      } else {
        gameLog.log('All balls spin the reward wheel!', 'victory');

        // Short delay before showing roulette
        setTimeout(() => {
          scene.rouletteSystem.showAll(standings, () => {
            console.log('[Chain] Roulette complete, proceeding to next level');
            // Proceed to next level after roulette completes
            proceedToNextLevel();
          });
        }, 1500);
      }
    } else {
      // No balls found, proceed directly
      const delay = scene?.turboMode ? 100 : 2500;
      setTimeout(proceedToNextLevel, delay);
    }
  } else {
    // No roulette system, proceed with normal delay
    const delay = scene?.turboMode ? 100 : 2500;
    setTimeout(proceedToNextLevel, delay);
  }
}

// Expose to global for scene to call
window.onLevelComplete = onLevelComplete;

// Start the app
init();
