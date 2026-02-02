/**
 * StatisticsSystem.js - Tracks historical race statistics
 *
 * TRACKS:
 * - Win rate per ball color
 * - Average finish position
 * - Weapon effectiveness (win rate when held)
 * - Boss damage averages
 * - Comeback frequency
 * - Upset frequency (underdog wins)
 * - Race history log
 *
 * PERSISTS: All data saved to localStorage
 */

const STORAGE_KEY = 'gmi-racing-statistics';

class StatisticsSystemManager {
  constructor() {
    // Initialize with empty stats or load from storage
    this.stats = this.loadStats();

    // Current race tracking (reset each race)
    this.currentRace = null;
  }

  /**
   * Get default empty stats structure
   */
  getDefaultStats() {
    return {
      // Overall counts
      totalRaces: 0,
      totalChains: 0,

      // Per-ball statistics
      balls: {
        Red: this.getEmptyBallStats(),
        Blue: this.getEmptyBallStats(),
        Green: this.getEmptyBallStats(),
        Yellow: this.getEmptyBallStats(),
        Purple: this.getEmptyBallStats()
      },

      // Weapon statistics
      weapons: {},

      // Comeback tracking
      comebacks: {
        positionJump2: 0,  // Improved 2+ positions
        positionJump3: 0,  // Improved 3+ positions
        fifthToFirst: 0,   // 5th place to 1st
        fourthToFirst: 0,  // 4th place to 1st
        underdogWins: 0    // 4th/5th winning a level
      },

      // Race history (last 100 races)
      raceHistory: [],

      // Chain history (last 50 chains)
      chainHistory: [],

      // Timestamps
      firstRaceAt: null,
      lastRaceAt: null
    };
  }

  /**
   * Get empty ball stats structure
   */
  getEmptyBallStats() {
    return {
      races: 0,
      wins: 0,
      chainWins: 0,
      totalPoints: 0,
      finishPositions: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalDamageDealt: 0,
      bossKills: 0,
      firstBloods: 0,
      timedOut: 0
    };
  }

  /**
   * Get empty weapon stats structure
   */
  getEmptyWeaponStats() {
    return {
      timesAwarded: 0,
      racesHeld: 0,
      winsWithWeapon: 0,
      totalDamage: 0,
      bossKillsWith: 0
    };
  }

