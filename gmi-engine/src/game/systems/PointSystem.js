/**
 * PointSystem.js - Tracks points across chain/campaign
 *
 * SCORING:
 * - Position points: 1st=10, 2nd=8, 3rd=6, 4th=4, 5th=2
 * - Level multipliers: Escalating (1x, 1.25x, 1.5x, 2x for final)
 * - Boss bonuses: Damage dealt, kill shot, first blood
 * - Comeback bonuses: Position improvement rewards
 *
 * FEATURES:
 * - Tracks cumulative points per ball
 * - Level history with detailed breakdown
 * - Live leaderboard
 * - Multiplier system for later levels
 */

import { gameLog } from './GameLog.js';

// Point values for positions
const POSITION_POINTS = {
  1: 10,
  2: 8,
  3: 6,
  4: 4,
  5: 2
};

// Bonus point values
const BONUS_POINTS = {
  BOSS_KILL: 5,           // Final blow on boss
  FIRST_BLOOD: 2,         // First to damage boss
  DAMAGE_PER_50: 1,       // +1 point per 50 damage dealt
  POSITION_JUMP_2: 3,     // Improve 2+ positions from last level
  POSITION_JUMP_3: 5,     // Improve 3+ positions from last level
  UNDERDOG_WIN: 5,        // Win from 4th or 5th place
  MOST_PUMPED: 2          // Most volume pumped during level
};

class PointSystemManager {
  constructor() {
    // Cumulative points per ball
    this.points = new Map(); // ballName -> total points

    // Level history
    this.levelHistory = []; // Array of level results

    // Current level tracking
    this.currentLevelPoints = new Map(); // ballName -> points this level
    this.currentLevelBonuses = new Map(); // ballName -> [bonus descriptions]

    // Position tracking for jump bonuses
    this.lastLevelPositions = new Map(); // ballName -> position last level

    // Boss tracking
    this.firstBloodClaimed = false;
    this.bossKiller = null;

    // Settings
    this.useEscalatingMultipliers = true;
    this.useComebackBonuses = true;
    this.useBossBonuses = true;

    // Callbacks
    this.onPointsUpdate = null;
  }

  /**
   * Initialize for a new chain
   */
  initChain(ballNames) {
    this.points.clear();
    this.levelHistory = [];
    this.lastLevelPositions.clear();

    ballNames.forEach(name => {
      this.points.set(name, 0);
    });

    console.log('[PointSystem] Initialized for', ballNames.length, 'balls');
  }

  /**
   * Start a new level
   */
  startLevel(levelIndex, totalLevels) {
    this.currentLevelPoints.clear();
    this.currentLevelBonuses.clear();
    this.firstBloodClaimed = false;
    this.bossKiller = null;

    // Initialize current level tracking
    for (const [name] of this.points) {
      this.currentLevelPoints.set(name, 0);
      this.currentLevelBonuses.set(name, []);
    }

    console.log('[PointSystem] Level', levelIndex + 1, 'started');
  }

  /**
   * Get level multiplier based on position in chain
   */
  getLevelMultiplier(levelIndex, totalLevels) {
    if (!this.useEscalatingMultipliers) return 1;

    const isFinal = levelIndex === totalLevels - 1;
    if (isFinal) return 2.0;

    // Gradual increase: 1x, 1.25x, 1.5x, etc.
    const progress = levelIndex / (totalLevels - 1);
    return 1 + progress * 0.5;
  }

  /**
   * Record first blood (first to damage boss)
   */
  recordFirstBlood(ballName) {
    if (this.firstBloodClaimed || !this.useBossBonuses) return;

    this.firstBloodClaimed = true;
    this.addBonus(ballName, BONUS_POINTS.FIRST_BLOOD, 'First Blood');
    gameLog.log(`${ballName} draws FIRST BLOOD! +${BONUS_POINTS.FIRST_BLOOD} pts`, 'victory');
  }

  /**
   * Record boss kill
   */
  recordBossKill(ballName) {
    if (!this.useBossBonuses) return;

    this.bossKiller = ballName;
    this.addBonus(ballName, BONUS_POINTS.BOSS_KILL, 'Boss Kill');
    gameLog.log(`${ballName} lands the KILLING BLOW! +${BONUS_POINTS.BOSS_KILL} pts`, 'victory');
  }

  /**
   * Add bonus points to a ball for current level
   */
  addBonus(ballName, points, reason) {
    const current = this.currentLevelPoints.get(ballName) || 0;
    this.currentLevelPoints.set(ballName, current + points);

    const bonuses = this.currentLevelBonuses.get(ballName) || [];
    bonuses.push({ points, reason });
    this.currentLevelBonuses.set(ballName, bonuses);
  }

