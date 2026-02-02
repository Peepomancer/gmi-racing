/**
 * BallRenderer - Handles rendering of ball graphics and HP bars
 * Extracted from RaceScene.js for modularity
 */

/**
 * Render a ball's visual graphics (circle with eyes)
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} radius - Ball radius
 * @param {string} colorHex - Color in hex format (e.g., '#ff4444')
 * @returns {Phaser.GameObjects.Graphics} The graphics object
 */
export function renderBallGraphics(scene, radius, colorHex) {
  const graphics = scene.add.graphics();
  const colorNum = parseInt(colorHex.replace('#', ''), 16);

  // Ball outline and fill
  graphics.lineStyle(3, 0x000000, 1);
  graphics.strokeCircle(0, 0, radius);
  graphics.fillStyle(colorNum, 1);
  graphics.fillCircle(0, 0, radius - 2);

  // Eyes - white background
  graphics.fillStyle(0xffffff, 1);
  graphics.fillRect(-radius / 3 - 3, -radius / 4, 6, 6);
  graphics.fillRect(radius / 3 - 3, -radius / 4, 6, 6);

  // Eyes - black pupils
  graphics.fillStyle(0x000000, 1);
  graphics.fillRect(-radius / 3 - 1, -radius / 4 + 2, 2, 2);
  graphics.fillRect(radius / 3 - 1, -radius / 4 + 2, 2, 2);

  return graphics;
}

/**
 * Render HP bar background and foreground
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} radius - Ball radius (used for positioning)
 * @returns {{ hpBar: Phaser.GameObjects.Graphics, hpBarBg: Phaser.GameObjects.Graphics }}
 */
export function renderHPBar(scene, radius) {
  // Background (gray)
  const hpBarBg = scene.add.graphics();
  hpBarBg.fillStyle(0x333333, 0.8);
  hpBarBg.fillRect(-15, -radius - 12, 30, 6);

  // Foreground (green, full)
  const hpBar = scene.add.graphics();
  hpBar.fillStyle(0x00ff00, 1);
  hpBar.fillRect(-14, -radius - 11, 28, 4);

  return { hpBar, hpBarBg };
}

/**
 * Update HP bar display based on current HP
 * @param {Phaser.GameObjects.Graphics} hpBar - The HP bar graphics
 * @param {number} hp - Current HP
 * @param {number} maxHp - Maximum HP
 * @param {number} radius - Ball radius
 */
export function updateHPBar(hpBar, hp, maxHp, radius) {
  const hpPercent = Math.max(0, hp / maxHp);
  const barWidth = Math.round(28 * hpPercent);

  // Color based on HP: green > yellow/orange > red
  let hpColor = 0x00ff00; // Green (default)
  if (hpPercent < 0.3) {
    hpColor = 0xff0000; // Red
  } else if (hpPercent < 0.6) {
    hpColor = 0xffaa00; // Orange
  }

  hpBar.clear();
  hpBar.fillStyle(hpColor, 1);
  hpBar.fillRect(-14, -radius - 11, barWidth, 4);
}
