/**
 * MapChain - Campaign/level progression system
 *
 * PURPOSE:
 * Manages sequences of maps (levels) that auto-progress when completed.
 * Supports both race maps (finish line) and boss maps (defeat boss).
 *
 * FEATURES:
 * - Chain multiple maps into a campaign
 * - Auto-advance to next level on completion
 * - Progress tracking (current level, total levels, percentage)
 * - Callbacks for map change and chain completion
 * - Built-in map chains for testing
 *
 * BUILT-IN CHAINS:
 * - CHAIN_RACE_MAPS: 3 race levels (Easy Start → Narrow Path → Breakable Barrier)
 * - CHAIN_BOSS_MAPS: 3 boss fights (Spiral → Spread Shot → Aimed Fury)
 * - CHAIN_MIXED: 6 levels alternating races and bosses
 *
 * LEVEL COMPLETION TRIGGERS:
 * - Race maps: All balls finish or are eliminated
 * - Boss maps: Boss health reaches 0
 *
 * USAGE:
 *   mapChain.setChain(CHAIN_BOSS_MAPS);  // Start boss chain
 *   mapChain.getCurrentMap();             // Get current level data
 *   mapChain.nextMap();                   // Advance to next level
 *   mapChain.getProgress();               // { current: 2, total: 3, percent: 66 }
 *
 * MAP DATA FORMAT:
 *   {
 *     id: "map-id",
 *     name: "Display Name",
 *     width: 800, height: 700,
 *     startZone: { x, y, width, height },
 *     finishZone: { x, y, width, height },  // Off-screen for boss maps
 *     bossConfig: { x, y, health, pattern, color },  // Optional
 *     obstacles: [...]
 *   }
 *
 * @module MapChain
 */

import { gameLog } from './GameLog.js';

class MapChainSystem {
  constructor() {
    this.maps = [];
    this.currentIndex = 0;
    this.isActive = false;
    this.onMapChange = null;
    this.onChainComplete = null;
  }

  /**
   * Set the chain of maps to play through
   * @param {Array} maps - Array of map objects or map IDs
   */
  setChain(maps) {
    this.maps = maps;
    this.currentIndex = 0;
    this.isActive = true;
    console.log('[MapChain] Chain set with', maps.length, 'maps');
    gameLog.log(`Map chain started: ${maps.length} levels`, 'system');
  }

  /**
   * Get current map
   */
  getCurrentMap() {
    if (this.currentIndex < this.maps.length) {
      return this.maps[this.currentIndex];
    }
    return null;
  }

  /**
   * Get current level number (1-indexed for display)
   */
  getCurrentLevel() {
    return this.currentIndex + 1;
  }

  /**
   * Get total maps in chain
   */
  getTotalLevels() {
    return this.maps.length;
  }

  /**
   * Advance to next map
   * @returns {Object|null} Next map or null if chain complete
   */
  nextMap() {
    console.log('[MapChain] nextMap called, currentIndex before increment:', this.currentIndex);
    this.currentIndex++;
    console.log('[MapChain] currentIndex after increment:', this.currentIndex, 'maps.length:', this.maps.length);

    if (this.currentIndex >= this.maps.length) {
      // Chain complete
      this.isActive = false;
      console.log('[MapChain] Chain complete! (currentIndex >= maps.length)');
      gameLog.log('ALL LEVELS COMPLETE!', 'victory');

      if (this.onChainComplete) {
        console.log('[MapChain] Calling onChainComplete callback');
        this.onChainComplete();
      }
      return null;
    }

    const nextMap = this.maps[this.currentIndex];
    console.log('[MapChain] Advancing to level', this.currentIndex + 1);
    gameLog.log(`Level ${this.currentIndex + 1}/${this.maps.length}: ${nextMap.name || 'Unknown'}`, 'system');

    if (this.onMapChange) {
      this.onMapChange(nextMap, this.currentIndex);
    }

    return nextMap;
  }

  /**
   * Reset chain to beginning
   */
  reset() {
    this.currentIndex = 0;
    if (this.maps.length > 0) {
      this.isActive = true;
    }
  }

  /**
   * Stop the chain
   */
  stop() {
    this.isActive = false;
  }

