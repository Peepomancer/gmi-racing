/**
 * RouletteSystem.js - CS:GO style loot box for ALL balls after each level
 *
 * Features:
 * - ALL 5 balls get roulette simultaneously
 * - Tiered odds based on placement (1st = better odds)
 * - S-Tier, A-Tier, B-Tier, C-Tier rewards
 * - Synchronized spin and reveal
 */

import { WEAPON_TYPES, WEAPON_TIERS, getRandomWeapon } from './WeaponDefinitions.js';
import { ITEM_TYPES, ITEM_RARITY } from './ItemDefinitions.js';
import { statisticsSystem } from './StatisticsSystem.js';

// Reward tiers with weapon/buff assignments
const REWARD_TIERS = {
  S: {
    name: 'S-TIER',
    color: 0xff44ff, // Purple/pink
    items: [
      { type: 'weapon', id: 'homingOrb', name: 'Homing Orb', icon: '🔮' },
      { type: 'weapon', id: 'lightning', name: 'Lightning', icon: '⚡' },
      { type: 'weapon', id: 'hammer', name: 'Hammer', icon: '🔨' }
    ]
  },
  A: {
    name: 'A-TIER',
    color: 0x4488ff, // Blue
    items: [
      { type: 'weapon', id: 'shotgun', name: 'Shotgun', icon: '💥' },
      { type: 'weapon', id: 'sword', name: 'Sword', icon: '⚔️' },
      { type: 'weapon', id: 'flail', name: 'Flail', icon: '⭕' }
    ]
  },
  B: {
    name: 'B-TIER',
    color: 0x44ff44, // Green
    items: [
      { type: 'weapon', id: 'peaShooter', name: 'Pea Shooter', icon: '🟢' },
      { type: 'weapon', id: 'bouncyShot', name: 'Bouncy Shot', icon: '🔵' },
      { type: 'weapon', id: 'spike', name: 'Spike Aura', icon: '🦔' }
    ]
  },
  C: {
    name: 'C-TIER',
    color: 0xaaaaaa, // Gray
    items: [
      { type: 'buff', id: 'speed', name: 'Speed Boost', icon: '💨' },
      { type: 'buff', id: 'shield', name: 'Shield', icon: '🛡️' },
      { type: 'buff', id: 'damage', name: 'Damage Up', icon: '💪' }
    ]
  }
};

// Odds by placement (percentages for each tier)
const PLACEMENT_ODDS = {
  1: { S: 30, A: 40, B: 20, C: 10 },
  2: { S: 20, A: 35, B: 30, C: 15 },
  3: { S: 10, A: 30, B: 40, C: 20 },
  4: { S: 5, A: 20, B: 45, C: 30 },
  5: { S: 2, A: 15, B: 43, C: 40 }
};

export class RouletteSystem {
  constructor(scene) {
    this.scene = scene;

    // UI elements
    this.overlay = null;
    this.titleText = null;
    this.ballRoulettes = []; // Array of roulette UI for each ball

    // State
    this.isSpinning = false;
    this.ballResults = []; // { ball, position, reward }

    // Config
    this.slotWidth = 80;
    this.slotHeight = 80;
    this.slotCount = 40;
    this.spinDuration = 4000;
    this.visibleSlots = 5;

    // Callback when roulette completes
    this.onComplete = null;
  }

  /**
   * Show roulette for ALL balls based on standings
   * @param {Array} standings - Array of { name, color, position } sorted by finish
   * @param {Function} onComplete - Callback when done
   */
  showAll(standings, onComplete) {
    if (this.isSpinning) return;

    console.log('[Roulette] showAll called with', standings.length, 'balls');
    console.log('[Roulette] Standings:', JSON.stringify(standings.map(s => ({ name: s.name, color: s.color }))));
    console.log('[Roulette] Scene dimensions:', this.scene.gameWidth, 'x', this.scene.gameHeight);

    this.onComplete = onComplete;
    this.isSpinning = true;
    this.ballResults = [];
    this.revealsCompleted = 0; // Reset reveal counter

    // Create UI
    this.createOverlay();
    this.createTitle();

    // Create a roulette strip for each ball
    standings.forEach((ball, index) => {
      const position = index + 1;
      console.log(`[Roulette] Creating roulette for ball #${position}: ${ball.name}`);
      this.createBallRoulette(ball, position, standings.length);
    });

    // Start all spinning after a brief delay
    this.scene.time.delayedCall(500, () => {
      this.spinAll();
    });
  }

