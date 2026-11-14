import WMTSCapabilities from 'ol/format/WMTSCapabilities.js';
import { optionsFromCapabilities } from 'ol/source/WMTS.js';
import type { Options as WMTSOptions } from 'ol/source/WMTS.js';
import WMTSTileGrid from 'ol/tilegrid/WMTS.js';
import { MOON_TREK_WMTS } from './wmtsConfig';

export interface CapabilitiesFetchResult {
  options: WMTSOptions;
  fromLiveCapabilities: boolean;
  rawXml?: string;
  error?: string;
}

/**
 * Builds standard WMTS options directly from the static layer specification.
 */
export function createDirectWMTSOptions(): WMTSOptions {
  // Tile resolutions in degrees per pixel for equirectangular projection
  // Zoom 0: 360 degrees / (2 * 256) = 0.703125 deg/px
  const resolutions: number[] = [];
  const matrixIds: string[] = [];

  for (let z = 0; z <= 8; z++) {
    resolutions.push(180 / (256 * Math.pow(2, z)));
    matrixIds.push(z.toString());
  }

  const tileGrid = new WMTSTileGrid({
    origin: [-180, 90],
    resolutions,
    matrixIds,
    tileSize: [256, 256],
    extent: [-180, -90, 180, 90],
  });

  return {
    url: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.jpg',
    layer: MOON_TREK_WMTS.defaultLayer,
    matrixSet: MOON_TREK_WMTS.defaultMatrixSet,
    format: MOON_TREK_WMTS.defaultFormat,
    style: MOON_TREK_WMTS.defaultStyle,
    projection: MOON_TREK_WMTS.crsCode,
    tileGrid,
    crossOrigin: 'anonymous',
    attributions: MOON_TREK_WMTS.attribution,
    requestEncoding: 'REST',
    wrapX: true,
  };
}

/**
 * Loads capabilities XML from NASA Moon Trek and parses it using OpenLayers.
 * Falls back to verified direct configuration if network or CORS error occurs.
 */
export async function loadMoonTrekCapabilities(): Promise<CapabilitiesFetchResult> {
  const parser = new WMTSCapabilities();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(MOON_TREK_WMTS.capabilitiesUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/xml, text/xml, */*',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} from Moon Trek WMTS server`);
    }

    const xmlText = await response.text();
    const capabilities = parser.read(xmlText);

    const wmtsOptions = optionsFromCapabilities(capabilities, {
      layer: MOON_TREK_WMTS.defaultLayer,
      matrixSet: MOON_TREK_WMTS.defaultMatrixSet,
      format: MOON_TREK_WMTS.defaultFormat,
      style: MOON_TREK_WMTS.defaultStyle,
      projection: MOON_TREK_WMTS.crsCode,
    });

    if (!wmtsOptions) {
      throw new Error('Could not derive WMTS options from GetCapabilities for layer ' + MOON_TREK_WMTS.defaultLayer);
    }

    // Ensure crossOrigin and attribution are configured
    wmtsOptions.crossOrigin = 'anonymous';
    wmtsOptions.attributions = MOON_TREK_WMTS.attribution;
    wmtsOptions.wrapX = true;

    return {
      options: wmtsOptions,
      fromLiveCapabilities: true,
      rawXml: xmlText,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown network error';
    console.warn('[MoonTrek] Failed to load live WMTSCapabilities.xml; falling back to direct configuration:', errMsg);

    return {
      options: createDirectWMTSOptions(),
      fromLiveCapabilities: false,
      error: errMsg,
    };
  }
}
