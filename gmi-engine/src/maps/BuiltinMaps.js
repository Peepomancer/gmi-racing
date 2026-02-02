/**
 * BuiltinMaps - Built-in test map definitions
 * Extracted from renderer.js for modularity
 */

// Built-in test map - PHYSICS CRUSH TEST v2
// Narrow corridor | thin red wall | TRAP ZONE (yellow area)
// If balls phase through the thin wall, they get trapped in the yellow zone as proof
export const BUILTIN_CRUSHER_MAP = {
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
export const BUILTIN_BOSS_MAP = {
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
export const BUILTIN_BREAKABLE_MAP = {
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