  /**
   * Load stats from localStorage
   */
  loadStats() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('[Statistics] Loaded stats from storage');
        return parsed;
      }
    } catch (e) {
      console.error('[Statistics] Failed to load stats:', e);
    }
    return this.getDefaultStats();
  }

  /**
   * Save stats to localStorage
   */
  saveStats() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
      console.log('[Statistics] Saved stats to storage');
    } catch (e) {
      console.error('[Statistics] Failed to save stats:', e);
    }
  }

  /**
   * Start tracking a new race
   */
  startRace(levelIndex, levelName, isBossLevel) {
    this.currentRace = {
      levelIndex,
      levelName,
      isBossLevel,
      startTime: Date.now(),
      ballData: {},
      weaponsUsed: {}
    };
    console.log('[Statistics] Started tracking race:', levelName);
  }

  /**
   * Record ball's weapons at race start
   */
  recordBallWeapons(ballName, weapons) {
    if (!this.currentRace) return;

    this.currentRace.ballData[ballName] = {
      weapons: weapons.map(w => w.id),
      startPosition: null,
      finishPosition: null,
      damageDealt: 0,
      timedOut: false
    };

    // Track weapon usage
    weapons.forEach(w => {
      if (!this.currentRace.weaponsUsed[w.id]) {
        this.currentRace.weaponsUsed[w.id] = [];
      }
      this.currentRace.weaponsUsed[w.id].push(ballName);
    });
  }

  /**
   * Record race results
   */
  recordRaceResults(results, options = {}) {
    if (!this.currentRace) return;

    const raceData = {
      ...this.currentRace,
      endTime: Date.now(),
      duration: (Date.now() - this.currentRace.startTime) / 1000,
      results: [],
      mostPumpedBall: options.mostPumpedBall || null,
      bossKiller: options.bossKiller || null,
      firstBlood: options.firstBlood || null
    };

    // Process each ball's result
    results.forEach((ball, index) => {
      const position = index + 1;
      const ballName = ball.name;

      // Update race data
      raceData.results.push({
        name: ballName,
        position,
        points: ball.levelTotal || 0,
        damage: ball.damageDealtToBoss || 0,
        timedOut: ball.timedOut || false
      });

      // Update ball stats
      this.updateBallStats(ballName, {
        position,
        points: ball.levelTotal || 0,
        damage: ball.damageDealtToBoss || 0,
        timedOut: ball.timedOut || false,
        isWinner: position === 1,
        isBossKiller: options.bossKiller === ballName,
        isFirstBlood: options.firstBlood === ballName
      });

      // Update weapon stats for this ball
      const ballWeapons = this.currentRace.ballData[ballName]?.weapons || [];
      ballWeapons.forEach(weaponId => {
        this.updateWeaponStats(weaponId, {
          won: position === 1,
          damage: ball.damageDealtToBoss || 0,
          bossKill: options.bossKiller === ballName
        });
      });
    });

    // Track comebacks
    this.trackComebacks(results);

    // Add to race history (keep last 100)
    this.stats.raceHistory.unshift(raceData);
    if (this.stats.raceHistory.length > 100) {
      this.stats.raceHistory.pop();
    }

    // Update totals
    this.stats.totalRaces++;
    this.stats.lastRaceAt = Date.now();
    if (!this.stats.firstRaceAt) {
      this.stats.firstRaceAt = Date.now();
    }

    // Save to storage
    this.saveStats();

    // Clear current race
    this.currentRace = null;

    console.log('[Statistics] Recorded race results');
  }

  /**
   * Update ball statistics
   */
  updateBallStats(ballName, data) {
    if (!this.stats.balls[ballName]) {
      this.stats.balls[ballName] = this.getEmptyBallStats();
    }

    const ballStats = this.stats.balls[ballName];
    ballStats.races++;
    ballStats.totalPoints += data.points || 0;
    ballStats.totalDamageDealt += data.damage || 0;

    if (data.position >= 1 && data.position <= 5) {
      ballStats.finishPositions[data.position]++;
    }

    if (data.isWinner) {
      ballStats.wins++;
    }

    if (data.isBossKiller) {
      ballStats.bossKills++;
    }

    if (data.isFirstBlood) {
      ballStats.firstBloods++;
    }

    if (data.timedOut) {
      ballStats.timedOut++;
    }
  }

  /**
   * Update weapon statistics
   */
  updateWeaponStats(weaponId, data) {
    if (!this.stats.weapons[weaponId]) {
      this.stats.weapons[weaponId] = this.getEmptyWeaponStats();
    }

    const weaponStats = this.stats.weapons[weaponId];
    weaponStats.racesHeld++;
    weaponStats.totalDamage += data.damage || 0;

    if (data.won) {
      weaponStats.winsWithWeapon++;
    }

    if (data.bossKill) {
      weaponStats.bossKillsWith++;
    }
  }

  /**
   * Record weapon awarded from roulette
   */
  recordWeaponAwarded(weaponId) {
    if (!this.stats.weapons[weaponId]) {
      this.stats.weapons[weaponId] = this.getEmptyWeaponStats();
    }
    this.stats.weapons[weaponId].timesAwarded++;
  }

  /**
   * Track comebacks
   */
  trackComebacks(results) {
    // Check each ball for comeback
    results.forEach((ball, index) => {
      const currentPosition = index + 1;
      const previousPosition = ball.previousPosition;

      if (previousPosition) {
        const improvement = previousPosition - currentPosition;

        if (improvement >= 2) {
          this.stats.comebacks.positionJump2++;
        }
        if (improvement >= 3) {
          this.stats.comebacks.positionJump3++;
        }

        // Underdog wins
        if (previousPosition >= 4 && currentPosition === 1) {
          this.stats.comebacks.underdogWins++;

          if (previousPosition === 5) {
            this.stats.comebacks.fifthToFirst++;
          } else if (previousPosition === 4) {
            this.stats.comebacks.fourthToFirst++;
          }
        }
      }
    });
  }

  /**
   * Record chain completion
   */
  recordChainComplete(finalResults) {
    const chainData = {
      timestamp: Date.now(),
      totalLevels: finalResults.totalLevels,
      winner: finalResults.winner,
      standings: finalResults.standings,
      history: finalResults.history
    };

    // Update chain winner stats
    if (finalResults.winner) {
      const winnerName = finalResults.winner.name;
      if (this.stats.balls[winnerName]) {
        this.stats.balls[winnerName].chainWins++;
      }
    }

    // Add to chain history (keep last 50)
    this.stats.chainHistory.unshift(chainData);
    if (this.stats.chainHistory.length > 50) {
      this.stats.chainHistory.pop();
    }

    this.stats.totalChains++;
    this.saveStats();

    console.log('[Statistics] Recorded chain completion');
  }

  // ============================================
  // COMPUTED STATISTICS
  // ============================================

  /**
   * Get ball win rates
   */
  getBallWinRates() {
    const rates = {};
    for (const [name, stats] of Object.entries(this.stats.balls)) {
      rates[name] = {
        winRate: stats.races > 0 ? (stats.wins / stats.races * 100).toFixed(1) : 0,
        chainWinRate: this.stats.totalChains > 0 ? (stats.chainWins / this.stats.totalChains * 100).toFixed(1) : 0,
        avgPosition: stats.races > 0 ? this.calculateAvgPosition(stats.finishPositions, stats.races).toFixed(2) : '-',
        avgPoints: stats.races > 0 ? (stats.totalPoints / stats.races).toFixed(1) : 0,
        races: stats.races,
        wins: stats.wins,
        chainWins: stats.chainWins
      };
    }
    return rates;
  }

  /**
   * Calculate average position from position counts
   */
  calculateAvgPosition(positions, totalRaces) {
    let sum = 0;
    for (const [pos, count] of Object.entries(positions)) {
      sum += parseInt(pos) * count;
    }
    return sum / totalRaces;
  }

  /**
   * Get weapon effectiveness
   */
  getWeaponEffectiveness() {
    const weapons = [];
    for (const [id, stats] of Object.entries(this.stats.weapons)) {
      if (stats.racesHeld > 0) {
        weapons.push({
          id,
          name: this.getWeaponName(id),
          winRate: (stats.winsWithWeapon / stats.racesHeld * 100).toFixed(1),
          avgDamage: (stats.totalDamage / stats.racesHeld).toFixed(0),
          timesAwarded: stats.timesAwarded,
          racesHeld: stats.racesHeld,
          wins: stats.winsWithWeapon,
          bossKills: stats.bossKillsWith
        });
      }
    }

    // Sort by win rate descending
    weapons.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));
    return weapons;
  }

  /**
   * Get weapon name from ID
   */
  getWeaponName(id) {
    const names = {
      peaShooter: 'Pea Shooter',
      shotgun: 'Shotgun',
      homingOrb: 'Homing Orb',
      bouncyShot: 'Bouncy Shot',
      sword: 'Sword',
      flail: 'Flail',
      spike: 'Spike Aura',
      hammer: 'Hammer',
      freezeAura: 'Freeze Aura',
      lightning: 'Lightning'
    };
    return names[id] || id;
  }

  /**
   * Get comeback statistics
   */
  getComebackStats() {
    const total = this.stats.totalRaces;
    return {
      positionJump2: this.stats.comebacks.positionJump2,
      positionJump2Rate: total > 0 ? (this.stats.comebacks.positionJump2 / total * 100).toFixed(1) : 0,
      positionJump3: this.stats.comebacks.positionJump3,
      positionJump3Rate: total > 0 ? (this.stats.comebacks.positionJump3 / total * 100).toFixed(1) : 0,
      underdogWins: this.stats.comebacks.underdogWins,
      underdogWinRate: total > 0 ? (this.stats.comebacks.underdogWins / total * 100).toFixed(1) : 0,
      fifthToFirst: this.stats.comebacks.fifthToFirst,
      fourthToFirst: this.stats.comebacks.fourthToFirst
    };
  }

  /**
   * Get recent race history
   */
  getRecentRaces(count = 10) {
    return this.stats.raceHistory.slice(0, count);
  }

  /**
   * Get recent chain history
   */
  getRecentChains(count = 10) {
    return this.stats.chainHistory.slice(0, count);
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return {
      totalRaces: this.stats.totalRaces,
      totalChains: this.stats.totalChains,
      firstRaceAt: this.stats.firstRaceAt,
      lastRaceAt: this.stats.lastRaceAt,
      ballWinRates: this.getBallWinRates(),
      weaponEffectiveness: this.getWeaponEffectiveness(),
      comebacks: this.getComebackStats()
    };
  }

  /**
   * Reset all statistics
   */
  resetStats() {
    this.stats = this.getDefaultStats();
    this.saveStats();
    console.log('[Statistics] Stats reset');
  }

  /**
   * Export stats as JSON
   */
  exportStats() {
    const data = {
      exportedAt: new Date().toISOString(),
      summary: this.getSummary(),
      raw: this.stats
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gmi-racing-stats-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[Statistics] Exported stats');
  }
}

// Singleton
export const statisticsSystem = new StatisticsSystemManager();
