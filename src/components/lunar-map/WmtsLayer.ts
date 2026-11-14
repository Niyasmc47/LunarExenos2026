import Projection from 'ol/proj/Projection.js';
import { addProjection, addEquivalentProjections } from 'ol/proj.js';
import TileLayer from 'ol/layer/Tile.js';
import WMTS from 'ol/source/WMTS.js';
import { loadMoonTrekCapabilities } from '../../services/moonTrek/capabilities';
import { MOON_TREK_WMTS } from '../../services/moonTrek/wmtsConfig';

/**
 * Register lunar equirectangular projection EPSG:104903 in OpenLayers.
 */
export const LUNAR_PROJECTION = new Projection({
  code: 'EPSG:104903',
  units: 'degrees',
  extent: [-180, -90, 180, 90],
  worldExtent: [-180, -90, 180, 90],
  global: true,
});

addProjection(LUNAR_PROJECTION);

// Register equivalents so OpenLayers can freely transform or accept coordinates
addEquivalentProjections([
  LUNAR_PROJECTION,
  new Projection({
    code: 'urn:ogc:def:crs:EPSG::104903',
    units: 'degrees',
    extent: [-180, -90, 180, 90],
    global: true,
  }),
  new Projection({
    code: 'EPSG:4326',
    units: 'degrees',
    extent: [-180, -90, 180, 90],
    global: true,
  }),
]);

/**
 * Creates the OpenLayers TileLayer for Moon Trek WMTS.
 */
export async function createMoonTrekLayer(
  onLoadingChange: (loading: boolean) => void,
  onError: (error: string | null) => void,
  onCapabilitiesActive: (active: boolean) => void
): Promise<TileLayer<WMTS>> {
  onLoadingChange(true);
  onError(null);

  const { options, fromLiveCapabilities, error } = await loadMoonTrekCapabilities();
  onCapabilitiesActive(fromLiveCapabilities);

  if (error) {
    console.warn('[MoonTrek WMTS] Initialized with fallback config due to:', error);
  }

  const source = new WMTS(options);

  let pendingTiles = 0;

  source.on('tileloadstart', () => {
    pendingTiles++;
    onLoadingChange(true);
  });

  source.on('tileloadend', () => {
    pendingTiles = Math.max(0, pendingTiles - 1);
    if (pendingTiles === 0) {
      onLoadingChange(false);
    }
  });

  source.on('tileloaderror', (evt) => {
    pendingTiles = Math.max(0, pendingTiles - 1);
    console.error('[MoonTrek WMTS] Tile load error:', evt);
    // Don't mark fatal error on a single missing tile, but notify if persistent
    if (pendingTiles === 0) {
      onLoadingChange(false);
    }
  });

  return new TileLayer({
    source,
    extent: MOON_TREK_WMTS.extent,
  });
}
