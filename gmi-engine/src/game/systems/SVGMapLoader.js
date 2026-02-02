/**
 * SVG Map Loader
 *
 * Loads SVG files from Illustrator and extracts collision data.
 *
 * ILLUSTRATOR WORKFLOW:
 * 1. Create document at your desired size (e.g., 800x600)
 * 2. Create layers:
 *    - "collision" - rectangles/circles that become physics bodies
 *    - "visual" - your artwork (displayed as background image)
 *    - "finish" - rectangle marking the finish line
 *    - "spawn" - rectangle marking where balls spawn
 * 3. Export as SVG (File > Export > Export As > SVG)
 * 4. Import into the engine
 *
 * SUPPORTED SHAPES:
 * - <rect> - Rectangles
 * - <circle> - Circles
 * - <ellipse> - Ellipses (converted to circles)
 * - <line> - Lines (converted to thin rectangles)
 * - <polygon> - Polygons (uses bounding box)
 * - <path> - Basic paths (uses bounding box)
 *
 * COLOR SUPPORT:
 * - Fill colors are extracted and can be used for visual styling
 * - Use different colors in Illustrator to categorize obstacles
 */

export class SVGMapLoader {
  constructor(scene) {
    this.scene = scene;
  }

  async loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const svgText = e.target.result;
          const mapData = this.parseSVG(svgText);
          resolve(mapData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  loadFromString(svgText) {
    return this.parseSVG(svgText);
  }

  parseSVG(svgText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid SVG: ' + parseError.textContent.slice(0, 100));
    }

    if (!svg) {
      throw new Error('No SVG element found in file');
    }

    // Get SVG dimensions
    const viewBox = svg.getAttribute('viewBox');
    let width = parseFloat(svg.getAttribute('width')) || 800;
    let height = parseFloat(svg.getAttribute('height')) || 600;

    // Handle width/height with units (e.g., "800px")
    if (typeof width === 'string') width = parseFloat(width);
    if (typeof height === 'string') height = parseFloat(height);

    if (viewBox) {
      const parts = viewBox.split(/\s+|,/).map(p => parseFloat(p));
      if (parts.length >= 4) {
        width = parts[2];
        height = parts[3];
      }
    }

    const mapData = {
      width,
      height,
      obstacles: [],
      finishLine: null,
      spawnArea: null,
      visualSVG: svgText,
      metadata: {
        layers: [],
        shapeCount: 0
      }
    };

    // Find layers
    const collisionLayer = this.findLayerByName(doc, 'collision');
    const finishLayer = this.findLayerByName(doc, 'finish');
    const spawnLayer = this.findLayerByName(doc, 'spawn');
    const visualLayer = this.findLayerByName(doc, 'visual');

    // Track found layers
    if (collisionLayer) mapData.metadata.layers.push('collision');
    if (finishLayer) mapData.metadata.layers.push('finish');
    if (spawnLayer) mapData.metadata.layers.push('spawn');
    if (visualLayer) mapData.metadata.layers.push('visual');

    // If no collision layer found, parse all shapes from root
    const shapeContainer = collisionLayer || svg;
    this.parseShapes(shapeContainer, mapData.obstacles);
    mapData.metadata.shapeCount = mapData.obstacles.length;

    // Parse finish line
    if (finishLayer) {
      const finishShapes = [];
      this.parseShapes(finishLayer, finishShapes);
      if (finishShapes.length > 0) {
        mapData.finishLine = finishShapes[0];
      }
    }

    // Parse spawn area
    if (spawnLayer) {
      const spawnShapes = [];
      this.parseShapes(spawnLayer, spawnShapes);
      if (spawnShapes.length > 0) {
        mapData.spawnArea = spawnShapes[0];
      }
    }

    // Default finish and spawn if not defined
    if (!mapData.finishLine) {
      mapData.finishLine = { x: 0, y: 40, width: width, height: 40, type: 'rect' };
    }
    if (!mapData.spawnArea) {
      mapData.spawnArea = { x: width * 0.2, y: height - 80, width: width * 0.6, height: 40, type: 'rect' };
    }

    console.log('SVG parsed:', {
      size: `${width}x${height}`,
      obstacles: mapData.obstacles.length,
      layers: mapData.metadata.layers
    });

    return mapData;
  }

