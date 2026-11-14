import React, { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import { defaults as defaultControls } from 'ol/control.js';
import { useLocationStore } from '../../stores/locationStore';
import { createMoonTrekLayer, LUNAR_PROJECTION } from './WmtsLayer';
import { createMarkerLayer } from './MapMarker';
import { clampLatitude, normalizeLongitude, formatCoordinates } from '../../utils/lunarCoordinates';
import { Compass, Crosshair, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';

export const LunarMap: React.FC = () => {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerUpdaterRef = useRef<((lon: number, lat: number) => void) | null>(null);

  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const selectedLatitude = useLocationStore((state) => state.selectedLatitude);
  const selectedLongitude = useLocationStore((state) => state.selectedLongitude);
  const selectedLocationSource = useLocationStore((state) => state.selectedLocationSource);
  const setSelectedCoordinates = useLocationStore((state) => state.setSelectedCoordinates);

  const mapLoading = useLocationStore((state) => state.mapLoading);
  const mapError = useLocationStore((state) => state.mapError);
  const liveCapabilitiesActive = useLocationStore((state) => state.liveCapabilitiesActive);
  const setMapLoading = useLocationStore((state) => state.setMapLoading);
  const setMapError = useLocationStore((state) => state.setMapError);
  const setLiveCapabilitiesActive = useLocationStore((state) => state.setLiveCapabilitiesActive);

  // Initialize Map
  useEffect(() => {
    if (!mapElementRef.current) return;

    let mapInstance: Map | null = null;
    let resizeObserver: ResizeObserver | null = null;

    try {
      const wmtsLayer = createMoonTrekLayer(
        (loading) => setMapLoading(loading),
        (err) => setMapError(err),
        (active) => setLiveCapabilitiesActive(active)
      );

      const { layer: markerLayer, updatePosition } = createMarkerLayer(
        selectedLongitude,
        selectedLatitude
      );
      markerUpdaterRef.current = updatePosition;

      const view = new View({
        projection: LUNAR_PROJECTION,
        center: [selectedLongitude, selectedLatitude],
        zoom: 1.5,
        minZoom: 0.5,
        maxZoom: 8,
        extent: [-180, -90, 180, 90],
        constrainResolution: false,
      });

      mapInstance = new Map({
        target: mapElementRef.current,
        layers: [wmtsLayer, markerLayer],
        view,
        controls: defaultControls({
          zoom: false,
          rotate: false,
          attribution: false,
        }),
      });

      // ResizeObserver ensures OpenLayers always updates when container size is computed
      resizeObserver = new ResizeObserver(() => {
        if (mapInstance) {
          mapInstance.updateSize();
        }
      });
      resizeObserver.observe(mapElementRef.current);

      // Force immediate resize updates on mount and after layout settles
      requestAnimationFrame(() => mapInstance?.updateSize());
      setTimeout(() => mapInstance?.updateSize(), 50);
      setTimeout(() => mapInstance?.updateSize(), 200);

      // Click handler: select lunar coordinate
      mapInstance.on('singleclick', (evt) => {
        const rawCoords = evt.coordinate;
        if (!rawCoords || rawCoords.length < 2) return;

        const lon = normalizeLongitude(rawCoords[0]);
        const lat = clampLatitude(rawCoords[1]);

        setSelectedCoordinates(lat, lon, 'map');
      });

      // Pointer move handler for coordinate readout
      mapInstance.on('pointermove', (evt) => {
        if (evt.dragging) {
          setHoverCoords(null);
          return;
        }
        const rawCoords = evt.coordinate;
        if (rawCoords && rawCoords.length >= 2) {
          const lon = normalizeLongitude(rawCoords[0]);
          const lat = clampLatitude(rawCoords[1]);
          setHoverCoords({ lat, lon });
        } else {
          setHoverCoords(null);
        }
      });

      mapInstance.getView().on('change:resolution', () => {
        const z = mapInstance?.getView().getZoom();
        if (z !== undefined) {
          setZoomLevel(Math.round(z * 10) / 10);
        }
      });

      mapRef.current = mapInstance;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize OpenLayers map';
      setMapError(msg);
      setMapLoading(false);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstance) {
        mapInstance.setTarget(undefined);
      }
      mapRef.current = null;
    };
  }, []);

  // Sync marker position when store coordinates update
  useEffect(() => {
    if (markerUpdaterRef.current) {
      markerUpdaterRef.current(selectedLongitude, selectedLatitude);
    }

    // Pan map smoothly if selection was triggered by the 3D globe or manual preset
    if (mapRef.current && (selectedLocationSource === 'globe' || selectedLocationSource === 'preset')) {
      const view = mapRef.current.getView();
      view.animate({
        center: [selectedLongitude, selectedLatitude],
        duration: 400,
      });
    }
  }, [selectedLatitude, selectedLongitude, selectedLocationSource]);

  // Map control buttons
  const handleZoomIn = () => {
    if (!mapRef.current) return;
    const view = mapRef.current.getView();
    const currentZoom = view.getZoom() || 1;
    view.animate({ zoom: Math.min(8, currentZoom + 1), duration: 250 });
  };

  const handleZoomOut = () => {
    if (!mapRef.current) return;
    const view = mapRef.current.getView();
    const currentZoom = view.getZoom() || 1;
    view.animate({ zoom: Math.max(0.5, currentZoom - 1), duration: 250 });
  };

  const handleRecenter = () => {
    if (!mapRef.current) return;
    const view = mapRef.current.getView();
    view.animate({
      center: [selectedLongitude, selectedLatitude],
      duration: 350,
    });
  };

  const handleResetWorldView = () => {
    if (!mapRef.current) return;
    const view = mapRef.current.getView();
    view.animate({
      center: [0, 0],
      zoom: 1,
      duration: 400,
    });
  };

  return (
    <div className="relative w-full h-full min-h-[300px] flex flex-col bg-[#070b11] border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl shadow-black/60 group">
      {/* Top HUD Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-[#0c121e]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-lg pointer-events-auto">
          <Compass className="w-4 h-4 text-emerald-400 animate-spin-slow" />
          <span className="text-xs font-semibold tracking-wider text-slate-200 uppercase font-mono">
            2D LUNAR MAP (LRO WAC 100M)
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {mapLoading && (
            <div className="flex items-center gap-1.5 bg-[#0c121e]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/60 text-[11px] font-mono text-emerald-400 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>FETCHING TILES...</span>
            </div>
          )}
          <div className="bg-[#0c121e]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/60 text-[11px] font-mono text-slate-300">
            TREK: <span className={liveCapabilitiesActive ? "text-emerald-400" : "text-amber-400"}>{liveCapabilitiesActive ? "LIVE XML" : "DIRECT"}</span>
          </div>
          <div className="bg-[#0c121e]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/60 text-[11px] font-mono text-slate-300">
            CRS: <span className="text-emerald-400">EPSG:104903</span>
          </div>
          <div className="bg-[#0c121e]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/60 text-[11px] font-mono text-slate-300">
            ZOOM: <span className="text-emerald-400">{zoomLevel}x</span>
          </div>
        </div>
      </div>

      {/* OpenLayers Map Canvas Container */}
      <div ref={mapElementRef} className="w-full h-full min-h-[300px] cursor-crosshair" />

      {/* Floating Map Zoom / Recenter Controls */}
      <div className="absolute right-3 top-16 z-20 flex flex-col gap-1.5 bg-[#0c121e]/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700/60 shadow-lg">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-2 text-slate-300 hover:text-emerald-400 hover:bg-slate-800/80 rounded transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-2 text-slate-300 hover:text-emerald-400 hover:bg-slate-800/80 rounded transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-px bg-slate-700/80 my-0.5" />
        <button
          onClick={handleRecenter}
          title="Recenter on Selected Coordinates"
          className="p-2 text-slate-300 hover:text-emerald-400 hover:bg-slate-800/80 rounded transition-colors"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetWorldView}
          title="Fit Global Moon View"
          className="p-2 text-slate-300 hover:text-emerald-400 hover:bg-slate-800/80 rounded transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Status / Coordinate HUD */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none text-xs">
        <div className="bg-[#0c121e]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-slate-300 font-mono shadow-lg pointer-events-auto flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
          <span>SELECTED:</span>
          <span className="text-emerald-400 font-semibold">
            {formatCoordinates({ latitude: selectedLatitude, longitude: selectedLongitude })}
          </span>
          {hoverCoords && (
            <span className="text-slate-400 pl-2 border-l border-slate-700">
              CURSOR: {formatCoordinates({ latitude: hoverCoords.lat, longitude: hoverCoords.lon })}
            </span>
          )}
        </div>

        <div className="bg-[#0c121e]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/60 text-[10px] text-slate-400 font-mono pointer-events-auto">
          NASA / GSFC / ASU / JPL / Moon Trek
        </div>
      </div>

      {/* Error Alert */}
      {mapError && (
        <div className="absolute top-16 left-3 right-3 z-30 flex items-center gap-2 bg-red-950/90 border border-red-700/70 text-red-200 px-3 py-2 rounded-lg text-xs font-mono backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{mapError}</span>
        </div>
      )}
    </div>
  );
};
