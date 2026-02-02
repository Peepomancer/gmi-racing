/**
 * AnimationController
 *
 * Manages animations in the editor context.
 * Bridges between Timeline UI, Presets, and the Editor Scene.
 *
 * Responsibilities:
 * - Store animation data for all obstacles in the map
 * - Connect Timeline UI to obstacle selection
 * - Preview animations in the editor canvas
 * - Export animation data for saving
 */

import { Timeline } from './Timeline.js';
import { AnimationPlayer } from './AnimationPlayer.js';
import { Presets, applyPreset, listPresetsByCategory } from './Presets.js';

export class AnimationController {
  constructor(options = {}) {
    // Editor scene reference (for preview)
    this.scene = options.scene || null;

    // Timeline container element
    this.timelineContainer = options.timelineContainer || null;

    // Callback when animation data changes
    this.onAnimationChange = options.onAnimationChange || (() => {});

    // Callback when timeline time changes
    this.onTimeChangeCallback = options.onTimeChange || (() => {});

    // Animation data storage: obstacleId -> animation config
    this.animations = {};

    // Currently selected obstacle
    this.selectedObstacleId = null;

    // Timeline UI component
    this.timeline = null;

    // Animation player for preview
    this.player = new AnimationPlayer();

    // Preview state
    this.isPreviewPlaying = false;
    this.previewStartTime = 0;
    this.previewAnimationFrame = null;

    // Initialize if container provided
    if (this.timelineContainer) {
      this.initTimeline();
    }
  }

  /**
   * Initialize the Timeline UI
   */
  initTimeline() {
    this.timeline = new Timeline(this.timelineContainer, {
      duration: 2000,
      loop: 'pingpong',
      onKeyframeChange: (obstacleId, animData) => this.handleKeyframeChange(obstacleId, animData),
      onTimeChange: (time) => this.handleTimeChange(time),
      onPlayStateChange: (isPlaying) => this.handlePlayStateChange(isPlaying),
      onLayerSelect: (obstacleId) => this.handleLayerSelect(obstacleId)
    });
  }

  /**
   * Handle layer selection from Timeline UI
   * Used to highlight/select the obstacle in the editor when clicking a layer
   */
  handleLayerSelect(obstacleId) {
    this.selectedObstacleId = obstacleId;

    // Find and highlight the obstacle in the editor scene
    if (this.scene && this.scene.selectObstacleById) {
      this.scene.selectObstacleById(obstacleId);
    }
  }

  /**
   * Refresh the timeline with current animation data
   * Call this when animations change externally or obstacles are added/removed
   */
  refreshTimeline() {
    this.refreshTimelineWithObstacles(null);
  }

  /**
   * Set the editor scene for preview updates
   */
  setScene(scene) {
    this.scene = scene;
  }

  /**
   * Handle selection of an obstacle in the editor
   */
  selectObstacle(obstacleId, obstacle = null) {
    this.selectedObstacleId = obstacleId;

    // Stop any ongoing preview
    this.stopPreview();

    if (!obstacleId) {
      // No selection - just refresh to show all layers
      this.refreshTimeline();
      return;
    }

    // Get or create animation data for this obstacle
    let animData = this.animations[obstacleId];

    // First refresh the timeline with all animations (multi-layer view)
    this.refreshTimeline();

    // Then set the selected animation to highlight and expand its layer
    if (this.timeline) {
      this.timeline.setAnimation(obstacleId, animData || null);
    }
  }

  /**
   * Handle keyframe changes from Timeline UI
   */
  handleKeyframeChange(obstacleId, animData) {
    if (!obstacleId) return;

    // Store animation data
    if (animData && Object.keys(animData.tracks).length > 0) {
      this.animations[obstacleId] = animData;
    } else {
      // Remove if empty
      delete this.animations[obstacleId];
    }

    // Notify external listener
    this.onAnimationChange(obstacleId, animData);

    // Update preview if playing
    if (this.isPreviewPlaying) {
      this.updatePreviewAnimation();
    }
  }

  /**
   * Handle time changes from Timeline UI
   * Updates ALL animated obstacles during scrubbing for multi-object preview
   */
  handleTimeChange(time) {
    // Update ALL animated obstacles, not just the selected one
    if (this.scene) {
      for (const obstacleId of Object.keys(this.animations)) {
        this.updateObstacleAtTime(obstacleId, time);
      }
    }

    // Notify external listener (for updating keyframe buttons)
    this.onTimeChangeCallback(time);
  }

  /**
   * Handle play state changes from Timeline UI
   */
  handlePlayStateChange(isPlaying) {
    this.isPreviewPlaying = isPlaying;

    if (isPlaying) {
      this.startPreview();
    } else {
      this.stopPreview();
    }
  }

  /**
   * Start preview playback
   */
  startPreview() {
    this.isPreviewPlaying = true;
    this.previewStartTime = performance.now();

    // Load current animation into player
    this.updatePreviewAnimation();
    this.player.start(this.timeline?.currentTime || 0);

    this.animatePreview();
  }

