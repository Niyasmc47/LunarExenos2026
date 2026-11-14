import Projection from 'ol/proj/Projection.js';
import { addProjection, addEquivalentProjections } from 'ol/proj.js';
import TileLayer from 'ol/layer/Tile.js';
import WMTS from 'ol/source/WMTS.js';
import { createDirectWMTSOptions, loadMoonTrekCapabilities } from '../../services/moonTrek/capabilities';
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
 *
 * Initializes SYNCHRONOUSLY using verified direct options so tiles start loading
 * immediately without waiting for the slow capabilities XML.
 * Checks live capabilities in the background.
 */
export function createMoonTrekLayer(
  onLoadingChange: (loading: boolean) => void,
  _onError: (error: string | null) => void,
  onCapabilitiesActive: (active: boolean) => void
): TileLayer<WMTS> {
  const initialOptions = createDirectWMTSOptions();
  const source = new WMTS(initialOptions);

  let pendingTiles = 0;
  let loadingTimeout: ReturnType<typeof setTimeout> | null = null;

  source.on('tileloadstart', () => {
    pendingTiles++;
    onLoadingChange(true);
    if (loadingTimeout) clearTimeout(loadingTimeout);
    // Safety fallback: clear loading state after 6s in case network drops a tile
    loadingTimeout = setTimeout(() => {
      onLoadingChange(false);
    }, 6000);
  });

  source.on('tileloadend', () => {
    pendingTiles = Math.max(0, pendingTiles - 1);
    if (pendingTiles === 0) {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      onLoadingChange(false);
    }
  });

  source.on('tileloaderror', () => {
    pendingTiles = Math.max(0, pendingTiles - 1);
    if (pendingTiles === 0) {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      onLoadingChange(false);
    }
  });

  // Verify live capabilities asynchronously in the background
  loadMoonTrekCapabilities().then(({ fromLiveCapabilities }) => {
    onCapabilitiesActive(fromLiveCapabilities);
  }).catch(() => {
    onCapabilitiesActive(false);
  });

  return new TileLayer({
    source,
    extent: MOON_TREK_WMTS.extent,
  });
}