  findLayerByName(doc, name) {
    const groups = doc.querySelectorAll('g');
    for (const g of groups) {
      const id = (g.getAttribute('id') || '').toLowerCase();
      const label = (g.getAttribute('inkscape:label') || '').toLowerCase();
      const dataName = (g.getAttribute('data-name') || '').toLowerCase(); // Illustrator CC

      if (id.includes(name) || label.includes(name) || dataName.includes(name)) {
        return g;
      }
    }
    return null;
  }

  parseShapes(container, obstacles) {
    // Parse rectangles
    const rects = container.querySelectorAll('rect');
    rects.forEach(rect => {
      const shape = this.parseRect(rect);
      if (shape) obstacles.push(shape);
    });

    // Parse circles
    const circles = container.querySelectorAll('circle');
    circles.forEach(circle => {
      const shape = this.parseCircle(circle);
      if (shape) obstacles.push(shape);
    });

    // Parse ellipses
    const ellipses = container.querySelectorAll('ellipse');
    ellipses.forEach(ellipse => {
      const shape = this.parseEllipse(ellipse);
      if (shape) obstacles.push(shape);
    });

    // Parse lines (as thin rectangles)
    const lines = container.querySelectorAll('line');
    lines.forEach(line => {
      const shape = this.parseLine(line);
      if (shape) obstacles.push(shape);
    });

    // Parse polygons
    const polygons = container.querySelectorAll('polygon');
    polygons.forEach(polygon => {
      const shape = this.parsePolygon(polygon);
      if (shape) obstacles.push(shape);
    });

    // Parse paths (basic bounding box)
    const paths = container.querySelectorAll('path');
    paths.forEach(path => {
      const shape = this.parsePath(path);
      if (shape) obstacles.push(shape);
    });
  }

  parseRect(rect) {
    const x = parseFloat(rect.getAttribute('x')) || 0;
    const y = parseFloat(rect.getAttribute('y')) || 0;
    const width = parseFloat(rect.getAttribute('width')) || 0;
    const height = parseFloat(rect.getAttribute('height')) || 0;

    if (width <= 0 || height <= 0) return null;

    const transform = this.parseTransform(rect.getAttribute('transform'));
    const color = this.parseColor(rect);

    return {
      type: 'rect',
      x: x + transform.x,
      y: y + transform.y,
      width,
      height,
      angle: transform.angle,
      color
    };
  }

  parseCircle(circle) {
    const cx = parseFloat(circle.getAttribute('cx')) || 0;
    const cy = parseFloat(circle.getAttribute('cy')) || 0;
    const r = parseFloat(circle.getAttribute('r')) || 0;

    if (r <= 0) return null;

    const transform = this.parseTransform(circle.getAttribute('transform'));
    const color = this.parseColor(circle);

    return {
      type: 'circle',
      x: cx + transform.x,
      y: cy + transform.y,
      radius: r,
      color
    };
  }

  parseEllipse(ellipse) {
    const cx = parseFloat(ellipse.getAttribute('cx')) || 0;
    const cy = parseFloat(ellipse.getAttribute('cy')) || 0;
    const rx = parseFloat(ellipse.getAttribute('rx')) || 0;
    const ry = parseFloat(ellipse.getAttribute('ry')) || 0;

    if (rx <= 0 || ry <= 0) return null;

    const transform = this.parseTransform(ellipse.getAttribute('transform'));
    const color = this.parseColor(ellipse);

    return {
      type: 'circle',
      x: cx + transform.x,
      y: cy + transform.y,
      radius: (rx + ry) / 2,
      color
    };
  }