  /**
   * Check if chain is active
   */
  isChainActive() {
    return this.isActive && this.currentIndex < this.maps.length;
  }

  /**
   * Get progress info
   */
  getProgress() {
    return {
      current: this.currentIndex + 1,
      total: this.maps.length,
      percent: Math.round(((this.currentIndex + 1) / this.maps.length) * 100),
      isComplete: this.currentIndex >= this.maps.length
    };
  }
}

// Singleton
export const mapChain = new MapChainSystem();


// ============================================
// BUILT-IN MAP CHAINS
// ============================================

// Simple race maps (no boss)
export const CHAIN_RACE_MAPS = [
  {
    id: "chain-race-1",
    name: "Level 1: Easy Start",
    width: 800,
    height: 600,
    startZone: { x: 100, y: 520, width: 600, height: 60 },
    finishZone: { x: 300, y: 30, width: 200, height: 40 },
    obstacles: [
      // Simple deflectors
      { id: "d1", type: "rectangle", x: 200, y: 400, width: 100, height: 15, color: "#4a5568", behavior: "static", angle: 15 },
      { id: "d2", type: "rectangle", x: 500, y: 400, width: 100, height: 15, color: "#4a5568", behavior: "static", angle: -15 },
      { id: "d3", type: "rectangle", x: 350, y: 300, width: 100, height: 15, color: "#4a5568", behavior: "static" },
      // Bumpers
      { id: "b1", type: "circle", x: 200, y: 200, radius: 25, color: "#f39c12", behavior: "static" },
      { id: "b2", type: "circle", x: 600, y: 200, radius: 25, color: "#f39c12", behavior: "static" }
    ]
  },
  {
    id: "chain-race-2",
    name: "Level 2: Narrow Path",
    width: 800,
    height: 600,
    startZone: { x: 100, y: 520, width: 600, height: 60 },
    finishZone: { x: 350, y: 30, width: 100, height: 40 },
    obstacles: [
      // Funnel walls
      { id: "w1", type: "rectangle", x: 100, y: 100, width: 200, height: 20, color: "#2d3748", behavior: "static", angle: 30 },
      { id: "w2", type: "rectangle", x: 500, y: 100, width: 200, height: 20, color: "#2d3748", behavior: "static", angle: -30 },
      // Narrow corridor walls
      { id: "c1", type: "rectangle", x: 300, y: 150, width: 20, height: 200, color: "#2d3748", behavior: "static" },
      { id: "c2", type: "rectangle", x: 480, y: 150, width: 20, height: 200, color: "#2d3748", behavior: "static" },
      // Chaos bumpers
      { id: "b1", type: "circle", x: 390, y: 250, radius: 20, color: "#e74c3c", behavior: "static" },
      { id: "b2", type: "circle", x: 200, y: 350, radius: 30, color: "#f39c12", behavior: "static" },
      { id: "b3", type: "circle", x: 600, y: 350, radius: 30, color: "#f39c12", behavior: "static" },
      // Rotating obstacle
      { id: "r1", type: "rectangle", x: 400, y: 450, width: 150, height: 12, color: "#9b59b6", behavior: "rotating", rotationSpeed: 2, rotationDirection: "cw" }
    ]
  },
  {
    id: "chain-race-3",
    name: "Level 3: Breakable Barrier",
    width: 800,
    height: 600,
    startZone: { x: 100, y: 520, width: 600, height: 60 },
    finishZone: { x: 300, y: 30, width: 200, height: 40 },
    obstacles: [
      // Breakable wall blocking finish
      { id: "break1", type: "rectangle", x: 200, y: 100, width: 150, height: 25, color: "#e74c3c", behavior: "breakable", health: 2, maxHealth: 2 },
      { id: "break2", type: "rectangle", x: 450, y: 100, width: 150, height: 25, color: "#3498db", behavior: "breakable", health: 3, maxHealth: 3 },
      // Deflectors
      { id: "d1", type: "rectangle", x: 150, y: 300, width: 120, height: 15, color: "#4a5568", behavior: "static", angle: -25 },
      { id: "d2", type: "rectangle", x: 530, y: 300, width: 120, height: 15, color: "#4a5568", behavior: "static", angle: 25 },
      // Bumpers for chaos
      { id: "b1", type: "circle", x: 400, y: 400, radius: 35, color: "#f39c12", behavior: "static" },
      { id: "b2", type: "circle", x: 200, y: 200, radius: 25, color: "#9b59b6", behavior: "static" },
      { id: "b3", type: "circle", x: 600, y: 200, radius: 25, color: "#9b59b6", behavior: "static" }
    ]
  }
];

