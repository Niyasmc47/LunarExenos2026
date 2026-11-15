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
import { useLocationStore } from '../../stores/locationStore';
import { createMoonTrekLayer, LUNAR_PROJECTION } from '../lunar-map/WmtsLayer';
import { createMarkerLayer } from '../lunar-map/MapMarker';
import { clampLatitude, normalizeLongitude, formatCoordinates } from '../../utils/lunarCoordinates';
import { fetchElevationPoint, getOverlayImageUrl } from '../../services/terrainApi';
import {
  Layers,
  RotateCcw,
  MapPin,
  Ruler
} from 'lucide-react';

const SITE01_EXTENT = [-171.4692, -89.8351, -101.8887, -89.0903] as [number, number, number, number];

export const TerrainMap2D: React.FC = () => {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const overlayLayerRef = useRef<ImageLayer<Static> | null>(null);
  const markerUpdaterRef = useRef<((lon: number, lat: number) => void) | null>(null);
  const profileLineSourceRef = useRef<VectorSource | null>(null);

  const selectedLatitude = useLocationStore((state) => state.selectedLatitude);
  const selectedLongitude = useLocationStore((state) => state.selectedLongitude);
  const setSelectedCoordinates = useLocationStore((state) => state.setSelectedCoordinates);
  const setCurrentElevationData = useLocationStore((state) => state.setCurrentElevationData);
  const currentElevationData = useLocationStore((state) => state.currentElevationData);

  const elevationLayerVisible = useLocationStore((state) => state.elevationLayerVisible);
  const elevationLayerType = useLocationStore((state) => state.elevationLayerType);
  const setElevationLayerType = useLocationStore((state) => state.setElevationLayerType);
  const setElevationLayerVisible = useLocationStore((state) => state.setElevationLayerVisible);

  const profileStart = useLocationStore((state) => state.profileStart);
  const profileEnd = useLocationStore((state) => state.profileEnd);
  const setProfileLine = useLocationStore((state) => state.setProfileLine);
  const isDrawingProfile = useLocationStore((state) => state.isDrawingProfile);
  const setIsDrawingProfile = useLocationStore((state) => state.setIsDrawingProfile);

  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [clickStep, setClickStep] = useState<'none' | 'first'>('none');
  const [firstPoint, setFirstPoint] = useState<{ lat: number; lon: number } | null>(null);

  // Initialize Map focused on Site 01
  useEffect(() => {
    if (!mapElementRef.current) return;

    let mapInstance: Map | null = null;
    let resizeObserver: ResizeObserver | null = null;

    try {
      const wmtsLayer = createMoonTrekLayer(
        () => {},
        () => {},
        () => {}
      );

      // 2D Elevation Overlay Layer for Site01
      const overlaySource = new Static({
        url: getOverlayImageUrl(elevationLayerType),
        imageExtent: SITE01_EXTENT,
        projection: LUNAR_PROJECTION,
      });

      const overlayLayer = new ImageLayer({
        source: overlaySource,
        opacity: 0.85,
        visible: elevationLayerVisible,
        zIndex: 50,
      });
      overlayLayerRef.current = overlayLayer;

      // Reticle Marker Layer
      const { layer: markerLayer, updatePosition } = createMarkerLayer(
        selectedLongitude,
        selectedLatitude
      );
      markerUpdaterRef.current = updatePosition;

      // Profile Line Vector Layer
      const lineSource = new VectorSource();
      profileLineSourceRef.current = lineSource;

      const profileLayer = new VectorLayer({
        source: lineSource,
        zIndex: 80,
        style: new Style({
          stroke: new Stroke({
            color: '#10b981',
            width: 3,
            lineDash: [6, 4],
          }),
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: '#10b981' }),
            stroke: new Stroke({ color: '#ffffff', width: 1.5 }),
          }),
        }),
      });

      const view = new View({
        projection: LUNAR_PROJECTION,
        center: [-137.4896, -89.4632], // Centered directly on Site01
        zoom: 6.2,
        minZoom: 4.0,
        maxZoom: 9.0,
        extent: [-180, -90, 180, 90],
      });

      mapInstance = new Map({
        target: mapElementRef.current,
        layers: [wmtsLayer, overlayLayer, profileLayer, markerLayer],
        view,
        controls: defaultControls({
          zoom: false,
          rotate: false,
          attribution: false,
        }),
      });

      resizeObserver = new ResizeObserver(() => {
        if (mapInstance) mapInstance.updateSize();
      });
      resizeObserver.observe(mapElementRef.current);

      requestAnimationFrame(() => mapInstance?.updateSize());
      setTimeout(() => mapInstance?.updateSize(), 100);

      // Map Click Handler (Supports normal selection or Profile Transect line drawing)
      mapInstance.on('singleclick', (evt) => {
        const rawCoords = evt.coordinate;
        if (!rawCoords || rawCoords.length < 2) return;

        const lon = normalizeLongitude(rawCoords[0]);
        const lat = clampLatitude(rawCoords[1]);

        if (isDrawingProfile) {
          if (clickStep === 'none' || !firstPoint) {
            setFirstPoint({ lat, lon });
            setClickStep('first');
          } else {
            // Second point selected: update profile transect line
            setProfileLine(firstPoint, { lat, lon });
            setClickStep('none');
            setFirstPoint(null);
            setIsDrawingProfile(false);
          }
          return;
        }

        // Standard point selection
        setSelectedCoordinates(lat, lon, 'terrain');
        fetchElevationPoint(lat, lon).then((data) => {
          if (data) setCurrentElevationData(data);
        });
      });

      // Pointer Move Handler
      mapInstance.on('pointermove', (evt) => {
        if (evt.dragging) {
          setHoverCoords(null);
          return;
        }
        const rawCoords = evt.coordinate;
        if (rawCoords && rawCoords.length >= 2) {
          setHoverCoords({
            lat: clampLatitude(rawCoords[1]),
            lon: normalizeLongitude(rawCoords[0]),
          });
        }
      });

      mapRef.current = mapInstance;
    } catch (err) {
      console.error('Failed to initialize TerrainMap2D:', err);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (mapInstance) mapInstance.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  // Update profile line vector on map when profileStart or profileEnd changes
  useEffect(() => {
    if (!profileLineSourceRef.current) return;
    profileLineSourceRef.current.clear();

    if (profileStart && profileEnd) {
      const lineGeom = new LineString([
        [profileStart.lon, profileStart.lat],
        [profileEnd.lon, profileEnd.lat],
      ]);
      profileLineSourceRef.current.addFeature(new Feature({ geometry: lineGeom }));
      profileLineSourceRef.current.addFeature(
        new Feature({ geometry: new Point([profileStart.lon, profileStart.lat]) })
      );
      profileLineSourceRef.current.addFeature(
        new Feature({ geometry: new Point([profileEnd.lon, profileEnd.lat]) })
      );
    }
  }, [profileStart, profileEnd]);

  // Update overlay source when type changes
  useEffect(() => {
    if (!overlayLayerRef.current) return;
    overlayLayerRef.current.setVisible(elevationLayerVisible);
    if (elevationLayerVisible) {
      overlayLayerRef.current.setSource(
        new Static({
          url: getOverlayImageUrl(elevationLayerType),
          imageExtent: SITE01_EXTENT,
          projection: LUNAR_PROJECTION,
        })
      );
    }
  }, [elevationLayerVisible, elevationLayerType]);

  // Sync marker position
  useEffect(() => {
    if (markerUpdaterRef.current) {
      markerUpdaterRef.current(selectedLongitude, selectedLatitude);
    }
  }, [selectedLatitude, selectedLongitude]);

  const handleRecenter = () => {
    if (!mapRef.current) return;
    mapRef.current.getView().animate({
      center: [-137.4896, -89.4632],
      zoom: 6.2,
      duration: 400,
    });
  };

  return (
    <div className="relative w-full h-full bg-[#05080e] border border-[#2b2d32] rounded-xl overflow-hidden shadow-2xl flex flex-col group">
      {/* Top HUD Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-[#141619]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#2b2d32]/60 shadow-lg pointer-events-auto">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold tracking-wider text-slate-200 uppercase font-mono">
            2D ELEVATION MAP — SITE 01
          </span>
        </div>

        {/* Overlay Layer Selector Pills */}
        <div className="flex items-center gap-1.5 bg-[#141619]/90 backdrop-blur-md p-1 rounded-lg border border-[#2b2d32]/60 pointer-events-auto text-xs font-mono">
          <button
            onClick={() => {
              setElevationLayerVisible(true);
              setElevationLayerType('elevation');
            }}
            className={`px-2 py-0.5 rounded transition-colors ${
              elevationLayerVisible && elevationLayerType === 'elevation'
                ? 'bg-emerald-500 text-black font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ELEVATION
          </button>
          <button
            onClick={() => {
              setElevationLayerVisible(true);
              setElevationLayerType('slope');
            }}
            className={`px-2 py-0.5 rounded transition-colors ${
              elevationLayerVisible && elevationLayerType === 'slope'
                ? 'bg-amber-500 text-black font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SLOPE
          </button>
          <button
            onClick={() => setElevationLayerVisible(!elevationLayerVisible)}
            className={`px-2 py-0.5 rounded border border-[#2b2d32] text-[10px] ${
              !elevationLayerVisible ? 'bg-slate-800 text-slate-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {elevationLayerVisible ? 'HIDE' : 'SHOW'}
          </button>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute right-3 top-16 z-20 flex flex-col gap-1.5 bg-[#141619]/90 backdrop-blur-md p-1.5 rounded-lg border border-[#2b2d32]/60 shadow-lg">
        <button
          onClick={handleRecenter}
          title="Recenter to Site 01 (Connecting Ridge)"
          className="p-2 rounded hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            setIsDrawingProfile(!isDrawingProfile);
            setClickStep('none');
            setFirstPoint(null);
          }}
          title={isDrawingProfile ? 'Cancel Transect Drawing' : 'Click two points on the map to draw profile transect'}
          className={`p-2 rounded transition-colors ${
            isDrawingProfile
              ? 'bg-emerald-500 text-black shadow-lg animate-pulse'
              : 'hover:bg-slate-800 text-slate-300 hover:text-emerald-400'
          }`}
        >
          <Ruler className="w-4 h-4" />
        </button>
      </div>

      {/* Drawing Mode Banner */}
      {isDrawingProfile && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 px-3 py-1.5 rounded-lg text-xs font-mono shadow-xl backdrop-blur-sm flex items-center gap-2">
          <Ruler className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>
            {clickStep === 'none'
              ? 'Click START POINT on the map for profile transect'
              : 'Click END POINT on the map to complete transect'}
          </span>
        </div>
      )}

      {/* Map DOM Container */}
      <div ref={mapElementRef} className="flex-1 w-full h-full min-h-0 bg-[#020408]" />

      {/* Bottom HUD: Live Coordinates & Sampling Status */}
      <div className="absolute bottom-2 left-3 right-3 z-20 pointer-events-none flex items-center justify-between text-[11px] font-mono">
        <div className="bg-[#141619]/90 backdrop-blur-md px-2.5 py-1 rounded border border-[#2b2d32] text-slate-300 pointer-events-auto flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>SELECTED: {formatCoordinates({ latitude: selectedLatitude, longitude: selectedLongitude }, 3)}</span>
          {currentElevationData?.in_bounds && typeof currentElevationData.elevation_m === 'number' && (
            <span className="text-emerald-400 font-bold border-l border-[#2b2d32] pl-2">
              ELEV: {currentElevationData.elevation_m > 0 ? '+' : ''}{currentElevationData.elevation_m.toFixed(1)} m
            </span>
          )}
        </div>

        {hoverCoords && (
          <div className="bg-[#141619]/90 backdrop-blur-md px-2.5 py-1 rounded border border-[#2b2d32] text-slate-400 pointer-events-auto hidden sm:block">
            CURSOR: {formatCoordinates({ latitude: hoverCoords.lat, longitude: hoverCoords.lon }, 3)}
          </div>
        )}
      </div>
    </div>
  );
};
