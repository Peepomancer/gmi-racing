import Phaser from 'phaser';
import { RaceScene } from './scenes/RaceScene.js';

// Global config holder to avoid race condition with Phaser scene init
let pendingGameConfig = null;

export function getPendingGameConfig() {
  return pendingGameConfig;
}

export class Game {
  constructor(containerId, config) {
    this.config = config;
    this.isRacing = false;
    this.raceStartTime = 0;
    this.raceTime = 0;

    // Store config globally BEFORE creating Phaser game to avoid race condition
    // RaceScene.create() may run before registry.set() is called
    pendingGameConfig = config;

    // Get container dimensions
    const container = document.getElementById(containerId);
    const width = container ? container.clientWidth : 800;
    const height = container ? container.clientHeight : 600;

    // Phaser game config - NO GRAVITY for DVD-style bouncing
    const phaserConfig = {
      type: Phaser.AUTO,
      parent: containerId,
      width: width || 800,
      height: height || 600,
      backgroundColor: '#e8e0d0',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      physics: {
        default: 'matter',
        matter: {
          gravity: { y: 0 },  // NO GRAVITY - DVD screensaver style
          debug: false,
          enableSleeping: false,
          // Improve collision detection for fast-moving balls
          positionIterations: 30,  // More iterations = better tunneling prevention
          velocityIterations: 30,
          constraintIterations: 6
        }
      },
      scene: [RaceScene]
    };

    this.game = new Phaser.Game(phaserConfig);

    // Also store in registry for later access
    this.game.registry.set('controller', this);
    this.game.registry.set('gameConfig', config);
  }

  getScene() {
    return this.game.scene.getScene('RaceScene');
  }

  updateConfig(newConfig) {
    this.config = newConfig;
    this.game.registry.set('gameConfig', newConfig);

    const scene = this.getScene();
    if (scene && scene.onConfigUpdate) {
      scene.onConfigUpdate(newConfig);
    }
  }

  startRace() {
    this.isRacing = true;
    this.raceStartTime = Date.now();

    const scene = this.getScene();
    if (scene) {
      scene.startRace();
    }
  }

  stopRace() {
    this.isRacing = false;

    const scene = this.getScene();
    if (scene) {
      scene.stopRace();
    }
  }

  reset() {
    this.isRacing = false;
    this.raceTime = 0;
    this.raceStartTime = 0;

    const scene = this.getScene();
    if (scene) {
      scene.reset();
    }
  }

  regenerateMap() {
    const scene = this.getScene();
    if (scene) {
      scene.regenerateMap();
    }
  }

  getRaceTime() {
    if (!this.isRacing) return this.raceTime;
    this.raceTime = (Date.now() - this.raceStartTime) / 1000;
    return this.raceTime;
  }

  getStandings() {
    const scene = this.getScene();
    if (scene && scene.getStandings) {
      return scene.getStandings();
    }
    return [];
  }
}
