/**
 * CrushDetector - Handles crush detection for balls against obstacles and walls
 * Extracted from RaceScene.js for modularity
 */

import Phaser from 'phaser';

export class CrushDetector {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Check if any balls are crushed between crusher and wall/obstacle
   * Checks against OBSTACLES in the crush direction, not just game boundaries
   * @param {Object} crusher - The crusher obstacle
   */
  checkCrushedBalls(crusher) {
    if (!this.scene.isRacing) return;

    try {
      const crusherPos = crusher.body.position;
      const crusherWidth = crusher.data.width || 50;
      const crusherHeight = crusher.data.height || 20;
      const crusherHalfH = crusherHeight / 2;
      const crusherHalfW = crusherWidth / 2;

      // Find the nearest LARGE obstacle/wall in the crusher's direction
      // Only consider obstacles that are big enough to crush against (>100px in crush axis)
      let targetWallPos = null;
      const minCrushWallSize = 100; // Minimum size to be considered a "crush wall"

      this.scene.obstacles.forEach(obs => {
        if (obs === crusher || obs.destroyed || obs.crusher) return;
        const obsPos = obs.body.position;
        const obsW = obs.data.width || 50;
        const obsH = obs.data.height || 20;

        switch (crusher.crusherDirection) {
          case 'right':
          case 'left':
            // For horizontal crushers, only consider tall walls (height > minCrushWallSize)
            if (obsH < minCrushWallSize) return;
            break;
          case 'up':
          case 'down':
            // For vertical crushers, only consider wide walls (width > minCrushWallSize)
            if (obsW < minCrushWallSize) return;
            break;
        }

        switch (crusher.crusherDirection) {
          case 'right':
            // Find obstacles to the RIGHT of crusher
            const obsLeft = obsPos.x - obsW / 2;
            if (obsLeft > crusherPos.x && (targetWallPos === null || obsLeft < targetWallPos)) {
              // Check if obstacle overlaps vertically with crusher
              if (obsPos.y - obsH/2 < crusherPos.y + crusherHalfH &&
                  obsPos.y + obsH/2 > crusherPos.y - crusherHalfH) {
                targetWallPos = obsLeft;
              }
            }
            break;
          case 'left':
            const obsRight = obsPos.x + obsW / 2;
            if (obsRight < crusherPos.x && (targetWallPos === null || obsRight > targetWallPos)) {
              if (obsPos.y - obsH/2 < crusherPos.y + crusherHalfH &&
                  obsPos.y + obsH/2 > crusherPos.y - crusherHalfH) {
                targetWallPos = obsRight;
              }
            }
            break;
          case 'down':
            const obsTop = obsPos.y - obsH / 2;
            if (obsTop > crusherPos.y && (targetWallPos === null || obsTop < targetWallPos)) {
              if (obsPos.x - obsW/2 < crusherPos.x + crusherHalfW &&
                  obsPos.x + obsW/2 > crusherPos.x - crusherHalfW) {
                targetWallPos = obsTop;
              }
            }
            break;
          case 'up':
            const obsBottom = obsPos.y + obsH / 2;
            if (obsBottom < crusherPos.y && (targetWallPos === null || obsBottom > targetWallPos)) {
              if (obsPos.x - obsW/2 < crusherPos.x + crusherHalfW &&
                  obsPos.x + obsW/2 > crusherPos.x - crusherHalfW) {
                targetWallPos = obsBottom;
              }
            }
            break;
        }
      });

      // Fallback to game boundaries if no obstacle found
      if (targetWallPos === null) {
        switch (crusher.crusherDirection) {
          case 'right': targetWallPos = this.scene.gameWidth; break;
          case 'left': targetWallPos = 0; break;
          case 'down': targetWallPos = this.scene.gameHeight; break;
          case 'up': targetWallPos = 0; break;
        }
      }

      this.scene.balls.forEach(ball => {
        if (ball.finished || ball.eliminated) return;

        const ballPos = ball.body.position;
        const ballRadius = ball.radius || 12;
        const ballDiameter = ballRadius * 2;

        let crusherEdge, gap, ballBetween;

        switch (crusher.crusherDirection) {
          case 'down':
            crusherEdge = crusherPos.y + crusherHalfH;
            gap = targetWallPos - crusherEdge;
            ballBetween = ballPos.y > crusherEdge &&
                         ballPos.x >= crusherPos.x - crusherHalfW &&
                         ballPos.x <= crusherPos.x + crusherHalfW;
            break;
          case 'up':
            crusherEdge = crusherPos.y - crusherHalfH;
            gap = crusherEdge - targetWallPos;
            ballBetween = ballPos.y < crusherEdge &&
                         ballPos.x >= crusherPos.x - crusherHalfW &&
                         ballPos.x <= crusherPos.x + crusherHalfW;
            break;
          case 'right':
            crusherEdge = crusherPos.x + crusherHalfW;
            gap = targetWallPos - crusherEdge;
            ballBetween = ballPos.x > crusherEdge &&
                         ballPos.y >= crusherPos.y - crusherHalfH &&
                         ballPos.y <= crusherPos.y + crusherHalfH;
            break;
          case 'left':
            crusherEdge = crusherPos.x - crusherHalfW;
            gap = crusherEdge - targetWallPos;
            ballBetween = ballPos.x < crusherEdge &&
                         ballPos.y >= crusherPos.y - crusherHalfH &&
                         ballPos.y <= crusherPos.y + crusherHalfH;
            break;
        }

        const inDanger = ballBetween && gap < ballDiameter * 3;
        const crushed = ballBetween && gap < ballDiameter * 0.9;

        // Visual feedback
        if (inDanger && !crushed && ball.graphics) {
          if (!ball.inDanger) {
            ball.inDanger = true;
            ball.graphics.setAlpha(0.6);
          }
        } else if (ball.inDanger && !inDanger && ball.graphics) {
          ball.inDanger = false;
          ball.graphics.setAlpha(1);
        }

        if (crushed) {
          this.scene.eliminateBall(ball, 'crushed');
        }
      });
    } catch (e) {
      console.error('Crush detection error:', e);
    }
  }

