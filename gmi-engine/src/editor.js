import Phaser from 'phaser';
import { getMapStorage } from './shared/MapStorage.js';
import { AnimationController } from './animation/AnimationController.js';

// ============================================================================
// Editor Scene - Phaser scene for canvas rendering
// ============================================================================
class EditorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EditorScene' });

    this.obstacles = [];
    this.itemSpawns = [];
    this.startZone = null;
    this.finishZone = null;
    this.selectedObject = null;
    this.currentTool = 'select';
    this.isDrawing = false;
    this.drawStart = { x: 0, y: 0 };
    this.previewGraphics = null;
    this.selectionHandles = [];
    this.mapWidth = 800;
    this.mapHeight = 600;

    // Color settings
    this.viewportBgColor = 0x1a1a2e;
    this.floorColor = 0xe8e0d0;
    this.gridColor = 0xcccccc;
    this.gridSize = 50;
    this.showGrid = true;
  }

  init(data) {
    this.mapWidth = data.width || 800;
    this.mapHeight = data.height || 600;
  }

  create() {
    // Background
    this.bgGraphics = this.add.graphics();
    this.drawBackground();

    // Obstacle layer
    this.obstacleLayer = this.add.graphics();

    // Zone layer (start/finish)
    this.zoneLayer = this.add.graphics();

    // Selection layer
    this.selectionLayer = this.add.graphics();

    // Preview layer for drawing
    this.previewGraphics = this.add.graphics();

    // Handle layer for resize handles
    this.handleLayer = this.add.graphics();

    // Input events
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);

    // Middle-click panning
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.cameraOffset = { x: 0, y: 0 };

    // Setup camera for panning
    this.cameras.main.setBounds(-500, -500, this.mapWidth + 1000, this.mapHeight + 1000);

    // Wheel zoom
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const zoom = this.cameras.main.zoom;
      const newZoom = deltaY > 0 ? zoom * 0.9 : zoom * 1.1;
      this.cameras.main.setZoom(Phaser.Math.Clamp(newZoom, 0.25, 3));
    });

    // Keyboard
    this.input.keyboard.on('keydown-DELETE', this.deleteSelected, this);
    this.input.keyboard.on('keydown-BACKSPACE', this.deleteSelected, this);

    console.log('EditorScene created', this.mapWidth, 'x', this.mapHeight);
  }

  drawBackground() {
    this.bgGraphics.clear();

    // Viewport background (area outside map) - draw a large rectangle first
    this.bgGraphics.fillStyle(this.viewportBgColor, 1);
    this.bgGraphics.fillRect(-500, -500, this.mapWidth + 1000, this.mapHeight + 1000);

    // Floor/canvas background
    this.bgGraphics.fillStyle(this.floorColor, 1);
    this.bgGraphics.fillRect(0, 0, this.mapWidth, this.mapHeight);

    // Map border (makes it clear where the canvas is)
    this.bgGraphics.lineStyle(3, 0x00ffff, 1);
    this.bgGraphics.strokeRect(0, 0, this.mapWidth, this.mapHeight);

    // Grid
    if (this.showGrid) {
      this.bgGraphics.lineStyle(1, this.gridColor, 0.3);
      for (let x = 0; x <= this.mapWidth; x += this.gridSize) {
        this.bgGraphics.lineBetween(x, 0, x, this.mapHeight);
      }
      for (let y = 0; y <= this.mapHeight; y += this.gridSize) {
        this.bgGraphics.lineBetween(0, y, this.mapWidth, y);
      }
    }
  }

  setColors(viewportBg, floor, grid, gridSize, showGrid) {
    this.viewportBgColor = viewportBg;
    this.floorColor = floor;
    this.gridColor = grid;
    this.gridSize = gridSize;
    this.showGrid = showGrid;
    this.drawBackground();
    this.redraw();
  }

  setTool(tool) {
    this.currentTool = tool;
    this.clearSelection();
  }

  // ---- Input Handlers ----

  onPointerDown(pointer) {
    // Middle mouse button - start panning (use screen coords for panning)
    if (pointer.middleButtonDown()) {
      this.isPanning = true;
      this.panStart = { x: pointer.x, y: pointer.y };
      return;
    }

    // Convert screen coordinates to world coordinates for all other operations
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const x = worldPoint.x;
    const y = worldPoint.y;

    if (this.currentTool === 'select') {
      this.handleSelectClick(x, y);
    } else if (this.currentTool === 'boss') {
      // Boss placement - instant click, no drag
      this.placeBoss(x, y);
    } else if (this.currentTool === 'item') {
      // Item spawn placement - instant click, no drag
      this.placeItemSpawn(x, y);
    } else {
      // Start drawing
      this.isDrawing = true;
      this.drawStart = { x, y };
    }
  }

  onPointerMove(pointer) {
    // Handle panning (use screen coords)
    if (this.isPanning) {
      const dx = pointer.x - this.panStart.x;
      const dy = pointer.y - this.panStart.y;
      this.cameras.main.scrollX -= dx;
      this.cameras.main.scrollY -= dy;
      this.panStart = { x: pointer.x, y: pointer.y };
      return;
    }

    // Note: dragging and resizing are handled by onDragMove/onResizeMove
    // which are attached separately in startDrag/startResize

    if (!this.isDrawing) return;

    // Convert to world coordinates for drawing preview
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const x = worldPoint.x;
    const y = worldPoint.y;

    this.previewGraphics.clear();

    if (this.currentTool === 'rectangle') {
      this.drawPreviewRect(this.drawStart.x, this.drawStart.y, x, y);
    } else if (this.currentTool === 'circle') {
      this.drawPreviewCircle(this.drawStart.x, this.drawStart.y, x, y);
    } else if (this.currentTool === 'start' || this.currentTool === 'finish') {
      this.drawPreviewZone(this.drawStart.x, this.drawStart.y, x, y, this.currentTool);
    }
  }

  onPointerUp(pointer) {
    // Stop panning
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    // Note: drag/resize ending is handled by onDragEnd/onResizeEnd
    // which are set as 'once' handlers in startDrag/startResize

    if (!this.isDrawing) return;

    // Convert to world coordinates
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const x = worldPoint.x;
    const y = worldPoint.y;

    this.isDrawing = false;
    this.previewGraphics.clear();

    // Minimum size check
    const minSize = 10;
    const width = Math.abs(x - this.drawStart.x);
    const height = Math.abs(y - this.drawStart.y);

    if (width < minSize && height < minSize) return;

    if (this.currentTool === 'rectangle') {
      this.createRectangle(this.drawStart.x, this.drawStart.y, x, y);
    } else if (this.currentTool === 'circle') {
      this.createCircle(this.drawStart.x, this.drawStart.y, x, y);
    } else if (this.currentTool === 'start') {
      this.createStartZone(this.drawStart.x, this.drawStart.y, x, y);
    } else if (this.currentTool === 'finish') {
      this.createFinishZone(this.drawStart.x, this.drawStart.y, x, y);
    }
  }

  // ---- Selection ----

  handleSelectClick(x, y) {
    // Check if clicked on a handle
    if (this.selectedObject) {
      const handle = this.getHandleAtPoint(x, y);
      if (handle) {
        this.startResize(handle, x, y);
        return;
      }
    }

    // Check zones first
    if (this.startZone && this.pointInRect(x, y, this.startZone)) {
      this.selectObject(this.startZone, 'start');
      return;
    }
    if (this.finishZone && this.pointInRect(x, y, this.finishZone)) {
      this.selectObject(this.finishZone, 'finish');
      return;
    }

    // Check obstacles (reverse order - top items first)
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (this.pointInObject(x, y, obs)) {
        this.selectObject(obs, 'obstacle');
        this.startDrag(x, y);
        return;
      }
    }

    // Check item spawns
    for (const spawn of this.itemSpawns) {
      const dx = x - spawn.x;
      const dy = y - spawn.y;
      if (dx * dx + dy * dy <= 25 * 25) {
        this.selectObject(spawn, 'itemSpawn');
        this.startDrag(x, y);
        return;
      }
    }

    // Clicked on nothing
    this.clearSelection();
  }

  pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width &&
           y >= rect.y && y <= rect.y + rect.height;
  }

  pointInObject(x, y, obj) {
    if (obj.type === 'circle') {
      const dx = x - obj.x;
      const dy = y - obj.y;
      return (dx * dx + dy * dy) <= (obj.radius * obj.radius);
    } else {
      return this.pointInRect(x, y, obj);
    }
  }

  selectObject(obj, type) {
    this.selectedObject = obj;
    this.selectedType = type;
    this.drawSelection();

    // Notify UI
    if (window.editorUI) {
      window.editorUI.onObjectSelected(obj, type);
    }
  }

  clearSelection() {
    this.selectedObject = null;
    this.selectedType = null;
    this.selectionLayer.clear();
    this.handleLayer.clear();

    if (window.editorUI) {
      window.editorUI.onSelectionCleared();
    }
  }

  drawSelection() {
    this.selectionLayer.clear();
    this.handleLayer.clear();

    if (!this.selectedObject) return;

    const obj = this.selectedObject;

    // Highlight color
    this.selectionLayer.lineStyle(2, 0x00ffff, 1);

    if (obj.type === 'circle') {
      this.selectionLayer.strokeCircle(obj.x, obj.y, obj.radius + 3);
      this.drawCircleHandles(obj);
    } else {
      this.selectionLayer.strokeRect(obj.x - 2, obj.y - 2, obj.width + 4, obj.height + 4);
      this.drawRectHandles(obj);
    }
  }

  drawRectHandles(obj) {
    const handleSize = 8;
    const halfHandle = handleSize / 2;

    this.handleLayer.fillStyle(0x00ffff, 1);
    this.handleLayer.lineStyle(1, 0x000000, 1);

    // 8 resize handles
    const positions = [
      { x: obj.x, y: obj.y, cursor: 'nw-resize' },                          // top-left
      { x: obj.x + obj.width / 2, y: obj.y, cursor: 'n-resize' },           // top-center
      { x: obj.x + obj.width, y: obj.y, cursor: 'ne-resize' },              // top-right
      { x: obj.x + obj.width, y: obj.y + obj.height / 2, cursor: 'e-resize' }, // right-center
      { x: obj.x + obj.width, y: obj.y + obj.height, cursor: 'se-resize' }, // bottom-right
      { x: obj.x + obj.width / 2, y: obj.y + obj.height, cursor: 's-resize' }, // bottom-center
      { x: obj.x, y: obj.y + obj.height, cursor: 'sw-resize' },             // bottom-left
      { x: obj.x, y: obj.y + obj.height / 2, cursor: 'w-resize' },          // left-center
    ];

    this.selectionHandles = positions.map((pos, i) => {
      this.handleLayer.fillRect(pos.x - halfHandle, pos.y - halfHandle, handleSize, handleSize);
      this.handleLayer.strokeRect(pos.x - halfHandle, pos.y - halfHandle, handleSize, handleSize);
      return { ...pos, index: i };
    });
  }

  drawCircleHandles(obj) {
    const handleSize = 8;
    const halfHandle = handleSize / 2;

    this.handleLayer.fillStyle(0x00ffff, 1);
    this.handleLayer.lineStyle(1, 0x000000, 1);

    // 4 handles at compass points
    const positions = [
      { x: obj.x, y: obj.y - obj.radius, cursor: 'n-resize' },  // top
      { x: obj.x + obj.radius, y: obj.y, cursor: 'e-resize' },  // right
      { x: obj.x, y: obj.y + obj.radius, cursor: 's-resize' },  // bottom
      { x: obj.x - obj.radius, y: obj.y, cursor: 'w-resize' },  // left
    ];

    this.selectionHandles = positions.map((pos, i) => {
      this.handleLayer.fillRect(pos.x - halfHandle, pos.y - halfHandle, handleSize, handleSize);
      this.handleLayer.strokeRect(pos.x - halfHandle, pos.y - halfHandle, handleSize, handleSize);
      return { ...pos, index: i };
    });
  }

  getHandleAtPoint(x, y) {
    const tolerance = 8;
    for (const handle of this.selectionHandles) {
      if (Math.abs(x - handle.x) <= tolerance && Math.abs(y - handle.y) <= tolerance) {
        return handle;
      }
    }
    return null;
  }

  // ---- Dragging ----

  startDrag(x, y) {
    if (!this.selectedObject) return;

    this.isDragging = true;
    // x, y are already world coordinates from handleSelectClick
    this.dragStart = { x, y };
    this.dragObjectStart = {
      x: this.selectedObject.x,
      y: this.selectedObject.y
    };

    // Override move handler
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.on('pointermove', this.onDragMove, this);
    this.input.once('pointerup', this.onDragEnd, this);
  }

  onDragMove(pointer) {
    if (!this.isDragging || !this.selectedObject) return;

    // Convert screen to world coordinates
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const dx = worldPoint.x - this.dragStart.x;
    const dy = worldPoint.y - this.dragStart.y;

    this.selectedObject.x = this.dragObjectStart.x + dx;
    this.selectedObject.y = this.dragObjectStart.y + dy;

    this.redraw();
    this.drawSelection();
  }

  onDragEnd(pointer) {
    this.isDragging = false;
    this.input.off('pointermove', this.onDragMove, this);
    this.input.on('pointermove', this.onPointerMove, this);

    if (window.editorUI && this.selectedObject) {
      window.editorUI.onObjectSelected(this.selectedObject, this.selectedType);

      // Trigger auto-keyframe after drag
      if (window.editorUI.isAutoKeyframeEnabled() &&
          window.editorUI.animationController?.animations[this.selectedObject.id]) {
        console.log('[Drag] Auto-keyframing position after drag');
        window.editorUI.recordKeyframeFromCurrentPosition('x');
        window.editorUI.recordKeyframeFromCurrentPosition('y');
      }
    }
  }

  // ---- Resizing ----

  startResize(handle, x, y) {
    this.isResizing = true;
    this.resizeHandle = handle;
    this.resizeStart = { x, y };
    this.resizeObjectStart = { ...this.selectedObject };

    this.input.off('pointermove', this.onPointerMove, this);
    this.input.on('pointermove', this.onResizeMove, this);
    this.input.once('pointerup', this.onResizeEnd, this);
  }

  onResizeMove(pointer) {
    if (!this.isResizing || !this.selectedObject) return;

    // Convert screen to world coordinates
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    const obj = this.selectedObject;
    const start = this.resizeObjectStart;
    const dx = worldPoint.x - this.resizeStart.x;
    const dy = worldPoint.y - this.resizeStart.y;

    if (obj.type === 'circle') {
      // For circles, just change radius
      const distance = Math.sqrt(
        Math.pow(worldPoint.x - obj.x, 2) +
        Math.pow(worldPoint.y - obj.y, 2)
      );
      obj.radius = Math.max(10, distance);
    } else {
      // Rectangle resizing based on handle
      const idx = this.resizeHandle.index;

      switch (idx) {
        case 0: // top-left
          obj.x = start.x + dx;
          obj.y = start.y + dy;
          obj.width = start.width - dx;
          obj.height = start.height - dy;
          break;
        case 1: // top-center
          obj.y = start.y + dy;
          obj.height = start.height - dy;
          break;
        case 2: // top-right
          obj.y = start.y + dy;
          obj.width = start.width + dx;
          obj.height = start.height - dy;
          break;
        case 3: // right-center
          obj.width = start.width + dx;
          break;
        case 4: // bottom-right
          obj.width = start.width + dx;
          obj.height = start.height + dy;
          break;
        case 5: // bottom-center
          obj.height = start.height + dy;
          break;
        case 6: // bottom-left
          obj.x = start.x + dx;
          obj.width = start.width - dx;
          obj.height = start.height + dy;
          break;
        case 7: // left-center
          obj.x = start.x + dx;
          obj.width = start.width - dx;
          break;
      }

      // Enforce minimum size
      if (obj.width < 10) { obj.width = 10; obj.x = start.x + start.width - 10; }
      if (obj.height < 10) { obj.height = 10; obj.y = start.y + start.height - 10; }
    }

    this.redraw();
    this.drawSelection();
  }

  onResizeEnd() {
    this.isResizing = false;
    this.input.off('pointermove', this.onResizeMove, this);
    this.input.on('pointermove', this.onPointerMove, this);

    if (window.editorUI && this.selectedObject) {
      window.editorUI.onObjectSelected(this.selectedObject, this.selectedType);
    }
  }

  // ---- Preview Drawing ----

  drawPreviewRect(x1, y1, x2, y2) {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);

    this.previewGraphics.lineStyle(2, 0x00ffff, 0.8);
    this.previewGraphics.fillStyle(0x4a5568, 0.5);
    this.previewGraphics.fillRect(x, y, w, h);
    this.previewGraphics.strokeRect(x, y, w, h);
  }

  drawPreviewCircle(x1, y1, x2, y2) {
    const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    this.previewGraphics.lineStyle(2, 0x00ffff, 0.8);
    this.previewGraphics.fillStyle(0x4a5568, 0.5);
    this.previewGraphics.fillCircle(x1, y1, radius);
    this.previewGraphics.strokeCircle(x1, y1, radius);
  }

  drawPreviewZone(x1, y1, x2, y2, type) {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);

    const color = type === 'start' ? 0x00ff88 : 0xff4444;

    this.previewGraphics.lineStyle(3, color, 0.8);
    this.previewGraphics.fillStyle(color, 0.2);
    this.previewGraphics.fillRect(x, y, w, h);

    // Dashed effect
    const dashLength = 10;
    for (let i = x; i < x + w; i += dashLength * 2) {
      this.previewGraphics.lineBetween(i, y, Math.min(i + dashLength, x + w), y);
      this.previewGraphics.lineBetween(i, y + h, Math.min(i + dashLength, x + w), y + h);
    }
    for (let i = y; i < y + h; i += dashLength * 2) {
      this.previewGraphics.lineBetween(x, i, x, Math.min(i + dashLength, y + h));
      this.previewGraphics.lineBetween(x + w, i, x + w, Math.min(i + dashLength, y + h));
    }
  }

  // ---- Object Creation ----

  createRectangle(x1, y1, x2, y2) {
    const obstacle = {
      id: 'obs-' + Date.now(),
      type: 'rectangle',
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      angle: 0,
      color: '#e74c3c',
      behavior: 'static',
      // Breakable settings
      health: 3,
      breakableBy: ['Red', 'Blue'],
      // Rotating settings
      rotationSpeed: 2,
      rotationDirection: 'cw',
      // Moving settings
      moveDirection: 'horizontal',
      moveDistance: 100,
      moveSpeed: 50
    };

    this.obstacles.push(obstacle);
    this.redraw();
    this.selectObject(obstacle, 'obstacle');
    this.updateStatus();
  }

  createCircle(x1, y1, x2, y2) {
    const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    const obstacle = {
      id: 'obs-' + Date.now(),
      type: 'circle',
      x: x1,
      y: y1,
      radius: Math.max(10, radius),
      angle: 0,
      color: '#e74c3c',
      behavior: 'static',
      health: 3,
      breakableBy: ['Red', 'Blue'],
      rotationSpeed: 2,
      rotationDirection: 'cw',
      moveDirection: 'horizontal',
      moveDistance: 100,
      moveSpeed: 50
    };

    this.obstacles.push(obstacle);
    this.redraw();
    this.selectObject(obstacle, 'obstacle');
    this.updateStatus();
  }

  createStartZone(x1, y1, x2, y2) {
    this.startZone = {
      type: 'start',
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.max(50, Math.abs(x2 - x1)),
      height: Math.max(20, Math.abs(y2 - y1))
    };

    this.redraw();
    this.selectObject(this.startZone, 'start');
    this.updateValidation();
  }

  createFinishZone(x1, y1, x2, y2) {
    this.finishZone = {
      type: 'finish',
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.max(50, Math.abs(x2 - x1)),
      height: Math.max(20, Math.abs(y2 - y1))
    };

    this.redraw();
    this.selectObject(this.finishZone, 'finish');
    this.updateValidation();
  }

  // ---- Delete ----

  deleteSelected() {
    if (!this.selectedObject) return;

    if (this.selectedType === 'obstacle') {
      const idx = this.obstacles.indexOf(this.selectedObject);
      if (idx !== -1) {
        this.obstacles.splice(idx, 1);
      }
    } else if (this.selectedType === 'start') {
      this.startZone = null;
    } else if (this.selectedType === 'finish') {
      this.finishZone = null;
    } else if (this.selectedType === 'itemSpawn') {
      // Destroy the label text if it exists
      if (this.selectedObject.labelText) {
        this.selectedObject.labelText.destroy();
      }
      const idx = this.itemSpawns.indexOf(this.selectedObject);
      if (idx !== -1) {
        this.itemSpawns.splice(idx, 1);
      }
    }

    this.clearSelection();
    this.redraw();
    this.updateStatus();
    this.updateValidation();
  }

  // ---- Redraw ----

  redraw() {
    this.obstacleLayer.clear();
    this.zoneLayer.clear();

    // Draw zones
    if (this.startZone) {
      this.drawZone(this.startZone, 0x00ff88, 'START');
    }
    if (this.finishZone) {
      this.drawZone(this.finishZone, 0xff4444, 'FINISH');
    }

    // Draw obstacles
    for (const obs of this.obstacles) {
      this.drawObstacle(obs);
    }

    // Draw item spawns
    this.drawItemSpawns();

    // Draw boss preview
    this.drawBossPreview();
  }

  drawBossPreview() {
    // Get boss config from UI
    const config = window.editorUI?.getBossConfig();
    if (!config) return;

    const x = config.x;
    const y = config.y;
    const width = config.width;
    const height = config.height;
    const color = config.color || 0xcc3300;

    // Draw boss body
    this.zoneLayer.fillStyle(color, 0.6);
    this.zoneLayer.lineStyle(3, 0xffff00, 1);

    if (config.shape === 'circle') {
      const radius = Math.min(width, height) / 2;
      this.zoneLayer.fillCircle(x, y, radius);
      this.zoneLayer.strokeCircle(x, y, radius);
    } else if (config.shape === 'diamond') {
      this.zoneLayer.beginPath();
      this.zoneLayer.moveTo(x, y - height / 2);
      this.zoneLayer.lineTo(x + width / 2, y);
      this.zoneLayer.lineTo(x, y + height / 2);
      this.zoneLayer.lineTo(x - width / 2, y);
      this.zoneLayer.closePath();
      this.zoneLayer.fillPath();
      this.zoneLayer.strokePath();
    } else {
      this.zoneLayer.fillRect(x - width / 2, y - height / 2, width, height);
      this.zoneLayer.strokeRect(x - width / 2, y - height / 2, width, height);
    }

    // Draw eyes
    this.zoneLayer.fillStyle(0xffffff, 1);
    this.zoneLayer.fillCircle(x - width / 5, y - height / 6, 6);
    this.zoneLayer.fillCircle(x + width / 5, y - height / 6, 6);
    this.zoneLayer.fillStyle(0x000000, 1);
    this.zoneLayer.fillCircle(x - width / 5, y - height / 6 + 2, 3);
    this.zoneLayer.fillCircle(x + width / 5, y - height / 6 + 2, 3);

    // Draw BOSS label
    if (!this.bossLabel) {
      this.bossLabel = this.add.text(0, 0, 'BOSS', {
        fontSize: '12px',
        color: '#ffff00',
        fontStyle: 'bold',
        backgroundColor: '#000000'
      });
    }
    this.bossLabel.setPosition(x - 20, y - height / 2 - 20);
    this.bossLabel.setVisible(true);
  }

  hideBossPreview() {
    if (this.bossLabel) {
      this.bossLabel.setVisible(false);
    }
  }

  placeBoss(x, y) {
    // Enable boss if not already enabled
    const bossToggle = document.getElementById('boss-enabled');
    if (bossToggle && !bossToggle.checked) {
      bossToggle.checked = true;
      // Trigger change event so panel shows
      bossToggle.dispatchEvent(new Event('change'));
    }

    // Update boss position inputs
    const bossX = document.getElementById('boss-x');
    const bossY = document.getElementById('boss-y');
    if (bossX) bossX.value = Math.round(x);
    if (bossY) bossY.value = Math.round(y);

    // Trigger input events to update preview
    bossX?.dispatchEvent(new Event('input'));
    bossY?.dispatchEvent(new Event('input'));

    // Mark as having unsaved changes
    if (window.editorUI) {
      window.editorUI.hasUnsavedChanges = true;
    }

    console.log('[EditorScene] Boss placed at', Math.round(x), Math.round(y));
  }

  placeItemSpawn(x, y) {
    // Create a new item spawn point
    const spawn = {
      id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      x: Math.round(x),
      y: Math.round(y),
      itemType: 'random',
      spawnOnStart: true,
      respawnTime: 0
    };

    this.itemSpawns.push(spawn);
    this.redraw();

    // Select the new spawn for editing
    this.selectedObject = spawn;
    this.selectedType = 'itemSpawn';
    this.drawSelection();

    // Update properties panel
    if (window.editorUI) {
      window.editorUI.onObjectSelected(spawn, 'itemSpawn');
      window.editorUI.hasUnsavedChanges = true;
    }

    console.log('[EditorScene] Item spawn placed at', spawn.x, spawn.y);
  }

  drawItemSpawns() {
    for (const spawn of this.itemSpawns) {
      const isSelected = this.selectedObject === spawn;

      // Outer glow
      this.zoneLayer.fillStyle(0x00ffff, 0.2);
      this.zoneLayer.fillCircle(spawn.x, spawn.y, 25);

      // Main circle
      this.zoneLayer.fillStyle(0x00ffff, 0.6);
      this.zoneLayer.fillCircle(spawn.x, spawn.y, 18);

      // Inner circle
      this.zoneLayer.fillStyle(0x1a1a2e, 1);
      this.zoneLayer.fillCircle(spawn.x, spawn.y, 12);

      // Question mark or icon based on type
      if (!spawn.labelText) {
        spawn.labelText = this.add.text(spawn.x, spawn.y, '?', {
          fontSize: '16px',
          color: '#00ffff',
          fontStyle: 'bold'
        }).setOrigin(0.5);
      }
      spawn.labelText.setPosition(spawn.x, spawn.y);
      spawn.labelText.setText(spawn.itemType === 'random' ? '?' : spawn.itemType.charAt(0).toUpperCase());

      // Selection highlight
      if (isSelected) {
        this.zoneLayer.lineStyle(2, 0xffffff, 1);
        this.zoneLayer.strokeCircle(spawn.x, spawn.y, 28);
      }
    }
  }

  drawZone(zone, color, label) {
    this.zoneLayer.fillStyle(color, 0.2);
    this.zoneLayer.fillRect(zone.x, zone.y, zone.width, zone.height);

    // Dashed border
    this.zoneLayer.lineStyle(3, color, 0.8);
    const dashLength = 10;
    const x = zone.x, y = zone.y, w = zone.width, h = zone.height;

    for (let i = x; i < x + w; i += dashLength * 2) {
      this.zoneLayer.lineBetween(i, y, Math.min(i + dashLength, x + w), y);
      this.zoneLayer.lineBetween(i, y + h, Math.min(i + dashLength, x + w), y + h);
    }
    for (let i = y; i < y + h; i += dashLength * 2) {
      this.zoneLayer.lineBetween(x, i, x, Math.min(i + dashLength, y + h));
      this.zoneLayer.lineBetween(x + w, i, x + w, Math.min(i + dashLength, y + h));
    }

    // Label
    if (!zone.labelText) {
      zone.labelText = this.add.text(0, 0, label, {
        fontSize: '12px',
        color: '#' + color.toString(16).padStart(6, '0'),
        fontStyle: 'bold'
      });
    }
    zone.labelText.setPosition(zone.x + 5, zone.y + 5);
    zone.labelText.setText(label);
  }

  drawObstacle(obs) {
    const color = parseInt(obs.color.replace('#', ''), 16);
    this.obstacleLayer.fillStyle(color, 1);

    if (obs.type === 'circle') {
      this.obstacleLayer.fillCircle(obs.x, obs.y, obs.radius);

      // Behavior indicators
      if (obs.behavior === 'rotating') {
        this.obstacleLayer.lineStyle(2, 0xffffff, 0.5);
        this.obstacleLayer.strokeCircle(obs.x, obs.y, obs.radius * 0.6);
      } else if (obs.behavior === 'breakable') {
        this.drawBreakableIndicator(obs.x, obs.y, obs.radius);
      } else if (obs.behavior === 'moving') {
        this.drawMovingIndicator(obs);
      }
    } else {
      this.obstacleLayer.fillRect(obs.x, obs.y, obs.width, obs.height);

      // Behavior indicators
      const cx = obs.x + obs.width / 2;
      const cy = obs.y + obs.height / 2;

      if (obs.behavior === 'rotating') {
        this.obstacleLayer.lineStyle(2, 0xffffff, 0.5);
        this.obstacleLayer.strokeCircle(cx, cy, Math.min(obs.width, obs.height) * 0.3);
      } else if (obs.behavior === 'breakable') {
        this.drawBreakableIndicator(cx, cy, Math.min(obs.width, obs.height) / 2);
      } else if (obs.behavior === 'moving') {
        this.drawMovingIndicator(obs);
      } else if (obs.behavior === 'crusher') {
        this.drawCrusherIndicator(obs);
      }
    }
  }

  drawBreakableIndicator(x, y, size) {
    // Draw crack pattern
    this.obstacleLayer.lineStyle(2, 0xffffff, 0.5);
    this.obstacleLayer.lineBetween(x - size * 0.3, y, x + size * 0.3, y);
    this.obstacleLayer.lineBetween(x, y - size * 0.3, x, y + size * 0.3);
  }

  drawMovingIndicator(obs) {
    this.obstacleLayer.lineStyle(2, 0xffffff, 0.5);

    const cx = obs.type === 'circle' ? obs.x : obs.x + obs.width / 2;
    const cy = obs.type === 'circle' ? obs.y : obs.y + obs.height / 2;

    if (obs.moveDirection === 'horizontal') {
      // Horizontal arrows
      this.obstacleLayer.lineBetween(cx - 10, cy, cx + 10, cy);
      this.obstacleLayer.lineBetween(cx - 10, cy, cx - 5, cy - 5);
      this.obstacleLayer.lineBetween(cx - 10, cy, cx - 5, cy + 5);
      this.obstacleLayer.lineBetween(cx + 10, cy, cx + 5, cy - 5);
      this.obstacleLayer.lineBetween(cx + 10, cy, cx + 5, cy + 5);
    } else {
      // Vertical arrows
      this.obstacleLayer.lineBetween(cx, cy - 10, cx, cy + 10);
      this.obstacleLayer.lineBetween(cx, cy - 10, cx - 5, cy - 5);
      this.obstacleLayer.lineBetween(cx, cy - 10, cx + 5, cy - 5);
      this.obstacleLayer.lineBetween(cx, cy + 10, cx - 5, cy + 5);
      this.obstacleLayer.lineBetween(cx, cy + 10, cx + 5, cy + 5);
    }
  }

  drawCrusherIndicator(obs) {
    const cx = obs.type === 'circle' ? obs.x : obs.x + obs.width / 2;
    const cy = obs.type === 'circle' ? obs.y : obs.y + obs.height / 2;
    const w = obs.type === 'circle' ? obs.radius * 2 : obs.width;
    const h = obs.type === 'circle' ? obs.radius * 2 : obs.height;

    // Draw danger stripes (diagonal lines)
    this.obstacleLayer.lineStyle(2, 0x000000, 0.6);
    const stripeGap = 8;
    for (let i = -w; i < w; i += stripeGap) {
      const x1 = obs.x + Math.max(0, i);
      const y1 = obs.y;
      const x2 = obs.x + Math.min(w, i + h);
      const y2 = obs.y + Math.min(h, h);
      if (x1 < obs.x + w && x2 > obs.x) {
        this.obstacleLayer.lineBetween(x1, y1, x2, y2);
      }
    }

    // Draw direction arrow
    this.obstacleLayer.lineStyle(3, 0xffffff, 0.9);
    const arrowSize = 8;
    const dir = obs.crusherDirection || 'down';

    switch (dir) {
      case 'down':
        this.obstacleLayer.lineBetween(cx, cy - 8, cx, cy + 8);
        this.obstacleLayer.lineBetween(cx, cy + 8, cx - arrowSize, cy + 8 - arrowSize);
        this.obstacleLayer.lineBetween(cx, cy + 8, cx + arrowSize, cy + 8 - arrowSize);
        break;
      case 'up':
        this.obstacleLayer.lineBetween(cx, cy + 8, cx, cy - 8);
        this.obstacleLayer.lineBetween(cx, cy - 8, cx - arrowSize, cy - 8 + arrowSize);
        this.obstacleLayer.lineBetween(cx, cy - 8, cx + arrowSize, cy - 8 + arrowSize);
        break;
      case 'right':
        this.obstacleLayer.lineBetween(cx - 8, cy, cx + 8, cy);
        this.obstacleLayer.lineBetween(cx + 8, cy, cx + 8 - arrowSize, cy - arrowSize);
        this.obstacleLayer.lineBetween(cx + 8, cy, cx + 8 - arrowSize, cy + arrowSize);
        break;
      case 'left':
        this.obstacleLayer.lineBetween(cx + 8, cy, cx - 8, cy);
        this.obstacleLayer.lineBetween(cx - 8, cy, cx - 8 + arrowSize, cy - arrowSize);
        this.obstacleLayer.lineBetween(cx - 8, cy, cx - 8 + arrowSize, cy + arrowSize);
        break;
    }

    // Add skull/danger text indicator
    this.obstacleLayer.lineStyle(1, 0xff0000, 0.8);
    this.obstacleLayer.strokeCircle(cx, cy - h/2 + 5, 4);
  }

  // ---- Status Updates ----

  updateStatus() {
    if (window.editorUI) {
      window.editorUI.updateObjectCount(this.obstacles.length);
    }
  }

  updateValidation() {
    if (window.editorUI) {
      window.editorUI.updateValidation(!!this.startZone, !!this.finishZone);
    }
  }

  // ---- Load/Save Data ----

  loadMapData(data) {
    // Clear existing
    this.obstacles = [];
    this.startZone = null;
    this.finishZone = null;

    // Clear item spawn labels
    for (const spawn of this.itemSpawns) {
      if (spawn.labelText) spawn.labelText.destroy();
    }
    this.itemSpawns = [];

    if (this.startZone?.labelText) this.startZone.labelText.destroy();
    if (this.finishZone?.labelText) this.finishZone.labelText.destroy();

    // Load obstacles
    if (data.obstacles) {
      this.obstacles = data.obstacles.map(obs => ({
        ...obs,
        id: obs.id || 'obs-' + Date.now() + Math.random()
      }));
    }

    // Load item spawns
    if (data.itemSpawns) {
      this.itemSpawns = data.itemSpawns.map(spawn => ({
        ...spawn,
        id: spawn.id || 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
      }));
    }

    // Load zones
    if (data.startZone) {
      this.startZone = { ...data.startZone, type: 'start' };
    }
    if (data.finishZone) {
      this.finishZone = { ...data.finishZone, type: 'finish' };
    }

    // Load animations into controller (pass obstacles to filter out orphaned animations)
    if (window.editorUI?.animationController && data.animations) {
      window.editorUI.animationController.loadAnimations(data.animations, this.obstacles);
    }

    // Load boss config into UI
    if (window.editorUI) {
      window.editorUI.loadBossConfig(data.bossConfig);
    }

    this.clearSelection();
    this.redraw();
    this.updateStatus();
    this.updateValidation();
  }

  getMapData() {
    // Get animation data from EditorUI's animation controller
    // Pass obstacles array to filter out orphaned animations
    const animations = window.editorUI?.animationController?.exportAnimations(this.obstacles) || null;

    // Get boss config from UI
    const bossConfig = window.editorUI?.getBossConfig() || null;

    return {
      startZone: this.startZone ? {
        x: this.startZone.x,
        y: this.startZone.y,
        width: this.startZone.width,
        height: this.startZone.height
      } : null,
      finishZone: this.finishZone ? {
        x: this.finishZone.x,
        y: this.finishZone.y,
        width: this.finishZone.width,
        height: this.finishZone.height
      } : null,
      bossConfig: bossConfig,
      obstacles: this.obstacles.map(obs => ({
        id: obs.id,
        type: obs.type,
        x: obs.x,
        y: obs.y,
        width: obs.width,
        height: obs.height,
        radius: obs.radius,
        angle: obs.angle,
        color: obs.color,
        behavior: obs.behavior,
        health: obs.health,
        breakableBy: obs.breakableBy,
        rotationSpeed: obs.rotationSpeed,
        rotationDirection: obs.rotationDirection,
        moveDirection: obs.moveDirection,
        moveDistance: obs.moveDistance,
        moveSpeed: obs.moveSpeed,
        crusherDirection: obs.crusherDirection,
        crusherSpeed: obs.crusherSpeed,
        crusherResetDelay: obs.crusherResetDelay
      })),
      itemSpawns: this.itemSpawns.map(spawn => ({
        id: spawn.id,
        x: spawn.x,
        y: spawn.y,
        itemType: spawn.itemType,
        spawnOnStart: spawn.spawnOnStart,
        respawnTime: spawn.respawnTime
      })),
      animations: animations
    };
  }

  // Update object from properties panel
  updateSelectedObject(props) {
    if (!this.selectedObject) return;

    Object.assign(this.selectedObject, props);
    this.redraw();
    this.drawSelection();
  }

  // Update obstacle visuals for animation preview
  updateObstaclePreview(obstacleId, values) {
    const obs = this.obstacles.find(o => o.id === obstacleId);
    if (!obs) return;

    // Store preview state (separate from actual obstacle data)
    if (values.x !== undefined) obs._previewX = values.x;
    if (values.y !== undefined) obs._previewY = values.y;
    if (values.rotation !== undefined) obs._previewRotation = values.rotation;
    if (values.scaleX !== undefined) obs._previewScaleX = values.scaleX;
    if (values.scaleY !== undefined) obs._previewScaleY = values.scaleY;

    // Redraw with preview values
    this.redrawWithPreview();
  }

  // Redraw obstacles using preview values if available
  redrawWithPreview() {
    this.obstacleLayer.clear();
    this.zoneLayer.clear();

    // Draw zones
    if (this.startZone) {
      this.drawZone(this.startZone, 0x00ff88, 'START');
    }
    if (this.finishZone) {
      this.drawZone(this.finishZone, 0xff4444, 'FINISH');
    }

    // Draw obstacles with preview transforms
    for (const obs of this.obstacles) {
      this.drawObstacleWithPreview(obs);
    }
  }

  drawObstacleWithPreview(obs) {
    // Use preview values if available, otherwise use actual values
    const x = obs._previewX !== undefined ? obs._previewX : (obs.type === 'circle' ? obs.x : obs.x + obs.width / 2);
    const y = obs._previewY !== undefined ? obs._previewY : (obs.type === 'circle' ? obs.y : obs.y + obs.height / 2);
    const rotation = obs._previewRotation !== undefined ? obs._previewRotation : (obs.angle || 0) * Math.PI / 180;
    const scaleX = obs._previewScaleX !== undefined ? obs._previewScaleX : 1;
    const scaleY = obs._previewScaleY !== undefined ? obs._previewScaleY : 1;

    const color = parseInt(obs.color.replace('#', ''), 16);

    // Save graphics state
    this.obstacleLayer.save();

    // Apply transforms (translate to center, rotate, scale)
    if (obs.type === 'circle') {
      // For circles, x/y is already center
      this.obstacleLayer.translateCanvas(x, y);
      this.obstacleLayer.rotateCanvas(rotation);
      this.obstacleLayer.scaleCanvas(scaleX, scaleY);

      this.obstacleLayer.fillStyle(color, 1);
      this.obstacleLayer.fillCircle(0, 0, obs.radius);
    } else {
      // For rectangles, transform around center
      this.obstacleLayer.translateCanvas(x, y);
      this.obstacleLayer.rotateCanvas(rotation);
      this.obstacleLayer.scaleCanvas(scaleX, scaleY);

      this.obstacleLayer.fillStyle(color, 1);
      this.obstacleLayer.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
    }

    // Restore and draw without transforms for indicators
    this.obstacleLayer.restore();

    // Draw behavior indicators (simplified - not transformed)
    this.drawBehaviorIndicator(obs, x, y);
  }

  drawBehaviorIndicator(obs, cx, cy) {
    if (obs.behavior === 'rotating') {
      this.obstacleLayer.lineStyle(2, 0xffffff, 0.5);
      const size = obs.type === 'circle' ? obs.radius * 0.6 : Math.min(obs.width, obs.height) * 0.3;
      this.obstacleLayer.strokeCircle(cx, cy, size);
    } else if (obs.behavior === 'breakable') {
      this.obstacleLayer.lineStyle(2, 0xffffff, 0.5);
      const size = obs.type === 'circle' ? obs.radius * 0.3 : Math.min(obs.width, obs.height) * 0.15;
      this.obstacleLayer.lineBetween(cx - size, cy, cx + size, cy);
      this.obstacleLayer.lineBetween(cx, cy - size, cx, cy + size);
    } else if (obs.behavior === 'moving') {
      this.obstacleLayer.lineStyle(2, 0xffffff, 0.5);
      if (obs.moveDirection === 'horizontal') {
        this.obstacleLayer.lineBetween(cx - 10, cy, cx + 10, cy);
      } else {
        this.obstacleLayer.lineBetween(cx, cy - 10, cx, cy + 10);
      }
    } else if (obs.behavior === 'crusher') {
      // Small danger indicator
      this.obstacleLayer.lineStyle(2, 0xff0000, 0.8);
      this.obstacleLayer.strokeCircle(cx, cy - 10, 4);
    }
  }

  // Clear preview values (return to actual positions)
  clearPreview() {
    for (const obs of this.obstacles) {
      delete obs._previewX;
      delete obs._previewY;
      delete obs._previewRotation;
      delete obs._previewScaleX;
      delete obs._previewScaleY;
    }
    this.redraw();
  }

  resizeCanvas(width, height) {
    this.mapWidth = width;
    this.mapHeight = height;
    this.scale.resize(width, height);
    this.drawBackground();
    this.redraw();
  }
}

