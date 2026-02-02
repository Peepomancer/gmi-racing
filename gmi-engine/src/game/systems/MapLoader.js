import { getMapStorage } from '../../shared/MapStorage.js';

/**
 * MapLoader - Loads editor maps into the game
 * Converts editor map format to game-compatible format
 */
export class MapLoader {
  constructor() {
    this.mapStorage = null;
    this.currentMap = null;
  }

  async init() {
    this.mapStorage = getMapStorage();
    await this.mapStorage.init();
  }

  /**
   * List all available maps
   * @returns {Promise<Array>} Array of map summaries
   */
  async listMaps() {
    if (!this.mapStorage) await this.init();
    return this.mapStorage.listMaps();
  }

  /**
   * Load a map by ID
   * @param {string} id - Map ID
   * @returns {Promise<Object|null>} Map data formatted for game use
   */
  async loadMap(id) {
    if (!this.mapStorage) await this.init();

    const map = await this.mapStorage.loadMap(id);
    if (!map) return null;

    this.currentMap = map;
    return this.convertToGameFormat(map);
  }

  /**
   * Convert editor map format to game-compatible format
   * @param {Object} map - Editor map data
   * @returns {Object} Game-compatible map data
   */
  convertToGameFormat(map) {
    const data = map.data || {};

    // Calculate finish and spawn Y from zones
    const finishY = data.finishZone ? data.finishZone.y + data.finishZone.height / 2 : 60;
    const spawnY = data.startZone ? data.startZone.y + data.startZone.height / 2 : map.height - 80;

    // Convert obstacles to game format
    const obstacles = (data.obstacles || []).map(obs => ({
      // IMPORTANT: Include the ID for animation matching
      id: obs.id,

      // Basic properties
      type: obs.type,
      x: obs.x,
      y: obs.y,
      width: obs.width,
      height: obs.height,
      radius: obs.radius,
      angle: (obs.angle || 0) * Math.PI / 180, // Convert degrees to radians
      color: obs.color,

      // Behavior
      behavior: obs.behavior || 'static',

      // Breakable properties
      breakable: obs.behavior === 'breakable',
      health: obs.health || 3,
      maxHealth: obs.health || 3,
      breakableBy: obs.breakableBy || [],

      // Rotating properties
      rotating: obs.behavior === 'rotating',
      rotationSpeed: obs.rotationSpeed || 2,
      rotationDirection: obs.rotationDirection || 'cw',

      // Moving properties
      moving: obs.behavior === 'moving',
      moveDirection: obs.moveDirection || 'horizontal',
      moveDistance: obs.moveDistance || 100,
      moveSpeed: obs.moveSpeed || 50,
      movePhase: 0, // Current movement phase (0 to 1)
      moveStartX: obs.x,
      moveStartY: obs.y,

      // Crusher properties
      crusher: obs.behavior === 'crusher',
      crusherDirection: obs.crusherDirection || 'down',
      crusherSpeed: obs.crusherSpeed || 80,
      crusherResetDelay: obs.crusherResetDelay || 2000
    }));

    return {
      id: map.id,
      name: map.name,
      width: map.width,
      height: map.height,
      obstacles,
      finishY,
      spawnY,
      startZone: data.startZone,
      finishZone: data.finishZone,
      animations: data.animations || null, // IMPORTANT: Include animation data!
      bossConfig: data.bossConfig || null, // IMPORTANT: Include boss configuration!
      lanes: 5 // Default lanes
    };
  }

  /**
   * Get spawn positions for balls based on start zone
   * @param {Object} startZone - Start zone data
   * @param {number} ballCount - Number of balls
   * @returns {Array} Array of {x, y} positions
   */
  getSpawnPositions(startZone, ballCount) {
    if (!startZone) {
      // Fallback: spread across bottom
      return Array.from({ length: ballCount }, (_, i) => ({
        x: 50 + (i * 100),
        y: 500
      }));
    }

    const positions = [];
    const laneWidth = startZone.width / ballCount;
    const centerY = startZone.y + startZone.height / 2;

    for (let i = 0; i < ballCount; i++) {
      positions.push({
        x: startZone.x + laneWidth * i + laneWidth / 2,
        y: centerY
      });
    }

    return positions;
  }
}

// Singleton instance
let instance = null;

export function getMapLoader() {
  if (!instance) {
    instance = new MapLoader();
  }
  return instance;
}
