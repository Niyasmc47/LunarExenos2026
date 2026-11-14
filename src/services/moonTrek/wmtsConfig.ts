import { WmtsLayerInfo } from '../../types/lunar';

/**
 * NASA Moon Trek WMTS endpoints and defaults.
 * Verified against live GetCapabilities XML on trek.nasa.gov.
 */
export const MOON_TREK_WMTS = {
  baseUrl: 'https://trek.nasa.gov',
  capabilitiesUrl: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/WMTSCapabilities.xml',
  defaultLayer: 'LRO_WAC_Mosaic_Global_303ppd_v02',
  defaultStyle: 'default',
  defaultFormat: 'image/jpeg',
  defaultMatrixSet: 'default028mm',
  crs: 'urn:ogc:def:crs:EPSG::104903',
  crsCode: 'EPSG:104903',
  extent: [-180, -90, 180, 90] as [number, number, number, number],
  attribution: 'Imagery: NASA / GSFC / ASU / JPL / Moon Trek',
  tileUrlTemplate:
    'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.jpg',
};

/**
 * Fallback static layer specification in case GetCapabilities XML fails or times out.
 */
export const FALLBACK_LRO_WAC_LAYER: WmtsLayerInfo = {
  identifier: 'LRO_WAC_Mosaic_Global_303ppd_v02',
  title: 'LRO WAC Global Mosaic (100m, Feb 2014 v2)',
  format: 'image/jpeg',
  style: 'default',
  tileMatrixSet: 'default028mm',
  crs: 'urn:ogc:def:crs:EPSG::104903',
  bbox: [-180, -90, 180, 90],
  tileMatrixList: [
    { identifier: '0', scaleDenominator: 2.79227636e8, matrixWidth: 2, matrixHeight: 1, tileWidth: 256, tileHeight: 256, topLeftCorner: [-180, 90] },
    { identifier: '1', scaleDenominator: 1.39613818e8, matrixWidth: 4, matrixHeight: 2, tileWidth: 256, tileHeight: 256, topLeftCorner: [-180, 90] },
    { identifier: '2', scaleDenominator: 6.98069091e7, matrixWidth: 8, matrixHeight: 4, tileWidth: 256, tileHeight: 256, topLeftCorner: [-180, 90] },
    { identifier: '3', scaleDenominator: 3.49034545e7, matrixWidth: 16, matrixHeight: 8, tileWidth: 256, tileHeight: 256, topLeftCorner: [-180, 90] },
    { identifier: '4', scaleDenominator: 1.74517273e7, matrixWidth: 32, matrixHeight: 16, tileWidth: 256, tileHeight: 256, topLeftCorner: [-180, 90] },
    { identifier: '5', scaleDenominator: 8.72586363e6, matrixWidth: 64, matrixHeight: 32, tileWidth: 256, tileHeight: 256, topLeftCorner: [-180, 90] },
    { identifier: '6', scaleDenominator: 4.36293182e6, matrixWidth: 128, matrixHeight: 64, tileWidth: 256, tileHeight: 256, topLeftCorner: [-180, 90] },
    { identifier: '7', scaleDenominator: 2.18146591e6, matrixWidth: 256, matrixHeight: 128, tileWidth: 256, tileHeight: 256, topLeftCorner: [-180, 90] },
    { identifier: '8', scaleDenominator: 1.09073295e6, matrixWidth: 512, matrixHeight: 256, tileWidth: 256, tileHeight: 256, topLeftCorner: [-180, 90] },
  ],
  resourceUrlTemplate: MOON_TREK_WMTS.tileUrlTemplate,
};

/**
 * Returns direct tile URL for given zoom, row, and col.
 */
export function getMoonTrekTileUrl(zoom: number, row: number, col: number): string {
  return `https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/${zoom}/${row}/${col}.jpg`;
}