// ============================================================================
// Editor UI - DOM-based UI management
// ============================================================================
class EditorUI {
  constructor() {
    this.mapStorage = null;
    this.currentMapId = null;
    this.currentMapName = 'Untitled Map';
    this.game = null;
    this.scene = null;
    this.mapWidth = 800;
    this.mapHeight = 600;
    this.hasUnsavedChanges = false;

    // Animation system
    this.animationController = null;
    this.timelineCollapsed = false;

    // Chain edit mode
    this.chainEditMode = false;
    this.editingChainId = null;
    this.editingChainMaps = []; // Array of {id, name, hasBoss} for current chain
    this.currentChainMapIndex = 0;
  }

  async init() {
    // Initialize storage
    this.mapStorage = getMapStorage();
    await this.mapStorage.init();

    // Initialize chain storage
    this.chains = this.loadChainsFromStorage();
    this.currentChainId = null;

    // Setup tool buttons
    this.setupToolButtons();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Setup toolbar buttons
    this.setupToolbarButtons();

    // Setup property inputs
    this.setupPropertyInputs();

    // Setup modals
    this.setupModals();

    // Setup animation timeline
    this.setupTimeline();

    // Setup boss configuration panel
    this.setupBossPanel();

    // Setup floating library window
    this.setupLibraryWindow();

    // Setup map settings (colors, grid)
    this.setupMapSettings();

    // Setup chain edit mode
    this.setupChainEditMode();

    // Load map list
    await this.refreshMapList();

    // Refresh chain list
    this.refreshChainList();

    // Check for welcome modal
    this.checkWelcome();

    console.log('EditorUI initialized');
  }

