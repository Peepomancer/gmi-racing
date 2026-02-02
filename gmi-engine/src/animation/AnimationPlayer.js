/**
 * AnimationPlayer - Runtime Animation Playback
 *
 * Evaluates keyframe animations at runtime.
 * Used by RaceScene to animate obstacles during gameplay.
 *
 * Features:
 * - Keyframe interpolation with easing
 * - Loop modes: none, loop, pingpong, hold
 * - Supports all transform properties (x, y, rotation, scaleX, scaleY)
 */

import { Easings } from './Easings.js';

export class AnimationPlayer {
  constructor() {
    // Map of obstacleId -> animation data
    this.animations = new Map();

    // Animation start time (set when race starts)
    this.startTime = 0;

    // Is animation playing?
    this.isPlaying = false;

    // Debug logging
    this.debugMode = false;
    this.debugLogInterval = 500; // Log every 500ms
    this.lastDebugLog = 0;
  }

  /**
   * Enable/disable debug logging
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log('[AnimationPlayer] Debug mode:', enabled ? 'ON' : 'OFF');
  }

  /**
   * Load animations from map data
   * @param {Object} animationsData - Map of obstacleId -> animation config
   */
  loadAnimations(animationsData) {
    this.animations.clear();

    if (!animationsData) return;

    for (const [obstacleId, animData] of Object.entries(animationsData)) {
      // Validate and normalize animation data
      const normalizedAnim = this.normalizeAnimation(animData);
      if (normalizedAnim) {
        this.animations.set(obstacleId, normalizedAnim);
      }
    }

    console.log(`[AnimationPlayer] Loaded ${this.animations.size} animations`);
  }

  /**
   * Normalize animation data structure
   * @param {Object} anim - Raw animation data
   * @returns {Object|null} Normalized animation or null if invalid
   */
  normalizeAnimation(anim) {
    if (!anim || !anim.tracks) return null;

    return {
      duration: anim.duration || 2000,
      loop: anim.loop || 'none',      // none, loop, pingpong, hold
      loopCount: anim.loopCount || 0,  // 0 = infinite
      tracks: anim.tracks
    };
  }

  /**
   * Start playback
   * @param {number} startTime - Time to start from (usually 0)
   */
  start(startTime = 0) {
    this.startTime = Date.now() - startTime;
    this.isPlaying = true;
  }

  /**
   * Stop playback
   */
  stop() {
    this.isPlaying = false;
  }

  /**
   * Reset to beginning
   */
  reset() {
    this.startTime = Date.now();
  }

  /**
   * Get current playback time in milliseconds
   * @returns {number}
   */
  getCurrentTime() {
    if (!this.isPlaying) return 0;
    return Date.now() - this.startTime;
  }

  /**
   * Check if an obstacle has animation
   * @param {string} obstacleId
   * @returns {boolean}
   */
  hasAnimation(obstacleId) {
    return this.animations.has(obstacleId);
  }

  /**
   * Get animation data for an obstacle
   * @param {string} obstacleId
   * @returns {Object|null}
   */
  getAnimation(obstacleId) {
    return this.animations.get(obstacleId) || null;
  }

  /**
   * Apply loop mode to time
   * @param {number} time - Raw time in ms
   * @param {number} duration - Animation duration
   * @param {string} loop - Loop mode
   * @param {number} loopCount - Max loops (0 = infinite)
   * @returns {number} Looped time value
   */
  applyLoop(time, duration, loop, loopCount) {
    if (duration <= 0) return 0;

    // Calculate how many loops have occurred
    const loopIndex = Math.floor(time / duration);

    // If loopCount > 0 and we've exceeded it, clamp
    if (loopCount > 0 && loopIndex >= loopCount) {
      switch (loop) {
        case 'hold':
        case 'none':
          return duration; // Stay at end
        case 'loop':
          return duration; // Stay at end
        case 'pingpong':
          // If odd loops, stay at start; if even, stay at end
          return (loopCount % 2 === 0) ? duration : 0;
      }
    }

    switch (loop) {
      case 'none':
        // Clamp to duration
        return Math.min(time, duration);

      case 'hold':
        // Play once, hold at end
        return Math.min(time, duration);

      case 'loop':
        // Repeat from start
        return time % duration;

      case 'pingpong':
        // Oscillate back and forth
        const phase = time % (duration * 2);
        return phase <= duration ? phase : duration * 2 - phase;

      default:
        return time % duration;
    }
  }