  /**
   * Stop preview playback
   */
  stopPreview() {
    this.isPreviewPlaying = false;
    this.player.stop();

    if (this.previewAnimationFrame) {
      cancelAnimationFrame(this.previewAnimationFrame);
      this.previewAnimationFrame = null;
    }
  }

  /**
   * Update animation data in player
   * Loads ALL animations, not just the selected one, for multi-object preview
   */
  updatePreviewAnimation() {
    // Load ALL animations into the player for multi-object preview
    this.player.loadAnimations(this.animations);
  }

  /**
   * Preview animation loop
   * Updates ALL animated obstacles, not just the selected one
   */
  animatePreview() {
    if (!this.isPreviewPlaying) return;

    const currentTime = this.timeline?.currentTime || 0;

    // Update ALL animated obstacles, not just the selected one
    for (const obstacleId of Object.keys(this.animations)) {
      this.updateObstacleAtTime(obstacleId, currentTime);
    }

    this.previewAnimationFrame = requestAnimationFrame(() => this.animatePreview());
  }

  /**
   * Update obstacle visuals at a specific time (for preview)
   */
  updateObstacleAtTime(obstacleId, time) {
    if (!this.scene || !this.animations[obstacleId]) return;

    const animData = this.animations[obstacleId];
    const obstacle = this.findObstacleById(obstacleId);

    if (!obstacle) return;

    // Store base position if not already (use CENTER position for all shapes)
    if (obstacle.animBaseX === undefined) {
      // For rectangles, compute center from top-left corner
      if (obstacle.type === 'rectangle' || obstacle.type === 'rect') {
        obstacle.animBaseX = obstacle.x + (obstacle.width || 0) / 2;
        obstacle.animBaseY = obstacle.y + (obstacle.height || 0) / 2;
      } else {
        // For circles, x/y is already center
        obstacle.animBaseX = obstacle.x || 0;
        obstacle.animBaseY = obstacle.y || 0;
      }
      obstacle.animBaseRotation = (obstacle.angle || 0) * Math.PI / 180; // Store in radians
      obstacle.animBaseScaleX = 1;
      obstacle.animBaseScaleY = 1;
    }

    // Evaluate animation at time
    const values = this.evaluateAtTime(animData, time);

    // Apply to obstacle in editor scene (preview values are CENTER positions)
    if (this.scene.updateObstaclePreview) {
      this.scene.updateObstaclePreview(obstacleId, {
        x: values.x !== undefined ? obstacle.animBaseX + values.x : undefined,
        y: values.y !== undefined ? obstacle.animBaseY + values.y : undefined,
        rotation: values.rotation !== undefined ? obstacle.animBaseRotation + (values.rotation * Math.PI / 180) : undefined,
        scaleX: values.scaleX,
        scaleY: values.scaleY
      });
    }
  }

  /**
   * Find obstacle by ID in the scene
   */
  findObstacleById(obstacleId) {
    if (!this.scene?.obstacles) return null;
    return this.scene.obstacles.find(o => o.id === obstacleId);
  }

  /**
   * Evaluate animation tracks at a specific time
   */
  evaluateAtTime(animData, time) {
    const result = {};

    if (!animData?.tracks) return result;

    // Apply loop mode
    const loopedTime = this.applyLoop(time, animData.duration, animData.loop);

    for (const [property, track] of Object.entries(animData.tracks)) {
      if (track.keyframes && track.keyframes.length > 0) {
        result[property] = this.interpolateTrack(track.keyframes, loopedTime);
      }
    }

    return result;
  }

  /**
   * Apply loop mode to time
   */
  applyLoop(time, duration, loop) {
    if (duration <= 0) return 0;

    switch (loop) {
      case 'none':
      case 'hold':
        return Math.min(time, duration);
      case 'loop':
        return time % duration;
      case 'pingpong':
        const phase = time % (duration * 2);
        return phase <= duration ? phase : duration * 2 - phase;
      default:
        return time % duration;
    }
  }

  /**
   * Interpolate a track's keyframes at a given time
   */
  interpolateTrack(keyframes, time) {
    if (keyframes.length === 0) return 0;
    if (keyframes.length === 1) return keyframes[0].value;

    const sorted = [...keyframes].sort((a, b) => a.time - b.time);

    // Before first
    if (time <= sorted[0].time) return sorted[0].value;

    // After last
    if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

    // Find surrounding keyframes
    for (let i = 0; i < sorted.length - 1; i++) {
      if (time >= sorted[i].time && time <= sorted[i + 1].time) {
        const kf1 = sorted[i];
        const kf2 = sorted[i + 1];
        const range = kf2.time - kf1.time;
        const t = (time - kf1.time) / range;

        // TODO: Apply easing function
        return kf1.value + (kf2.value - kf1.value) * t;
      }
    }

    return sorted[sorted.length - 1].value;
  }