// Boss fight chain
export const CHAIN_BOSS_MAPS = [
  {
    id: "chain-boss-1",
    name: "Boss 1: Spiral",
    width: 800,
    height: 700,
    startZone: { x: 100, y: 620, width: 600, height: 60 },
    finishZone: { x: -100, y: -100, width: 10, height: 10 },
    bossConfig: {
      x: 400, y: 100,
      width: 80, height: 60,
      health: 80,
      pattern: 'spiral',
      color: 0xcc3300
    },
    obstacles: [
      { id: "cover1", type: "rectangle", x: 150, y: 350, width: 80, height: 15, color: "#4a5568", behavior: "static" },
      { id: "cover2", type: "rectangle", x: 570, y: 350, width: 80, height: 15, color: "#4a5568", behavior: "static" },
      { id: "ramp1", type: "rectangle", x: 100, y: 500, width: 100, height: 12, color: "#3498db", behavior: "static", angle: -30 },
      { id: "ramp2", type: "rectangle", x: 600, y: 500, width: 100, height: 12, color: "#3498db", behavior: "static", angle: 30 },
      { id: "bump1", type: "circle", x: 400, y: 300, radius: 20, color: "#f39c12", behavior: "static" }
    ]
  },
  {
    id: "chain-boss-2",
    name: "Boss 2: Spread Shot",
    width: 800,
    height: 700,
    startZone: { x: 100, y: 620, width: 600, height: 60 },
    finishZone: { x: -100, y: -100, width: 10, height: 10 },
    bossConfig: {
      x: 400, y: 100,
      width: 100, height: 70,
      health: 120,
      pattern: 'spread',
      color: 0x9900cc
    },
    obstacles: [
      // More cover for spread pattern
      { id: "cover1", type: "rectangle", x: 120, y: 300, width: 100, height: 20, color: "#4a5568", behavior: "static" },
      { id: "cover2", type: "rectangle", x: 580, y: 300, width: 100, height: 20, color: "#4a5568", behavior: "static" },
      { id: "cover3", type: "rectangle", x: 350, y: 380, width: 100, height: 20, color: "#4a5568", behavior: "static" },
      { id: "ramp1", type: "rectangle", x: 80, y: 480, width: 120, height: 12, color: "#3498db", behavior: "static", angle: -35 },
      { id: "ramp2", type: "rectangle", x: 600, y: 480, width: 120, height: 12, color: "#3498db", behavior: "static", angle: 35 },
      { id: "spinner", type: "rectangle", x: 400, y: 250, width: 100, height: 10, color: "#e74c3c", behavior: "rotating", rotationSpeed: 1.5, rotationDirection: "ccw" }
    ]
  },
  {
    id: "chain-boss-3",
    name: "Final Boss: Aimed Fury",
    width: 800,
    height: 700,
    startZone: { x: 100, y: 620, width: 600, height: 60 },
    finishZone: { x: -100, y: -100, width: 10, height: 10 },
    bossConfig: {
      x: 400, y: 100,
      width: 120, height: 90,
      health: 200,
      pattern: 'aimed',
      attackCooldown: 600,
      color: 0xff0000
    },
    obstacles: [
      // Lots of cover for aimed shots
      { id: "c1", type: "rectangle", x: 100, y: 280, width: 70, height: 18, color: "#4a5568", behavior: "static" },
      { id: "c2", type: "rectangle", x: 630, y: 280, width: 70, height: 18, color: "#4a5568", behavior: "static" },
      { id: "c3", type: "rectangle", x: 250, y: 350, width: 70, height: 18, color: "#4a5568", behavior: "static" },
      { id: "c4", type: "rectangle", x: 480, y: 350, width: 70, height: 18, color: "#4a5568", behavior: "static" },
      { id: "c5", type: "rectangle", x: 360, y: 420, width: 80, height: 18, color: "#4a5568", behavior: "static" },
      // Ramps
      { id: "r1", type: "rectangle", x: 60, y: 500, width: 140, height: 12, color: "#3498db", behavior: "static", angle: -40 },
      { id: "r2", type: "rectangle", x: 600, y: 500, width: 140, height: 12, color: "#3498db", behavior: "static", angle: 40 },
      // Danger spinners
      { id: "s1", type: "rectangle", x: 200, y: 220, width: 80, height: 10, color: "#e74c3c", behavior: "rotating", rotationSpeed: 2, rotationDirection: "cw" },
      { id: "s2", type: "rectangle", x: 600, y: 220, width: 80, height: 10, color: "#e74c3c", behavior: "rotating", rotationSpeed: 2, rotationDirection: "ccw" }
    ]
  }
];