  /**
   * Interpolate between two keyframes
   * @param {Object} kf1 - First keyframe { time, value, easing }
   * @param {Object} kf2 - Second keyframe { time, value, easing }
   * @param {number} time - Current time
   * @returns {number} Interpolated value
   */
  interpolate(kf1, kf2, time) {
    if (!kf1 || !kf2) return kf1?.value ?? kf2?.value ?? 0;

    // Calculate progress (0-1) between keyframes
    const range = kf2.time - kf1.time;
    if (range <= 0) return kf2.value;

    const t = (time - kf1.time) / range;
    const clampedT = Math.max(0, Math.min(1, t));

    // Apply easing (use kf1's easing for the transition out of kf1)
    const easingFn = Easings.get(kf1.easing || 'linear');
    const easedT = easingFn(clampedT);

    // Linear interpolation with eased t
    return kf1.value + (kf2.value - kf1.value) * easedT;
  }

  /**
   * Evaluate a single track at a given time
   * @param {Object} track - Track with keyframes array
   * @param {number} time - Time to evaluate at
   * @returns {number|null} Value at time, or null if no keyframes
   */
  evaluateTrack(track, time) {
    if (!track || !track.keyframes || track.keyframes.length === 0) {
      return null;
    }

    const keyframes = track.keyframes;

    // Sort keyframes by time (should already be sorted, but be safe)
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);

    // Before first keyframe
    if (time <= sorted[0].time) {
      return sorted[0].value;
    }

    // After last keyframe
    if (time >= sorted[sorted.length - 1].time) {
      return sorted[sorted.length - 1].value;
    }

    // Find surrounding keyframes
    for (let i = 0; i < sorted.length - 1; i++) {
      if (time >= sorted[i].time && time <= sorted[i + 1].time) {
        return this.interpolate(sorted[i], sorted[i + 1], time);
      }
    }