  /**
   * After animated obstacles move, check if any balls are trapped/crushed
   * All moving obstacles act as crushers - if a ball is squeezed between
   * the obstacle and any surface (wall or another obstacle), the ball is eliminated.
   */
  resolveAnimatedObstacleCollisions() {
    if (!this.scene.animationPlayer || this.scene.animationPlayer.animations.size === 0) return;

    const Matter = Phaser.Physics.Matter.Matter;
    const ballDiameter = 24; // Standard ball diameter
    const crushThreshold = ballDiameter * 0.7; // Ball is crushed if space < 70% of diameter

    this.scene.balls.forEach(ball => {
      if (!ball.body || ball.finished || ball.eliminated) return;

      const ballPos = ball.body.position;
      const ballRadius = ball.radius || 12;

      // Check against each animated obstacle
      this.scene.obstacles.forEach(obs => {
        if (!obs.body || obs.destroyed) return;
        if (!obs.data?.id || !this.scene.animationPlayer.hasAnimation(obs.data.id)) return;

        const obsPos = obs.body.position;
        let isColliding = false;
        let pushX = 0;
        let pushY = 0;

        if (obs.data.type === 'circle') {
          // Circle-circle collision
          const obsRadius = obs.data.radius || 25;
          const dx = ballPos.x - obsPos.x;
          const dy = ballPos.y - obsPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = obsRadius + ballRadius;

          if (dist < minDist && dist > 0.1) {
            isColliding = true;
            const pushDist = minDist - dist + 5;
            pushX = (dx / dist) * pushDist;
            pushY = (dy / dist) * pushDist;
          }
        } else {
          // Rectangle-circle collision
          const halfW = (obs.data.width || 50) / 2;
          const halfH = (obs.data.height || 20) / 2;

          const closestX = Math.max(obsPos.x - halfW, Math.min(ballPos.x, obsPos.x + halfW));
          const closestY = Math.max(obsPos.y - halfH, Math.min(ballPos.y, obsPos.y + halfH));

          const dx = ballPos.x - closestX;
          const dy = ballPos.y - closestY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < ballRadius) {
            isColliding = true;
            if (dist > 0.1) {
              const pushDist = ballRadius - dist + 5;
              pushX = (dx / dist) * pushDist;
              pushY = (dy / dist) * pushDist;
            } else {
              // Ball center is inside obstacle - push toward nearest edge
              const toLeft = ballPos.x - (obsPos.x - halfW);
              const toRight = (obsPos.x + halfW) - ballPos.x;
              const toTop = ballPos.y - (obsPos.y - halfH);
              const toBottom = (obsPos.y + halfH) - ballPos.y;
              const minEdge = Math.min(toLeft, toRight, toTop, toBottom);

              if (minEdge === toLeft) pushX = -(halfW + ballRadius + 5);
              else if (minEdge === toRight) pushX = halfW + ballRadius + 5;
              else if (minEdge === toTop) pushY = -(halfH + ballRadius + 5);
              else pushY = halfH + ballRadius + 5;
            }
          }
        }

        if (!isColliding) return;

        // Calculate where the ball would be pushed to
        let newX = ballPos.x + pushX;
        let newY = ballPos.y + pushY;

        // Check if ball would be crushed against a wall
        const margin = ballRadius + 2;
        const crushedAgainstWall =
          (newX < margin && pushX < 0) ||
          (newX > this.scene.gameWidth - margin && pushX > 0) ||
          (newY < margin && pushY < 0) ||
          (newY > this.scene.gameHeight - margin && pushY > 0);

        // Check if ball would be crushed against another obstacle
        let crushedAgainstObstacle = false;
        if (!crushedAgainstWall) {
          crushedAgainstObstacle = this.checkCrushAgainstObstacles(
            ball, newX, newY, ballRadius, obs, crushThreshold
          );
        }

        // If crushed, eliminate the ball
        if (crushedAgainstWall || crushedAgainstObstacle) {
          this.scene.eliminateBall(ball, 'crushed');
          return;
        }

        // Not crushed - push the ball out safely
        newX = Math.max(margin, Math.min(this.scene.gameWidth - margin, newX));
        newY = Math.max(margin, Math.min(this.scene.gameHeight - margin, newY));

        Matter.Body.setPosition(ball.body, { x: newX, y: newY });

        // Give the ball velocity to bounce away
        const currentVel = ball.body.velocity;
        const speed = Math.sqrt(currentVel.x * currentVel.x + currentVel.y * currentVel.y) || 5;
        const pushLen = Math.sqrt(pushX * pushX + pushY * pushY) || 1;

        let velX = (pushX / pushLen) * speed;
        let velY = (pushY / pushLen) * speed;

        // Redirect velocity away from boundaries
        if (newX <= margin) velX = Math.abs(velX);
        if (newX >= this.scene.gameWidth - margin) velX = -Math.abs(velX);
        if (newY <= margin) velY = Math.abs(velY);
        if (newY >= this.scene.gameHeight - margin) velY = -Math.abs(velY);

        Matter.Body.setVelocity(ball.body, { x: velX, y: velY });
      });
    });
  }

  /**
   * Check if a ball at position (x,y) would be crushed against another obstacle
   * @param {Object} ball - The ball object
   * @param {number} x - X position to check
   * @param {number} y - Y position to check
   * @param {number} ballRadius - Ball radius
   * @param {Object} excludeObs - Obstacle to exclude from check
   * @param {number} crushThreshold - Threshold for crush detection
   * @returns {boolean} True if the ball would be crushed
   */
  checkCrushAgainstObstacles(ball, x, y, ballRadius, excludeObs, crushThreshold) {
    for (const otherObs of this.scene.obstacles) {
      if (otherObs === excludeObs || otherObs.destroyed || !otherObs.body) continue;

      const otherPos = otherObs.body.position;
      let distToOther = Infinity;

      if (otherObs.data?.type === 'circle') {
        const otherRadius = otherObs.data.radius || 25;
        const dx = x - otherPos.x;
        const dy = y - otherPos.y;
        distToOther = Math.sqrt(dx * dx + dy * dy) - otherRadius;
      } else {
        const halfW = (otherObs.data?.width || 50) / 2;
        const halfH = (otherObs.data?.height || 20) / 2;

        const closestX = Math.max(otherPos.x - halfW, Math.min(x, otherPos.x + halfW));
        const closestY = Math.max(otherPos.y - halfH, Math.min(y, otherPos.y + halfH));

        const dx = x - closestX;
        const dy = y - closestY;
        distToOther = Math.sqrt(dx * dx + dy * dy);
      }

      // If distance to other obstacle is less than crush threshold, ball is crushed
      if (distToOther < crushThreshold) {
        return true;
      }
    }
    return false;
  }
}