  initGame(width, height) {
    this.mapWidth = width;
    this.mapHeight = height;

    const config = {
      type: Phaser.AUTO,
      parent: 'editor-container',
      width: width,
      height: height,
      backgroundColor: '#e8e0d0',
      scene: [EditorScene]
    };

    this.game = new Phaser.Game(config);

    // Wait for scene to be ready
    this.game.events.on('ready', () => {
      this.scene = this.game.scene.getScene('EditorScene');
      this.scene.init({ width, height });
      this.updateSizeStatus();

      // Connect animation controller to scene
      if (this.animationController) {
        this.animationController.setScene(this.scene);
      }
    });
  }

  getScene() {
    if (!this.scene) {
      this.scene = this.game?.scene?.getScene('EditorScene');
    }
    return this.scene;
  }

  // ---- Tool Buttons ----

  setupToolButtons() {
    const toolBtns = document.querySelectorAll('.tool-btn');

    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        this.selectTool(tool);
      });
    });
  }

  selectTool(tool) {
    // Update button states
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Update status
    const toolNames = {
      select: 'Select',
      rectangle: 'Rectangle',
      circle: 'Circle',
      start: 'Start Zone',
      finish: 'Finish Zone'
    };
    document.getElementById('status-tool').textContent = `Tool: ${toolNames[tool]}`;

    // Update tip
    const tips = {
      select: 'Click to select, drag to move, use handles to resize',
      rectangle: 'Click and drag to draw a rectangle obstacle',
      circle: 'Click and drag to draw a circle obstacle',
      start: 'Click and drag to place the spawn area (green)',
      finish: 'Click and drag to place the finish line (red)'
    };
    document.getElementById('status-tip').textContent = `Tip: ${tips[tool]}`;

    // Tell scene
    const scene = this.getScene();
    if (scene) {
      scene.setTool(tool);
    }
  }

  // ---- Keyboard Shortcuts ----

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'v': this.selectTool('select'); break;
        case 'r': this.selectTool('rectangle'); break;
        case 'c': this.selectTool('circle'); break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.saveCurrentMap();
          } else {
            this.selectTool('start');
          }
          break;
        case 'f': this.selectTool('finish'); break;
        case 'b': this.selectTool('boss'); break;
        case 'i': this.selectTool('item'); break;
      }
    });
  }

  // ---- Toolbar Buttons ----

  setupToolbarButtons() {
    // Back to game
    document.getElementById('btn-back-to-game').addEventListener('click', () => {
      if (this.hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Leave anyway?')) return;
      }
      window.location.href = 'index.html';
    });

    // New map buttons
    document.getElementById('btn-new-map').addEventListener('click', () => this.showNewMapModal());
    document.getElementById('btn-new-map-sidebar')?.addEventListener('click', () => this.showNewMapModal());
    document.getElementById('btn-new-map-library')?.addEventListener('click', () => this.showNewMapModal());

    // Save
    document.getElementById('btn-save').addEventListener('click', () => this.saveCurrentMap());

    // Import/Export
    document.getElementById('btn-import').addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });

    document.getElementById('import-file-input').addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.importMap(e.target.files[0]);
        e.target.value = '';
      }
    });

    document.getElementById('btn-export').addEventListener('click', () => this.exportCurrentMap());

    // Test in game
    document.getElementById('btn-test-map').addEventListener('click', () => this.testInGame());

    // Delete zone button
    document.getElementById('btn-delete-zone')?.addEventListener('click', () => {
      const scene = this.getScene();
      if (scene) {
        scene.deleteSelected();
      }
    });

    // Delete obstacle button
    document.getElementById('btn-delete-obstacle')?.addEventListener('click', () => {
      const scene = this.getScene();
      if (scene) {
        scene.deleteSelected();
      }
    });
  }

  // ---- Property Inputs ----

  setupPropertyInputs() {
    // Position and size inputs
    const posInputs = ['prop-x', 'prop-y', 'prop-width', 'prop-height', 'prop-radius', 'prop-angle'];
    posInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.onPropertyChange());
      }
    });

    // Color
    document.getElementById('prop-color')?.addEventListener('change', () => this.onPropertyChange());

    // Behavior radios
    document.querySelectorAll('input[name="behavior"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this.onBehaviorChange();
        this.onPropertyChange();
      });
    });

    // Behavior-specific inputs
    const behaviorInputs = [
      'prop-health', 'prop-rotation-speed', 'prop-move-distance', 'prop-move-speed'
    ];
    behaviorInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.onPropertyChange());
      }
    });

    // Breakable checkboxes
    document.querySelectorAll('[id^="breakable-"]').forEach(cb => {
      cb.addEventListener('change', () => this.onPropertyChange());
    });

    // Rotation direction
    document.querySelectorAll('input[name="rotation-dir"]').forEach(radio => {
      radio.addEventListener('change', () => this.onPropertyChange());
    });

    // Move direction
    document.querySelectorAll('input[name="move-dir"]').forEach(radio => {
      radio.addEventListener('change', () => this.onPropertyChange());
    });

    // Zone inputs
    const zoneInputs = ['zone-x', 'zone-y', 'zone-width', 'zone-height'];
    zoneInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.onZonePropertyChange());
      }
    });

    // Item spawn inputs
    const itemInputs = ['item-x', 'item-y', 'item-type', 'item-spawn-on-start', 'item-respawn-time'];
    itemInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.onItemPropertyChange());
      }
    });

    // Delete item spawn button
    document.getElementById('btn-delete-item')?.addEventListener('click', () => {
      const scene = this.getScene();
      if (scene) {
        scene.deleteSelected();
      }
    });
  }

  onPropertyChange(changedProperty = null) {
    const scene = this.getScene();
    if (!scene || !scene.selectedObject) return;

    const obj = scene.selectedObject;
    const oldX = obj.x;
    const oldY = obj.y;
    const oldAngle = obj.angle;

    if (obj.type === 'circle') {
      obj.x = parseInt(document.getElementById('prop-x').value) || 0;
      obj.y = parseInt(document.getElementById('prop-y').value) || 0;
      obj.radius = parseInt(document.getElementById('prop-radius').value) || 20;
    } else {
      obj.x = parseInt(document.getElementById('prop-x').value) || 0;
      obj.y = parseInt(document.getElementById('prop-y').value) || 0;
      obj.width = parseInt(document.getElementById('prop-width').value) || 80;
      obj.height = parseInt(document.getElementById('prop-height').value) || 25;
    }

    obj.angle = parseInt(document.getElementById('prop-angle').value) || 0;
    obj.color = document.getElementById('prop-color').value;

    // Auto-keyframe if position changed
    if (this.isAutoKeyframeEnabled() && this.animationController?.animations[obj.id]) {
      if (obj.x !== oldX) this.recordKeyframeFromCurrentPosition('x');
      if (obj.y !== oldY) this.recordKeyframeFromCurrentPosition('y');
      if (obj.angle !== oldAngle) this.recordKeyframeFromCurrentPosition('rotation');
    }

    // Behavior
    const behavior = document.querySelector('input[name="behavior"]:checked').value;
    obj.behavior = behavior;

    // Behavior-specific
    obj.health = parseInt(document.getElementById('prop-health').value) || 3;
    obj.rotationSpeed = parseFloat(document.getElementById('prop-rotation-speed').value) || 2;
    obj.moveDistance = parseInt(document.getElementById('prop-move-distance').value) || 100;
    obj.moveSpeed = parseInt(document.getElementById('prop-move-speed').value) || 50;

    // Breakable colors
    const breakableBy = [];
    if (document.getElementById('breakable-red').checked) breakableBy.push('Red');
    if (document.getElementById('breakable-blue').checked) breakableBy.push('Blue');
    if (document.getElementById('breakable-green').checked) breakableBy.push('Green');
    if (document.getElementById('breakable-yellow').checked) breakableBy.push('Yellow');
    if (document.getElementById('breakable-purple').checked) breakableBy.push('Purple');
    obj.breakableBy = breakableBy;

    // Rotation direction
    obj.rotationDirection = document.querySelector('input[name="rotation-dir"]:checked').value;

    // Move direction
    obj.moveDirection = document.querySelector('input[name="move-dir"]:checked').value;

    // Crusher settings
    obj.crusherDirection = document.querySelector('input[name="crusher-dir"]:checked').value;
    obj.crusherSpeed = parseInt(document.getElementById('prop-crusher-speed').value) || 80;
    obj.crusherResetDelay = parseInt(document.getElementById('prop-crusher-delay').value) || 2000;

    scene.redraw();
    scene.drawSelection();
    this.hasUnsavedChanges = true;
  }

  onBehaviorChange() {
    const behavior = document.querySelector('input[name="behavior"]:checked').value;

    document.getElementById('breakable-settings').classList.toggle('hidden', behavior !== 'breakable');
    document.getElementById('rotating-settings').classList.toggle('hidden', behavior !== 'rotating');
    document.getElementById('moving-settings').classList.toggle('hidden', behavior !== 'moving');
    document.getElementById('crusher-settings').classList.toggle('hidden', behavior !== 'crusher');
  }

  // ---- Animation Timeline ----

  setupTimeline() {
    // Initialize AnimationController - it creates its own Timeline UI
    this.animationController = new AnimationController({
      timelineContainer: document.getElementById('timeline-container'),
      onAnimationChange: (obstacleId, animData) => {
        this.hasUnsavedChanges = true;
        this.updateAnimationStatus(obstacleId);
        this.updateKeyframeButtons();
      },
      onTimeChange: (time) => {
        this.updateKeyframeButtons();
      }
    });

    // Animation panel quick action buttons (these are in the sidebar, not timeline)
    document.getElementById('btn-add-keyframe-pos')?.addEventListener('click', () => {
      this.addKeyframeForProperty('x');
      this.addKeyframeForProperty('y');
    });

    document.getElementById('btn-add-keyframe-rot')?.addEventListener('click', () => {
      this.addKeyframeForProperty('rotation');
    });

    document.getElementById('btn-add-keyframe-scale')?.addEventListener('click', () => {
      this.addKeyframeForProperty('scaleX');
      this.addKeyframeForProperty('scaleY');
    });

    document.getElementById('btn-clear-animation')?.addEventListener('click', () => {
      if (this.animationController?.selectedObstacleId) {
        if (confirm('Remove all animation keyframes for this obstacle?')) {
          this.animationController.removeAnimation(this.animationController.selectedObstacleId);
          this.updateAnimationStatus(null);
          this.updateKeyframeButtons();
        }
      }
    });

    // Debug buttons
    document.getElementById('btn-debug-export')?.addEventListener('click', () => {
      this.debugExportData();
    });

    document.getElementById('btn-debug-log')?.addEventListener('click', () => {
      this.debugLogAnimation();
    });

    // Keyframe buttons next to properties in sidebar
    document.querySelectorAll('.kf-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const property = btn.dataset.property;
        this.toggleKeyframeForProperty(property, btn);
      });
    });

    // Record keyframe buttons (records current visual position)
    document.querySelectorAll('.kf-record-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const property = btn.dataset.property;
        this.recordKeyframeFromCurrentPosition(property);
      });
    });

    // Keyboard shortcut for play/pause
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (this.animationController?.timeline) {
          this.animationController.timeline.togglePlay();
        }
      }
      // K for add keyframe
      if (e.key.toLowerCase() === 'k') {
        const scene = this.getScene();
        if (scene?.selectedObject && this.animationController) {
          this.addKeyframeForProperty('x');
          this.addKeyframeForProperty('y');
        }
      }
    });

    console.log('[Animation] Timeline setup complete');
  }

  addKeyframeForProperty(property) {
    const scene = this.getScene();
    if (!scene?.selectedObject || !this.animationController) return;

    const obj = scene.selectedObject;
    let value = this.getPropertyValue(property);

    this.animationController.addKeyframeAtCurrentTime(property, value);
    this.updateAnimationStatus(obj.id);
    this.updateKeyframeButtons();
  }

  /**
   * Toggle keyframe at current time - add if none, remove if exists
   */
  toggleKeyframeForProperty(property, btn) {
    const scene = this.getScene();
    console.log('[KF] toggleKeyframeForProperty called', property);

    if (!scene?.selectedObject) {
      console.log('[KF] No selected object');
      return;
    }
    if (!this.animationController) {
      console.log('[KF] No animation controller');
      return;
    }

    const obstacleId = scene.selectedObject.id;
    const currentTime = Math.round(this.animationController.timeline?.currentTime || 0);

    console.log('[KF] obstacleId:', obstacleId, 'currentTime:', currentTime);

    // Ensure animation exists for this obstacle
    if (!this.animationController.animations[obstacleId]) {
      this.animationController.animations[obstacleId] = {
        duration: this.animationController.timeline?.duration || 2000,
        loop: this.animationController.timeline?.loop || 'pingpong',
        loopCount: 0,
        tracks: {}
      };
      console.log('[KF] Created new animation for obstacle');
    }

    const anim = this.animationController.animations[obstacleId];

    // Ensure track exists
    if (!anim.tracks[property]) {
      anim.tracks[property] = { keyframes: [] };
      console.log('[KF] Created new track for property:', property);
    }

    const track = anim.tracks[property];
    const existingIndex = track.keyframes.findIndex(kf => Math.abs(kf.time - currentTime) < 20);

    console.log('[KF] Existing keyframe index:', existingIndex, 'keyframes:', track.keyframes);

    if (existingIndex >= 0) {
      // Remove existing keyframe
      track.keyframes.splice(existingIndex, 1);
      console.log('[KF] Removed keyframe at index', existingIndex);
      if (track.keyframes.length === 0) {
        delete anim.tracks[property];
        console.log('[KF] Deleted empty track');
      }
    } else {
      // Add new keyframe with current value from input
      const value = this.getPropertyValue(property);
      const newKf = {
        time: currentTime,
        value: value,
        easing: 'easeInOutQuad'
      };
      track.keyframes.push(newKf);
      track.keyframes.sort((a, b) => a.time - b.time);
      console.log('[KF] Added keyframe:', newKf);
    }

    // Update timeline display
    if (this.animationController.timeline) {
      this.animationController.timeline.setAnimation(obstacleId, anim);
    }

    // Notify change
    this.animationController.onAnimationChange(obstacleId, anim);
    this.hasUnsavedChanges = true;

    this.updateAnimationStatus(obstacleId);
    this.updateKeyframeButtons();

    console.log('[KF] Final animation state:', JSON.stringify(anim, null, 2));
  }

  /**
   * Get current property value from animation offset inputs
   */
  getPropertyValue(property) {
    switch (property) {
      case 'x':
        return parseFloat(document.getElementById('anim-offset-x')?.value) || 0;
      case 'y':
        return parseFloat(document.getElementById('anim-offset-y')?.value) || 0;
      case 'rotation':
        return parseFloat(document.getElementById('anim-offset-rotation')?.value) || 0;
      case 'scaleX':
        return parseFloat(document.getElementById('anim-offset-scaleX')?.value) || 1;
      case 'scaleY':
        return parseFloat(document.getElementById('anim-offset-scaleY')?.value) || 1;
      default:
        return 0;
    }
  }

  /**
   * Record keyframe from current visual position of obstacle
   */
  recordKeyframeFromCurrentPosition(property) {
    const scene = this.getScene();
    if (!scene?.selectedObject || !this.animationController) {
      console.log('[KF] No obstacle selected');
      return;
    }

    const obj = scene.selectedObject;
    const obstacleId = obj.id;

    // Get or create base position (first time we animate this obstacle)
    if (!obj._animBaseX) {
      obj._animBaseX = obj.type === 'circle' ? obj.x : obj.x + obj.width / 2;
      obj._animBaseY = obj.type === 'circle' ? obj.y : obj.y + obj.height / 2;
      obj._animBaseRotation = obj.angle || 0;
      console.log('[KF] Set base position:', obj._animBaseX, obj._animBaseY);
    }

    // Calculate current offset from base
    const currentX = obj.type === 'circle' ? obj.x : obj.x + obj.width / 2;
    const currentY = obj.type === 'circle' ? obj.y : obj.y + obj.height / 2;

    let value;
    switch (property) {
      case 'x':
        value = currentX - obj._animBaseX;
        break;
      case 'y':
        value = currentY - obj._animBaseY;
        break;
      case 'rotation':
        value = (obj.angle || 0) - (obj._animBaseRotation || 0);
        break;
      default:
        value = 0;
    }

    console.log(`[KF] Recording ${property} = ${value} (current: ${currentX}, base: ${obj._animBaseX})`);

    // Add keyframe with this value
    this.addKeyframeWithValue(property, value);
  }

  /**
   * Add keyframe with specific value
   */
  addKeyframeWithValue(property, value) {
    const scene = this.getScene();
    if (!scene?.selectedObject || !this.animationController) return;

    const obstacleId = scene.selectedObject.id;
    const currentTime = Math.round(this.animationController.timeline?.currentTime || 0);

    // Ensure animation exists
    if (!this.animationController.animations[obstacleId]) {
      this.animationController.animations[obstacleId] = {
        duration: this.animationController.timeline?.duration || 2000,
        loop: this.animationController.timeline?.loop || 'pingpong',
        loopCount: 0,
        tracks: {}
      };
    }

    const anim = this.animationController.animations[obstacleId];

    // Ensure track exists
    if (!anim.tracks[property]) {
      anim.tracks[property] = { keyframes: [] };
    }

    const track = anim.tracks[property];

    // Check if keyframe exists at this time - update it
    const existingIndex = track.keyframes.findIndex(kf => Math.abs(kf.time - currentTime) < 20);
    if (existingIndex >= 0) {
      track.keyframes[existingIndex].value = value;
      console.log(`[KF] Updated keyframe at ${currentTime}ms: ${property} = ${value}`);
    } else {
      // Add new keyframe
      track.keyframes.push({
        time: currentTime,
        value: value,
        easing: 'easeInOutQuad'
      });
      track.keyframes.sort((a, b) => a.time - b.time);
      console.log(`[KF] Added keyframe at ${currentTime}ms: ${property} = ${value}`);
    }

    // Update timeline display
    if (this.animationController.timeline) {
      this.animationController.timeline.setAnimation(obstacleId, anim);
    }

    this.animationController.onAnimationChange(obstacleId, anim);
    this.hasUnsavedChanges = true;
    this.updateAnimationStatus(obstacleId);
    this.updateKeyframeButtons();
  }

  /**
   * Check if auto-keyframe mode is enabled
   */
  isAutoKeyframeEnabled() {
    return document.getElementById('auto-keyframe')?.checked || false;
  }

  /**
   * Called when obstacle position changes - auto-add keyframe if enabled
   */
  onObstaclePositionChanged(property) {
    if (!this.isAutoKeyframeEnabled()) return;

    const scene = this.getScene();
    if (!scene?.selectedObject) return;

    const obstacleId = scene.selectedObject.id;

    // Only auto-keyframe if this obstacle already has animation
    if (!this.animationController?.animations[obstacleId]) return;

    console.log('[KF] Auto-keyframe triggered for', property);
    this.recordKeyframeFromCurrentPosition(property);
  }

  /**
   * Update keyframe button states based on current time
   */
  updateKeyframeButtons() {
    const scene = this.getScene();
    if (!scene?.selectedObject || !this.animationController) {
      // Clear all buttons
      document.querySelectorAll('.kf-btn').forEach(btn => {
        btn.classList.remove('has-keyframe');
      });
      return;
    }

    const obstacleId = scene.selectedObject.id;
    const currentTime = Math.round(this.animationController.timeline?.currentTime || 0);
    // Get animation directly from controller's storage, not through getter
    const anim = this.animationController.animations[obstacleId];

    console.log('[KF-Update] obstacleId:', obstacleId, 'time:', currentTime, 'anim:', anim ? 'exists' : 'none');

    document.querySelectorAll('.kf-btn').forEach(btn => {
      const property = btn.dataset.property;
      const track = anim?.tracks?.[property];
      const hasKf = track?.keyframes?.some(kf => Math.abs(kf.time - currentTime) < 20);
      btn.classList.toggle('has-keyframe', !!hasKf);
      if (hasKf) {
        console.log('[KF-Update] Property', property, 'has keyframe at', currentTime);
      }
    });
  }

  updatePlayButton() {
    const playBtn = document.getElementById('btn-timeline-play');
    const isPlaying = this.animationController?.isPreviewPlaying;
    playBtn.classList.toggle('playing', isPlaying);
    playBtn.innerHTML = isPlaying ? '&#10074;&#10074;' : '&#9654;';
  }

  updateAnimationStatus(obstacleId) {
    const statusEl = document.getElementById('anim-status');
    if (!statusEl) return;

    if (!obstacleId || !this.animationController?.hasAnimation(obstacleId)) {
      statusEl.textContent = 'No animation';
      statusEl.style.color = 'var(--text-muted)';
    } else {
      const anim = this.animationController.getAnimation(obstacleId);
      const trackCount = Object.keys(anim.tracks || {}).length;
      const keyframeCount = Object.values(anim.tracks || {}).reduce(
        (sum, track) => sum + (track.keyframes?.length || 0), 0
      );
      statusEl.textContent = `${trackCount} tracks, ${keyframeCount} keyframes`;
      statusEl.style.color = 'var(--accent-cyan)';
    }
  }

  /**
   * Debug: Export all map and animation data to console
   */
  debugExportData() {
    const scene = this.getScene();
    if (!scene) {
      console.error('[DEBUG] No scene available');
      return;
    }

    const mapData = scene.getMapData();
    const animations = this.animationController?.animations || {};

    const exportData = {
      map: {
        id: this.currentMapId,
        name: this.currentMapName,
        width: this.mapWidth,
        height: this.mapHeight
      },
      obstacles: mapData.obstacles,
      startZone: mapData.startZone,
      finishZone: mapData.finishZone,
      animations: animations
    };

    console.log('=== DEBUG EXPORT ===');
    console.log('Full export data:', exportData);
    console.log('JSON:', JSON.stringify(exportData, null, 2));
    console.log('===================');

    // Also copy to clipboard
    try {
      navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      console.log('[DEBUG] Data copied to clipboard!');
      alert('Debug data exported to console and copied to clipboard!');
    } catch (e) {
      console.log('[DEBUG] Could not copy to clipboard:', e);
      alert('Debug data exported to console (check F12)');
    }
  }

  /**
   * Debug: Log animation evaluation for selected obstacle
   */
  debugLogAnimation() {
    const scene = this.getScene();
    if (!scene?.selectedObject) {
      console.error('[DEBUG] No obstacle selected');
      alert('Select an obstacle first');
      return;
    }

    const obstacleId = scene.selectedObject.id;
    const anim = this.animationController?.animations[obstacleId];

    if (!anim) {
      console.error('[DEBUG] No animation for obstacle', obstacleId);
      alert('No animation on this obstacle');
      return;
    }

    console.log('=== ANIMATION DEBUG ===');
    console.log('Obstacle ID:', obstacleId);
    console.log('Duration:', anim.duration, 'ms');
    console.log('Loop mode:', anim.loop);
    console.log('Tracks:', Object.keys(anim.tracks));

    // Log each track's keyframes
    for (const [prop, track] of Object.entries(anim.tracks)) {
      console.log(`\nTrack: ${prop}`);
      console.log('Keyframes:');
      track.keyframes.forEach((kf, i) => {
        console.log(`  [${i}] time=${kf.time}ms, value=${kf.value}, easing=${kf.easing}`);
      });
    }

    // Evaluate at different times
    console.log('\n--- Interpolation test ---');
    const testTimes = [0, 250, 500, 750, 1000, 1500, 2000];
    testTimes.forEach(t => {
      const values = this.animationController.evaluateAtTime(anim, t);
      console.log(`t=${t}ms:`, values);
    });

    console.log('========================');
    alert('Animation data logged to console (F12)');
  }

  // ---- Boss Configuration Panel ----

  setupBossPanel() {
    // Toggle panel
    document.getElementById('boss-panel-toggle')?.addEventListener('click', () => {
      const content = document.getElementById('boss-panel-content');
      const arrow = document.getElementById('boss-panel-arrow');
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      arrow.innerHTML = isHidden ? '&#9660;' : '&#9654;';
    });

    // Enable/disable boss checkbox
    document.getElementById('boss-enabled')?.addEventListener('change', (e) => {
      const settings = document.getElementById('boss-settings');
      settings.style.display = e.target.checked ? 'block' : 'none';
      this.hasUnsavedChanges = true;
      this.redrawScene();
    });

    // Boss settings changes - redraw preview on change
    const bossInputs = [
      'boss-x', 'boss-y', 'boss-width', 'boss-height',
      'boss-health', 'boss-pattern', 'boss-cooldown', 'boss-color'
    ];
    bossInputs.forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        this.hasUnsavedChanges = true;
        this.redrawScene();
      });
      // Also update on input for live preview
      document.getElementById(id)?.addEventListener('input', () => {
        this.redrawScene();
      });
    });

    // Boss shape radios
    document.querySelectorAll('input[name="boss-shape"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this.hasUnsavedChanges = true;
        this.redrawScene();
      });
    });
  }

  redrawScene() {
    const scene = this.getScene();
    if (scene) {
      scene.redraw();
    }
  }

  getBossConfig() {
    const enabled = document.getElementById('boss-enabled')?.checked;
    if (!enabled) return null;

    const colorHex = document.getElementById('boss-color')?.value || '#cc3300';
    const colorInt = parseInt(colorHex.replace('#', ''), 16);

    return {
      x: parseInt(document.getElementById('boss-x')?.value) || 400,
      y: parseInt(document.getElementById('boss-y')?.value) || 100,
      width: parseInt(document.getElementById('boss-width')?.value) || 80,
      height: parseInt(document.getElementById('boss-height')?.value) || 60,
      health: parseInt(document.getElementById('boss-health')?.value) || 100,
      pattern: document.getElementById('boss-pattern')?.value || 'spiral',
      attackCooldown: parseInt(document.getElementById('boss-cooldown')?.value) || 800,
      color: colorInt,
      shape: document.querySelector('input[name="boss-shape"]:checked')?.value || 'rectangle',
      winCondition: document.getElementById('boss-win-condition')?.value || 'boss'
    };
  }

  loadBossConfig(config) {
    const enabled = config !== null && config !== undefined;
    const checkbox = document.getElementById('boss-enabled');
    const settings = document.getElementById('boss-settings');

    if (checkbox) checkbox.checked = enabled;
    if (settings) settings.style.display = enabled ? 'block' : 'none';

    if (config) {
      document.getElementById('boss-x').value = config.x || 400;
      document.getElementById('boss-y').value = config.y || 100;
      document.getElementById('boss-width').value = config.width || 80;
      document.getElementById('boss-height').value = config.height || 60;
      document.getElementById('boss-health').value = config.health || 100;
      document.getElementById('boss-pattern').value = config.pattern || 'spiral';
      document.getElementById('boss-cooldown').value = config.attackCooldown || 800;

      // Convert color int to hex
      const colorHex = '#' + (config.color || 0xcc3300).toString(16).padStart(6, '0');
      document.getElementById('boss-color').value = colorHex;

      // Set shape - handle both 'rect' and 'rectangle'
      const shape = config.shape || 'rectangle';
      const shapeId = shape === 'rect' ? 'boss-shape-rect' : `boss-shape-${shape}`;
      const shapeRadio = document.getElementById(shapeId);
      if (shapeRadio) shapeRadio.checked = true;

      // Set win condition
      const winConditionEl = document.getElementById('boss-win-condition');
      if (winConditionEl) winConditionEl.value = config.winCondition || 'boss';
    } else {
      // Reset to defaults when no config
      document.getElementById('boss-x').value = 400;
      document.getElementById('boss-y').value = 100;
      document.getElementById('boss-width').value = 80;
      document.getElementById('boss-height').value = 60;
      document.getElementById('boss-health').value = 100;
      document.getElementById('boss-pattern').value = 'spiral';
      document.getElementById('boss-cooldown').value = 800;
      document.getElementById('boss-color').value = '#cc3300';
      document.getElementById('boss-shape-rect').checked = true;
      const winConditionEl = document.getElementById('boss-win-condition');
      if (winConditionEl) winConditionEl.value = 'boss';
    }

    // Hide boss preview label if disabled
    const scene = this.getScene();
    if (scene && !enabled) {
      scene.hideBossPreview();
    }
  }

  // ---- Library Window ----

  setupSidebarTabs() {
    // This is now replaced by the floating library window
    // Keep for backwards compatibility but redirect to library window tabs
  }

  setupLibraryWindow() {
    const libraryWindow = document.getElementById('library-window');
    const libraryBtn = document.getElementById('btn-library');
    const closeBtn = document.getElementById('library-window-close');
    const header = document.getElementById('library-window-header');

    // Toggle library window
    libraryBtn?.addEventListener('click', () => {
      libraryWindow.classList.toggle('hidden');
      if (!libraryWindow.classList.contains('hidden')) {
        this.refreshLibraryMapList();
        this.refreshLibraryChainList();
      }
    });

    // Close button
    closeBtn?.addEventListener('click', () => {
      libraryWindow.classList.add('hidden');
    });

    // Make window draggable
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    header?.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragOffset = {
        x: e.clientX - libraryWindow.offsetLeft,
        y: e.clientY - libraryWindow.offsetTop
      };
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      libraryWindow.style.left = (e.clientX - dragOffset.x) + 'px';
      libraryWindow.style.top = (e.clientY - dragOffset.y) + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // New map button in library
    document.getElementById('btn-new-map-library')?.addEventListener('click', () => {
      this.showNewMapModal();
    });

    // New chain button in library
    document.getElementById('btn-new-chain-library')?.addEventListener('click', () => {
      this.createNewChain();
      this.refreshLibraryChainList();
    });

    // Delete chain button in library
    document.getElementById('btn-delete-chain-library')?.addEventListener('click', () => {
      if (this.currentChainId && confirm('Delete this chain?')) {
        this.deleteChain(this.currentChainId);
        this.refreshLibraryChainList();
      }
    });

    // Save chain button in library
    document.getElementById('btn-save-chain-library')?.addEventListener('click', () => {
      this.saveCurrentChainLibrary();
    });

    // Test chain button in library
    document.getElementById('btn-test-chain-library')?.addEventListener('click', () => {
      this.testChain();
    });

    // Chain name input in library
    document.getElementById('library-chain-name')?.addEventListener('change', (e) => {
      if (this.currentChainId) {
        const chain = this.chains.find(c => c.id === this.currentChainId);
        if (chain) {
          chain.name = e.target.value;
          this.refreshLibraryChainList();
        }
      }
    });

    // Setup drop zone for library chain slots
    this.setupLibraryChainDropZone();
  }

  async refreshLibraryMapList() {
    const maps = await this.mapStorage.listMaps();
    const listEl = document.getElementById('library-map-list');
    if (!listEl) return;

    if (maps.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No maps yet.</div>';
      return;
    }

    listEl.innerHTML = maps.map(map => `
      <div class="map-item ${map.id === this.currentMapId ? 'active' : ''}" data-id="${map.id}" draggable="true">
        <div class="map-item-name">${map.name}</div>
        <div class="map-item-info">${map.width}x${map.height} - ${map.obstacleCount} obstacles</div>
        <div class="map-item-actions">
          <button class="btn-load" data-id="${map.id}">Load</button>
          <button class="btn-duplicate" data-id="${map.id}">Copy</button>
          <button class="btn-delete" data-id="${map.id}">Delete</button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    listEl.querySelectorAll('.btn-load').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.loadMap(btn.dataset.id);
      });
    });

    listEl.querySelectorAll('.btn-duplicate').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.mapStorage.duplicateMap(btn.dataset.id);
        await this.refreshLibraryMapList();
        await this.refreshMapList();
      });
    });

    listEl.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Delete this map?')) {
          await this.mapStorage.deleteMap(btn.dataset.id);
          if (btn.dataset.id === this.currentMapId) {
            this.currentMapId = null;
          }
          await this.refreshLibraryMapList();
          await this.refreshMapList();
        }
      });
    });

    // Drag handlers for chain building
    listEl.querySelectorAll('.map-item').forEach(item => {
      item.addEventListener('click', () => {
        this.loadMap(item.dataset.id);
      });

      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', item.dataset.id);
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
      });
    });
  }

  refreshLibraryChainList() {
    const listEl = document.getElementById('library-chain-list');
    if (!listEl) return;

    if (this.chains.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No chains yet.</div>';
      const editorEl = document.getElementById('library-chain-editor');
      const emptyEl = document.getElementById('library-chain-empty');
      if (editorEl) editorEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    listEl.innerHTML = this.chains.map(chain => `
      <div class="chain-item ${chain.id === this.currentChainId ? 'active' : ''}" data-id="${chain.id}">
        <div class="chain-item-name">${chain.name}</div>
        <div class="chain-item-info">${chain.maps.length} maps</div>
      </div>
    `).join('');

    // Add click handlers
    listEl.querySelectorAll('.chain-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectChainLibrary(item.dataset.id);
      });
    });
  }

  selectChainLibrary(chainId) {
    this.currentChainId = chainId;
    const chain = this.chains.find(c => c.id === chainId);

    const editorEl = document.getElementById('library-chain-editor');
    const emptyEl = document.getElementById('library-chain-empty');

    if (!chain) {
      if (editorEl) editorEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    // Update UI
    document.querySelectorAll('#library-chain-list .chain-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === chainId);
    });

    if (editorEl) editorEl.style.display = 'flex';
    if (emptyEl) emptyEl.style.display = 'none';
    document.getElementById('library-chain-name').value = chain.name;

    this.renderLibraryChainSlots();
  }

  async renderLibraryChainSlots() {
    const container = document.getElementById('library-chain-slots');
    if (!container) return;

    const chain = this.chains.find(c => c.id === this.currentChainId);
    if (!chain) {
      container.innerHTML = '<div class="chain-slot-empty">No chain selected</div>';
      return;
    }

    if (chain.maps.length === 0) {
      container.innerHTML = `
        <div class="chain-slot-empty" id="library-empty-drop-zone">
          Drag maps here to build your chain
        </div>
      `;
      this.setupLibraryEmptyDropZone();
      return;
    }

    // Get map info for each map in chain
    const mapInfos = await Promise.all(
      chain.maps.map(async (mapId) => {
        const map = await this.mapStorage.loadMap(mapId);
        return map ? { id: mapId, name: map.name, hasBoss: !!map.data?.bossConfig } : null;
      })
    );

    container.innerHTML = mapInfos.map((info, idx) => {
      if (!info) {
        return `
          <div class="chain-slot" data-index="${idx}" draggable="true">
            <span class="chain-slot-number">${idx + 1}</span>
            <span class="chain-slot-name" style="color: var(--accent-red);">(Map not found)</span>
            <button class="chain-slot-remove" data-index="${idx}">X</button>
          </div>
        `;
      }
      return `
        <div class="chain-slot" data-index="${idx}" draggable="true">
          <span class="chain-slot-number">${idx + 1}</span>
          <span class="chain-slot-name">${info.name}</span>
          ${info.hasBoss ? '<span class="chain-slot-boss">BOSS</span>' : ''}
          <button class="chain-slot-remove" data-index="${idx}">X</button>
        </div>
      `;
    }).join('') + `
      <div class="chain-slot-empty" id="library-empty-drop-zone" style="margin-top: 10px;">
        + Drop map here to add
      </div>
    `;

    this.setupLibrarySlotEventHandlers();
    this.setupLibraryEmptyDropZone();
  }

  setupLibraryChainDropZone() {
    const slotsContainer = document.getElementById('library-chain-slots');
    if (!slotsContainer) return;

    slotsContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    slotsContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      const mapId = e.dataTransfer.getData('text/plain');
      if (mapId && this.currentChainId) {
        this.addMapToChainLibrary(mapId);
      }
    });
  }

  setupLibraryEmptyDropZone() {
    const dropZone = document.getElementById('library-empty-drop-zone');
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const mapId = e.dataTransfer.getData('text/plain');
      if (mapId && this.currentChainId) {
        this.addMapToChainLibrary(mapId);
      }
    });
  }

  setupLibrarySlotEventHandlers() {
    const slots = document.querySelectorAll('#library-chain-slots .chain-slot');

    slots.forEach(slot => {
      // Remove button
      const removeBtn = slot.querySelector('.chain-slot-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(removeBtn.dataset.index);
          this.removeMapFromChainLibrary(idx);
        });
      }

      // Drag for reordering
      slot.addEventListener('dragstart', (e) => {
        slot.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/slot-index', slot.dataset.index);
      });

      slot.addEventListener('dragend', () => {
        slot.classList.remove('dragging');
        document.querySelectorAll('.chain-slot').forEach(s => s.classList.remove('drag-over'));
      });

      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('text/slot-index')) {
          e.dataTransfer.dropEffect = 'move';
          slot.classList.add('drag-over');
        }
      });

      slot.addEventListener('dragleave', () => {
        slot.classList.remove('drag-over');
      });

      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('drag-over');

        const fromIndex = parseInt(e.dataTransfer.getData('text/slot-index'));
        const toIndex = parseInt(slot.dataset.index);

        if (!isNaN(fromIndex) && !isNaN(toIndex) && fromIndex !== toIndex) {
          this.reorderChainSlotsLibrary(fromIndex, toIndex);
        }
      });
    });
  }

  async addMapToChainLibrary(mapId) {
    const chain = this.chains.find(c => c.id === this.currentChainId);
    if (!chain) return;

    const map = await this.mapStorage.loadMap(mapId);
    if (!map) {
      console.error('Map not found:', mapId);
      return;
    }

    chain.maps.push(mapId);
    this.saveChainsToStorage();
    this.renderLibraryChainSlots();
  }

  removeMapFromChainLibrary(index) {
    const chain = this.chains.find(c => c.id === this.currentChainId);
    if (!chain) return;

    chain.maps.splice(index, 1);
    this.saveChainsToStorage();
    this.renderLibraryChainSlots();
  }

  reorderChainSlotsLibrary(fromIndex, toIndex) {
    const chain = this.chains.find(c => c.id === this.currentChainId);
    if (!chain) return;

    const [removed] = chain.maps.splice(fromIndex, 1);
    chain.maps.splice(toIndex, 0, removed);
    this.saveChainsToStorage();
    this.renderLibraryChainSlots();
  }

  saveCurrentChainLibrary() {
    const name = document.getElementById('library-chain-name')?.value;
    const chain = this.chains.find(c => c.id === this.currentChainId);

    if (chain && name) {
      chain.name = name;
      this.saveChainsToStorage();
      this.refreshLibraryChainList();
      console.log('Chain saved:', chain.name);
    }
  }

  // ---- Chain Storage ----

  loadChainsFromStorage() {
    try {
      const data = localStorage.getItem('gmi-map-chains');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load chains:', e);
      return [];
    }
  }

  saveChainsToStorage() {
    try {
      localStorage.setItem('gmi-map-chains', JSON.stringify(this.chains));
    } catch (e) {
      console.error('Failed to save chains:', e);
    }
  }

  // ---- Chain Editor ----

  setupChainEditor() {
    // New chain button
    document.getElementById('btn-new-chain')?.addEventListener('click', () => {
      this.createNewChain();
    });

    // Delete chain button
    document.getElementById('btn-delete-chain')?.addEventListener('click', () => {
      if (this.currentChainId && confirm('Delete this chain?')) {
        this.deleteChain(this.currentChainId);
      }
    });

    // Save chain button
    document.getElementById('btn-save-chain')?.addEventListener('click', () => {
      this.saveCurrentChain();
    });

    // Test chain button
    document.getElementById('btn-test-chain')?.addEventListener('click', () => {
      this.testChain();
    });

    // Chain name input
    document.getElementById('chain-name-input')?.addEventListener('change', (e) => {
      if (this.currentChainId) {
        const chain = this.chains.find(c => c.id === this.currentChainId);
        if (chain) {
          chain.name = e.target.value;
          this.refreshChainList();
        }
      }
    });

    // Setup drop zone for empty chain
    this.setupChainDropZone();
  }

  setupChainDropZone() {
    const slotsContainer = document.getElementById('chain-slots');
    if (!slotsContainer) return;

    slotsContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    slotsContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      const mapId = e.dataTransfer.getData('text/plain');
      if (mapId && this.currentChainId) {
        this.addMapToChain(mapId);
      }
    });
  }

  createNewChain() {
    const newChain = {
      id: 'chain-' + Date.now(),
      name: 'New Chain',
      maps: []
    };

    this.chains.push(newChain);
    this.saveChainsToStorage();
    this.refreshChainList();
    this.selectChain(newChain.id);
  }

  deleteChain(chainId) {
    this.chains = this.chains.filter(c => c.id !== chainId);
    this.saveChainsToStorage();

    if (this.currentChainId === chainId) {
      this.currentChainId = null;
      document.getElementById('chain-editor').style.display = 'none';
    }

    this.refreshChainList();
  }

  selectChain(chainId) {
    this.currentChainId = chainId;
    const chain = this.chains.find(c => c.id === chainId);

    if (!chain) {
      document.getElementById('chain-editor').style.display = 'none';
      return;
    }

    // Update UI
    document.querySelectorAll('.chain-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === chainId);
    });

    document.getElementById('chain-editor').style.display = 'block';
    document.getElementById('chain-name-input').value = chain.name;

    this.renderChainSlots();
  }

  async renderChainSlots() {
    const container = document.getElementById('chain-slots');
    if (!container) return;

    const chain = this.chains.find(c => c.id === this.currentChainId);
    if (!chain) {
      container.innerHTML = '<div class="chain-slot-empty">No chain selected</div>';
      return;
    }

    if (chain.maps.length === 0) {
      container.innerHTML = `
        <div class="chain-slot-empty" id="empty-drop-zone">
          Drag maps here to build your chain
        </div>
      `;
      this.setupEmptyDropZone();
      return;
    }

    // Get map info for each map in chain
    const mapInfos = await Promise.all(
      chain.maps.map(async (mapId) => {
        const map = await this.mapStorage.loadMap(mapId);
        return map ? { id: mapId, name: map.name, hasBoss: !!map.data?.bossConfig } : null;
      })
    );

    container.innerHTML = mapInfos.map((info, idx) => {
      if (!info) {
        return `
          <div class="chain-slot" data-index="${idx}" draggable="true">
            <span class="chain-slot-number">${idx + 1}</span>
            <span class="chain-slot-name" style="color: var(--accent-red);">(Map not found)</span>
            <button class="chain-slot-remove" data-index="${idx}">X</button>
          </div>
        `;
      }
      return `
        <div class="chain-slot" data-index="${idx}" draggable="true">
          <span class="chain-slot-number">${idx + 1}</span>
          <span class="chain-slot-name">${info.name}</span>
          ${info.hasBoss ? '<span class="chain-slot-boss">BOSS</span>' : ''}
          <button class="chain-slot-remove" data-index="${idx}">X</button>
        </div>
      `;
    }).join('') + `
      <div class="chain-slot-empty" id="empty-drop-zone" style="margin-top: 10px;">
        + Drop map here to add
      </div>
    `;

    // Setup slot event handlers
    this.setupSlotEventHandlers();
    this.setupEmptyDropZone();
  }

  setupEmptyDropZone() {
    const dropZone = document.getElementById('empty-drop-zone');
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const mapId = e.dataTransfer.getData('text/plain');
      if (mapId && this.currentChainId) {
        this.addMapToChain(mapId);
      }
    });
  }

  setupSlotEventHandlers() {
    const slots = document.querySelectorAll('.chain-slot');

    slots.forEach(slot => {
      // Remove button
      const removeBtn = slot.querySelector('.chain-slot-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(removeBtn.dataset.index);
          this.removeMapFromChain(idx);
        });
      }

      // Drag start
      slot.addEventListener('dragstart', (e) => {
        slot.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/slot-index', slot.dataset.index);
      });

      // Drag end
      slot.addEventListener('dragend', () => {
        slot.classList.remove('dragging');
        document.querySelectorAll('.chain-slot').forEach(s => s.classList.remove('drag-over'));
      });

      // Drag over
      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggedIndex = e.dataTransfer.types.includes('text/slot-index');
        if (draggedIndex) {
          e.dataTransfer.dropEffect = 'move';
          slot.classList.add('drag-over');
        }
      });

      // Drag leave
      slot.addEventListener('dragleave', () => {
        slot.classList.remove('drag-over');
      });

      // Drop (reorder)
      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('drag-over');

        const fromIndex = parseInt(e.dataTransfer.getData('text/slot-index'));
        const toIndex = parseInt(slot.dataset.index);

        if (!isNaN(fromIndex) && !isNaN(toIndex) && fromIndex !== toIndex) {
          this.reorderChainSlots(fromIndex, toIndex);
        }
      });
    });
  }

  async addMapToChain(mapId) {
    const chain = this.chains.find(c => c.id === this.currentChainId);
    if (!chain) return;

    // Verify map exists
    const map = await this.mapStorage.loadMap(mapId);
    if (!map) {
      console.error('Map not found:', mapId);
      return;
    }

    chain.maps.push(mapId);
    this.saveChainsToStorage();
    this.renderChainSlots();
  }

  removeMapFromChain(index) {
    const chain = this.chains.find(c => c.id === this.currentChainId);
    if (!chain) return;

    chain.maps.splice(index, 1);
    this.saveChainsToStorage();
    this.renderChainSlots();
  }

  reorderChainSlots(fromIndex, toIndex) {
    const chain = this.chains.find(c => c.id === this.currentChainId);
    if (!chain) return;

    const [removed] = chain.maps.splice(fromIndex, 1);
    chain.maps.splice(toIndex, 0, removed);
    this.saveChainsToStorage();
    this.renderChainSlots();
  }

  saveCurrentChain() {
    const name = document.getElementById('chain-name-input')?.value;
    const chain = this.chains.find(c => c.id === this.currentChainId);

    if (chain && name) {
      chain.name = name;
      this.saveChainsToStorage();
      this.refreshChainList();
      console.log('Chain saved:', chain.name);
    }
  }

  testChain() {
    if (!this.currentChainId) {
      alert('No chain selected');
      return;
    }

    const chain = this.chains.find(c => c.id === this.currentChainId);
    if (!chain || chain.maps.length === 0) {
      alert('Chain is empty');
      return;
    }

    // Save chain first
    this.saveCurrentChain();

    // Store chain for game to load
    localStorage.setItem('gmi-test-chain', JSON.stringify(chain));
    window.location.href = 'index.html?testChain=' + this.currentChainId;
  }

  refreshChainList() {
    const listEl = document.getElementById('chain-list');
    if (!listEl) return;

    if (this.chains.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          No chains yet.<br>Click + to create one.
        </div>
      `;
      return;
    }

    listEl.innerHTML = this.chains.map(chain => `
      <div class="chain-item ${chain.id === this.currentChainId ? 'active' : ''}" data-id="${chain.id}">
        <div class="chain-item-name">${chain.name}</div>
        <div class="chain-item-info">${chain.maps.length} maps</div>
      </div>
    `).join('');

    // Add click handlers
    listEl.querySelectorAll('.chain-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectChain(item.dataset.id);
      });
    });
  }

  onZonePropertyChange() {
    const scene = this.getScene();
    if (!scene || !scene.selectedObject) return;

    const zone = scene.selectedObject;
    zone.x = parseInt(document.getElementById('zone-x').value) || 0;
    zone.y = parseInt(document.getElementById('zone-y').value) || 0;
    zone.width = parseInt(document.getElementById('zone-width').value) || 200;
    zone.height = parseInt(document.getElementById('zone-height').value) || 40;

    scene.redraw();
    scene.drawSelection();
    this.hasUnsavedChanges = true;
  }

  onItemPropertyChange() {
    const scene = this.getScene();
    if (!scene || !scene.selectedObject) return;

    const spawn = scene.selectedObject;
    spawn.x = parseInt(document.getElementById('item-x').value) || 0;
    spawn.y = parseInt(document.getElementById('item-y').value) || 0;
    spawn.itemType = document.getElementById('item-type').value || 'random';
    spawn.spawnOnStart = document.getElementById('item-spawn-on-start').checked;
    spawn.respawnTime = parseInt(document.getElementById('item-respawn-time').value) || 0;

    scene.redraw();
    scene.drawSelection();
    this.hasUnsavedChanges = true;
  }

  // ---- Selection Callbacks ----

  onObjectSelected(obj, type) {
    if (type === 'obstacle') {
      document.getElementById('no-selection').style.display = 'none';
      document.getElementById('obstacle-properties').style.display = 'block';
      document.getElementById('panel-zone-properties').style.display = 'none';
      document.getElementById('panel-item-properties').style.display = 'none';

      // Show/hide radius vs width/height
      const isCircle = obj.type === 'circle';
      document.getElementById('prop-radius-group').style.display = isCircle ? 'block' : 'none';
      document.querySelector('#prop-width').parentElement.parentElement.style.display = isCircle ? 'none' : 'flex';

      // Populate values
      document.getElementById('prop-x').value = Math.round(obj.x);
      document.getElementById('prop-y').value = Math.round(obj.y);
      document.getElementById('prop-width').value = Math.round(obj.width || 80);
      document.getElementById('prop-height').value = Math.round(obj.height || 25);
      document.getElementById('prop-radius').value = Math.round(obj.radius || 20);
      document.getElementById('prop-angle').value = Math.round(obj.angle || 0);
      document.getElementById('prop-color').value = obj.color || '#e74c3c';

      // Behavior
      document.getElementById(`behavior-${obj.behavior || 'static'}`).checked = true;
      this.onBehaviorChange();

      // Breakable settings
      document.getElementById('prop-health').value = obj.health || 3;
      document.getElementById('breakable-red').checked = (obj.breakableBy || []).includes('Red');
      document.getElementById('breakable-blue').checked = (obj.breakableBy || []).includes('Blue');
      document.getElementById('breakable-green').checked = (obj.breakableBy || []).includes('Green');
      document.getElementById('breakable-yellow').checked = (obj.breakableBy || []).includes('Yellow');
      document.getElementById('breakable-purple').checked = (obj.breakableBy || []).includes('Purple');

      // Rotating settings
      document.getElementById('prop-rotation-speed').value = obj.rotationSpeed || 2;
      document.getElementById(obj.rotationDirection === 'ccw' ? 'rotation-ccw' : 'rotation-cw').checked = true;

      // Moving settings
      document.getElementById(obj.moveDirection === 'vertical' ? 'move-vertical' : 'move-horizontal').checked = true;
      document.getElementById('prop-move-distance').value = obj.moveDistance || 100;
      document.getElementById('prop-move-speed').value = obj.moveSpeed || 50;

      // Crusher settings
      const crusherDir = obj.crusherDirection || 'down';
      document.getElementById(`crusher-${crusherDir}`).checked = true;
      document.getElementById('prop-crusher-speed').value = obj.crusherSpeed || 80;
      document.getElementById('prop-crusher-delay').value = obj.crusherResetDelay || 2000;

      // Show animation panel and notify controller
      document.getElementById('panel-animation').style.display = 'block';
      if (this.animationController) {
        this.animationController.selectObstacle(obj.id, obj);
        this.updateAnimationStatus(obj.id);
        this.updateKeyframeButtons();
      }

    } else if (type === 'start' || type === 'finish') {
      document.getElementById('no-selection').style.display = 'none';
      document.getElementById('obstacle-properties').style.display = 'none';
      document.getElementById('panel-zone-properties').style.display = 'block';
      document.getElementById('panel-item-properties').style.display = 'none';
      document.getElementById('panel-animation').style.display = 'none';

      const hint = type === 'start'
        ? 'Start Zone: Where balls spawn at race start'
        : 'Finish Zone: The goal line for the race';
      document.getElementById('zone-hint').textContent = hint;

      document.getElementById('zone-x').value = Math.round(obj.x);
      document.getElementById('zone-y').value = Math.round(obj.y);
      document.getElementById('zone-width').value = Math.round(obj.width);
      document.getElementById('zone-height').value = Math.round(obj.height);

      // Clear animation selection for zones
      if (this.animationController) {
        this.animationController.selectObstacle(null);
      }
    } else if (type === 'itemSpawn') {
      document.getElementById('no-selection').style.display = 'none';
      document.getElementById('obstacle-properties').style.display = 'none';
      document.getElementById('panel-zone-properties').style.display = 'none';
      document.getElementById('panel-item-properties').style.display = 'block';
      document.getElementById('panel-animation').style.display = 'none';

      document.getElementById('item-x').value = Math.round(obj.x);
      document.getElementById('item-y').value = Math.round(obj.y);
      document.getElementById('item-type').value = obj.itemType || 'random';
      document.getElementById('item-spawn-on-start').checked = obj.spawnOnStart !== false;
      document.getElementById('item-respawn-time').value = obj.respawnTime || 0;

      // Clear animation selection for items
      if (this.animationController) {
        this.animationController.selectObstacle(null);
      }
    }
  }

  onSelectionCleared() {
    document.getElementById('no-selection').style.display = 'block';
    document.getElementById('obstacle-properties').style.display = 'none';
    document.getElementById('panel-zone-properties').style.display = 'none';
    document.getElementById('panel-item-properties').style.display = 'none';
    document.getElementById('panel-animation').style.display = 'none';

    // Clear animation selection
    if (this.animationController) {
      this.animationController.selectObstacle(null);
    }
  }

  // ---- Status Updates ----

  updateObjectCount(count) {
    document.getElementById('status-objects').textContent = `Objects: ${count}`;
  }

  updateSizeStatus() {
    document.getElementById('status-size').textContent = `Size: ${this.mapWidth} x ${this.mapHeight}`;
  }

  updateValidation(hasStart, hasFinish) {
    const warning = document.getElementById('validation-warning');

    // Check if boss mode allows skipping finish zone
    const bossConfig = this.getBossConfig();
    const bossWinCondition = bossConfig?.winCondition || 'boss';
    const needsFinish = !bossConfig || bossWinCondition === 'finish' || bossWinCondition === 'either';

    // Valid if: has start AND (has finish OR boss mode with 'boss' win condition)
    const isValid = hasStart && (hasFinish || (bossConfig && bossWinCondition === 'boss'));

    if (isValid) {
      warning.classList.add('hidden');
    } else {
      let msg = 'Map needs ';
      if (!hasStart && !hasFinish && needsFinish) {
        msg += 'a Start Zone and Finish Zone';
      } else if (!hasStart) {
        msg += 'a Start Zone';
      } else if (!hasFinish && needsFinish) {
        msg += 'a Finish Zone';
      } else {
        msg += 'valid zones';
      }
      msg += ' to be playable.';
      warning.textContent = msg;
      warning.classList.remove('hidden');
    }
  }

  // ---- Modals ----

  setupModals() {
    // New Map Modal
    document.getElementById('btn-cancel-new-map').addEventListener('click', () => {
      document.getElementById('modal-new-map').classList.add('hidden');
    });

    document.getElementById('btn-create-map').addEventListener('click', () => {
      this.createNewMap();
    });

    // Size presets
    document.querySelectorAll('.size-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.size-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('new-map-width').value = btn.dataset.width;
        document.getElementById('new-map-height').value = btn.dataset.height;
      });
    });

    // Welcome Modal
    document.getElementById('btn-get-started').addEventListener('click', () => {
      document.getElementById('modal-welcome').classList.add('hidden');
      localStorage.setItem('gmi-editor-welcomed', 'true');
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.add('hidden');
        }
      });
    });
  }

  showNewMapModal() {
    document.getElementById('new-map-name').value = 'Untitled Map';
    document.getElementById('new-map-width').value = '800';
    document.getElementById('new-map-height').value = '600';
    document.querySelectorAll('.size-preset').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.width === '800');
    });
    document.getElementById('modal-new-map').classList.remove('hidden');
    document.getElementById('new-map-name').focus();
  }

  async createNewMap() {
    const name = document.getElementById('new-map-name').value || 'Untitled Map';
    const width = parseInt(document.getElementById('new-map-width').value) || 800;
    const height = parseInt(document.getElementById('new-map-height').value) || 600;

    document.getElementById('modal-new-map').classList.add('hidden');

    // Create new map in storage
    const newMap = await this.mapStorage.createNewMap(name, width, height);

    this.currentMapId = newMap.id;
    this.currentMapName = name;
    this.mapWidth = width;
    this.mapHeight = height;

    // Initialize or resize game
    if (!this.game) {
      this.initGame(width, height);
    } else {
      // Destroy old game and create new
      this.game.destroy(true);
      this.scene = null;
      this.initGame(width, height);
    }

    await this.refreshMapList();
    this.hasUnsavedChanges = false;
  }

  checkWelcome() {
    if (!localStorage.getItem('gmi-editor-welcomed')) {
      document.getElementById('modal-welcome').classList.remove('hidden');
    }
  }

  // ---- Map List ----

  async refreshMapList() {
    // Also refresh the library map list
    await this.refreshLibraryMapList();
  }

  async loadMap(id) {
    if (this.hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Load anyway?')) return;
    }

    const map = await this.mapStorage.loadMap(id);
    if (!map) return;

    this.currentMapId = map.id;
    this.currentMapName = map.name;
    this.mapWidth = map.width;
    this.mapHeight = map.height;

    // Initialize or resize game
    if (!this.game) {
      this.initGame(map.width, map.height);

      // Wait for scene and load data
      setTimeout(() => {
        const scene = this.getScene();
        if (scene && map.data) {
          scene.loadMapData(map.data);
        }
      }, 500);
    } else {
      // Resize if different dimensions
      if (this.game.config.width !== map.width || this.game.config.height !== map.height) {
        this.game.destroy(true);
        this.scene = null;
        this.initGame(map.width, map.height);

        setTimeout(() => {
          const scene = this.getScene();
          if (scene && map.data) {
            scene.loadMapData(map.data);
          }
        }, 500);
      } else {
        const scene = this.getScene();
        if (scene && map.data) {
          scene.loadMapData(map.data);
        }
      }
    }

    this.updateSizeStatus();
    await this.refreshMapList();
    this.hasUnsavedChanges = false;
  }

  async saveCurrentMap() {
    if (!this.currentMapId) {
      // No map loaded, create new one
      this.showNewMapModal();
      return;
    }

    const scene = this.getScene();
    if (!scene) return;

    const mapData = scene.getMapData();

    await this.mapStorage.saveMap({
      id: this.currentMapId,
      name: this.currentMapName,
      width: this.mapWidth,
      height: this.mapHeight,
      data: mapData
    });

    this.hasUnsavedChanges = false;
    await this.refreshMapList();

    console.log('Map saved:', this.currentMapId);
  }

  async exportCurrentMap() {
    if (!this.currentMapId) {
      alert('No map loaded to export');
      return;
    }

    // Save first
    await this.saveCurrentMap();

    // Export
    await this.mapStorage.exportJSON(this.currentMapId);
  }

  async importMap(file) {
    try {
      const imported = await this.mapStorage.importJSON(file);
      await this.loadMap(imported.id);
    } catch (err) {
      alert('Failed to import map: ' + err.message);
    }
  }

  testInGame() {
    if (!this.currentMapId) {
      alert('Save your map first before testing');
      return;
    }

    // Save current map
    this.saveCurrentMap().then(() => {
      // Store map ID for game to load
      localStorage.setItem('gmi-test-map-id', this.currentMapId);
      window.location.href = 'index.html?testMap=' + this.currentMapId;
    });
  }

  // ---- Map Settings (Colors, Grid) ----

  setupMapSettings() {
    // Viewport background color
    document.getElementById('viewport-bg-color')?.addEventListener('input', () => {
      this.applyMapSettings();
    });

    // Floor color
    document.getElementById('floor-color')?.addEventListener('input', () => {
      this.applyMapSettings();
    });

    // Grid color
    document.getElementById('grid-color')?.addEventListener('input', () => {
      this.applyMapSettings();
    });

    // Grid size
    document.getElementById('grid-size')?.addEventListener('change', () => {
      this.applyMapSettings();
    });

    // Show grid toggle
    document.getElementById('show-grid')?.addEventListener('change', () => {
      this.applyMapSettings();
    });
  }

  applyMapSettings() {
    const scene = this.getScene();
    if (!scene) return;

    const viewportBg = document.getElementById('viewport-bg-color')?.value || '#1a1a2e';
    const floor = document.getElementById('floor-color')?.value || '#e8e0d0';
    const grid = document.getElementById('grid-color')?.value || '#cccccc';
    const gridSize = parseInt(document.getElementById('grid-size')?.value) || 50;
    const showGrid = document.getElementById('show-grid')?.checked ?? true;

    // Convert hex to int
    const viewportBgInt = parseInt(viewportBg.replace('#', ''), 16);
    const floorInt = parseInt(floor.replace('#', ''), 16);
    const gridInt = parseInt(grid.replace('#', ''), 16);

    scene.setColors(viewportBgInt, floorInt, gridInt, gridSize, showGrid);
  }

  // ---- Chain Edit Mode ----

  setupChainEditMode() {
    // Exit chain mode button
    document.getElementById('btn-exit-chain-mode')?.addEventListener('click', () => {
      this.exitChainEditMode();
    });

    // Edit Chain button in library
    document.getElementById('btn-edit-chain-mode')?.addEventListener('click', () => {
      if (this.currentChainId) {
        this.enterChainEditMode(this.currentChainId);
      }
    });

    // Test chain button (main toolbar)
    document.getElementById('btn-test-chain')?.addEventListener('click', () => {
      if (this.chainEditMode && this.editingChainId) {
        this.testChain();
      }
    });

    // Add new map to chain button
    document.getElementById('btn-add-new-map-chain')?.addEventListener('click', () => {
      if (this.chainEditMode) {
        this.showNewMapModal();
      }
    });

    // Add existing map button
    document.getElementById('btn-add-existing-chain')?.addEventListener('click', () => {
      // Show map library for selection
      document.getElementById('library-window')?.classList.remove('hidden');
    });

    // Add current map to chain button
    document.getElementById('btn-add-map-to-chain')?.addEventListener('click', () => {
      this.addCurrentMapToChain();
    });
  }

  enterChainEditMode(chainId) {
    const chain = this.chains.find(c => c.id === chainId);
    if (!chain) return;

    this.chainEditMode = true;
    this.editingChainId = chainId;
    this.currentChainMapIndex = 0;

    // Update UI
    document.getElementById('chain-edit-bar')?.classList.remove('hidden');
    document.getElementById('chain-edit-name').textContent = chain.name;
    document.getElementById('panel-chain-edit')?.classList.remove('hidden');

    // Enable test chain button
    const testChainBtn = document.getElementById('btn-test-chain');
    if (testChainBtn) {
      testChainBtn.disabled = false;
      testChainBtn.title = 'Test the entire chain';
    }

    // Load chain maps info
    this.loadChainMapsInfo(chain);

    // Load first map in chain if any
    if (chain.maps.length > 0) {
      this.loadMapInChainMode(0);
    }

    // Close library window
    document.getElementById('library-window')?.classList.add('hidden');

    console.log('[ChainEdit] Entered chain edit mode:', chain.name);
  }

  exitChainEditMode() {
    this.chainEditMode = false;
    this.editingChainId = null;
    this.editingChainMaps = [];
    this.currentChainMapIndex = 0;

    // Update UI
    document.getElementById('chain-edit-bar')?.classList.add('hidden');
    document.getElementById('panel-chain-edit')?.classList.add('hidden');

    // Disable test chain button
    const testChainBtn = document.getElementById('btn-test-chain');
    if (testChainBtn) {
      testChainBtn.disabled = true;
      testChainBtn.title = 'Enter chain edit mode to test chains';
    }

    console.log('[ChainEdit] Exited chain edit mode');
  }

  async loadChainMapsInfo(chain) {
    this.editingChainMaps = [];

    for (const mapId of chain.maps) {
      const map = await this.mapStorage.loadMap(mapId);
      if (map) {
        this.editingChainMaps.push({
          id: mapId,
          name: map.name,
          hasBoss: !!map.data?.bossConfig
        });
      } else {
        this.editingChainMaps.push({
          id: mapId,
          name: '(Not Found)',
          hasBoss: false
        });
      }
    }

    this.renderChainMapList();
    this.updateChainEditProgress();
  }

  renderChainMapList() {
    const listEl = document.getElementById('chain-map-list');
    if (!listEl) return;

    if (this.editingChainMaps.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center;">No maps in chain.<br>Add maps from library.</div>';
      return;
    }

    listEl.innerHTML = this.editingChainMaps.map((map, idx) => `
      <div class="chain-map-item ${idx === this.currentChainMapIndex ? 'active' : ''}" data-index="${idx}">
        <div class="map-number">${idx + 1}</div>
        <div class="map-name">${map.name}</div>
        ${map.hasBoss ? '<div class="map-badge">BOSS</div>' : ''}
        <button class="btn-remove" data-index="${idx}" title="Remove from chain">&times;</button>
      </div>
    `).join('');

    // Add click handlers
    listEl.querySelectorAll('.chain-map-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('btn-remove')) {
          this.loadMapInChainMode(parseInt(item.dataset.index));
        }
      });
    });

    listEl.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeMapFromChainEdit(parseInt(btn.dataset.index));
      });
    });
  }

  loadMapInChainMode(index) {
    if (index < 0 || index >= this.editingChainMaps.length) return;

    // Save current map first if there are changes
    if (this.hasUnsavedChanges && this.currentMapId) {
      this.saveCurrentMap();
    }

    const mapInfo = this.editingChainMaps[index];
    this.currentChainMapIndex = index;

    // Load the map
    this.loadMap(mapInfo.id);

    // Update UI
    this.renderChainMapList();
    this.updateChainEditProgress();
  }

  updateChainEditProgress() {
    const progressEl = document.getElementById('chain-edit-progress');
    if (progressEl) {
      progressEl.textContent = `(Map ${this.currentChainMapIndex + 1} of ${this.editingChainMaps.length})`;
    }
  }

  removeMapFromChainEdit(index) {
    const chain = this.chains.find(c => c.id === this.editingChainId);
    if (!chain) return;

    chain.maps.splice(index, 1);
    this.editingChainMaps.splice(index, 1);
    this.saveChainsToStorage();

    // Adjust current index if needed
    if (this.currentChainMapIndex >= this.editingChainMaps.length) {
      this.currentChainMapIndex = Math.max(0, this.editingChainMaps.length - 1);
    }

    this.renderChainMapList();
    this.updateChainEditProgress();

    // Load the current map
    if (this.editingChainMaps.length > 0) {
      this.loadMapInChainMode(this.currentChainMapIndex);
    }
  }

  addCurrentMapToChain() {
    if (!this.chainEditMode || !this.editingChainId || !this.currentMapId) return;

    const chain = this.chains.find(c => c.id === this.editingChainId);
    if (!chain) return;

    // Don't add duplicates
    if (chain.maps.includes(this.currentMapId)) {
      alert('This map is already in the chain');
      return;
    }

    chain.maps.push(this.currentMapId);
    this.saveChainsToStorage();

    // Reload chain maps info
    this.loadChainMapsInfo(chain);
  }
}

