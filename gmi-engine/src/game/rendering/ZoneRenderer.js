/**
 * ZoneRenderer - Handles rendering of start and finish zones
 * Extracted from RaceScene.js for modularity
 */

export class ZoneRenderer {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Draw start zone indicator
   * @param {Object} zone - Zone with x, y, width, height
   */
  drawStartZone(zone) {
    const bgLayer = this.scene.bgLayer;

    bgLayer.fillStyle(0x00ff88, 0.15);
    bgLayer.fillRect(zone.x, zone.y, zone.width, zone.height);

    bgLayer.lineStyle(2, 0x00ff88, 0.5);
    // Dashed border
    const dashLength = 10;
    for (let i = zone.x; i < zone.x + zone.width; i += dashLength * 2) {
      bgLayer.lineBetween(i, zone.y, Math.min(i + dashLength, zone.x + zone.width), zone.y);
      bgLayer.lineBetween(i, zone.y + zone.height, Math.min(i + dashLength, zone.x + zone.width), zone.y + zone.height);
    }
  }

  /**
   * Draw finish line (fallback checkered line for procedural maps)
   * @param {number} finishY - Y position of finish line
   */
  drawFinishLine(finishY) {
    // If we have a finish zone from editor, draw it as a zone
    if (this.scene.finishZone) {
      this.drawFinishZone(this.scene.finishZone);
      return;
    }

    const finishLayer = this.scene.finishLayer;
    const gameWidth = this.scene.gameWidth;

    // Fallback: draw checkered line for procedural maps
    const tileSize = 20;
    const cols = Math.ceil(gameWidth / tileSize);

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < 2; row++) {
        const isWhite = (col + row) % 2 === 0;
        finishLayer.fillStyle(isWhite ? 0xffffff : 0x000000, 1);
        finishLayer.fillRect(col * tileSize, finishY + row * tileSize, tileSize, tileSize);
      }
    }

    if (this.scene.finishText) this.scene.finishText.destroy();
    this.scene.finishText = this.scene.add.text(gameWidth / 2, finishY - 15, 'FINISH', {
      fontSize: '16px',
      color: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  /**
   * Draw finish zone with checkered pattern
   * @param {Object} zone - Zone with x, y, width, height
   */
  drawFinishZone(zone) {
    const finishLayer = this.scene.finishLayer;

    const tileSize = 15;
    const cols = Math.ceil(zone.width / tileSize);
    const rows = Math.ceil(zone.height / tileSize);

    // Draw checkered pattern inside the zone
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const isWhite = (col + row) % 2 === 0;
        finishLayer.fillStyle(isWhite ? 0xffffff : 0x111111, 0.9);

        const x = zone.x + col * tileSize;
        const y = zone.y + row * tileSize;
        const w = Math.min(tileSize, zone.x + zone.width - x);
        const h = Math.min(tileSize, zone.y + zone.height - y);

        finishLayer.fillRect(x, y, w, h);
      }
    }

    // Red border
    finishLayer.lineStyle(3, 0xff4444, 1);
    finishLayer.strokeRect(zone.x, zone.y, zone.width, zone.height);

    // FINISH label
    if (this.scene.finishText) this.scene.finishText.destroy();
    this.scene.finishText = this.scene.add.text(
      zone.x + zone.width / 2,
      zone.y + zone.height / 2,
      'FINISH',
      {
        fontSize: '14px',
        color: '#ff4444',
        fontStyle: 'bold',
        backgroundColor: '#000000',
        padding: { x: 5, y: 2 }
      }
    ).setOrigin(0.5);
  }
}
