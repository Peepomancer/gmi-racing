/**
 * Timeline UI Component
 *
 * Renders an After Effects-style timeline for editing keyframe animations.
 *
 * Features:
 * - Multi-layer view showing ALL animated objects
 * - Collapsible layers with property tracks
 * - Time ruler with markers
 * - Draggable playhead
 * - Property tracks with keyframe diamonds
 * - Click to add/select keyframes
 * - Play/Pause controls (animates ALL objects)
 */

import { Easings } from './Easings.js';

export class Timeline {
  constructor(container, options = {}) {
    this.container = container;
    this.onKeyframeChange = options.onKeyframeChange || (() => {});
    this.onTimeChange = options.onTimeChange || (() => {});
    this.onPlayStateChange = options.onPlayStateChange || (() => {});
    this.onLayerSelect = options.onLayerSelect || (() => {});

    // Timeline state
    this.currentTime = 0;
    this.duration = options.duration || 2000;
    this.zoom = 1;
    this.isPlaying = false;
    this.loop = options.loop || 'pingpong';

    // Multi-layer mode: store ALL animations
    this.allAnimations = {}; // obstacleId -> animData
    this.obstacles = [];     // Array of obstacle objects for names/colors

    // Current selected obstacle (for single-object editing compatibility)
    this.obstacleId = null;
    this.animationData = null;

    // Selected keyframe: { obstacleId, property, index }
    this.selectedKeyframe = null;

    // Expanded/collapsed layers
    this.expandedLayers = new Set();

    // UI state
    this.isDraggingPlayhead = false;
    this.isDraggingKeyframe = false;

    // Properties to show in timeline
    this.properties = ['x', 'y', 'rotation', 'scaleX', 'scaleY'];

    // Playback
    this.playStartTime = 0;
    this.playStartOffset = 0;
    this.animationFrameId = null;

    // Build UI
    this.buildUI();
    this.attachEvents();
  }

  /**
   * Build the timeline UI structure
   */
  buildUI() {
    this.container.innerHTML = `
      <div class="timeline-component">
        <div class="timeline-controls">
          <button class="tl-btn tl-play" title="Play All (Space)">
            <span class="play-icon">&#9658;</span>
            <span class="pause-icon" style="display:none;">&#10074;&#10074;</span>
          </button>
          <button class="tl-btn tl-stop" title="Stop">&#9632;</button>
          <span class="tl-time-display">0.000s</span>
          <span class="tl-separator">|</span>
          <label>Duration:
            <input type="number" class="tl-duration" value="${this.duration}" min="100" max="30000" step="100">
            <span>ms</span>
          </label>
          <span class="tl-separator">|</span>
          <label>Loop:
            <select class="tl-loop">
              <option value="none">None</option>
              <option value="loop">Loop</option>
              <option value="pingpong" selected>Ping-Pong</option>
              <option value="hold">Hold</option>
            </select>
          </label>
          <span class="tl-separator">|</span>
          <span class="tl-layer-count">0 layers</span>
        </div>

        <div class="timeline-body">
          <div class="timeline-layers-panel">
            <div class="tl-layers-header">Layers</div>
            <div class="tl-layers-list"></div>
          </div>

          <div class="timeline-tracks-container">
            <div class="timeline-ruler">
              <div class="ruler-ticks"></div>
              <div class="playhead" style="left: 0%;">
                <div class="playhead-head"></div>
                <div class="playhead-line"></div>
              </div>
            </div>

            <div class="timeline-tracks"></div>
          </div>
        </div>

        <div class="timeline-footer">
          <span class="tl-hint">Click track to add keyframe | Drag keyframe to move | Delete to remove</span>
          <div class="tl-easing-selector" style="display: none;">
            <label>Easing:
              <select class="tl-easing">
                ${this.buildEasingOptions()}
              </select>
            </label>
          </div>
        </div>
      </div>
    `;

    // Cache elements
    this.playBtn = this.container.querySelector('.tl-play');
    this.stopBtn = this.container.querySelector('.tl-stop');
    this.timeDisplay = this.container.querySelector('.tl-time-display');
    this.durationInput = this.container.querySelector('.tl-duration');
    this.loopSelect = this.container.querySelector('.tl-loop');
    this.rulerTicks = this.container.querySelector('.ruler-ticks');
    this.playhead = this.container.querySelector('.playhead');
    this.layersList = this.container.querySelector('.tl-layers-list');
    this.tracksContainer = this.container.querySelector('.timeline-tracks');
    this.easingSelector = this.container.querySelector('.tl-easing-selector');
    this.easingSelect = this.container.querySelector('.tl-easing');
    this.layerCount = this.container.querySelector('.tl-layer-count');

    // Initial render
    this.renderRuler();
  }