// Mixed chain (race + boss)
export const CHAIN_MIXED = [
  CHAIN_RACE_MAPS[0], // Easy race
  CHAIN_RACE_MAPS[1], // Narrow path
  CHAIN_BOSS_MAPS[0], // Boss 1
  CHAIN_RACE_MAPS[2], // Breakable barrier
  CHAIN_BOSS_MAPS[1], // Boss 2
  CHAIN_BOSS_MAPS[2]  // Final boss
];

// Weapon & Item Test Chain
export const CHAIN_WEAPONS_TEST = [
  {
    id: "chain-weapons-1",
    name: "Level 1: Item Intro",
    width: 800,
    height: 600,
    startZone: { x: 50, y: 500, width: 700, height: 60 },
    finishZone: { x: 50, y: 30, width: 700, height: 40 },
    obstacles: [
      { id: "obs-1", type: "rectangle", x: 0, y: 250, width: 250, height: 25, color: "#e74c3c", behavior: "static" },
      { id: "obs-2", type: "rectangle", x: 550, y: 250, width: 250, height: 25, color: "#e74c3c", behavior: "static" },
      { id: "obs-3", type: "rectangle", x: 200, y: 380, width: 400, height: 25, color: "#3498db", behavior: "static" },
      { id: "obs-4", type: "circle", x: 400, y: 150, radius: 40, color: "#9b59b6", behavior: "rotating", rotationSpeed: 2, rotationDirection: "cw" }
    ],
    itemSpawns: [
      { id: "item-1", x: 150, y: 420, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 0 },
      { id: "item-2", x: 400, y: 420, itemType: "random", spawnOnStart: true, respawnTime: 0 },
      { id: "item-3", x: 650, y: 420, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 0 },
      { id: "item-4", x: 400, y: 300, itemType: "speed_boost", spawnOnStart: true, respawnTime: 5000 },
      { id: "item-5", x: 200, y: 180, itemType: "health_pack", spawnOnStart: true, respawnTime: 8000 },
      { id: "item-6", x: 600, y: 180, itemType: "shield", spawnOnStart: true, respawnTime: 10000 }
    ]
  },
  {
    id: "chain-weapons-2",
    name: "Level 2: Weapon Arena",
    width: 800,
    height: 700,
    startZone: { x: 50, y: 600, width: 700, height: 60 },
    finishZone: { x: 50, y: 30, width: 700, height: 40 },
    obstacles: [
      { id: "obs-wall-left", type: "rectangle", x: 0, y: 200, width: 150, height: 25, color: "#e74c3c", behavior: "static" },
      { id: "obs-wall-right", type: "rectangle", x: 650, y: 200, width: 150, height: 25, color: "#e74c3c", behavior: "static" },
      { id: "obs-moving-1", type: "rectangle", x: 200, y: 350, width: 120, height: 25, color: "#f39c12", behavior: "moving", moveDirection: "horizontal", moveDistance: 200, moveSpeed: 60 },
      { id: "obs-moving-2", type: "rectangle", x: 480, y: 350, width: 120, height: 25, color: "#f39c12", behavior: "moving", moveDirection: "horizontal", moveDistance: 200, moveSpeed: 60 },
      { id: "obs-spinner-1", type: "rectangle", x: 350, y: 480, width: 100, height: 20, color: "#9b59b6", behavior: "rotating", rotationSpeed: 3, rotationDirection: "cw" },
      { id: "obs-breakable-1", type: "rectangle", x: 300, y: 150, width: 80, height: 80, color: "#2ecc71", behavior: "breakable", health: 3, breakableBy: ["Red", "Blue", "Green", "Yellow", "Purple"] },
      { id: "obs-breakable-2", type: "rectangle", x: 420, y: 150, width: 80, height: 80, color: "#2ecc71", behavior: "breakable", health: 3, breakableBy: ["Red", "Blue", "Green", "Yellow", "Purple"] }
    ],
    itemSpawns: [
      { id: "item-wep-1", x: 100, y: 450, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 8000 },
      { id: "item-wep-2", x: 700, y: 450, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 8000 },
      { id: "item-wep-3", x: 400, y: 550, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 5000 },
      { id: "item-damage", x: 400, y: 280, itemType: "damage_boost", spawnOnStart: true, respawnTime: 12000 },
      { id: "item-speed-1", x: 200, y: 280, itemType: "speed_boost", spawnOnStart: true, respawnTime: 6000 },
      { id: "item-speed-2", x: 600, y: 280, itemType: "speed_boost", spawnOnStart: true, respawnTime: 6000 },
      { id: "item-ghost", x: 400, y: 400, itemType: "ghost", spawnOnStart: true, respawnTime: 15000 },
      { id: "item-heal-1", x: 100, y: 280, itemType: "health_pack", spawnOnStart: true, respawnTime: 10000 },
      { id: "item-heal-2", x: 700, y: 280, itemType: "health_pack", spawnOnStart: true, respawnTime: 10000 }
    ]
  },
  {
    id: "chain-weapons-3",
    name: "Level 3: Boss Battle",
    width: 900,
    height: 700,
    startZone: { x: 50, y: 600, width: 800, height: 60 },
    finishZone: { x: -100, y: -100, width: 10, height: 10 },
    bossConfig: {
      x: 450, y: 120,
      width: 200, height: 100,
      health: 150,
      pattern: 'mixed',
      attackCooldown: 2000,
      color: 0xff4400
    },
    obstacles: [
      { id: "obs-pillar-1", type: "rectangle", x: 150, y: 300, width: 40, height: 200, color: "#7f8c8d", behavior: "static" },
      { id: "obs-pillar-2", type: "rectangle", x: 350, y: 300, width: 40, height: 200, color: "#7f8c8d", behavior: "static" },
      { id: "obs-pillar-3", type: "rectangle", x: 510, y: 300, width: 40, height: 200, color: "#7f8c8d", behavior: "static" },
      { id: "obs-pillar-4", type: "rectangle", x: 710, y: 300, width: 40, height: 200, color: "#7f8c8d", behavior: "static" },
      { id: "obs-cover-1", type: "rectangle", x: 100, y: 450, width: 150, height: 30, color: "#34495e", behavior: "static" },
      { id: "obs-cover-2", type: "rectangle", x: 650, y: 450, width: 150, height: 30, color: "#34495e", behavior: "static" }
    ],
    itemSpawns: [
      { id: "item-wep-left", x: 80, y: 550, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 6000 },
      { id: "item-wep-right", x: 820, y: 550, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 6000 },
      { id: "item-wep-center", x: 450, y: 550, itemType: "weapon_crate", spawnOnStart: true, respawnTime: 4000 },
      { id: "item-shield-1", x: 250, y: 400, itemType: "shield", spawnOnStart: true, respawnTime: 12000 },
      { id: "item-shield-2", x: 650, y: 400, itemType: "shield", spawnOnStart: true, respawnTime: 12000 },
      { id: "item-damage-boost", x: 450, y: 480, itemType: "damage_boost", spawnOnStart: true, respawnTime: 15000 },
      { id: "item-heal-left", x: 175, y: 550, itemType: "health_pack", spawnOnStart: true, respawnTime: 8000 },
      { id: "item-heal-right", x: 725, y: 550, itemType: "health_pack", spawnOnStart: true, respawnTime: 8000 },
      { id: "item-speed-center", x: 450, y: 400, itemType: "speed_boost", spawnOnStart: true, respawnTime: 10000 }
    ]
  }
];
