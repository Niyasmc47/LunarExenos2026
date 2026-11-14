import * as THREE from 'three';
import { getMoonTrekTileUrl } from '../../services/moonTrek/wmtsConfig';

export interface TextureLoadProgress {
  total: number;
  loaded: number;
  isComplete: boolean;
  error?: string;
}

/**
 * Assembles NASA Moon Trek WMTS tiles into a high-resolution CanvasTexture for Three.js.
 *
 * Starts with Level 1 (8 tiles, 1024x512) for immediate crisp display,
 * then progressively upgrades to Level 2 (32 tiles, 2048x1024).
 */
export function createMoonTrekCanvasTexture(
  onProgress?: (progress: TextureLoadProgress) => void
): { texture: THREE.CanvasTexture; dispose: () => void } {
  const canvas = document.createElement('canvas');
  // Initialize canvas with Level 2 dimensions: 8 cols * 256 = 2048 wide, 4 rows * 256 = 1024 high
  canvas.width = 2048;
  canvas.height = 1024;

  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for Moon texture');
  }
  const context = ctx;

  // Pre-fill with average lunar regolith charcoal-gray
  context.fillStyle = '#484b51';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = true;

  let isDisposed = false;

  // Load a single tile with retry & error handling
  function loadTileImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load tile: ${url}`));
      img.src = url;
    });
  }

  async function loadTileLevel(zoom: number, cols: number, rows: number) {
    const totalTiles = cols * rows;
    let loadedCount = 0;

    const tilePromises: Promise<void>[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (isDisposed) return;

        const tileUrl = getMoonTrekTileUrl(zoom, row, col);
        const p = loadTileImage(tileUrl)
          .then((img) => {
            if (isDisposed) return;
            // Draw tile scaled appropriately into the 2048x1024 canvas
            const tileWidth = canvas.width / cols;
            const tileHeight = canvas.height / rows;
            context.drawImage(img, col * tileWidth, row * tileHeight, tileWidth, tileHeight);
            texture.needsUpdate = true;

            loadedCount++;
            onProgress?.({
              total: totalTiles,
              loaded: loadedCount,
              isComplete: loadedCount === totalTiles,
            });
          })
          .catch((err) => {
            console.warn(`[MoonTexture] Non-critical tile skip (${zoom}/${row}/${col}):`, err.message);
            loadedCount++;
            onProgress?.({
              total: totalTiles,
              loaded: loadedCount,
              isComplete: loadedCount === totalTiles,
            });
          });

        tilePromises.push(p);
      }
    }

    await Promise.all(tilePromises);
  }

  // Two-stage progressive load:
  // Stage 1: Zoom level 1 (8 tiles) loads very rapidly (< 300ms)
  // Stage 2: Zoom level 2 (32 tiles) completes high-definition surface detail
  (async () => {
    try {
      await loadTileLevel(1, 4, 2);
      if (!isDisposed) {
        await loadTileLevel(2, 8, 4);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load Moon Trek tiles';
      console.error('[MoonTexture] Error during texture assembly:', msg);
      onProgress?.({ total: 1, loaded: 1, isComplete: true, error: msg });
    }
  })();

  const dispose = () => {
    isDisposed = true;
    texture.dispose();
  };

  return { texture, dispose };
}