// ============================================================================
// Initialize
// ============================================================================
window.editorUI = new EditorUI();

// Test function - run from console: testKeyframes()
window.testKeyframes = function() {
  const ui = window.editorUI;
  const scene = ui.getScene();

  console.log('=== KEYFRAME SYSTEM TEST ===');
  console.log('1. Scene:', scene ? 'OK' : 'MISSING');
  console.log('2. Selected object:', scene?.selectedObject ? scene.selectedObject.id : 'NONE');
  console.log('3. Animation controller:', ui.animationController ? 'OK' : 'MISSING');
  console.log('4. Timeline:', ui.animationController?.timeline ? 'OK' : 'MISSING');
  console.log('5. Current time:', ui.animationController?.timeline?.currentTime);

  if (scene?.selectedObject) {
    const obsId = scene.selectedObject.id;
    console.log('6. Animations storage:', ui.animationController?.animations);
    console.log('7. Animation for selected:', ui.animationController?.animations[obsId]);
  }

  console.log('=== END TEST ===');
  return {
    scene: !!scene,
    selectedObject: scene?.selectedObject?.id,
    animationController: !!ui.animationController,
    timeline: !!ui.animationController?.timeline,
    animations: ui.animationController?.animations
  };
};

// Manual keyframe add test - run: addTestKeyframe('x', 0)
window.addTestKeyframe = function(property, value) {
  const ui = window.editorUI;
  const scene = ui.getScene();

  if (!scene?.selectedObject) {
    console.error('No obstacle selected!');
    return;
  }

  const obsId = scene.selectedObject.id;
  const time = ui.animationController?.timeline?.currentTime || 0;

  // Ensure animation structure exists
  if (!ui.animationController.animations[obsId]) {
    ui.animationController.animations[obsId] = {
      duration: 2000,
      loop: 'pingpong',
      loopCount: 0,
      tracks: {}
    };
  }

  const anim = ui.animationController.animations[obsId];
  if (!anim.tracks[property]) {
    anim.tracks[property] = { keyframes: [] };
  }

  anim.tracks[property].keyframes.push({
    time: Math.round(time),
    value: value,
    easing: 'easeInOutQuad'
  });

  console.log('Added keyframe:', property, '=', value, 'at time', time);
  console.log('Animation:', anim);

  // Update UI
  if (ui.animationController.timeline) {
    ui.animationController.timeline.setAnimation(obsId, anim);
  }
  ui.updateKeyframeButtons();

  return anim;
};

