import React, { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import ImageLayer from 'ol/layer/Image.js';
import Static from 'ol/source/ImageStatic.js';
import { defaults as defaultControls } from 'ol/control.js';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { useLocationStore } from '../../stores/locationStore';
import { createMoonTrekLayer, LUNAR_PROJECTION } from '../lunar-map/WmtsLayer';
import { createMarkerLayer } from '../lunar-map/MapMarker';
import { clampLatitude, normalizeLongitude, formatCoordinates } from '../../utils/lunarCoordinates';
import { inspectTerrainPoint } from '../../services/dynamicAnalysisApi';
import { RotateCcw, MapPin, Mountain, ZoomIn, ZoomOut } from 'lucide-react';

const SITE01_EXTENT = [-171.4692, -89.8351, -101.8887, -89.0903] as [number, number, number, number];

export const SouthPoleDualMaps: React.FC = () => {
  const elevElementRef = useRef<HTMLDivElement>(null);
  const slopeElementRef = useRef<HTMLDivElement>(null);

  const elevMapRef = useRef<Map | null>(null);
  const slopeMapRef = useRef<Map | null>(null);

  const elevMarkerUpdaterRef = useRef<((lon: number, lat: number) => void) | null>(null);
  const slopeMarkerUpdaterRef = useRef<((lon: number, lat: number) => void) | null>(null);
  const elevOverlayRef = useRef<ImageLayer<Static> | null>(null);

  const selectedLatitude = useLocationStore((state) => state.selectedLatitude);
  const selectedLongitude = useLocationStore((state) => state.selectedLongitude);
  const setSelectedCoordinates = useLocationStore((state) => state.setSelectedCoordinates);

  const setCurrentPointTelemetry = useDynamicAnalysisStore((state) => state.setCurrentPointTelemetry);
  const currentPointTelemetry = useDynamicAnalysisStore((state) => state.currentPointTelemetry);
  const activeColormap = useDynamicAnalysisStore((state) => state.activeColormap);
  const setActiveColormap = useDynamicAnalysisStore((state) => state.setActiveColormap);

  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Initialize both synchronized maps
  useEffect(() => {
    if (!elevElementRef.current || !slopeElementRef.current) return;

    let elevMapInstance: Map | null = null;
    let slopeMapInstance: Map | null = null;

    try {
      // Shared initial view configuration for South Pole
      const sharedView = new View({
        projection: LUNAR_PROJECTION,
        center: [-137.4896, -89.4632],
        zoom: 6.2,
        minZoom: 3.5,
        maxZoom: 16.0,
        extent: [-180, -90, 180, 90],
      });

      const slopeView = new View({
        projection: LUNAR_PROJECTION,
        center: [-137.4896, -89.4632],
        zoom: 6.2,
        minZoom: 3.5,
        maxZoom: 16.0,
        extent: [-180, -90, 180, 90],
      });

      // 1. Elevation Map setup
      const elevWmts = createMoonTrekLayer(() => {}, () => {}, () => {});
      const elevOverlay = new ImageLayer({
        source: new Static({
          url: 'http://127.0.0.1:8000/api/regional/elevation-map.png',
          imageExtent: SITE01_EXTENT,
          projection: LUNAR_PROJECTION,
        }),
        opacity: 0.88,
        zIndex: 50,
      });
      const { layer: elevMarkerLayer, updatePosition: updateElevMarker } = createMarkerLayer(
        selectedLongitude,
        selectedLatitude
      );
      elevMarkerUpdaterRef.current = updateElevMarker;

      elevOverlayRef.current = elevOverlay;
      elevMapInstance = new Map({
        target: elevElementRef.current,
        layers: [elevWmts, elevOverlay, elevMarkerLayer],
        view: sharedView,
        controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      });

      // 2. Slope Map setup
      const slopeWmts = createMoonTrekLayer(() => {}, () => {}, () => {});
      const slopeOverlay = new ImageLayer({
        source: new Static({
          url: 'http://127.0.0.1:8000/api/regional/slope-map.png',
          imageExtent: SITE01_EXTENT,
          projection: LUNAR_PROJECTION,
        }),
        opacity: 0.88,
        zIndex: 50,
      });
      const { layer: slopeMarkerLayer, updatePosition: updateSlopeMarker } = createMarkerLayer(
        selectedLongitude,
        selectedLatitude
      );
      slopeMarkerUpdaterRef.current = updateSlopeMarker;

      slopeMapInstance = new Map({
        target: slopeElementRef.current,
        layers: [slopeWmts, slopeOverlay, slopeMarkerLayer],
        view: slopeView,
        controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      });

      // Bidirectional pan & zoom synchronization between both views
      let isSyncing = false;

      sharedView.on(['change:center', 'change:resolution'], () => {
        if (isSyncing) return;
        isSyncing = true;
        slopeView.setCenter(sharedView.getCenter());
        slopeView.setResolution(sharedView.getResolution());
        isSyncing = false;
      });

      slopeView.on(['change:center', 'change:resolution'], () => {
        if (isSyncing) return;
        isSyncing = true;
        sharedView.setCenter(slopeView.getCenter());
        sharedView.setResolution(slopeView.getResolution());
        isSyncing = false;
      });

      // Click handling on either map
      const handlePointClick = (rawCoords: number[]) => {
        if (!rawCoords || rawCoords.length < 2) return;
        const lon = normalizeLongitude(rawCoords[0]);
        const lat = clampLatitude(rawCoords[1]);

        setSelectedCoordinates(lat, lon, 'map');
        inspectTerrainPoint(lat, lon, 'site01').then((pt) => {
          if (pt) setCurrentPointTelemetry(pt);
        });
      };

      elevMapInstance.on('singleclick', (evt) => handlePointClick(evt.coordinate));
      slopeMapInstance.on('singleclick', (evt) => handlePointClick(evt.coordinate));

      // Pointer move tracking
      elevMapInstance.on('pointermove', (evt) => {
        if (evt.coordinate && evt.coordinate.length >= 2) {
          setHoverCoords({
            lat: clampLatitude(evt.coordinate[1]),
            lon: normalizeLongitude(evt.coordinate[0]),
          });
        }
      });

      elevMapRef.current = elevMapInstance;
      slopeMapRef.current = slopeMapInstance;

      // Force size update
      requestAnimationFrame(() => {
        elevMapInstance?.updateSize();
        slopeMapInstance?.updateSize();
      });
    } catch (err) {
      console.error('Failed to initialize SouthPoleDualMaps:', err);
    }

    return () => {
      if (elevMapInstance) elevMapInstance.setTarget(undefined);
      if (slopeMapInstance) slopeMapInstance.setTarget(undefined);
      elevMapRef.current = null;
      slopeMapRef.current = null;
    };
  }, []);

  // Sync marker positions on coordinate updates
  useEffect(() => {
    if (elevMarkerUpdaterRef.current) elevMarkerUpdaterRef.current(selectedLongitude, selectedLatitude);
    if (slopeMarkerUpdaterRef.current) slopeMarkerUpdaterRef.current(selectedLongitude, selectedLatitude);
  }, [selectedLatitude, selectedLongitude]);

  // Update elevation colormap dynamically
  useEffect(() => {
    if (!elevOverlayRef.current) return;
    elevOverlayRef.current.setSource(
      new Static({
        url: `http://127.0.0.1:8000/api/regional/elevation-map.png?dataset_id=site01&colormap_name=${activeColormap}`,
        imageExtent: SITE01_EXTENT,
        projection: LUNAR_PROJECTION,
      })
    );
  }, [activeColormap]);

  const handleZoomIn = () => {
    if (!elevMapRef.current) return;
    const v = elevMapRef.current.getView();
    v.animate({ zoom: Math.min(16.0, (v.getZoom() || 6.2) + 0.8), duration: 250 });
  };

  const handleZoomOut = () => {
    if (!elevMapRef.current) return;
    const v = elevMapRef.current.getView();
    v.animate({ zoom: Math.max(3.5, (v.getZoom() || 6.2) - 0.8), duration: 250 });
  };

  const handleResetBoth = () => {
    if (!elevMapRef.current) return;
    elevMapRef.current.getView().animate({
      center: [-137.4896, -89.4632],
      zoom: 6.2,
      duration: 400,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
      {/* Top Controls Strip */}
      <div className="shrink-0 flex items-center justify-between bg-[#141619] border border-[#2b2d32] px-3 py-1.5 rounded-xl text-xs font-mono">
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200 uppercase tracking-wider">
            SOUTH POLE SYNCHRONIZED TERRAIN MAPPING
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            5M LOLA DEM
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-slate-400 hidden sm:flex">
            <span>COLORMAP:</span>
            {(['hypsometric', 'turbo', 'viridis', 'magma'] as const).map((cmap) => (
              <button
                key={cmap}
                onClick={() => setActiveColormap(cmap)}
                className={`px-2 py-0.5 rounded uppercase text-[10px] transition-colors ${
                  activeColormap === cmap
                    ? 'bg-emerald-500 text-black font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cmap}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border-l border-[#2b2d32] pl-2">
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1 rounded bg-[#0e1013] hover:bg-slate-800 border border-[#303238] text-slate-300 hover:text-emerald-400 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1 rounded bg-[#0e1013] hover:bg-slate-800 border border-[#303238] text-slate-300 hover:text-emerald-400 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleResetBoth}
            title="Recenter both maps to Connecting Ridge"
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0e1013] hover:bg-slate-800 border border-[#303238] text-slate-300 hover:text-emerald-400 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RECENTER</span>
          </button>
        </div>
      </div>

      {/* Side-by-side Dual Map Viewports */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 min-h-0 overflow-hidden">
        {/* LEFT: ELEVATION MAP */}
        <div className="relative w-full h-full bg-[#05080e] border border-[#2b2d32] rounded-xl overflow-hidden shadow-2xl flex flex-col group">
          <div className="absolute top-2.5 left-3 z-20 flex items-center gap-2 bg-[#141619] backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#2b2d32] pointer-events-none">
            <span className="text-xs font-mono font-bold text-emerald-400">ELEVATION MAP (LOLA)</span>
            <span className="text-[10px] font-mono text-slate-400">DATUM: 1737.4 KM</span>
          </div>

          <div ref={elevElementRef} className="flex-1 w-full h-full min-h-0 bg-[#020408]" />

          {/* Elevation Color Legend */}
          <div className="absolute bottom-2 left-3 right-3 z-20 pointer-events-none bg-[#141619] backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#2b2d32]">
            <div className="text-[10px] font-mono text-slate-400 flex justify-between mb-1">
              <span>-520 m (Deep Basins)</span>
              <span>+1,140 m (Mean)</span>
              <span>+1,960 m (Ridge Crest)</span>
            </div>
            <div
              className="h-2 rounded w-full"
              style={{
                background: 'linear-gradient(to right, #1d0e40, #2b4984, #1b8770, #4db150, #d6d338, #ffffff)',
              }}
            />
          </div>
        </div>

        {/* RIGHT: SLOPE MAP */}
        <div className="relative w-full h-full bg-[#05080e] border border-[#2b2d32] rounded-xl overflow-hidden shadow-2xl flex flex-col group">
          <div className="absolute top-2.5 left-3 z-20 flex items-center gap-2 bg-[#141619] backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#2b2d32] pointer-events-none">
            <span className="text-xs font-mono font-bold text-amber-400">SLOPE MAP (LANDING HAZARDS)</span>
            <span className="text-[10px] font-mono text-slate-400">7-TIER CLASSIFICATION</span>
          </div>

          <div ref={slopeElementRef} className="flex-1 w-full h-full min-h-0 bg-[#020408]" />

          {/* Slope Legend */}
          <div className="absolute bottom-2 left-3 right-3 z-20 pointer-events-none bg-[#141619] backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-[#2b2d32]">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 text-[9px] font-mono text-center">
              <div className="bg-emerald-500 text-black px-1 py-0.5 rounded font-bold">0–5° Safe</div>
              <div className="bg-emerald-400 text-black px-1 py-0.5 rounded font-bold">5–10° Fav</div>
              <div className="bg-amber-400 text-black px-1 py-0.5 rounded font-bold">10–15° Mod</div>
              <div className="bg-orange-500 text-black px-1 py-0.5 rounded font-bold">15–20° Ste</div>
              <div className="bg-rose-500 text-white px-1 py-0.5 rounded font-bold">20–25° Tilt</div>
              <div className="bg-red-700 text-white px-1 py-0.5 rounded font-bold">25–30° Haz</div>
              <div className="bg-pink-900 text-white px-1 py-0.5 rounded font-bold">&gt;30° Wall</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Telemetry Readout Bar */}
      <div className="shrink-0 flex items-center justify-between bg-[#141619] border border-[#2b2d32] px-3 py-1.5 rounded-xl text-xs font-mono">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400 text-[11px]">SELECTED:</span>
          <span className="text-emerald-400 font-bold">
            {formatCoordinates({ latitude: selectedLatitude, longitude: selectedLongitude }, 3)}
          </span>
          {currentPointTelemetry?.in_bounds && typeof currentPointTelemetry.elevation_m === 'number' && (
            <span className="text-slate-200 border-l border-[#303238] pl-2">
              ELEV: <strong className="text-emerald-400">{currentPointTelemetry.elevation_m > 0 ? '+' : ''}{currentPointTelemetry.elevation_m} m</strong>
              {currentPointTelemetry.slope_deg !== null && currentPointTelemetry.slope_deg !== undefined && (
                <span className="ml-2 text-amber-400 font-semibold">({currentPointTelemetry.slope_deg}° slope)</span>
              )}
            </span>
          )}
        </div>

        {hoverCoords && (
          <div className="text-slate-500 text-[11px] hidden sm:block">
            CURSOR: {formatCoordinates({ latitude: hoverCoords.lat, longitude: hoverCoords.lon }, 3)}
          </div>
        )}
      </div>
    </div>
  );
};
