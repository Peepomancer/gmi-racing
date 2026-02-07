/**
 * SpecialObstacleManager - Handles updating special obstacle behaviors
 * (rotating, moving, crushing)
 * Extracted from RaceScene.js for modularity
 */

export class SpecialObstacleManager {
  constructor(scene, crushDetector) {
    this.scene = scene;
    this.crushDetector = crushDetector;
  }

  /**
   * Update all special obstacles (rotating, moving, crushing)
   * @param {number} deltaSeconds - Time delta in seconds
   */
  update(deltaSeconds) {
    this.scene.obstacles.forEach(obs => {
      if (obs.destroyed) return;

      // Handle rotating obstacles
      if (obs.rotating && obs.graphics) {
        this.updateRotating(obs, deltaSeconds);
      }

      // Handle moving obstacles
      if (obs.moving && obs.graphics) {
        this.updateMoving(obs, deltaSeconds);
      }

      // Handle crusher obstacles - ONLY move when race is active
      if (obs.crusher && obs.graphics && this.scene.isRacing) {
        this.updateCrusher(obs, deltaSeconds);
      }
    });
  }

  /**
   * Update a rotating obstacle
   * @param {Object} obs - The obstacle
   * @param {number} deltaSeconds - Time delta
   */
  updateRotating(obs, deltaSeconds) {
    const rpm = obs.rotationSpeed || 2;
    const direction = obs.rotationDirection === 'ccw' ? -1 : 1;
    const rotationAmount = (rpm * Math.PI * 2 / 60) * deltaSeconds * direction;

    // Update graphics rotation
    obs.graphics.rotation += rotationAmount;

    // Update physics body rotation
    this.scene.matter.body.setAngle(obs.body, obs.body.angle + rotationAmount);
  }

  /**
   * Update a moving obstacle
   * @param {Object} obs - The obstacle
   * @param {number} deltaSeconds - Time delta
   */
  updateMoving(obs, deltaSeconds) {
    const speed = obs.moveSpeed || 50;
    const distance = obs.moveDistance || 100;

    // Update phase (oscillates 0 to 1 and back)
    obs.movePhase += (speed / distance) * deltaSeconds;
    if (obs.movePhase > 2) obs.movePhase -= 2;

    // Calculate offset (ping-pong motion)
    const t = obs.movePhase <= 1 ? obs.movePhase : 2 - obs.movePhase;
    const offset = (t - 0.5) * distance;

    let newX = obs.moveStartX;
    let newY = obs.moveStartY;

    if (obs.moveDirection === 'horizontal') {
      newX = obs.moveStartX + offset;
    } else {
      newY = obs.moveStartY + offset;
    }

    // Update graphics position
    obs.graphics.x = newX;
    obs.graphics.y = newY;

    // Update physics body position
    this.scene.matter.body.setPosition(obs.body, { x: newX, y: newY });
  }

  /**
   * Update a crusher obstacle
   * @param {Object} obs - The obstacle
   * @param {number} deltaSeconds - Time delta
   */
  updateCrusher(obs, deltaSeconds) {
    if (obs.crusherActive) {
      const speed = obs.crusherSpeed || 80;
      const currentPos = obs.body.position;
      let newX = currentPos.x;
      let newY = currentPos.y;
      let reachedEnd = false;

      // Move in crusher direction
      switch (obs.crusherDirection) {
        case 'down':
          newY += speed * deltaSeconds;
          if (newY >= this.scene.gameHeight - 20) reachedEnd = true;
          break;
        case 'up':
          newY -= speed * deltaSeconds;
          if (newY <= 20) reachedEnd = true;
          break;
        case 'right':
          newX += speed * deltaSeconds;
          if (newX >= this.scene.gameWidth - 20) reachedEnd = true;
          break;
        case 'left':
          newX -= speed * deltaSeconds;
          if (newX <= 20) reachedEnd = true;
          break;
      }

      // Update position
      obs.graphics.x = newX;
      obs.graphics.y = newY;
      this.scene.matter.body.setPosition(obs.body, { x: newX, y: newY });

      // Check for crushed balls
      this.crushDetector.checkCrushedBalls(obs);

      // If reached end, start reset timer
      if (reachedEnd) {
        obs.crusherActive = false;
        obs.crusherResetTimer = obs.crusherResetDelay || 2000;
      }
    } else {
      // Waiting to reset
      obs.crusherResetTimer -= deltaSeconds * 1000;
      if (obs.crusherResetTimer <= 0) {
        // Reset to start position
        obs.graphics.x = obs.crusherStartX;
        obs.graphics.y = obs.crusherStartY;
        this.scene.matter.body.setPosition(obs.body, {
          x: obs.crusherStartX,
          y: obs.crusherStartY
        });
        obs.crusherActive = true;
      }
    }
  }
}
