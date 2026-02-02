/**
 * BettingSystem.js - Manages pre-race betting and live volume pumping
 *
 * FEATURES:
 * - Pre-race betting phase with countdown
 * - Live odds calculation based on volume
 * - Volume pumping during race with cooldowns
 * - Bet tracking and payout calculation
 * - Integration with existing VolumeSystem
 *
 * BETTING FLOW:
 * 1. User selects chain/map
 * 2. Betting phase begins (configurable duration)
 * 3. Users place bets on balls
 * 4. Race starts automatically or manually
 * 5. During race: live pumping allowed with cooldowns
 * 6. Race ends: points calculated, payouts determined
 */

import { volumeSystem } from './VolumeSystem.js';

class BettingSystemManager {
  constructor() {
    // Betting phase state
    this.isInBettingPhase = false;
    this.bettingDuration = 120; // 2 minutes in seconds
    this.bettingTimeRemaining = 0;
    this.bettingTimer = null;

    // User bets tracking
    this.userBets = new Map(); // ballName -> amount bet
    this.totalUserBet = 0;

    // Pump cooldowns during race
    this.pumpCooldowns = new Map(); // ballName -> timestamp of last pump
    this.pumpCooldownDuration = 30000; // 30 seconds

    // Pump tracking for bonuses
    this.pumpsThisRace = new Map(); // ballName -> total pumped this race

    // Callbacks
    this.onBettingStart = null;
    this.onBettingEnd = null;
    this.onBettingTick = null;
    this.onPump = null;
    this.onOddsChange = null;

    // UI container
    this.containerEl = null;
  }

  /**
   * Initialize betting system with DOM container
   */
  init(containerId = 'betting-overlay') {
    this.containerEl = document.getElementById(containerId);
    if (!this.containerEl) {
      this.createBettingOverlay();
    }
    console.log('[BettingSystem] Initialized');
  }

  /**
   * Create the betting overlay UI
   */
  createBettingOverlay() {
    this.containerEl = document.createElement('div');
    this.containerEl.id = 'betting-overlay';
    this.containerEl.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      font-family: Arial, sans-serif;
    `;

    this.containerEl.innerHTML = `
      <div style="text-align: center; color: white; max-width: 900px; width: 90%;">
        <h1 style="color: #ffd700; font-size: 2.5em; margin-bottom: 10px;">PLACE YOUR BETS</h1>
        <div id="betting-timer" style="font-size: 3em; color: #ff6b6b; margin-bottom: 30px;">2:00</div>

        <div id="betting-balls" style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; margin-bottom: 30px;">
          <!-- Ball betting cards will be inserted here -->
        </div>

        <div id="betting-summary" style="background: #1a1a2e; padding: 15px 30px; border-radius: 10px; margin-bottom: 20px;">
          <span style="color: #888;">YOUR BETS:</span>
          <span id="user-bets-display" style="color: #4dabf7; margin-left: 10px;">None</span>
          <span style="color: #888; margin-left: 30px;">TOTAL:</span>
          <span id="user-total-display" style="color: #ffd700; margin-left: 10px;">0</span>
        </div>

        <div style="display: flex; gap: 15px; justify-content: center;">
          <button id="btn-skip-betting" style="
            padding: 15px 40px;
            font-size: 1.2em;
            background: #4a5568;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          ">Skip Betting</button>
          <button id="btn-start-with-bets" style="
            padding: 15px 40px;
            font-size: 1.2em;
            background: #48bb78;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          ">START RACE</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.containerEl);

    // Button handlers
    document.getElementById('btn-skip-betting')?.addEventListener('click', () => {
      this.endBettingPhase(true);
    });

    document.getElementById('btn-start-with-bets')?.addEventListener('click', () => {
      this.endBettingPhase(false);
    });
  }

