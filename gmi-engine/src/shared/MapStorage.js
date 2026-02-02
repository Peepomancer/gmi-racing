/**
 * MapStorage - IndexedDB-based storage for editor maps
 * Handles saving, loading, listing, and import/export of maps
 */
export class MapStorage {
  constructor() {
    this.dbName = 'GMIRacingMaps';
    this.dbVersion = 1;
    this.storeName = 'maps';
    this.db = null;
  }

  /**
   * Initialize the database connection
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('MapStorage initialized');
        resolve(this);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create maps object store
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          console.log('Created maps object store');
        }
      };
    });
  }

  /**
   * Generate a unique map ID
   */
  generateId() {
    return 'map-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Save a map (create or update)
   * @param {Object} mapData - Map data to save
   * @returns {Promise<Object>} Saved map with ID
   */
  async saveMap(mapData) {
    if (!this.db) await this.init();

    const now = Date.now();
    const map = {
      ...mapData,
      id: mapData.id || this.generateId(),
      createdAt: mapData.createdAt || now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(map);

      request.onsuccess = () => {
        console.log('Map saved:', map.id);
        resolve(map);
      };

      request.onerror = () => {
        console.error('Failed to save map:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Load a map by ID
   * @param {string} id - Map ID
   * @returns {Promise<Object|null>} Map data or null if not found
   */
  async loadMap(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Failed to load map:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a map by ID
   * @param {string} id - Map ID
   * @returns {Promise<void>}
   */
  async deleteMap(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Map deleted:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to delete map:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * List all maps (returns summary info for sidebar)
   * @returns {Promise<Array>} Array of map summaries
   */
  async listMaps() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const maps = request.result || [];
        // Sort by updatedAt descending (most recent first)
        maps.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        // Return summary info for sidebar
        const summaries = maps.map(map => ({
          id: map.id,
          name: map.name,
          width: map.width,
          height: map.height,
          createdAt: map.createdAt,
          updatedAt: map.updatedAt,
          obstacleCount: map.data?.obstacles?.length || 0
        }));

        resolve(summaries);
      };

      request.onerror = () => {
        console.error('Failed to list maps:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Export a map as a JSON file download
   * @param {string} id - Map ID
   */
  async exportJSON(id) {
    const map = await this.loadMap(id);
    if (!map) {
      throw new Error('Map not found');
    }

    // Create export object (exclude internal IDs for sharing)
    const exportData = {
      name: map.name,
      width: map.width,
      height: map.height,
      data: map.data,
      exportedAt: Date.now(),
      version: '1.0'
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create download link and click it
    const a = document.createElement('a');
    a.href = url;
    a.download = `${map.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Map exported:', map.name);
  }

  /**
   * Import a map from a JSON file
   * @param {File} file - JSON file to import
   * @returns {Promise<Object>} Imported map data
   */
  async importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const importData = JSON.parse(e.target.result);

          // Validate required fields
          if (!importData.name || !importData.width || !importData.height || !importData.data) {
            throw new Error('Invalid map file: missing required fields');
          }

          // Create new map from import (with new ID)
          const mapData = {
            name: importData.name + ' (imported)',
            width: importData.width,
            height: importData.height,
            data: importData.data
          };

          const saved = await this.saveMap(mapData);
          console.log('Map imported:', saved.id);
          resolve(saved);
        } catch (err) {
          console.error('Failed to import map:', err);
          reject(err);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Create a new empty map with specified dimensions
   * @param {string} name - Map name
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @returns {Promise<Object>} Created map
   */
  async createNewMap(name, width, height) {
    const mapData = {
      name: name || 'Untitled Map',
      width: width || 800,
      height: height || 600,
      data: {
        startZone: null,
        finishZone: null,
        obstacles: []
      }
    };

    return this.saveMap(mapData);
  }

  /**
   * Duplicate an existing map
   * @param {string} id - Map ID to duplicate
   * @returns {Promise<Object>} New duplicated map
   */
  async duplicateMap(id) {
    const original = await this.loadMap(id);
    if (!original) {
      throw new Error('Map not found');
    }

    const duplicate = {
      name: original.name + ' (copy)',
      width: original.width,
      height: original.height,
      data: JSON.parse(JSON.stringify(original.data)) // Deep copy
    };

    return this.saveMap(duplicate);
  }
}

// Singleton instance
let instance = null;

export function getMapStorage() {
  if (!instance) {
    instance = new MapStorage();
  }
  return instance;
}