// Debug: Show all animations in the controller
window.debugAnimations = function() {
  const ui = window.editorUI;
  console.log('=== ALL ANIMATIONS ===');
  console.log('Animations stored:', ui.animationController?.animations);

  if (ui.animationController?.animations) {
    for (const [obsId, anim] of Object.entries(ui.animationController.animations)) {
      console.log(`\nObstacle: ${obsId}`);
      console.log(`  Duration: ${anim.duration}ms`);
      console.log(`  Loop: ${anim.loop}`);
      for (const [prop, track] of Object.entries(anim.tracks || {})) {
        console.log(`  Track '${prop}': ${track.keyframes?.length || 0} keyframes`);
        track.keyframes?.forEach((kf, i) => {
          console.log(`    [${i}] t=${kf.time}ms v=${kf.value} ease=${kf.easing}`);
        });
      }
    }
  }
  console.log('======================');
};

// Debug: Create a simple test animation
window.createTestAnimation = function() {
  const ui = window.editorUI;
  const scene = ui.getScene();

  if (!scene?.selectedObject) {
    console.error('Select an obstacle first!');
    return;
  }

  const obsId = scene.selectedObject.id;

  // Create a simple left-right animation
  const testAnim = {
    duration: 2000,
    loop: 'pingpong',
    loopCount: 0,
    tracks: {
      x: {
        keyframes: [
          { time: 0, value: -50, easing: 'easeInOutQuad' },
          { time: 1000, value: 50, easing: 'easeInOutQuad' },
          { time: 2000, value: -50, easing: 'easeInOutQuad' }
        ]
      }
    }
  };

  ui.animationController.animations[obsId] = testAnim;

  if (ui.animationController.timeline) {
    ui.animationController.timeline.setAnimation(obsId, testAnim);
  }

  console.log('Created test animation for', obsId);
  console.log('Animation:', testAnim);
  console.log('Run debugAnimations() to verify');

  ui.updateKeyframeButtons();
  ui.updateAnimationStatus(obsId);

  return testAnim;
};

document.addEventListener('DOMContentLoaded', async () => {
  await window.editorUI.init();

  // Check if we should load a specific map or create new
  const maps = await window.editorUI.mapStorage.listMaps();
  if (maps.length > 0) {
    // Load most recent map
    await window.editorUI.loadMap(maps[0].id);
  } else {
    // Show new map dialog
    window.editorUI.showNewMapModal();
  }
});