  /**
   * Start the betting phase
   */
  startBettingPhase(duration = null) {
    if (duration) this.bettingDuration = duration;

    this.isInBettingPhase = true;
    this.bettingTimeRemaining = this.bettingDuration;
    this.userBets.clear();
    this.totalUserBet = 0;
    this.pumpsThisRace.clear();

    // Show overlay
    if (this.containerEl) {
      this.containerEl.style.display = 'flex';
      this.renderBettingCards();
      this.updateBettingSummary();
    }

    // Start countdown
    this.bettingTimer = setInterval(() => {
      this.bettingTimeRemaining--;
      this.updateTimerDisplay();

      if (this.onBettingTick) {
        this.onBettingTick(this.bettingTimeRemaining);
      }

      if (this.bettingTimeRemaining <= 0) {
        this.endBettingPhase(false);
      }
    }, 1000);

    if (this.onBettingStart) {
      this.onBettingStart();
    }

    console.log('[BettingSystem] Betting phase started, duration:', this.bettingDuration);
  }

  /**
   * End the betting phase
   */
  endBettingPhase(skipped = false) {
    this.isInBettingPhase = false;

    if (this.bettingTimer) {
      clearInterval(this.bettingTimer);
      this.bettingTimer = null;
    }

    // Hide overlay
    if (this.containerEl) {
      this.containerEl.style.display = 'none';
    }

    if (this.onBettingEnd) {
      this.onBettingEnd(skipped, this.getUserBets());
    }

    console.log('[BettingSystem] Betting phase ended, skipped:', skipped, 'bets:', this.getUserBets());
  }

