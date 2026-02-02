/**
 * FinishTrackerUI - Displays the finish order and eliminated balls
 * Extracted from RaceScene.js for modularity
 */

export class FinishTrackerUI {
  constructor(scene) {
    this.scene = scene;
    this.container = null;
    this.items = [];
  }

  /**
   * Create the finish tracker UI container
   */
  create() {
    // Destroy old tracker
    if (this.container) {
      this.container.destroy();
    }

    // Create container for finish tracker
    this.container = this.scene.add.container(10, 10);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(0, 0, 150, 30, 5);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(75, 8, 'FINISH ORDER', {
      fontSize: '11px',
      color: '#00ffff',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Will be populated as balls finish
    this.items = [];
  }

  /**
   * Update the tracker with current ball states
   * @param {Array} balls - Array of ball objects
   */
  update(balls) {
    if (!this.container) return;

    // Get finished balls in order
    const finishedBalls = balls
      .filter(b => b.finished)
      .sort((a, b) => a.finishPosition - b.finishPosition);

    // Get eliminated balls
    const eliminatedBalls = balls.filter(b => b.eliminated);

    const totalEntries = finishedBalls.length + eliminatedBalls.length;

    // Update background height
    const bg = this.container.list[0];
    bg.clear();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(0, 0, 150, 30 + totalEntries * 22, 5);

    // Clear old items
    this.items.forEach(item => item.destroy());
    this.items = [];

    // Add finished balls
    finishedBalls.forEach((ball, index) => {
      const y = 28 + index * 22;

      // Position medal
      const posText = this.scene.add.text(10, y, this.getPositionText(ball.finishPosition), {
        fontSize: '12px',
        color: this.getPositionColor(ball.finishPosition),
        fontStyle: 'bold'
      });
      this.container.add(posText);
      this.items.push(posText);

      // Ball color indicator
      const ballDot = this.scene.add.graphics();
      ballDot.fillStyle(parseInt(ball.color.replace('#', ''), 16), 1);
      ballDot.fillCircle(45, y + 6, 6);
      ballDot.lineStyle(1, 0xffffff, 0.5);
      ballDot.strokeCircle(45, y + 6, 6);
      this.container.add(ballDot);
      this.items.push(ballDot);

      // Ball name
      const nameText = this.scene.add.text(55, y, ball.name, {
        fontSize: '11px',
        color: '#ffffff'
      });
      this.container.add(nameText);
      this.items.push(nameText);

      // Time
      const timeText = this.scene.add.text(140, y, this.formatTime(ball.finishTime), {
        fontSize: '10px',
        color: '#aaaaaa'
      }).setOrigin(1, 0);
      this.container.add(timeText);
      this.items.push(timeText);
    });

    // Add eliminated balls at the bottom
    eliminatedBalls.forEach((ball, index) => {
      const y = 28 + (finishedBalls.length + index) * 22;

      // OUT indicator for eliminated
      const posText = this.scene.add.text(10, y, 'OUT', {
        fontSize: '10px',
        color: '#ff4444',
        fontStyle: 'bold'
      });
      this.container.add(posText);
      this.items.push(posText);

      // Ball color indicator with X
      const ballDot = this.scene.add.graphics();
      ballDot.fillStyle(parseInt(ball.color.replace('#', ''), 16), 0.5);
      ballDot.fillCircle(45, y + 6, 6);
      ballDot.lineStyle(2, 0xff0000, 1);
      ballDot.lineBetween(40, y + 1, 50, y + 11);
      ballDot.lineBetween(50, y + 1, 40, y + 11);
      this.container.add(ballDot);
      this.items.push(ballDot);

      // Ball name (dimmed)
      const nameText = this.scene.add.text(55, y, ball.name, {
        fontSize: '11px',
        color: '#666666'
      });
      this.container.add(nameText);
      this.items.push(nameText);

      // Elimination reason
      const reasonText = this.scene.add.text(140, y, ball.eliminationReason || 'crushed', {
        fontSize: '9px',
        color: '#ff4444'
      }).setOrigin(1, 0);
      this.container.add(reasonText);
      this.items.push(reasonText);
    });
  }

  /**
   * Get position display text (1st, 2nd, 3rd, etc.)
   */
  getPositionText(pos) {
    switch (pos) {
      case 1: return '1st';
      case 2: return '2nd';
      case 3: return '3rd';
      default: return pos + 'th';
    }
  }

  /**
   * Get position color (gold, silver, bronze)
   */
  getPositionColor(pos) {
    switch (pos) {
      case 1: return '#ffd700'; // Gold
      case 2: return '#c0c0c0'; // Silver
      case 3: return '#cd7f32'; // Bronze
      default: return '#888888';
    }
  }

  /**
   * Format time in seconds to mm:ss.ms
   */
  formatTime(timeMs) {
    if (!timeMs) return '--:--';
    const seconds = timeMs / 1000;
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  }

  /**
   * Destroy the tracker UI
   */
  destroy() {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
    this.items = [];
  }
}