  /**
   * Apply a preset to the selected obstacle
   */
  applyPreset(presetKey) {
    if (!this.selectedObstacleId) return false;

    const animData = applyPreset(presetKey, this.selectedObstacleId);
    if (!animData) return false;

    // Store animation
    this.animations[this.selectedObstacleId] = animData;

    // Update timeline
    if (this.timeline) {
      this.timeline.setAnimation(this.selectedObstacleId, animData);
    }

    // Notify
    this.onAnimationChange(this.selectedObstacleId, animData);

    return true;
  }

  /**
   * Get presets organized by category (for UI)
   */
  getPresetsForUI() {
    return listPresetsByCategory();
  }

  /**
   * Add keyframe for property at current time
   */
  addKeyframeAtCurrentTime(property, value) {
    if (!this.selectedObstacleId || !this.timeline) return;

    const time = Math.round(this.timeline.currentTime);
    this.timeline.addKeyframe(property, time, value);
  }

  /**
   * Check if an obstacle has animation
   */
  hasAnimation(obstacleId) {
    return !!this.animations[obstacleId];
  }

  /**
   * Get animation data for an obstacle
   */
  getAnimation(obstacleId) {
    return this.animations[obstacleId] || null;
  }

  /**
   * Remove animation for an obstacle
   */
  removeAnimation(obstacleId) {
    delete this.animations[obstacleId];
    if (this.selectedObstacleId === obstacleId && this.timeline) {
      this.timeline.setAnimation(null, null);
    }
    this.onAnimationChange(obstacleId, null);
  }

  /**
   * Load animations from map data
   * @param {Object} animationsData - Animation data keyed by obstacleId
   * @param {Array} existingObstacles - Optional array of obstacles for validation and timeline display
   */
  loadAnimations(animationsData, existingObstacles = null) {
    this.animations = {};

    // Store the obstacles reference for timeline display
    this._cachedObstacles = existingObstacles;

    if (!animationsData) {
      this.refreshTimelineWithObstacles(existingObstacles);
      return;
    }

    const validIds = existingObstacles
      ? new Set(existingObstacles.map(o => o.id))
      : null;

    for (const [obstacleId, animData] of Object.entries(animationsData)) {
      // Skip orphaned animations (obstacle no longer exists)
      if (validIds && !validIds.has(obstacleId)) {
        console.log(`[AnimController] Skipping orphaned animation on load: ${obstacleId}`);
        continue;
      }
      this.animations[obstacleId] = animData;
    }

    console.log(`[AnimController] Loaded ${Object.keys(this.animations).length} animations`);

    // Update timeline with all loaded animations using provided obstacles
    this.refreshTimelineWithObstacles(existingObstacles);

    // Also update selected obstacle's view if applicable
    if (this.selectedObstacleId && this.timeline) {
      this.timeline.setAnimation(
        this.selectedObstacleId,
        this.animations[this.selectedObstacleId] || null
      );
    }
  }

  /**
   * Refresh timeline with specific obstacles array (used when obstacles array might be stale)
   */
  refreshTimelineWithObstacles(obstacles) {
    if (!this.timeline) return;

    const obstacleList = obstacles || this._cachedObstacles || this.scene?.obstacles || [];
    this.timeline.setAnimations(this.animations, obstacleList);

    // If there's a selected obstacle, make sure it's shown
    if (this.selectedObstacleId) {
      this.timeline.setAnimation(
        this.selectedObstacleId,
        this.animations[this.selectedObstacleId] || null
      );
    }
  }

  /**
   * Export all animations (for saving map)
   * @param {Array} existingObstacles - Optional array of obstacles to validate against
   * @returns {Object|null} Animation data for valid obstacles, or null if empty
   */
  exportAnimations(existingObstacles = null) {
    const result = {};
    const validIds = existingObstacles
      ? new Set(existingObstacles.map(o => o.id))
      : null;

    for (const [obstacleId, animData] of Object.entries(this.animations)) {
      // Skip orphaned animations (obstacle no longer exists)
      if (validIds && !validIds.has(obstacleId)) {
        console.log(`[AnimController] Removing orphaned animation on export: ${obstacleId}`);
        continue;
      }

      // Skip empty animations (no tracks or empty tracks)
      if (animData && animData.tracks && Object.keys(animData.tracks).length > 0) {
        result[obstacleId] = animData;
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Reset animation preview for an obstacle (return to base position)
   */
  resetObstaclePreview(obstacleId) {
    const obstacle = this.findObstacleById(obstacleId);
    if (!obstacle) return;

    if (this.scene?.updateObstaclePreview) {
      this.scene.updateObstaclePreview(obstacleId, {
        x: obstacle.animBaseX,
        y: obstacle.animBaseY,
        rotation: obstacle.animBaseRotation,
        scaleX: obstacle.animBaseScaleX || 1,
        scaleY: obstacle.animBaseScaleY || 1
      });
    }
  }

  /**
   * Destroy the controller
   */
  destroy() {
    this.stopPreview();
    if (this.timeline) {
      this.timeline.destroy();
    }
  }
}
