import * as THREE from 'three';
import { getMoonTrekTileUrl } from '../../services/moonTrek/wmtsConfig';
export interface TextureLoadProgress { total: number; loaded: number; isComplete: boolean; error?: string; stage?: number; }
export function createMoonTrekCanvasTexture(onProgress?: (progress: TextureLoadProgress) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = 4096; canvas.height = 2048;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot create globe imagery canvas');
  context.fillStyle = '#484b51'; context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  let disposed = false;
  let failed = false;
  const controllers = new Set<AbortController>();
  async function tile(zoom: number, row: number, col: number) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (disposed) return;
      const controller = new AbortController();
      controllers.add(controller);
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(getMoonTrekTileUrl(zoom, row, col), { signal: controller.signal });
        if (!response.ok) throw new Error('Imagery request failed');
        const bitmap = await createImageBitmap(await response.blob());
        if (!disposed) {
          const w = canvas.width / 2 ** (zoom + 1), h = canvas.height / 2 ** zoom;
          context!.drawImage(bitmap, col * w, row * h, w, h);
          texture.needsUpdate = true;
        }
        bitmap.close(); return;
      } catch {
        if (attempt === 1 && !disposed) failed = true;
      } finally { clearTimeout(timer); controllers.delete(controller); }
    }
  }
  void (async () => {
    for (const zoom of [1, 2, 3]) {
      if (disposed) return;
      const cols = 2 ** (zoom + 1), rows = 2 ** zoom, total = cols * rows;
      let next = 0, completed = 0;
      await Promise.all(Array.from({ length: 8 }, async () => {
        while (next < total && !disposed) {
          const index = next++;
          await tile(zoom, Math.floor(index / cols), index % cols);
          completed++;
          if (!disposed) onProgress?.({ total, loaded: completed, isComplete: completed === total, stage: zoom, error: failed ? 'Some globe imagery is unavailable. Unfilled areas are not terrain data.' : undefined });
        }
      }));
      if (failed) return;
    }
  })();
  return { texture, dispose: () => { disposed = true; controllers.forEach(c => c.abort()); controllers.clear(); texture.dispose(); } };
}
