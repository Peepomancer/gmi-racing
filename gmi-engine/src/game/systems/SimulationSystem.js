/**
 * SimulationSystem.js - Auto-run multiple chains for data collection
 *
 * Simulates races with randomized outcomes to gather statistics quickly.
 * Results are properly recorded to StatisticsSystem.
 */

import { statisticsSystem } from './StatisticsSystem.js';
import { WEAPON_TYPES } from './WeaponDefinitions.js';

class SimulationSystemManager {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentChain = 0;
    this.totalChains = 0;
    this.currentLevel = 0;
    this.onProgress = null;
    this.onComplete = null;

    // Ball names
    this.balls = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];

    // Available weapons for simulation
    this.weaponIds = Object.keys(WEAPON_TYPES);
  }

  /**
   * Run multiple chain simulations
   * @param {number} chainCount - Number of chains to simulate
   * @param {object} options - Simulation options
   */
  async runSimulation(chainCount, options = {}) {
    if (this.isRunning) {
      console.warn('[Simulation] Already running');
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.totalChains = chainCount;
    this.currentChain = 0;

    const levelsPerChain = options.levelsPerChain || 3;

    console.log(`[Simulation] Starting ${chainCount} chain simulation (${levelsPerChain} levels each)`);

    const results = {
      startTime: Date.now(),
      chainsCompleted: 0,
      racesCompleted: 0,
      chainResults: [],
      ballWins: { Red: 0, Blue: 0, Green: 0, Yellow: 0, Purple: 0 },
      ballChainWins: { Red: 0, Blue: 0, Green: 0, Yellow: 0, Purple: 0 },
      weaponStats: {}
    };

    for (let i = 0; i < chainCount && this.isRunning; i++) {
      this.currentChain = i + 1;

      // Wait if paused
      while (this.isPaused && this.isRunning) {
        await this.sleep(50);
      }

      if (!this.isRunning) break;

      const chainResult = await this.simulateChain(levelsPerChain, options);

      if (chainResult) {
        results.chainsCompleted++;
        results.racesCompleted += chainResult.levels.length;
        results.chainResults.push(chainResult);

        // Track chain winner
        if (chainResult.winner) {
          results.ballChainWins[chainResult.winner]++;
        }

        // Track level wins
        chainResult.levels.forEach(level => {
          if (level.winner) {
            results.ballWins[level.winner]++;
          }
        });
      }

      // Progress callback
      if (this.onProgress) {
        this.onProgress({
          current: this.currentChain,
          total: this.totalChains,
          percent: Math.round((this.currentChain / this.totalChains) * 100),
          lastWinner: chainResult?.winner,
          racesCompleted: results.racesCompleted
        });
      }

      // Small delay between chains
      await this.sleep(10);
    }

    results.endTime = Date.now();
    results.duration = (results.endTime - results.startTime) / 1000;
    results.summary = this.generateSummary(results);

    this.isRunning = false;
    console.log('[Simulation] Complete', results.summary);

    if (this.onComplete) {
      this.onComplete(results);
    }

    return results;
  }

  /**
   * Simulate a single chain
   */
  async simulateChain(levelCount, options = {}) {
    const chainResult = {
      levels: [],
      winner: null,
      finalStandings: null
    };

    // Track cumulative points through chain
    const cumulativePoints = {};
    this.balls.forEach(ball => cumulativePoints[ball] = 0);

    for (let levelIdx = 0; levelIdx < levelCount && this.isRunning; levelIdx++) {
      this.currentLevel = levelIdx + 1;

      // Wait if paused
      while (this.isPaused && this.isRunning) {
        await this.sleep(50);
      }

      const isBossLevel = levelIdx === levelCount - 1;
      const levelResult = await this.simulateLevel(levelIdx, isBossLevel, cumulativePoints);
      chainResult.levels.push(levelResult);

      // Update cumulative points
      levelResult.results.forEach(r => {
        cumulativePoints[r.name] += r.points;
      });
    }

    // Determine chain winner (highest cumulative points)
    if (chainResult.levels.length > 0) {
      const sortedBalls = Object.entries(cumulativePoints)
        .sort((a, b) => b[1] - a[1])
        .map(([name, points], idx) => ({
          name,
          points,
          position: idx + 1
        }));

      chainResult.winner = sortedBalls[0].name;
      chainResult.finalStandings = sortedBalls;

      // Record chain completion with statistics system
      statisticsSystem.recordChainComplete({
        totalLevels: chainResult.levels.length,
        results: sortedBalls
      });

      // Update chainWins for winner
      if (statisticsSystem.stats.balls[chainResult.winner]) {
        statisticsSystem.stats.balls[chainResult.winner].chainWins++;
      }
    }

    return chainResult;
  }

  /**
   * Simulate a single level/race
   */
  async simulateLevel(levelIndex, isBossLevel, currentStandings) {
    const levelName = isBossLevel ? `Boss Level ${levelIndex + 1}` : `Level ${levelIndex + 1}`;

    // Start race in statistics
    statisticsSystem.startRace(levelIndex, levelName, isBossLevel);

    // Assign random weapons to balls
    const ballWeapons = {};
    this.balls.forEach(ball => {
      const numWeapons = Math.floor(Math.random() * 3); // 0-2 weapons
      const weapons = [];
      for (let i = 0; i < numWeapons; i++) {
        const weaponId = this.weaponIds[Math.floor(Math.random() * this.weaponIds.length)];
        weapons.push({ id: weaponId });
      }
      ballWeapons[ball] = weapons;
      statisticsSystem.recordBallWeapons(ball, weapons);
    });

    // Generate race results with some randomness
    // Lower position balls get slight boost (comeback mechanic)
    const ballScores = {};
    this.balls.forEach(ball => {
      let baseScore = Math.random() * 100;

      // Underdog boost - lower ranked balls get small bonus
      const currentPoints = currentStandings[ball] || 0;
      const maxPoints = Math.max(...Object.values(currentStandings)) || 1;
      if (currentPoints < maxPoints * 0.5) {
        baseScore += Math.random() * 10; // Small comeback chance
      }

      // Weapon bonus
      const weapons = ballWeapons[ball];
      if (weapons.length > 0) {
        baseScore += weapons.length * 5;
      }

      ballScores[ball] = baseScore;
    });

    // Sort by score to get positions
    const sortedBalls = Object.entries(ballScores)
      .sort((a, b) => b[1] - a[1])
      .map(([name], idx) => name);

    // Calculate points and build results
    const basePoints = [10, 8, 6, 4, 2];
    const multiplier = 1 + (levelIndex * 0.25); // Escalating multiplier

    const results = sortedBalls.map((ball, idx) => {
      const position = idx + 1;
      const points = Math.round(basePoints[idx] * multiplier);
      const damage = isBossLevel ? Math.floor(Math.random() * 300) : Math.floor(Math.random() * 100);

      return {
        name: ball,
        position,
        levelTotal: points,
        damageDealtToBoss: damage,
        timedOut: Math.random() < 0.05 // 5% chance of timeout
      };
    });

    const levelResult = {
      levelIndex,
      levelName,
      isBossLevel,
      winner: results[0].name,
      results: results.map(r => ({
        name: r.name,
        position: r.position,
        points: r.levelTotal,
        damage: r.damageDealtToBoss
      }))
    };

    // Determine boss killer and first blood
    const bossKiller = isBossLevel ? results[Math.floor(Math.random() * 2)].name : null;
    const firstBlood = results[Math.floor(Math.random() * 3)].name;

    // Record to statistics system
    statisticsSystem.recordRaceResults(results, {
      bossKiller,
      firstBlood
    });

    return levelResult;
  }

  /**
   * Generate summary statistics
   */
  generateSummary(results) {
    return {
      chainsRun: results.chainsCompleted,
      racesRun: results.racesCompleted,
      duration: `${results.duration.toFixed(1)}s`,
      ballRaceWinRates: Object.fromEntries(
        Object.entries(results.ballWins).map(([ball, wins]) => [
          ball,
          `${((wins / results.racesCompleted) * 100).toFixed(1)}%`
        ])
      ),
      ballChainWinRates: Object.fromEntries(
        Object.entries(results.ballChainWins).map(([ball, wins]) => [
          ball,
          `${((wins / results.chainsCompleted) * 100).toFixed(1)}%`
        ])
      ),
      avgChainTime: `${(results.duration / results.chainsCompleted).toFixed(3)}s`
    };
  }

  /**
   * Stop simulation
   */
  stop() {
    this.isRunning = false;
    console.log('[Simulation] Stopped');
  }

  /**
   * Pause simulation
   */
  pause() {
    this.isPaused = true;
    console.log('[Simulation] Paused');
  }

  /**
   * Resume simulation
   */
  resume() {
    this.isPaused = false;
    console.log('[Simulation] Resumed');
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentChain: this.currentChain,
      totalChains: this.totalChains,
      currentLevel: this.currentLevel,
      progress: this.totalChains > 0 ? Math.round((this.currentChain / this.totalChains) * 100) : 0
    };
  }
}

// Singleton
export const simulationSystem = new SimulationSystemManager();

// Expose globally for console access
if (typeof window !== 'undefined') {
  window.simulationSystem = simulationSystem;
}