  /**
   * Build easing dropdown options grouped by category
   */
  buildEasingOptions() {
    let html = '';
    for (const [group, easings] of Object.entries(Easings.groups)) {
      html += `<optgroup label="${group}">`;
      for (const easing of easings) {
        html += `<option value="${easing}">${easing}</option>`;
      }
      html += `</optgroup>`;
    }
    return html;
  }

  /**
   * Render the time ruler with tick marks
   */
  renderRuler() {
    const width = this.rulerTicks.offsetWidth || 600;
    const pxPerMs = width / this.duration;

    // Determine tick interval based on zoom
    let tickInterval = 500; // 0.5s default
    if (pxPerMs < 0.1) tickInterval = 2000;
    else if (pxPerMs < 0.2) tickInterval = 1000;
    else if (pxPerMs > 0.5) tickInterval = 250;

    let html = '';
    for (let t = 0; t <= this.duration; t += tickInterval) {
      const left = (t / this.duration) * 100;
      const isMajor = t % 1000 === 0;
      const label = (t / 1000).toFixed(1) + 's';

      html += `
        <div class="ruler-tick ${isMajor ? 'major' : 'minor'}" style="left: ${left}%;">
          ${isMajor ? `<span class="tick-label">${label}</span>` : ''}
        </div>
      `;
    }
    this.rulerTicks.innerHTML = html;
  }