    // Fallback (shouldn't reach here)
    return sorted[sorted.length - 1].value;
  }

  /**
   * Evaluate all properties for an obstacle at current time
   * @param {string} obstacleId
   * @param {number} time - Time in ms (if not provided, uses current playback time)
   * @returns {Object|null} Object with animated property values, or null if no animation
   */
  evaluate(obstacleId, time = null) {
    const anim = this.animations.get(obstacleId);
    if (!anim) return null;

    // Use provided time or current playback time
    const rawTime = time !== null ? time : this.getCurrentTime();

    // Apply loop mode
    const loopedTime = this.applyLoop(rawTime, anim.duration, anim.loop, anim.loopCount);

    // Evaluate each track
    const result = {};
    for (const [property, track] of Object.entries(anim.tracks)) {
      const value = this.evaluateTrack(track, loopedTime);
      if (value !== null) {
        result[property] = value;
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Debug: Detailed evaluation with logging
   */
  evaluateDebug(obstacleId, time) {
    const anim = this.animations.get(obstacleId);
    if (!anim) {
      console.log(`[AnimPlayer DEBUG] No animation for ${obstacleId}`);
      return null;
    }

    console.log(`[AnimPlayer DEBUG] Evaluating ${obstacleId} at t=${time}ms`);
    console.log(`  Duration: ${anim.duration}ms, Loop: ${anim.loop}`);

    const loopedTime = this.applyLoop(time, anim.duration, anim.loop, anim.loopCount);
    console.log(`  Raw time: ${time}ms -> Looped time: ${loopedTime}ms`);

    const result = {};
    for (const [property, track] of Object.entries(anim.tracks)) {
      console.log(`  Track '${property}':`);
      track.keyframes.forEach((kf, i) => {
        console.log(`    KF[${i}]: t=${kf.time}, v=${kf.value}, ease=${kf.easing}`);
      });

      const value = this.evaluateTrack(track, loopedTime);
      console.log(`    -> Interpolated value: ${value}`);
      if (value !== null) {
        result[property] = value;
      }
    }

    console.log(`  Final result:`, result);
    return result;
  }

  /**
   * Update all animated obstacles
   * @param {Array} obstacles - Array of obstacle objects from RaceScene
   * @param {number} time - Current time in ms
   * @param {Object} matter - Phaser Matter instance for physics body updates
   */
  update(obstacles, time, matter) {
    if (!this.isPlaying && time === undefined) return;

    const now = Date.now();
    const shouldLog = this.debugMode && (now - this.lastDebugLog > this.debugLogInterval);
    if (shouldLog) {
      this.lastDebugLog = now;
      console.log(`[AnimPlayer] update() time=${time}ms, obstacles=${obstacles.length}, animated=${this.animations.size}`);
    }

    obstacles.forEach(obs => {
      try {
        // Skip if no animation for this obstacle
        if (!obs.data?.id || !this.hasAnimation(obs.data.id)) return;

        // Skip destroyed or invalid obstacles
        if (!obs.body || obs.destroyed) return;

        // Get animated values
        const values = this.evaluate(obs.data.id, time);
        if (!values) return;

        if (shouldLog) {
          console.log(`[AnimPlayer] ${obs.data.id}: values=`, values);
        }

        // Get base position (stored when obstacle was created)
        const baseX = obs.animBaseX ?? obs.body.position.x;
        const baseY = obs.animBaseY ?? obs.body.position.y;
        const baseRotation = obs.animBaseRotation ?? obs.body.angle;
        const baseScaleX = obs.animBaseScaleX ?? 1;
        const baseScaleY = obs.animBaseScaleY ?? 1;

        // Store base values if not already stored
        if (obs.animBaseX === undefined) {
          obs.animBaseX = baseX;
          obs.animBaseY = baseY;
          obs.animBaseRotation = baseRotation;
          obs.animBaseScaleX = baseScaleX;
          obs.animBaseScaleY = baseScaleY;
        }

        // Calculate final values (animation values are relative to base)
        const finalX = values.x !== undefined ? baseX + values.x : obs.body.position.x;
        const finalY = values.y !== undefined ? baseY + values.y : obs.body.position.y;
        const finalRotation = values.rotation !== undefined
          ? baseRotation + (values.rotation * Math.PI / 180)  // Convert degrees to radians
          : obs.body.angle;

        // Validate values are finite numbers
        if (!isFinite(finalX) || !isFinite(finalY)) {
          console.warn(`[AnimPlayer] Invalid position for ${obs.data.id}: x=${finalX}, y=${finalY}`);
          return;
        }

        // Store previous position for collision resolution
        const prevX = obs.body.position.x;
        const prevY = obs.body.position.y;

        // Update physics body position
        if (matter && obs.body && (values.x !== undefined || values.y !== undefined)) {
          const Matter = Phaser.Physics.Matter.Matter;

          // Calculate movement direction (for pushing balls)
          const dx = finalX - prevX;
          const dy = finalY - prevY;

          // Move the obstacle
          Matter.Body.setPosition(obs.body, { x: finalX, y: finalY });

          // Set velocity in movement direction to help push balls
          if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
            const speed = 5; // Movement speed multiplier
            Matter.Body.setVelocity(obs.body, { x: dx * speed, y: dy * speed });
          } else {
            Matter.Body.setVelocity(obs.body, { x: 0, y: 0 });
          }
        }

        // Update physics body rotation
        if (matter && obs.body && values.rotation !== undefined) {
          const Matter = Phaser.Physics.Matter.Matter;
          Matter.Body.setAngle(obs.body, finalRotation);
        }

        // Update graphics position
        if (obs.graphics) {
          if (values.x !== undefined || values.y !== undefined) {
            obs.graphics.x = finalX;
            obs.graphics.y = finalY;
          }

          if (values.rotation !== undefined) {
            obs.graphics.rotation = finalRotation;
          }

          // Handle scale (graphics only, physics body doesn't scale well)
          if (values.scaleX !== undefined) {
            obs.graphics.scaleX = baseScaleX * values.scaleX;
          }
          if (values.scaleY !== undefined) {
            obs.graphics.scaleY = baseScaleY * values.scaleY;
          }
        }
      } catch (err) {
        console.error(`[AnimPlayer] Error updating obstacle ${obs.data?.id}:`, err);
      }
    });
  }

  /**
   * Get debug info for an animation
   * @param {string} obstacleId
   * @returns {string} Debug string
   */
  getDebugInfo(obstacleId) {
    const anim = this.animations.get(obstacleId);
    if (!anim) return 'No animation';

    const trackNames = Object.keys(anim.tracks);
    const kfCounts = trackNames.map(t => `${t}:${anim.tracks[t].keyframes.length}kf`);

    return `${anim.duration}ms, ${anim.loop}, [${kfCounts.join(', ')}]`;
  }
}