  parseLine(line) {
    const x1 = parseFloat(line.getAttribute('x1')) || 0;
    const y1 = parseFloat(line.getAttribute('y1')) || 0;
    const x2 = parseFloat(line.getAttribute('x2')) || 0;
    const y2 = parseFloat(line.getAttribute('y2')) || 0;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 1) return null;

    const angle = Math.atan2(dy, dx);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const thickness = parseFloat(line.getAttribute('stroke-width')) || 4;
    const color = this.parseColor(line);

    // Return as rectangle centered at midpoint
    return {
      type: 'rect',
      x: cx - length / 2,
      y: cy - thickness / 2,
      width: length,
      height: thickness,
      angle,
      color
    };
  }

  parsePolygon(polygon) {
    const points = polygon.getAttribute('points');
    if (!points) return null;

    const bbox = this.getPolygonBBox(points);
    if (!bbox) return null;

    const color = this.parseColor(polygon);

    return {
      type: 'rect',
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      angle: 0,
      color
    };
  }

  parsePath(path) {
    const d = path.getAttribute('d');
    if (!d) return null;

    // Try to get bounding box from path data
    const bbox = this.getPathBBox(d);
    if (!bbox) return null;

    const color = this.parseColor(path);

    return {
      type: 'rect',
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      angle: 0,
      color
    };
  }

  parseTransform(transform) {
    const result = { x: 0, y: 0, angle: 0 };
    if (!transform) return result;

    // Parse translate
    const translateMatch = transform.match(/translate\(\s*([^,\s]+)[\s,]*([^)\s]*)\s*\)/);
    if (translateMatch) {
      result.x = parseFloat(translateMatch[1]) || 0;
      result.y = parseFloat(translateMatch[2]) || 0;
    }

    // Parse rotate
    const rotateMatch = transform.match(/rotate\(\s*([^)\s,]+)/);
    if (rotateMatch) {
      result.angle = (parseFloat(rotateMatch[1]) || 0) * Math.PI / 180;
    }

    // Parse matrix (extract translation and rotation)
    const matrixMatch = transform.match(/matrix\(\s*([^)]+)\)/);
    if (matrixMatch) {
      const vals = matrixMatch[1].split(/[\s,]+/).map(parseFloat);
      if (vals.length >= 6) {
        result.x += vals[4] || 0;
        result.y += vals[5] || 0;
        result.angle = Math.atan2(vals[1], vals[0]);
      }
    }

    return result;
  }

  parseColor(element) {
    // Try fill attribute
    let fill = element.getAttribute('fill');
    if (fill && fill !== 'none') {
      return this.normalizeColor(fill);
    }

    // Try style attribute
    const style = element.getAttribute('style');
    if (style) {
      const fillMatch = style.match(/fill:\s*([^;]+)/);
      if (fillMatch && fillMatch[1] !== 'none') {
        return this.normalizeColor(fillMatch[1].trim());
      }
    }

    // Try stroke for lines
    let stroke = element.getAttribute('stroke');
    if (stroke && stroke !== 'none') {
      return this.normalizeColor(stroke);
    }

    return null;
  }

  normalizeColor(color) {
    if (!color) return null;
    color = color.trim();

    // Already hex
    if (color.startsWith('#')) {
      return color;
    }

    // RGB
    const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }

    return color;
  }

  getPolygonBBox(pointsStr) {
    const coords = pointsStr.trim().split(/[\s,]+/).map(parseFloat);
    if (coords.length < 4) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < coords.length; i += 2) {
      const x = coords[i];
      const y = coords[i + 1];
      if (!isNaN(x) && !isNaN(y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (minX === Infinity) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  getPathBBox(d) {
    // Extract all numbers from path data
    const numbers = d.match(/-?[\d.]+/g);
    if (!numbers || numbers.length < 2) return null;

    const coords = numbers.map(parseFloat);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Simple approach: treat pairs as coordinates
    for (let i = 0; i < coords.length - 1; i += 2) {
      const x = coords[i];
      const y = coords[i + 1];
      if (!isNaN(x) && !isNaN(y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (minX === Infinity || maxX - minX < 1 || maxY - minY < 1) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}
