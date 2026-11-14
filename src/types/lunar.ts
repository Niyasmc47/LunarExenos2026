export interface LunarCoordinates {
  latitude: number;   // -90 to +90 degrees (decimal)
  longitude: number;  // -180 to +180 degrees (decimal)
}

export type LocationSource = 'map' | 'globe' | 'manual' | 'preset' | 'initial' | 'terrain';

export type AppScreen = 'lunar-explorer' | 'terrain-explorer';

export type ActiveView = 'split' | '3d' | '2d';

export interface PresetLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  category: 'apollo' | 'artemis' | 'robotic' | 'feature';
}

export interface WmtsLayerInfo {
  identifier: string;
  title: string;
  format: string;
  style: string;
  tileMatrixSet: string;
  crs: string;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  tileMatrixList: {
    identifier: string;
    scaleDenominator: number;
    matrixWidth: number;
    matrixHeight: number;
    tileWidth: number;
    tileHeight: number;
    topLeftCorner: [number, number];
  }[];
  resourceUrlTemplate: string;
}
