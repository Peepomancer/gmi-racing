/**
 * VolumeSystem - Simulates crypto trading volume for ball racing
 *
 * PURPOSE:
 * Manages fake/simulated trading volume for each ball (representing crypto tokens).
 * Volume rankings determine ball stats - higher volume = better stats.
 *
 * FEATURES:
 * - Manual volume adjustment via UI (+1K, +5K, -1K buttons)
 * - Auto-fluctuation mode simulates real trading activity
 * - Volume rankings (1st = highest volume)
 * - Stats calculation based on rank (HP, Speed, Damage)
 *
 * STAT SCALING (based on volume rank):
 * - Rank 1 (highest volume): HP=200, Speed=1.2x, Damage=15
 * - Last rank (lowest volume): HP=100, Speed=0.8x, Damage=5
 *
 * USAGE:
 *   volumeSystem.initialize();           // Set up default balls
 *   volumeSystem.addVolume('Red', 5000); // Increase Red's volume
 *   volumeSystem.getStatsForBall('Red'); // Get computed stats
 *   volumeSystem.startAutoFluctuate();   // Enable random changes
 *
 * @module VolumeSystem
 */

export class VolumeSystem {
  constructor() {
    // Volume data per ball
    this.volumes = new Map();

    // Auto-fluctuation settings
    this.autoFluctuate = false;
    this.fluctuateInterval = null;
    this.fluctuateRate = 1000; // ms between fluctuations
    this.fluctuateAmount = 0.05; // 5% max change per tick

    // Callbacks for when volume changes
    this.onChangeCallbacks = [];

    // Default balls
    this.defaultBalls = [
      { name: 'Red', color: '#ff0000', volume: 50000 },
      { name: 'Blue', color: '#0066ff', volume: 45000 },
      { name: 'Green', color: '#00cc00', volume: 40000 },
      { name: 'Yellow', color: '#ffcc00', volume: 35000 },
      { name: 'Purple', color: '#9900ff', volume: 30000 }
    ];
  }

  /**
   * Initialize with default or custom balls
   */
  initialize(balls = null) {
    this.volumes.clear();

    const ballsToUse = balls || this.defaultBalls;

    ballsToUse.forEach(ball => {
      this.volumes.set(ball.name, {
        name: ball.name,
        color: ball.color,
        volume: ball.volume,
        previousVolume: ball.volume
      });
    });

    this.notifyChange();
  }

  /**
   * Get volume for a specific ball
   */
  getVolume(ballName) {
    const data = this.volumes.get(ballName);
    return data ? data.volume : 0;
  }

  /**
   * Set volume for a specific ball
   */
  setVolume(ballName, amount) {
    const data = this.volumes.get(ballName);
    if (data) {
      data.previousVolume = data.volume;
      data.volume = Math.max(0, amount);
      this.notifyChange();
    }
  }

  /**
   * Add volume (buy simulation)
   */
  addVolume(ballName, amount) {
    const current = this.getVolume(ballName);
    this.setVolume(ballName, current + amount);
  }

  /**
   * Remove volume (sell simulation)
   */
  removeVolume(ballName, amount) {
    const current = this.getVolume(ballName);
    this.setVolume(ballName, Math.max(0, current - amount));
  }

  /**
   * Get all volumes as array sorted by volume (highest first)
   */
  getVolumeRanks() {
    const entries = Array.from(this.volumes.values());
    entries.sort((a, b) => b.volume - a.volume);

    return entries.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
  }

  /**
   * Get rank for a specific ball (1 = highest volume)
   */
  getRank(ballName) {
    const ranks = this.getVolumeRanks();
    const entry = ranks.find(r => r.name === ballName);
    return entry ? entry.rank : 0;
  }

  /**
   * Get all ball data
   */
  getAllBalls() {
    return Array.from(this.volumes.values());
  }

  /**
   * Randomize all volumes
   */
  randomizeAll(min = 20000, max = 60000) {
    this.volumes.forEach((data, name) => {
      data.previousVolume = data.volume;
      data.volume = Math.floor(Math.random() * (max - min) + min);
    });
    this.notifyChange();
  }

