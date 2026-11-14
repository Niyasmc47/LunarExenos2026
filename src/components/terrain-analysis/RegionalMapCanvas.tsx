import React, { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import ImageLayer from 'ol/layer/Image.js';
import Static from 'ol/source/ImageStatic.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import { defaults as defaultControls } from 'ol/control.js';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { useLocationStore } from '../../stores/locationStore';
import { createMoonTrekLayer, LUNAR_PROJECTION } from '../lunar-map/WmtsLayer';
import { createMarkerLayer } from '../lunar-map/MapMarker';
import { clampLatitude, normalizeLongitude } from '../../utils/lunarCoordinates';
import { inspectTerrainPoint } from '../../services/dynamicAnalysisApi';
import { Ruler } from 'lucide-react';

export const RegionalMapCanvas: React.FC = () => {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const overlayLayerRef = useRef<ImageLayer<Static> | null>(null);
  const markerUpdaterRef = useRef<((lon: number, lat: number) => void) | null>(null);
  const lineSourceRef = useRef<VectorSource | null>(null);

  const selectedRegionBbox = useDynamicAnalysisStore((state) => state.selectedRegionBbox);
  const activeDatasetId = useDynamicAnalysisStore((state) => state.activeDatasetId);
  const activeLayerMode = useDynamicAnalysisStore((state) => state.activeLayerMode);
  const setActiveLayerMode = useDynamicAnalysisStore((state) => state.setActiveLayerMode);
  const activeColormap = useDynamicAnalysisStore((state) => state.activeColormap);
  const hillshadeAzimuth = useDynamicAnalysisStore((state) => state.hillshadeAzimuth);
  const hillshadeAltitude = useDynamicAnalysisStore((state) => state.hillshadeAltitude);
  const hillshadeZFactor = useDynamicAnalysisStore((state) => state.hillshadeZFactor);

  const selectedLatitude = useLocationStore((state) => state.selectedLatitude);
  const selectedLongitude = useLocationStore((state) => state.selectedLongitude);
  const setSelectedCoordinates = useLocationStore((state) => state.setSelectedCoordinates);

  const setCurrentPointTelemetry = useDynamicAnalysisStore((state) => state.setCurrentPointTelemetry);
  const transectStart = useDynamicAnalysisStore((state) => state.transectStart);
  const transectEnd = useDynamicAnalysisStore((state) => state.transectEnd);
  const setTransectLine = useDynamicAnalysisStore((state) => state.setTransectLine);
  const isDrawingTransect = useDynamicAnalysisStore((state) => state.isDrawingTransect);
  const setIsDrawingTransect = useDynamicAnalysisStore((state) => state.setIsDrawingTransect);

  const [drawStep, setDrawStep] = useState<'none' | 'first'>('none');
  const [firstPt, setFirstPt] = useState<{ lat: number; lon: number } | null>(null);

  // Helper to build dynamic raster URL
  const getDynamicRasterUrl = () => {
    if (activeLayerMode === 'elevation') {
      return `http://127.0.0.1:8000/api/regional/elevation-map.png`;
    } else if (activeLayerMode === 'slope') {
      return `http://127.0.0.1:8000/api/regional/slope-map.png`;
    } else {
      return `http://127.0.0.1:8000/api/regional/hillshade.png`;
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapElementRef.current) return;

    let mapInstance: Map | null = null;

    try {
      const wmts = createMoonTrekLayer(() => {}, () => {}, () => {});

      const extent: [number, number, number, number] = [
        selectedRegionBbox.minLon,
        selectedRegionBbox.minLat,
        selectedRegionBbox.maxLon,
        selectedRegionBbox.maxLat,
      ];

      const overlay = new ImageLayer({
        source: new Static({
          url: getDynamicRasterUrl(),
          imageExtent: extent,
          projection: LUNAR_PROJECTION,
        }),
        opacity: 0.88,
        zIndex: 50,
      });
      overlayLayerRef.current = overlay;

      // Transect Line Source
      const lineSource = new VectorSource();
      lineSourceRef.current = lineSource;

      const lineLayer = new VectorLayer({
        source: lineSource,
        zIndex: 80,
        style: new Style({
          stroke: new Stroke({ color: '#10b981', width: 3, lineDash: [6, 4] }),
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: '#10b981' }),
            stroke: new Stroke({ color: '#ffffff', width: 1.5 }),
          }),
        }),
      });

      // Reticle Marker
      const { layer: markerLayer, updatePosition } = createMarkerLayer(selectedLongitude, selectedLatitude);
      markerUpdaterRef.current = updatePosition;

      const centerLon = (selectedRegionBbox.minLon + selectedRegionBbox.maxLon) / 2.0;
      const centerLat = (selectedRegionBbox.minLat + selectedRegionBbox.maxLat) / 2.0;

      const view = new View({
        projection: LUNAR_PROJECTION,
        center: [centerLon, centerLat],
        zoom: 6.2,
        minZoom: 4.0,
        maxZoom: 10.0,
        extent: [-180, -90, 180, 90],
      });

      mapInstance = new Map({
        target: mapElementRef.current,
        layers: [wmts, overlay, lineLayer, markerLayer],
        view,
        controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      });

      // Map singleclick handler
      mapInstance.on('singleclick', (evt) => {
        if (!evt.coordinate || evt.coordinate.length < 2) return;
        const lon = normalizeLongitude(evt.coordinate[0]);
        const lat = clampLatitude(evt.coordinate[1]);

        if (isDrawingTransect) {
          if (drawStep === 'none' || !firstPt) {
            setFirstPt({ lat, lon });
            setDrawStep('first');
          } else {
            setTransectLine(firstPt, { lat, lon });
            setDrawStep('none');
            setFirstPt(null);
            setIsDrawingTransect(false);
          }
          return;
        }

        setSelectedCoordinates(lat, lon, 'map');
        inspectTerrainPoint(lat, lon, activeDatasetId).then((pt) => {
          if (pt) setCurrentPointTelemetry(pt);
        });
      });

      mapRef.current = mapInstance;

      requestAnimationFrame(() => mapInstance?.updateSize());
    } catch (err) {
      console.error('Failed to initialize RegionalMapCanvas:', err);
    }

    return () => {
      if (mapInstance) mapInstance.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  // Update overlay source when bbox, dataset, colormap, or hillshade params change
  useEffect(() => {
    if (!overlayLayerRef.current) return;

    const extent: [number, number, number, number] = [
      selectedRegionBbox.minLon,
      selectedRegionBbox.minLat,
      selectedRegionBbox.maxLon,
      selectedRegionBbox.maxLat,
    ];

    overlayLayerRef.current.setSource(
      new Static({
        url: getDynamicRasterUrl(),
        imageExtent: extent,
        projection: LUNAR_PROJECTION,
      })
    );

    // Pan map to new center
    if (mapRef.current) {
      const centerLon = (selectedRegionBbox.minLon + selectedRegionBbox.maxLon) / 2.0;
      const centerLat = (selectedRegionBbox.minLat + selectedRegionBbox.maxLat) / 2.0;
      mapRef.current.getView().animate({ center: [centerLon, centerLat], duration: 400 });
    }
  }, [selectedRegionBbox, activeDatasetId, activeLayerMode, activeColormap, hillshadeAzimuth, hillshadeAltitude, hillshadeZFactor]);

  // Update transect line graphics
  useEffect(() => {
    if (!lineSourceRef.current) return;
    lineSourceRef.current.clear();

    if (transectStart && transectEnd) {
      const geom = new LineString([
        [transectStart.lon, transectStart.lat],
        [transectEnd.lon, transectEnd.lat],
      ]);
      lineSourceRef.current.addFeature(new Feature({ geometry: geom }));
      lineSourceRef.current.addFeature(new Feature({ geometry: new Point([transectStart.lon, transectStart.lat]) }));
      lineSourceRef.current.addFeature(new Feature({ geometry: new Point([transectEnd.lon, transectEnd.lat]) }));
    }
  }, [transectStart, transectEnd]);

  // Sync marker position
  useEffect(() => {
    if (markerUpdaterRef.current) markerUpdaterRef.current(selectedLongitude, selectedLatitude);
  }, [selectedLatitude, selectedLongitude]);

  return (
    <div className="relative w-full h-full bg-[#05080e] border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col group">
      {/* Top Layer Tabs */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 bg-[#0c121e]/90 backdrop-blur-md p-1 rounded-lg border border-slate-700/60 pointer-events-auto text-xs font-mono">
          <button
            onClick={() => setActiveLayerMode('elevation')}
            className={`px-3 py-1 rounded font-bold transition-all ${
              activeLayerMode === 'elevation'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ELEVATION
          </button>
          <button
            onClick={() => setActiveLayerMode('slope')}
            className={`px-3 py-1 rounded font-bold transition-all ${
              activeLayerMode === 'slope'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SLOPE
          </button>
          <button
            onClick={() => setActiveLayerMode('hillshade')}
            className={`px-3 py-1 rounded font-bold transition-all ${
              activeLayerMode === 'hillshade'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            HILLSHADE
          </button>
        </div>

        {/* Action Tools */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => {
              setIsDrawingTransect(!isDrawingTransect);
              setDrawStep('none');
              setFirstPt(null);
            }}
            title={isDrawingTransect ? 'Cancel transect' : 'Click two points on map to draw elevation transect'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              isDrawingTransect
                ? 'bg-emerald-500 text-black shadow-lg animate-pulse'
                : 'bg-[#0c121e]/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-emerald-400'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>{isDrawingTransect ? 'DRAWING TRANSECT...' : 'DRAW TRANSECT'}</span>
          </button>
        </div>
      </div>

      {/* Drawing Mode Prompt Banner */}
      {isDrawingTransect && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 px-3.5 py-1.5 rounded-lg text-xs font-mono shadow-xl backdrop-blur-sm flex items-center gap-2">
          <Ruler className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>
            {drawStep === 'none'
              ? 'Click START POINT on map for profile transect'
              : 'Click END POINT on map to complete transect'}
          </span>
        </div>
      )}

      {/* Map Element */}
      <div ref={mapElementRef} className="flex-1 w-full h-full min-h-0 bg-[#020408]" />

      {/* Bottom Context Legend */}
      <div className="absolute bottom-2 left-3 right-3 z-20 pointer-events-none bg-[#0c121e]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800">
        {activeLayerMode === 'elevation' ? (
          <div className="text-[10px] font-mono text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>-520 m (Deep Basins)</span>
              <span>+1,140 m (Mean)</span>
              <span>+1,960 m (Ridge Peaks)</span>
            </div>
            <div
              className="h-2 rounded w-full"
              style={{
                background: 'linear-gradient(to right, #1d0e40, #2b4984, #1b8770, #4db150, #d6d338, #ffffff)',
              }}
            />
          </div>
        ) : activeLayerMode === 'slope' ? (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 text-[9px] font-mono text-center">
            <div className="bg-emerald-500 text-black px-1 py-0.5 rounded font-bold">0–5° Safe</div>
            <div className="bg-emerald-400 text-black px-1 py-0.5 rounded font-bold">5–10° Fav</div>
            <div className="bg-amber-400 text-black px-1 py-0.5 rounded font-bold">10–15° Mod</div>
            <div className="bg-orange-500 text-black px-1 py-0.5 rounded font-bold">15–20° Ste</div>
            <div className="bg-rose-500 text-white px-1 py-0.5 rounded font-bold">20–25° Tilt</div>
            <div className="bg-red-700 text-white px-1 py-0.5 rounded font-bold">25–30° Haz</div>
            <div className="bg-pink-900 text-white px-1 py-0.5 rounded font-bold">&gt;30° Wall</div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>CARTOGRAPHIC HILLSHADE: Azimuth {hillshadeAzimuth.toFixed(0)}°, Altitude {hillshadeAltitude.toFixed(0)}°</span>
            <span className="text-amber-400">Z-Factor {hillshadeZFactor.toFixed(1)}×</span>
          </div>
        )}
      </div>
    </div>
  );
};
