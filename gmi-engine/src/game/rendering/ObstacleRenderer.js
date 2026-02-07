/**
 * ObstacleRenderer - Handles rendering of obstacle graphics
 * Extracted from RaceScene.js for modularity
 */

/**
 * Draw breakable indicator with health (crack lines)
 * @param {Phaser.GameObjects.Graphics} graphics - The graphics object
 * @param {number} health - Current health
 * @param {number} maxHealth - Maximum health
 */
export function drawBreakableIndicator(graphics, health, maxHealth) {
  graphics.lineStyle(2, 0xffffff, 0.7);
  // Draw crack lines based on damage
  const damage = maxHealth - health;
  if (damage >= 1) {
    graphics.lineBetween(-5, -5, 5, 5);
  }
  if (damage >= 2) {
    graphics.lineBetween(5, -5, -5, 5);
  }
}

/**
 * Draw a single obstacle's graphics (for animated obstacles)
 * @param {Phaser.GameObjects.Graphics} graphics - The graphics object
 * @param {Object} obs - The obstacle data (type, radius, width, height, behavior, etc.)
 * @param {number} color - The color as a number (e.g., 0xff4444)
 */
export function drawObstacleGraphics(graphics, obs, color) {
  graphics.clear();
  graphics.fillStyle(color, 1);

  if (obs.type === 'circle') {
    graphics.fillCircle(0, 0, obs.radius);

    // Behavior indicators
    if (obs.behavior === 'rotating') {
      graphics.lineStyle(2, 0xffffff, 0.5);
      graphics.strokeCircle(0, 0, obs.radius * 0.6);
      // Rotation indicator line
      graphics.lineBetween(0, 0, obs.radius * 0.8, 0);
    } else if (obs.behavior === 'breakable') {
      drawBreakableIndicator(graphics, obs.health, obs.maxHealth);
    } else if (obs.behavior === 'moving') {
      graphics.lineStyle(2, 0xffffff, 0.5);
      if (obs.moveDirection === 'horizontal') {
        graphics.lineBetween(-10, 0, 10, 0);
      } else {
        graphics.lineBetween(0, -10, 0, 10);
      }
    }
  } else {
    const w = obs.width || 50;
    const h = obs.height || 20;
    graphics.fillRect(-w / 2, -h / 2, w, h);

    // Behavior indicators
    if (obs.behavior === 'rotating') {
      graphics.lineStyle(2, 0xffffff, 0.5);
      graphics.strokeCircle(0, 0, Math.min(w, h) * 0.3);
      graphics.lineBetween(0, 0, Math.min(w, h) * 0.4, 0);
    } else if (obs.behavior === 'breakable') {
      drawBreakableIndicator(graphics, obs.health, obs.maxHealth);
    } else if (obs.behavior === 'moving') {
      graphics.lineStyle(2, 0xffffff, 0.5);
      if (obs.moveDirection === 'horizontal') {
        graphics.lineBetween(-15, 0, 15, 0);
      } else {
        graphics.lineBetween(0, -15, 0, 15);
      }
    } else if (obs.behavior === 'crusher') {
      // Crusher: draw danger stripes and arrow
      graphics.lineStyle(3, 0x000000, 0.8);
      const stripeGap = 8;
      for (let i = -w/2; i < w/2; i += stripeGap * 2) {
        graphics.lineBetween(i, -h/2, i + stripeGap, h/2);
      }
      // Arrow showing direction
      graphics.lineStyle(2, 0xffffff, 1);
      const arrowSize = 8;
      switch (obs.crusherDirection) {
        case 'down':
          graphics.lineBetween(0, -h/4, 0, h/4);
          graphics.lineBetween(0, h/4, -arrowSize, h/4 - arrowSize);
          graphics.lineBetween(0, h/4, arrowSize, h/4 - arrowSize);
          break;
        case 'up':
          graphics.lineBetween(0, h/4, 0, -h/4);
          graphics.lineBetween(0, -h/4, -arrowSize, -h/4 + arrowSize);
          graphics.lineBetween(0, -h/4, arrowSize, -h/4 + arrowSize);
          break;
        case 'right':
          graphics.lineBetween(-w/4, 0, w/4, 0);
          graphics.lineBetween(w/4, 0, w/4 - arrowSize, -arrowSize);
          graphics.lineBetween(w/4, 0, w/4 - arrowSize, arrowSize);
          break;
        case 'left':
          graphics.lineBetween(w/4, 0, -w/4, 0);
          graphics.lineBetween(-w/4, 0, -w/4 + arrowSize, -arrowSize);
          graphics.lineBetween(-w/4, 0, -w/4 + arrowSize, arrowSize);
          break;
      }
    }
  }
}
