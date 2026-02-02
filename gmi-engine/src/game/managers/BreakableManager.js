/**
 * BreakableManager - Handles breakable obstacle damage and destruction
 * Extracted from RaceScene.js for modularity
 */

export class BreakableManager {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Handle collision with breakable obstacle
   * @param {Object} obstacle - The obstacle being hit
   * @param {Object} ball - The ball hitting the obstacle
   * @param {Function} redrawCallback - Callback to redraw obstacle graphics
   */
  handleCollision(obstacle, ball, redrawCallback) {
    // Safety checks
    if (!obstacle || !ball || obstacle.destroyed) return;

    // Check if this ball color can break this obstacle
    const breakableBy = obstacle.breakableBy || [];
    const canBreak = breakableBy.length === 0 ||
                     breakableBy.includes(ball.name);

    // Log damage attempt
    const damageLog = {
      time: Date.now(),
      obstacleId: obstacle.data?.id || 'unknown',
      ballName: ball?.name || 'unknown',
      ballColor: ball?.color || 'unknown',
      canBreak: canBreak,
      healthBefore: obstacle.health,
      maxHealth: obstacle.maxHealth,
      breakableBy: breakableBy,
      position: obstacle.body ? { x: obstacle.body.position.x, y: obstacle.body.position.y } : null
    };

    if (!canBreak) {
      damageLog.result = 'BLOCKED';
      console.log('[BREAKABLE] Damage blocked:', damageLog);
      return;
    }

    // Reduce health based on ball's damage stat (from volume rank)
    const damage = ball.damage || 1;
    obstacle.health -= damage;
    damageLog.damage = damage;
    damageLog.healthAfter = obstacle.health;
    damageLog.result = obstacle.health <= 0 ? 'DESTROYED' : 'DAMAGED';
    console.log('[BREAKABLE] Damage applied:', damageLog);

    // Visual feedback - flash
    if (obstacle.graphics) {
      obstacle.graphics.setAlpha(0.3);
      this.scene.time.delayedCall(100, () => {
        if (obstacle.graphics && !obstacle.destroyed) {
          obstacle.graphics.setAlpha(1);
          // Redraw with updated health indicator
          if (redrawCallback) {
            redrawCallback(obstacle);
          }
        }
      });
    }

    // Check if destroyed
    if (obstacle.health <= 0) {
      this.destroy(obstacle);
    }
  }

  /**
   * Destroy an obstacle with visual effect
   * @param {Object} obstacle - The obstacle to destroy
   */
  destroy(obstacle) {
    obstacle.destroyed = true;

    // Remove physics body
    if (obstacle.body) {
      this.scene.matter.world.remove(obstacle.body);
    }

    // Destruction effect - fade out and scale up
    if (obstacle.graphics) {
      this.scene.tweens.add({
        targets: obstacle.graphics,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 200,
        onComplete: () => {
          if (obstacle.graphics) {
            obstacle.graphics.destroy();
            obstacle.graphics = null;
          }
        }
      });
    }

    console.log('[BREAKABLE] Obstacle destroyed:', obstacle.data?.id || 'unknown');
  }
}