  /**
   * Attach event listeners
   */
  attachEvents() {
    // Play/Pause
    this.playBtn.addEventListener('click', () => this.togglePlay());

    // Stop
    this.stopBtn.addEventListener('click', () => this.stop());

    // Duration change
    this.durationInput.addEventListener('change', (e) => {
      this.duration = parseInt(e.target.value) || 2000;
      this.renderRuler();
      this.renderLayers();
      // Update all animations with new duration
      for (const [obstacleId, animData] of Object.entries(this.allAnimations)) {
        animData.duration = this.duration;
        this.onKeyframeChange(obstacleId, animData);
      }
    });

    // Loop mode change
    this.loopSelect.addEventListener('change', (e) => {
      this.loop = e.target.value;
      // Update all animations with new loop mode
      for (const [obstacleId, animData] of Object.entries(this.allAnimations)) {
        animData.loop = this.loop;
        this.onKeyframeChange(obstacleId, animData);
      }
    });

    // Easing change
    this.easingSelect.addEventListener('change', (e) => {
      if (this.selectedKeyframe) {
        const { obstacleId, property, index } = this.selectedKeyframe;
        const animData = this.allAnimations[obstacleId];
        const track = animData?.tracks[property];
        if (track && track.keyframes[index]) {
          track.keyframes[index].easing = e.target.value;
          this.onKeyframeChange(obstacleId, animData);
        }
      }
    });

    // Playhead drag
    this.playhead.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isDraggingPlayhead = true;
    });

    // Global mouse move/up for dragging
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  /**
   * Set ALL animations at once (multi-layer mode)
   * @param {Object} animations - Map of obstacleId -> animData
   * @param {Array} obstacles - Array of obstacle objects with id, type, color
   */
  setAnimations(animations, obstacles = []) {
    this.allAnimations = animations || {};
    this.obstacles = obstacles;

    // Update layer count
    const count = Object.keys(this.allAnimations).length;
    this.layerCount.textContent = `${count} layer${count !== 1 ? 's' : ''}`;

    // Auto-expand the first layer if only one
    if (count === 1) {
      this.expandedLayers.add(Object.keys(this.allAnimations)[0]);
    }

    // Render the multi-layer view
    this.renderLayers();
  }

  /**
   * Set animation data for a single obstacle (backward compatibility)
   */
  setAnimation(obstacleId, animationData) {
    this.obstacleId = obstacleId;
    this.animationData = animationData;

    if (animationData) {
      this.duration = animationData.duration || 2000;
      this.loop = animationData.loop || 'pingpong';
      this.durationInput.value = this.duration;
      this.loopSelect.value = this.loop;

      // Also update allAnimations for multi-layer view
      if (obstacleId) {
        this.allAnimations[obstacleId] = animationData;
        this.expandedLayers.add(obstacleId); // Auto-expand selected
      }
    } else if (obstacleId && this.allAnimations[obstacleId]) {
      // Remove from multi-layer view if cleared
      delete this.allAnimations[obstacleId];
      this.expandedLayers.delete(obstacleId);
    }

    this.selectedKeyframe = null;
    this.renderRuler();
    this.renderLayers();
  }

  /**
   * Render multi-layer view with all animated objects
   */
  renderLayers() {
    const animatedIds = Object.keys(this.allAnimations);

    // Update layer count
    this.layerCount.textContent = `${animatedIds.length} layer${animatedIds.length !== 1 ? 's' : ''}`;

    // Build layers list and tracks
    let layersHtml = '';
    let tracksHtml = '';

    if (animatedIds.length === 0) {
      layersHtml = '<div class="tl-no-layers">No animated objects</div>';
      tracksHtml = '<div class="tl-no-tracks">Select an obstacle and add keyframes</div>';
    } else {
      for (const obstacleId of animatedIds) {
        const animData = this.allAnimations[obstacleId];
        const obstacle = this.obstacles.find(o => o.id === obstacleId);
        const isExpanded = this.expandedLayers.has(obstacleId);
        const isSelected = this.obstacleId === obstacleId;

        // Get display name from obstacle or use ID
        const displayName = this.getObstacleDisplayName(obstacle, obstacleId);
        const color = obstacle?.color || '#4a5568';

        // Layer header
        layersHtml += `
          <div class="tl-layer ${isSelected ? 'selected' : ''}" data-obstacle-id="${obstacleId}">
            <div class="tl-layer-header" data-obstacle-id="${obstacleId}">
              <span class="tl-layer-toggle ${isExpanded ? 'expanded' : ''}">${isExpanded ? '&#9660;' : '&#9654;'}</span>
              <span class="tl-layer-color" style="background-color: ${color};"></span>
              <span class="tl-layer-name">${displayName}</span>
            </div>
            ${isExpanded ? this.buildPropertyLabels(obstacleId) : ''}
          </div>
        `;

        // Tracks for this layer
        tracksHtml += `
          <div class="tl-layer-tracks ${isSelected ? 'selected' : ''}" data-obstacle-id="${obstacleId}">
            <div class="tl-layer-track-header" data-obstacle-id="${obstacleId}"></div>
            ${isExpanded ? this.buildPropertyTracks(obstacleId, animData) : ''}
          </div>
        `;
      }
    }

    this.layersList.innerHTML = layersHtml;
    this.tracksContainer.innerHTML = tracksHtml;

    // Attach layer click events
    this.attachLayerEvents();
  }

  /**
   * Get display name for an obstacle
   */
  getObstacleDisplayName(obstacle, obstacleId) {
    if (!obstacle) {
      // Extract short ID from full ID
      const shortId = obstacleId.split('-').pop().slice(-4);
      return `Object ${shortId}`;
    }
    const type = obstacle.type === 'circle' ? 'Circle' : 'Rect';
    const shortId = obstacleId.split('-').pop().slice(-4);
    return `${type} (${shortId})`;
  }

  /**
   * Build property labels for an expanded layer
   */
  buildPropertyLabels(obstacleId) {
    let html = '';
    for (const prop of this.properties) {
      html += `<div class="tl-label tl-prop-label" data-property="${prop}" data-obstacle-id="${obstacleId}">${prop}</div>`;
    }
    return html;
  }

  /**
   * Build property tracks for an expanded layer
   */
  buildPropertyTracks(obstacleId, animData) {
    let html = '';
    for (const prop of this.properties) {
      const track = animData?.tracks?.[prop];
      const keyframes = track?.keyframes || [];

      html += `
        <div class="tl-track" data-property="${prop}" data-obstacle-id="${obstacleId}">
          <div class="track-bg"></div>
          <div class="track-keyframes">
            ${keyframes.map((kf, index) => {
              const left = (kf.time / this.duration) * 100;
              const isSelected = this.selectedKeyframe?.obstacleId === obstacleId &&
                                this.selectedKeyframe?.property === prop &&
                                this.selectedKeyframe?.index === index;
              return `<div class="keyframe ${isSelected ? 'selected' : ''}"
                          style="left: ${left}%;"
                          data-index="${index}"
                          data-obstacle-id="${obstacleId}"
                          data-property="${prop}"
                          title="${prop}: ${kf.value} @ ${kf.time}ms (${kf.easing})"></div>`;
            }).join('')}
          </div>
        </div>
      `;
    }
    return html;
  }

  /**
   * Attach event listeners to layer elements
   */
  attachLayerEvents() {
    // Layer header clicks (toggle expand, select)
    const headers = this.layersList.querySelectorAll('.tl-layer-header');
    headers.forEach(header => {
      header.addEventListener('click', (e) => {
        const obstacleId = header.dataset.obstacleId;
        const toggle = e.target.closest('.tl-layer-toggle');

        if (toggle) {
          // Toggle expand/collapse
          if (this.expandedLayers.has(obstacleId)) {
            this.expandedLayers.delete(obstacleId);
          } else {
            this.expandedLayers.add(obstacleId);
          }
          this.renderLayers();
        } else {
          // Select this layer
          this.selectLayer(obstacleId);
        }
      });
    });

    // Track clicks
    const tracks = this.tracksContainer.querySelectorAll('.tl-track');
    tracks.forEach(track => {
      track.addEventListener('click', (e) => this.handleTrackClick(e, track));
      track.addEventListener('dblclick', (e) => this.handleTrackDoubleClick(e, track));
    });
  }

  /**
   * Select a layer (obstacle) in the timeline
   */
  selectLayer(obstacleId) {
    this.obstacleId = obstacleId;
    this.animationData = this.allAnimations[obstacleId] || null;

    // Update duration/loop from this animation
    if (this.animationData) {
      this.duration = this.animationData.duration || 2000;
      this.loop = this.animationData.loop || 'pingpong';
      this.durationInput.value = this.duration;
      this.loopSelect.value = this.loop;
    }

    // Auto-expand selected layer
    this.expandedLayers.add(obstacleId);

    // Notify external listener
    this.onLayerSelect(obstacleId);

    // Re-render to show selection
    this.renderLayers();
  }

  /**
   * Handle track click - select keyframe or set time
   */
  handleTrackClick(e, track) {
    const property = track.dataset.property;
    const obstacleId = track.dataset.obstacleId;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x / rect.width) * this.duration;

    // Check if clicking on a keyframe
    const kfElement = e.target.closest('.keyframe');
    if (kfElement) {
      const index = parseInt(kfElement.dataset.index);
      this.selectKeyframe(obstacleId, property, index);
      return;
    }

    // Otherwise, set playhead time
    this.setCurrentTime(clickTime);
  }

  /**
   * Handle track double-click - add keyframe
   */
  handleTrackDoubleClick(e, track) {
    const property = track.dataset.property;
    const obstacleId = track.dataset.obstacleId;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = Math.round((x / rect.width) * this.duration);

    this.addKeyframe(property, clickTime, null, obstacleId);
  }

  /**
   * Handle mouse move for dragging
   */
  handleMouseMove(e) {
    if (this.isDraggingPlayhead) {
      const container = this.container.querySelector('.timeline-tracks-container');
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      this.setCurrentTime(percent * this.duration);
    }

    if (this.isDraggingKeyframe && this.selectedKeyframe) {
      const container = this.container.querySelector('.timeline-tracks-container');
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newTime = Math.max(0, Math.min(this.duration, (x / rect.width) * this.duration));
      this.moveKeyframe(
        this.selectedKeyframe.obstacleId,
        this.selectedKeyframe.property,
        this.selectedKeyframe.index,
        Math.round(newTime)
      );
    }
  }

  /**
   * Handle mouse up
   */
  handleMouseUp(e) {
    this.isDraggingPlayhead = false;
    this.isDraggingKeyframe = false;
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeydown(e) {
    // Only handle if timeline is visible
    if (!this.container.offsetParent) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.togglePlay();
        break;
      case 'Delete':
      case 'Backspace':
        if (this.selectedKeyframe) {
          e.preventDefault();
          this.deleteSelectedKeyframe();
        }
        break;
      case 'KeyK':
        // Add keyframe at current time for selected property
        if (this.selectedKeyframe) {
          this.addKeyframe(
            this.selectedKeyframe.property,
            Math.round(this.currentTime),
            null,
            this.selectedKeyframe.obstacleId
          );
        }
        break;
    }
  }

  /**
   * Create empty animation data structure
   */
  createEmptyAnimation() {
    return {
      duration: this.duration,
      loop: this.loop,
      loopCount: 0,
      tracks: {}
    };
  }

  /**
   * Add a keyframe at the specified time
   * @param {string} property - Property name (x, y, rotation, etc.)
   * @param {number} time - Time in ms
   * @param {number|null} value - Value or null for default
   * @param {string|null} obstacleId - Obstacle ID (uses current if not provided)
   */
  addKeyframe(property, time, value = null, obstacleId = null) {
    const targetId = obstacleId || this.obstacleId;
    if (!targetId) return;

    // Get or create animation data for this obstacle
    let animData = this.allAnimations[targetId];
    if (!animData) {
      animData = this.createEmptyAnimation();
      this.allAnimations[targetId] = animData;
    }

    // Create track if doesn't exist
    if (!animData.tracks[property]) {
      animData.tracks[property] = { keyframes: [] };
    }

    const track = animData.tracks[property];

    // Check if keyframe already exists at this time
    const existing = track.keyframes.findIndex(kf => Math.abs(kf.time - time) < 10);
    if (existing >= 0) {
      // Update existing keyframe
      if (value !== null) {
        track.keyframes[existing].value = value;
      }
    } else {
      // Add new keyframe
      const newKf = {
        time,
        value: value !== null ? value : this.getDefaultValue(property),
        easing: 'easeInOutQuad'
      };
      track.keyframes.push(newKf);
      track.keyframes.sort((a, b) => a.time - b.time);
    }

    // Update local reference
    if (targetId === this.obstacleId) {
      this.animationData = animData;
    }

    this.renderLayers();
    this.onKeyframeChange(targetId, animData);
  }

  /**
   * Get default value for a property
   */
  getDefaultValue(property) {
    switch (property) {
      case 'x': return 0;
      case 'y': return 0;
      case 'rotation': return 0;
      case 'scaleX': return 1;
      case 'scaleY': return 1;
      default: return 0;
    }
  }

  /**
   * Select a keyframe
   */
  selectKeyframe(obstacleId, property, index) {
    this.selectedKeyframe = { obstacleId, property, index };

    // Also select the layer
    if (obstacleId !== this.obstacleId) {
      this.selectLayer(obstacleId);
    }

    this.renderLayers();

    // Show easing selector
    const animData = this.allAnimations[obstacleId];
    if (animData?.tracks[property]?.keyframes[index]) {
      const kf = animData.tracks[property].keyframes[index];
      this.easingSelect.value = kf.easing || 'linear';
      this.easingSelector.style.display = 'inline-block';

      // Enable dragging
      this.isDraggingKeyframe = true;
    }
  }

  /**
   * Delete the selected keyframe
   */
  deleteSelectedKeyframe() {
    if (!this.selectedKeyframe) return;

    const { obstacleId, property, index } = this.selectedKeyframe;
    const animData = this.allAnimations[obstacleId];
    const track = animData?.tracks[property];

    if (track && track.keyframes[index]) {
      track.keyframes.splice(index, 1);

      // Remove track if empty
      if (track.keyframes.length === 0) {
        delete animData.tracks[property];
      }

      // Remove animation entirely if no tracks left
      if (Object.keys(animData.tracks).length === 0) {
        delete this.allAnimations[obstacleId];
        if (obstacleId === this.obstacleId) {
          this.animationData = null;
        }
      }

      this.selectedKeyframe = null;
      this.easingSelector.style.display = 'none';
      this.renderLayers();
      this.onKeyframeChange(obstacleId, animData);
    }
  }

  /**
   * Move a keyframe to a new time
   */
  moveKeyframe(obstacleId, property, index, newTime) {
    const animData = this.allAnimations[obstacleId];
    if (!animData?.tracks[property]?.keyframes[index]) return;

    const track = animData.tracks[property];
    track.keyframes[index].time = newTime;
    track.keyframes.sort((a, b) => a.time - b.time);

    // Update selected index after sort
    const newIndex = track.keyframes.findIndex(kf => kf.time === newTime);
    this.selectedKeyframe.index = newIndex;

    this.renderLayers();
    this.onKeyframeChange(obstacleId, animData);
  }

  /**
   * Render keyframes on all tracks (backward compatibility - calls renderLayers)
   */
  renderKeyframes() {
    this.renderLayers();
  }

  /**
   * Set current time and update playhead
   */
  setCurrentTime(time) {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    const percent = (this.currentTime / this.duration) * 100;
    this.playhead.style.left = `${percent}%`;
    this.timeDisplay.textContent = (this.currentTime / 1000).toFixed(3) + 's';
    this.onTimeChange(this.currentTime);
  }

  /**
   * Toggle play/pause
   */
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Start playback
   */
  play() {
    this.isPlaying = true;
    this.playStartTime = performance.now();
    this.playStartOffset = this.currentTime;

    this.playBtn.querySelector('.play-icon').style.display = 'none';
    this.playBtn.querySelector('.pause-icon').style.display = 'inline';

    this.onPlayStateChange(true);
    this.animate();
  }

  /**
   * Pause playback
   */
  pause() {
    this.isPlaying = false;

    this.playBtn.querySelector('.play-icon').style.display = 'inline';
    this.playBtn.querySelector('.pause-icon').style.display = 'none';

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.onPlayStateChange(false);
  }

  /**
   * Stop playback and reset to start
   */
  stop() {
    this.pause();
    this.setCurrentTime(0);
  }

  /**
   * Animation loop
   */
  animate() {
    if (!this.isPlaying) return;

    const elapsed = performance.now() - this.playStartTime;
    let time = this.playStartOffset + elapsed;

    // Apply loop mode
    time = this.applyLoop(time);

    this.setCurrentTime(time);

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Apply loop mode to time
   */
  applyLoop(time) {
    switch (this.loop) {
      case 'none':
        if (time >= this.duration) {
          this.pause();
          return this.duration;
        }
        return time;

      case 'hold':
        return Math.min(time, this.duration);

      case 'loop':
        return time % this.duration;

      case 'pingpong':
        const phase = time % (this.duration * 2);
        return phase <= this.duration ? phase : this.duration * 2 - phase;

      default:
        return time % this.duration;
    }
  }

  /**
   * Get current animation data
   */
  getAnimationData() {
    return this.animationData;
  }

  /**
   * Get all animations
   */
  getAllAnimations() {
    return this.allAnimations;
  }

  /**
   * Set duration externally
   */
  setDuration(duration) {
    this.duration = duration;
    this.durationInput.value = duration;
    this.renderRuler();
    this.renderLayers();
    // Update selected animation
    if (this.animationData) {
      this.animationData.duration = duration;
      this.onKeyframeChange(this.obstacleId, this.animationData);
    }
  }

  /**
   * Set loop mode externally
   */
  setLoopMode(mode) {
    this.loop = mode;
    this.loopSelect.value = mode;
    if (this.animationData) {
      this.animationData.loop = mode;
      this.onKeyframeChange(this.obstacleId, this.animationData);
    }
  }

  /**
   * Go to previous keyframe across all tracks
   */
  goToPreviousKeyframe() {
    let prevTime = -1;

    // Search ALL animations, not just the selected one
    for (const animData of Object.values(this.allAnimations)) {
      if (!animData?.tracks) continue;
      for (const track of Object.values(animData.tracks)) {
        for (const kf of track.keyframes) {
          if (kf.time < this.currentTime && kf.time > prevTime) {
            prevTime = kf.time;
          }
        }
      }
    }

    if (prevTime >= 0) {
      this.setCurrentTime(prevTime);
    } else {
      this.setCurrentTime(0);
    }
  }

  /**
   * Go to next keyframe across all tracks
   */
  goToNextKeyframe() {
    let nextTime = this.duration + 1;

    // Search ALL animations, not just the selected one
    for (const animData of Object.values(this.allAnimations)) {
      if (!animData?.tracks) continue;
      for (const track of Object.values(animData.tracks)) {
        for (const kf of track.keyframes) {
          if (kf.time > this.currentTime && kf.time < nextTime) {
            nextTime = kf.time;
          }
        }
      }
    }

    if (nextTime <= this.duration) {
      this.setCurrentTime(nextTime);
    } else {
      this.setCurrentTime(this.duration);
    }
  }

  /**
   * Destroy the timeline
   */
  destroy() {
    this.pause();
    this.container.innerHTML = '';
  }
}