  /**
   * Legacy show method for single winner (backwards compatibility)
   */
  show(winnerBall, onComplete) {
    // Convert single ball to standings format
    const standings = [{ name: winnerBall.name, color: winnerBall.color || 0xff0000, position: 1 }];
    this.showAll(standings, onComplete);
  }

  /**
   * Instant roulette - skip animation but still assign weapons (for turbo mode)
   */
  showAllInstant(standings, onComplete) {
    console.log('[Roulette] INSTANT mode - skipping animation');

    this.ballResults = [];

    // Determine rewards for each ball without animation
    standings.forEach((ball, index) => {
      const position = index + 1;
      const reward = this.determineRewardForPosition(position);

      this.ballResults.push({
        ball,
        position,
        reward
      });

      console.log(`[Roulette] Ball ${ball.name} (pos ${position}) gets: ${reward.name}`);
    });

    // Apply the rewards to inventory (same as normal roulette)
    this.applyAllRewards();

    // Immediately call complete callback
    if (onComplete) {
      onComplete(this.ballResults);
    }
  }

  /**
   * Determine a reward based on position odds (used by instant mode)
   */
  determineRewardForPosition(position) {
    const odds = PLACEMENT_ODDS[position] || PLACEMENT_ODDS[5];

    // Roll for tier
    const roll = Math.random() * 100;
    let tier;
    let cumulative = 0;

    for (const [t, chance] of Object.entries(odds)) {
      cumulative += chance;
      if (roll < cumulative) {
        tier = t;
        break;
      }
    }
    tier = tier || 'C';

    // Get items for this tier
    const tierData = REWARD_TIERS[tier] || REWARD_TIERS.C;
    const tierItems = tierData.items;
    const reward = tierItems[Math.floor(Math.random() * tierItems.length)];

    // Add tier info to reward
    return {
      ...reward,
      tierName: tierData.name,
      tierColor: tierData.color
    };
  }

