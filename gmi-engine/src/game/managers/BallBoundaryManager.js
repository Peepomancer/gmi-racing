/**
 * BallBoundaryManager - Handles keeping balls within game boundaries
 * Extracted from RaceScene.js for modularity
 */

import Phaser from 'phaser';

export class BallBoundaryManager {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Keep all balls within game boundaries
   * Called every frame to prevent balls from escaping
   */
  enforceBoundaries() {
    if (!this.scene.balls) return;

    const Matter = Phaser.Physics.Matter.Matter;
    const gameWidth = this.scene.gameWidth;
    const gameHeight = this.scene.gameHeight;

    this.scene.balls.forEach(ball => {
      if (!ball.body || ball.finished || ball.eliminated) return;

      const pos = ball.body.position;
      const vel = ball.body.velocity;
      const radius = ball.radius || 12;
      const margin = radius + 2;

      let newX = pos.x;
      let newY = pos.y;
      let newVelX = vel.x;
      let newVelY = vel.y;
      let needsUpdate = false;

      // Left boundary
      if (pos.x < margin) {
        newX = margin;
        newVelX = Math.abs(vel.x) * 0.8; // Bounce with some energy loss
        needsUpdate = true;
      }
      // Right boundary
      if (pos.x > gameWidth - margin) {
        newX = gameWidth - margin;
        newVelX = -Math.abs(vel.x) * 0.8;
        needsUpdate = true;
      }
      // Top boundary
      if (pos.y < margin) {
        newY = margin;
        newVelY = Math.abs(vel.y) * 0.8;
        needsUpdate = true;
      }
      // Bottom boundary
      if (pos.y > gameHeight - margin) {
        newY = gameHeight - margin;
        newVelY = -Math.abs(vel.y) * 0.8;
        needsUpdate = true;
      }

      if (needsUpdate) {
        Matter.Body.setPosition(ball.body, { x: newX, y: newY });
        Matter.Body.setVelocity(ball.body, { x: newVelX, y: newVelY });
      }
    });
  }
}