  /**
   * Render betting cards for each ball
   */
  renderBettingCards() {
    const container = document.getElementById('betting-balls');
    if (!container) return;

    const balls = volumeSystem.getAllBalls();

    container.innerHTML = balls.map(ball => {
      const odds = this.calculateOdds(ball.name);
      const userBet = this.userBets.get(ball.name) || 0;

      return `
        <div class="betting-card" data-ball="${ball.name}" style="
          background: #2d3748;
          border-radius: 12px;
          padding: 20px;
          min-width: 140px;
          text-align: center;
          border: 3px solid ${userBet > 0 ? '#ffd700' : '#4a5568'};
          transition: border-color 0.3s;
        ">
          <div style="
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: ${ball.color};
            margin: 0 auto 10px;
            border: 3px solid white;
          "></div>
          <div style="font-weight: bold; font-size: 1.1em; color: white;">${ball.name}</div>
          <div style="color: #888; font-size: 0.9em; margin: 5px 0;">Vol: ${this.formatVolume(ball.volume)}</div>
          <div style="color: #ffd700; font-size: 1.3em; font-weight: bold; margin: 10px 0;">
            ${odds.toFixed(2)}x
          </div>
          <div style="color: #4dabf7; font-size: 0.9em; margin-bottom: 10px;">
            Your bet: ${this.formatVolume(userBet)}
          </div>
          <div style="display: flex; flex-direction: column; gap: 5px;">
            <button class="bet-btn" data-ball="${ball.name}" data-amount="1000" style="
              padding: 8px;
              background: #3182ce;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
            ">+1K</button>
            <button class="bet-btn" data-ball="${ball.name}" data-amount="5000" style="
              padding: 8px;
              background: #3182ce;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
            ">+5K</button>
            <button class="bet-btn" data-ball="${ball.name}" data-amount="10000" style="
              padding: 8px;
              background: #805ad5;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
            ">+10K</button>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.bet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ballName = e.target.dataset.ball;
        const amount = parseInt(e.target.dataset.amount);
        this.placeBet(ballName, amount);
      });
    });
  }

  /**
   * Place a bet on a ball
   */
  placeBet(ballName, amount) {
    const currentBet = this.userBets.get(ballName) || 0;
    this.userBets.set(ballName, currentBet + amount);
    this.totalUserBet += amount;

    // Also add to volume system
    volumeSystem.addVolume(ballName, amount);

    // Update UI
    this.renderBettingCards();
    this.updateBettingSummary();

    if (this.onOddsChange) {
      this.onOddsChange(this.getAllOdds());
    }

    console.log('[BettingSystem] Bet placed:', ballName, '+', amount);
  }

  /**
   * Pump a ball during race (with cooldown)
   */
  pumpBall(ballName, amount = 1000) {
    const now = Date.now();
    const lastPump = this.pumpCooldowns.get(ballName) || 0;

    if (now - lastPump < this.pumpCooldownDuration) {
      const remaining = Math.ceil((this.pumpCooldownDuration - (now - lastPump)) / 1000);
      console.log('[BettingSystem] Pump on cooldown:', remaining, 's remaining');
      return { success: false, cooldownRemaining: remaining };
    }

    // Apply pump
    this.pumpCooldowns.set(ballName, now);
    volumeSystem.addVolume(ballName, amount);

    // Track pumps this race
    const currentPumps = this.pumpsThisRace.get(ballName) || 0;
    this.pumpsThisRace.set(ballName, currentPumps + amount);

    if (this.onPump) {
      this.onPump(ballName, amount);
    }

    console.log('[BettingSystem] Pumped:', ballName, '+', amount);
    return { success: true, totalPumped: currentPumps + amount };
  }

  /**
   * Get pump cooldown remaining for a ball
   */
  getPumpCooldown(ballName) {
    const now = Date.now();
    const lastPump = this.pumpCooldowns.get(ballName) || 0;
    const elapsed = now - lastPump;

    if (elapsed >= this.pumpCooldownDuration) {
      return 0;
    }
    return Math.ceil((this.pumpCooldownDuration - elapsed) / 1000);
  }

  /**
   * Calculate odds for a ball based on volume distribution
   */
  calculateOdds(ballName) {
    const balls = volumeSystem.getAllBalls();
    const totalVolume = balls.reduce((sum, b) => sum + b.volume, 0);
    const ballVolume = volumeSystem.getVolume(ballName);

    if (totalVolume === 0 || ballVolume === 0) {
      return 5.0; // Default odds for no volume
    }

    const probability = ballVolume / totalVolume;
    // Odds = 1 / probability, with house edge
    const rawOdds = 1 / probability;
    const houseEdge = 0.95; // 5% house edge
    return Math.max(1.1, rawOdds * houseEdge);
  }

  /**
   * Get all odds
   */
  getAllOdds() {
    const balls = volumeSystem.getAllBalls();
    return balls.map(b => ({
      name: b.name,
      color: b.color,
      volume: b.volume,
      odds: this.calculateOdds(b.name)
    }));
  }

  /**
   * Update timer display
   */
  updateTimerDisplay() {
    const timerEl = document.getElementById('betting-timer');
    if (timerEl) {
      const minutes = Math.floor(this.bettingTimeRemaining / 60);
      const seconds = this.bettingTimeRemaining % 60;
      timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      // Change color when low
      if (this.bettingTimeRemaining <= 10) {
        timerEl.style.color = '#ff0000';
        timerEl.style.animation = 'pulse 0.5s infinite';
      } else if (this.bettingTimeRemaining <= 30) {
        timerEl.style.color = '#ffa500';
      }
    }
  }

  /**
   * Update betting summary display
   */
  updateBettingSummary() {
    const betsDisplay = document.getElementById('user-bets-display');
    const totalDisplay = document.getElementById('user-total-display');

    if (betsDisplay) {
      const bets = Array.from(this.userBets.entries())
        .filter(([_, amount]) => amount > 0)
        .map(([name, amount]) => `${name} ${this.formatVolume(amount)}`)
        .join(' | ');
      betsDisplay.textContent = bets || 'None';
    }

    if (totalDisplay) {
      totalDisplay.textContent = this.formatVolume(this.totalUserBet);
    }
  }

  /**
   * Get user bets summary
   */
  getUserBets() {
    return Array.from(this.userBets.entries()).map(([name, amount]) => ({
      ballName: name,
      amount
    }));
  }

  /**
   * Get most pumped ball this race
   */
  getMostPumpedBall() {
    let maxPumped = 0;
    let mostPumped = null;

    for (const [ballName, amount] of this.pumpsThisRace) {
      if (amount > maxPumped) {
        maxPumped = amount;
        mostPumped = ballName;
      }
    }

    return { ballName: mostPumped, amount: maxPumped };
  }

  /**
   * Reset for new race
   */
  resetForNewRace() {
    this.pumpCooldowns.clear();
    this.pumpsThisRace.clear();
  }

  /**
   * Format volume number
   */
  formatVolume(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return v.toString();
  }
}

// Singleton
export const bettingSystem = new BettingSystemManager();