  /**
   * Create dark overlay
   */
  createOverlay() {
    const width = this.scene.gameWidth;
    const height = this.scene.gameHeight;

    this.overlay = this.scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.9);
    this.overlay.fillRect(0, 0, width, height);
    this.overlay.setDepth(1000);
  }

  /**
   * Create title
   */
  createTitle() {
    const centerX = this.scene.gameWidth / 2;

    this.titleText = this.scene.add.text(centerX, 30, 'REWARD ROULETTE', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    this.titleText.setDepth(1003);
  }

  /**
   * Create roulette UI for a single ball
   */
  createBallRoulette(ball, position, totalBalls) {
    const width = this.scene.gameWidth;
    const height = this.scene.gameHeight;

    // Calculate vertical position for this ball's roulette
    const startY = 80;
    const rowHeight = (height - 120) / totalBalls;
    const rowY = startY + (position - 1) * rowHeight + rowHeight / 2;

    console.log(`[Roulette] Ball ${ball.name} (#${position}/${totalBalls}): rowY=${rowY}, rowHeight=${rowHeight}, height=${height}`);

    // Container width for visible slots
    const containerWidth = this.visibleSlots * this.slotWidth;
    const containerX = (width - containerWidth) / 2;

    // Ball indicator on the left
    const ballIndicatorX = containerX - 100;

    const ballCircle = this.scene.add.graphics();
    ballCircle.fillStyle(ball.color, 1);
    ballCircle.lineStyle(3, 0xffffff, 1);
    ballCircle.fillCircle(ballIndicatorX, rowY, 25);
    ballCircle.strokeCircle(ballIndicatorX, rowY, 25);
    ballCircle.setDepth(1002);

    const ballName = this.scene.add.text(ballIndicatorX, rowY + 35, ball.name, {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    ballName.setDepth(1002);

    const positionText = this.scene.add.text(ballIndicatorX, rowY - 40, `#${position}`, {
      fontSize: '16px',
      fontStyle: 'bold',
      color: position === 1 ? '#ffd700' : (position === 2 ? '#c0c0c0' : '#cd7f32')
    }).setOrigin(0.5);
    positionText.setDepth(1002);

    // Container background
    const containerBg = this.scene.add.graphics();
    containerBg.fillStyle(0x1a1a2e, 1);
    containerBg.fillRect(containerX - 5, rowY - this.slotHeight / 2 - 5, containerWidth + 10, this.slotHeight + 10);
    containerBg.lineStyle(2, 0x00ffff, 1);
    containerBg.strokeRect(containerX - 5, rowY - this.slotHeight / 2 - 5, containerWidth + 10, this.slotHeight + 10);
    containerBg.setDepth(1001);

    // Slots container
    const slotsContainer = this.scene.add.container(containerX, rowY - this.slotHeight / 2);
    slotsContainer.setDepth(1002);

    // Create mask
    const mask = this.scene.add.graphics();
    mask.fillStyle(0xffffff);
    mask.fillRect(containerX, rowY - this.slotHeight / 2, containerWidth, this.slotHeight);
    slotsContainer.setMask(mask.createGeometryMask());

    // Generate reward pool based on position odds
    const rewards = this.generateRewardPoolForPosition(position);
    const slots = [];

    for (let i = 0; i < this.slotCount; i++) {
      const reward = rewards[i % rewards.length];
      const slot = this.createSlot(i, reward);
      slots.push(slot);
      slotsContainer.add(slot.container);
    }

    // Center pointer
    const pointerX = containerX + containerWidth / 2;
    const pointer = this.scene.add.graphics();
    pointer.fillStyle(0xffd700, 1);
    // Triangle pointing down
    pointer.beginPath();
    pointer.moveTo(pointerX - 10, rowY - this.slotHeight / 2 - 15);
    pointer.lineTo(pointerX + 10, rowY - this.slotHeight / 2 - 15);
    pointer.lineTo(pointerX, rowY - this.slotHeight / 2);
    pointer.closePath();
    pointer.fillPath();
    // Triangle pointing up
    pointer.beginPath();
    pointer.moveTo(pointerX - 10, rowY + this.slotHeight / 2 + 15);
    pointer.lineTo(pointerX + 10, rowY + this.slotHeight / 2 + 15);
    pointer.lineTo(pointerX, rowY + this.slotHeight / 2);
    pointer.closePath();
    pointer.fillPath();
    pointer.setDepth(1003);

    // Result text (shows after spin)
    const resultText = this.scene.add.text(containerX + containerWidth + 30, rowY, '', {
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0, 0.5);
    resultText.setDepth(1003);

    // Store roulette data
    this.ballRoulettes.push({
      ball,
      position,
      containerX,
      containerWidth,
      rowY,
      slotsContainer,
      slots,
      rewards,
      pointer,
      resultText,
      ballCircle,
      ballName,
      positionText,
      containerBg,
      mask
    });
  }

  /**
   * Generate reward pool weighted by position
   */
  generateRewardPoolForPosition(position) {
    const rewards = [];
    const odds = PLACEMENT_ODDS[position] || PLACEMENT_ODDS[5];

    // Fill pool based on percentage odds
    const poolSize = 100;

    for (const [tier, percentage] of Object.entries(odds)) {
      const count = Math.round(poolSize * (percentage / 100));
      const tierData = REWARD_TIERS[tier];

      for (let i = 0; i < count; i++) {
        const item = tierData.items[Math.floor(Math.random() * tierData.items.length)];
        rewards.push({
          ...item,
          tier,
          tierName: tierData.name,
          color: tierData.color
        });
      }
    }

    // Shuffle
    for (let i = rewards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rewards[i], rewards[j]] = [rewards[j], rewards[i]];
    }

    return rewards;
  }

  /**
   * Create a single slot
   */
  createSlot(index, reward) {
    const x = index * this.slotWidth;
    const y = 0;

    const slotContainer = this.scene.add.container(x, y);

    // Slot background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x2a2a3e, 1);
    bg.fillRect(2, 2, this.slotWidth - 4, this.slotHeight - 4);
    bg.lineStyle(2, reward.color, 0.8);
    bg.strokeRect(2, 2, this.slotWidth - 4, this.slotHeight - 4);
    slotContainer.add(bg);

    // Icon
    const icon = this.scene.add.text(this.slotWidth / 2, this.slotHeight / 2 - 8, reward.icon, {
      fontSize: '28px'
    }).setOrigin(0.5);
    slotContainer.add(icon);

    // Name
    const name = this.scene.add.text(this.slotWidth / 2, this.slotHeight - 10, reward.name, {
      fontSize: '8px',
      color: '#' + reward.color.toString(16).padStart(6, '0'),
      fontStyle: 'bold'
    }).setOrigin(0.5);
    slotContainer.add(name);

    return {
      container: slotContainer,
      reward,
      x: x + this.slotWidth / 2
    };
  }

  /**
   * Spin all roulettes simultaneously
   */
  spinAll() {
    this.ballRoulettes.forEach((roulette, index) => {
      // Add slight delay for each ball (staggered start for dramatic effect)
      const delay = index * 100;

      this.scene.time.delayedCall(delay, () => {
        this.spinRoulette(roulette);
      });
    });
  }

  /**
   * Spin a single roulette
   */
  spinRoulette(roulette) {
    // Pick winning slot based on position odds (already weighted in pool)
    const winIndex = Math.floor(this.slotCount * 0.5 + Math.random() * this.slotCount * 0.3);
    const selectedReward = roulette.rewards[winIndex % roulette.rewards.length];

    // Store result
    this.ballResults.push({
      ball: roulette.ball,
      position: roulette.position,
      reward: selectedReward
    });

    // Calculate target scroll
    const centerOffset = roulette.containerWidth / 2 - this.slotWidth / 2;
    const targetX = -(winIndex * this.slotWidth) + centerOffset;
    const slotOffset = (Math.random() - 0.5) * (this.slotWidth * 0.4);
    const finalX = targetX + slotOffset;

    // Animate
    this.scene.tweens.add({
      targets: roulette.slotsContainer,
      x: roulette.containerX + finalX,
      duration: this.spinDuration + Math.random() * 500, // Slight variation
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.revealResult(roulette, selectedReward);
      }
    });

    // Tick effect
    this.startTickEffect(roulette);
  }

  /**
   * Tick effect for a roulette
   */
  startTickEffect(roulette) {
    let tickCount = 0;
    const maxTicks = 35;

    const tick = () => {
      if (tickCount >= maxTicks || !this.isSpinning) return;

      roulette.pointer.setAlpha(0.5);
      this.scene.time.delayedCall(50, () => {
        if (roulette.pointer) roulette.pointer.setAlpha(1);
      });

      tickCount++;
      const delay = 50 + tickCount * 5;
      this.scene.time.delayedCall(delay, tick);
    };

    tick();
  }

  /**
   * Reveal result for a single roulette
   */
  revealResult(roulette, reward) {
    // Flash the pointer
    this.scene.tweens.add({
      targets: roulette.pointer,
      alpha: 0.3,
      yoyo: true,
      repeat: 2,
      duration: 100
    });

    // Show result text with tier
    const tierColor = '#' + reward.color.toString(16).padStart(6, '0');
    roulette.resultText.setText(`${reward.icon} ${reward.name}`);
    roulette.resultText.setColor(tierColor);

    // Highlight if S-Tier (rare win!)
    if (reward.tier === 'S') {
      this.celebrateRareWin(roulette);
    }

    // Track how many reveals have completed
    this.revealsCompleted = (this.revealsCompleted || 0) + 1;
    console.log(`[Roulette] Reveal ${this.revealsCompleted}/${this.ballRoulettes.length} complete`);

    // Only proceed when ALL reveals are done (not just when results are collected)
    if (this.revealsCompleted >= this.ballRoulettes.length) {
      console.log('[Roulette] All reveals complete, scheduling close');
      this.scene.time.delayedCall(2000, () => {
        this.applyAllRewards();
        this.close();
      });
    }
  }

  /**
   * Celebrate rare S-tier win
   */
  celebrateRareWin(roulette) {
    // Add "LUCKY!" text
    const luckyText = this.scene.add.text(roulette.containerX + roulette.containerWidth + 30, roulette.rowY - 25, 'LUCKY!', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ff44ff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5);
    luckyText.setDepth(1004);

    // Store for cleanup
    roulette.luckyText = luckyText;

    // Bounce animation
    this.scene.tweens.add({
      targets: luckyText,
      y: luckyText.y - 10,
      yoyo: true,
      repeat: 3,
      duration: 200
    });

    // Flash ball circle
    this.scene.tweens.add({
      targets: roulette.ballCircle,
      alpha: 0.5,
      yoyo: true,
      repeat: 5,
      duration: 100
    });
  }

  /**
   * Apply all rewards to balls
   */
  applyAllRewards() {
    this.ballResults.forEach(result => {
      if (result.reward.type === 'weapon') {
        if (this.scene.inventorySystem) {
          this.scene.inventorySystem.addWeapon(result.ball.name, result.reward.id);
          console.log(`[Roulette] ${result.ball.name} won ${result.reward.name} (${result.reward.tierName})`);

          // Track weapon award in statistics
          statisticsSystem.recordWeaponAwarded(result.reward.id);
        }
      } else if (result.reward.type === 'buff') {
        // Apply buff - store for next level
        if (this.scene.inventorySystem) {
          this.scene.inventorySystem.addBuff(result.ball.name, result.reward.id, 10000); // 10s buff
          console.log(`[Roulette] ${result.ball.name} won buff: ${result.reward.name}`);
        }
      }
    });
  }

  /**
   * Close the roulette and cleanup
   */
  close() {
    this.isSpinning = false;

    // Collect all elements to fade
    const elementsToFade = [this.overlay, this.titleText];

    this.ballRoulettes.forEach(r => {
      elementsToFade.push(
        r.slotsContainer, r.pointer, r.resultText,
        r.ballCircle, r.ballName, r.positionText, r.containerBg
      );
    });

    // Fade out
    this.scene.tweens.add({
      targets: elementsToFade.filter(e => e && !e.destroyed),
      alpha: 0,
      duration: 500,
      onComplete: () => {
        this.cleanup();

        if (this.onComplete) {
          this.onComplete(this.ballResults);
        }
      }
    });
  }

  /**
   * Cleanup all UI elements
   */
  cleanup() {
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    if (this.titleText) { this.titleText.destroy(); this.titleText = null; }

    this.ballRoulettes.forEach(r => {
      if (r.slotsContainer) r.slotsContainer.destroy();
      if (r.pointer) r.pointer.destroy();
      if (r.resultText) r.resultText.destroy();
      if (r.ballCircle) r.ballCircle.destroy();
      if (r.ballName) r.ballName.destroy();
      if (r.positionText) r.positionText.destroy();
      if (r.containerBg) r.containerBg.destroy();
      if (r.mask) r.mask.destroy();
      if (r.luckyText) r.luckyText.destroy(); // Clean up LUCKY! text
    });

    this.ballRoulettes = [];
    this.ballResults = [];
  }

  /**
   * Check if roulette is active
   */
  isActive() {
    return this.isSpinning;
  }
}