  /**
   * Calculate and record level results
   * @param {Array} standings - Array of { name, position, damageDealtToBoss }
   * @param {number} levelIndex - Current level index
   * @param {number} totalLevels - Total levels in chain
   * @param {Object} options - { mostPumpedBall }
   */
  recordLevelResults(standings, levelIndex, totalLevels, options = {}) {
    const multiplier = this.getLevelMultiplier(levelIndex, totalLevels);
    const levelResults = {
      levelIndex,
      multiplier,
      results: []
    };

    standings.forEach((ball, index) => {
      const position = index + 1;
      const ballName = ball.name;

      // Base position points
      let basePoints = POSITION_POINTS[position] || 1;

      // Add damage bonus (1 point per 50 damage)
      if (this.useBossBonuses && ball.damageDealtToBoss) {
        const damageBonus = Math.floor(ball.damageDealtToBoss / 50);
        if (damageBonus > 0) {
          this.addBonus(ballName, damageBonus, `Damage (${ball.damageDealtToBoss})`);
        }
      }

      // Position jump bonus
      if (this.useComebackBonuses) {
        const lastPosition = this.lastLevelPositions.get(ballName);
        if (lastPosition) {
          const improvement = lastPosition - position;
          if (improvement >= 3) {
            this.addBonus(ballName, BONUS_POINTS.POSITION_JUMP_3, `Jumped ${improvement} positions`);
          } else if (improvement >= 2) {
            this.addBonus(ballName, BONUS_POINTS.POSITION_JUMP_2, `Jumped ${improvement} positions`);
          }

          // Underdog win (was 4th or 5th, now 1st)
          if (lastPosition >= 4 && position === 1) {
            this.addBonus(ballName, BONUS_POINTS.UNDERDOG_WIN, 'Underdog Victory');
            gameLog.log(`${ballName} UNDERDOG VICTORY! +${BONUS_POINTS.UNDERDOG_WIN} pts`, 'victory');
          }
        }
      }

      // Most pumped bonus
      if (options.mostPumpedBall === ballName) {
        this.addBonus(ballName, BONUS_POINTS.MOST_PUMPED, 'Most Pumped');
      }

      // Calculate total for this level (base + bonuses) * multiplier
      const levelBonuses = this.currentLevelPoints.get(ballName) || 0;
      const levelTotal = Math.round((basePoints + levelBonuses) * multiplier);

      // Add to cumulative points
      const currentTotal = this.points.get(ballName) || 0;
      this.points.set(ballName, currentTotal + levelTotal);

      // Record for history
      levelResults.results.push({
        name: ballName,
        position,
        basePoints,
        bonuses: this.currentLevelBonuses.get(ballName) || [],
        multiplier,
        levelTotal,
        cumulativeTotal: this.points.get(ballName)
      });

      // Update last position
      this.lastLevelPositions.set(ballName, position);
    });

    this.levelHistory.push(levelResults);

    // Log results
    this.logLevelResults(levelResults);

    if (this.onPointsUpdate) {
      this.onPointsUpdate(this.getLeaderboard());
    }

    return levelResults;
  }

  /**
   * Log level results to game log
   */
  logLevelResults(levelResults) {
    gameLog.log(`--- LEVEL ${levelResults.levelIndex + 1} POINTS (${levelResults.multiplier}x) ---`, 'system');

    levelResults.results.forEach(r => {
      const bonusText = r.bonuses.length > 0
        ? ` + ${r.bonuses.map(b => b.reason).join(', ')}`
        : '';
      gameLog.log(
        `#${r.position} ${r.name}: ${r.basePoints}${bonusText} = ${r.levelTotal} pts (Total: ${r.cumulativeTotal})`,
        r.position === 1 ? 'victory' : 'info'
      );
    });
  }

  /**
   * Get current leaderboard sorted by points
   */
  getLeaderboard() {
    return Array.from(this.points.entries())
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({
        ...entry,
        position: index + 1,
        gap: index === 0 ? 0 : this.getLeader().points - entry.points
      }));
  }

  /**
   * Get current leader
   */
  getLeader() {
    let maxPoints = -1;
    let leader = null;

    for (const [name, points] of this.points) {
      if (points > maxPoints) {
        maxPoints = points;
        leader = { name, points };
      }
    }

    return leader;
  }

  /**
   * Get points for a specific ball
   */
  getPoints(ballName) {
    return this.points.get(ballName) || 0;
  }

  /**
   * Get full level history
   */
  getHistory() {
    return this.levelHistory;
  }

  /**
   * Get final results (for chain complete)
   */
  getFinalResults() {
    const leaderboard = this.getLeaderboard();
    return {
      winner: leaderboard[0],
      standings: leaderboard,
      history: this.levelHistory,
      totalLevels: this.levelHistory.length
    };
  }

  /**
   * Check if race is close (top 2 within threshold)
   */
  isCloseRace(threshold = 5) {
    const leaderboard = this.getLeaderboard();
    if (leaderboard.length < 2) return false;
    return leaderboard[1].gap <= threshold;
  }

  /**
   * Reset for new chain
   */
  reset() {
    this.points.clear();
    this.levelHistory = [];
    this.currentLevelPoints.clear();
    this.currentLevelBonuses.clear();
    this.lastLevelPositions.clear();
    this.firstBloodClaimed = false;
    this.bossKiller = null;
  }
}

// Singleton
export const pointSystem = new PointSystemManager();