  /**
   * Start auto-fluctuation (simulates real trading)
   */
  startAutoFluctuate() {
    if (this.fluctuateInterval) return;

    this.autoFluctuate = true;
    this.fluctuateInterval = setInterval(() => {
      this.fluctuateTick();
    }, this.fluctuateRate);
  }

  /**
   * Stop auto-fluctuation
   */
  stopAutoFluctuate() {
    this.autoFluctuate = false;
    if (this.fluctuateInterval) {
      clearInterval(this.fluctuateInterval);
      this.fluctuateInterval = null;
    }
  }

  /**
   * Single fluctuation tick
   */
  fluctuateTick() {
    this.volumes.forEach((data, name) => {
      // Random change between -fluctuateAmount and +fluctuateAmount
      const changePercent = (Math.random() * 2 - 1) * this.fluctuateAmount;
      const change = Math.floor(data.volume * changePercent);

      data.previousVolume = data.volume;
      data.volume = Math.max(1000, data.volume + change); // Min 1000 volume
    });
    this.notifyChange();
  }

  /**
   * Register a callback for volume changes
   */
  onChange(callback) {
    this.onChangeCallbacks.push(callback);
  }

  /**
   * Remove a change callback
   */
  offChange(callback) {
    const index = this.onChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.onChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all callbacks of change
   */
  notifyChange() {
    const ranks = this.getVolumeRanks();
    this.onChangeCallbacks.forEach(callback => {
      try {
        callback(ranks);
      } catch (e) {
        console.error('[VolumeSystem] Callback error:', e);
      }
    });
  }

  /**
   * Format volume as currency string
   */
  static formatVolume(volume) {
    if (volume >= 1000000) {
      return '$' + (volume / 1000000).toFixed(2) + 'M';
    } else if (volume >= 1000) {
      return '$' + (volume / 1000).toFixed(1) + 'K';
    }
    return '$' + volume;
  }

  /**
   * Get volume change indicator (+/-)
   */
  getVolumeChange(ballName) {
    const data = this.volumes.get(ballName);
    if (!data) return { change: 0, percent: 0, direction: 'neutral' };

    const change = data.volume - data.previousVolume;
    const percent = data.previousVolume > 0
      ? ((change / data.previousVolume) * 100).toFixed(1)
      : 0;

    return {
      change,
      percent,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    };
  }

  /**
   * Get stats for a ball based on volume rank
   * Higher volume = better stats
   *
   * Stats:
   * - hp: Health points (100-200 based on rank)
   * - speed: Movement speed multiplier (0.8-1.2 based on rank)
   * - damage: Damage dealt on collision (5-15 based on rank)
   */
  getStatsForBall(ballName) {
    const ranks = this.getVolumeRanks();
    const entry = ranks.find(r => r.name === ballName);

    if (!entry) {
      return { hp: 100, maxHp: 100, speed: 1.0, damage: 10 };
    }

    const rank = entry.rank;
    const totalBalls = ranks.length;

    // Rank 1 = best stats, higher rank = worse stats
    // Normalized position: 0 = rank 1 (best), 1 = last rank (worst)
    const normalizedRank = (rank - 1) / Math.max(1, totalBalls - 1);

    // HP: Rank 1 gets 200, last rank gets 100
    const hp = Math.round(200 - (normalizedRank * 100));

    // Speed: Rank 1 gets 1.2x, last rank gets 0.8x
    const speed = 1.2 - (normalizedRank * 0.4);

    // Damage: Rank 1 deals 15, last rank deals 5
    const damage = Math.round(15 - (normalizedRank * 10));

    return {
      hp,
      maxHp: hp,
      speed: parseFloat(speed.toFixed(2)),
      damage
    };
  }

  /**
   * Get stats for all balls
   */
  getAllStats() {
    const stats = {};
    this.volumes.forEach((data, name) => {
      stats[name] = this.getStatsForBall(name);
    });
    return stats;
  }
}

// Singleton instance for global access
export const volumeSystem = new VolumeSystem();
