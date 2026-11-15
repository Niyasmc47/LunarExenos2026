import React, { useEffect, useRef } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Style from 'ol/style/Style.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Text from 'ol/style/Text.js';
import { defaults as defaultControls } from 'ol/control.js';
import { ZoomIn, ZoomOut, RotateCcw, MapPin } from 'lucide-react';
import { createMoonTrekLayer, LUNAR_PROJECTION } from '../lunar-map/WmtsLayer';
import { useScenarioStore } from '../../stores/scenarioStore';
import { ScenarioComparisonResult } from '../../types/scenario';

const MARKER_COLORS = ['#10b981', '#fbbf24', '#38bdf8', '#818cf8'];

export const ScenarioMapOverview: React.FC = () => {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);

  const comparisonResult = useScenarioStore((state) => state.comparisonResult);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenarioId = useScenarioStore((state) => state.setActiveScenarioId);

  const scenarios = comparisonResult?.scenarios ?? [];

  // Initialize Map
  useEffect(() => {
    if (!mapElementRef.current) return;

    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      zIndex: 100,
    });

    const wmts = createMoonTrekLayer(() => {}, () => {}, () => {});

    // Initial center on Connecting Ridge (-89.46, -137.48)
    const initialCenter: [number, number] = [-137.4896, -89.4632];

    const mapInstance = new Map({
      target: mapElementRef.current,
      layers: [wmts, vectorLayer],
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      view: new View({
        projection: LUNAR_PROJECTION,
        center: initialCenter,
        zoom: 6.2,
        minZoom: 3,
        maxZoom: 14,
      }),
    });

    mapRef.current = mapInstance;

    // Click handler to select scenario on map
    mapInstance.on('click', (evt) => {
      const feature = mapInstance.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature) {
        const sid = feature.get('scenarioId');
        if (sid) {
          setActiveScenarioId(sid);
        }
      }
    });

    return () => {
      mapInstance.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  // Update Vector Markers whenever scenarios or activeScenarioId changes
  useEffect(() => {
    if (!vectorSourceRef.current) return;
    const source = vectorSourceRef.current;
    source.clear();

    scenarios.forEach((scRes: ScenarioComparisonResult, idx: number) => {
      const sc = scRes.scenario;
      const isActive = activeScenarioId === sc.id;
      const color = MARKER_COLORS[idx % MARKER_COLORS.length];

      const feature = new Feature({
        geometry: new Point([sc.longitude, sc.latitude]),
        scenarioId: sc.id,
        name: sc.name,
      });

      feature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: isActive ? 12 : 9,
            fill: new Fill({ color: color }),
            stroke: new Stroke({
              color: isActive ? '#ffffff' : '#070b12',
              width: isActive ? 3 : 2,
            }),
          }),
          text: new Text({
            text: `S${idx + 1}: ${sc.name.split('—')[1]?.trim() || sc.name}`,
            font: 'bold 11px monospace',
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#070b12', width: 3 }),
            offsetY: -16,
          }),
        })
      );

      source.addFeature(feature);
    });

    // Animate map view to active scenario if selected
    if (activeScenarioId && mapRef.current) {
      const activeSc = scenarios.find((s) => s.scenario.id === activeScenarioId);
      if (activeSc) {
        mapRef.current.getView().animate({
          center: [activeSc.scenario.longitude, activeSc.scenario.latitude],
          duration: 350,
        });
      }
    }
  }, [scenarios, activeScenarioId]);

  const handleZoomIn = () => {
    if (!mapRef.current) return;
    const v = mapRef.current.getView();
    v.animate({ zoom: Math.min(14, (v.getZoom() || 6) + 1), duration: 250 });
  };

  const handleZoomOut = () => {
    if (!mapRef.current) return;
    const v = mapRef.current.getView();
    v.animate({ zoom: Math.max(3, (v.getZoom() || 6) - 1), duration: 250 });
  };

  const handleReset = () => {
    if (!mapRef.current) return;
    mapRef.current.getView().animate({
      center: [-137.4896, -89.4632],
      zoom: 6.2,
      duration: 350,
    });
  };

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-slate-800 bg-[#070b12] shadow-xl font-mono text-xs">
      <div ref={mapElementRef} className="w-full h-full cursor-crosshair" />

      {/* Map Controls */}
      <div className="absolute right-3 top-3 z-30 flex flex-col gap-1.5 bg-[#0c121e]/90 p-1 rounded-xl border border-slate-800 shadow-2xl backdrop-blur-md">
        <button
          onClick={handleZoomIn}
          className="p-2 text-slate-300 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 text-slate-300 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 text-slate-300 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
          title="Reset South Pole View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Info Overlay for Active Scenario */}
      {activeScenarioId && (
        <div className="absolute left-3 bottom-3 z-30 bg-[#0c121e]/95 border border-slate-700 p-2.5 rounded-xl shadow-2xl backdrop-blur-md max-w-sm space-y-1">
          {(() => {
            const activeRes = scenarios.find((s) => s.scenario.id === activeScenarioId);
            if (!activeRes) return null;
            const sc = activeRes.scenario;
            const t = activeRes.terrain;
            return (
              <>
                <div className="font-bold text-slate-100 flex items-center gap-1.5 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{sc.name}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Coordinates: <b className="text-slate-200">{sc.latitude.toFixed(4)}° N, {sc.longitude.toFixed(4)}° E</b>
                </div>
                <div className="text-[10px] text-slate-400">
                  Surface Elevation: <b className="text-slate-200">{t.observer_surface_elevation_m.toFixed(1)} m</b> | Local Slope: <b className="text-amber-400">{t.local_slope_deg !== undefined ? `${t.local_slope_deg.toFixed(1)}°` : 'N/A'}</b>
                </div>
                <div className="text-[10px] text-emerald-400 font-bold">
                  Average visible Sun disk: {activeRes.solar.time_weighted_sunlight_percentage?.toFixed(1) ?? 'Unavailable'}{activeRes.solar.time_weighted_sunlight_percentage != null ? '%' : ''}
                  {' | '}Any sunlight: {activeRes.solar.total_sun_visible_hours.toFixed(1)} h
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Legend */}
      <div className="absolute right-3 bottom-3 z-30 bg-[#0c121e]/90 border border-slate-800 px-3 py-1.5 rounded-xl text-[10px] text-slate-300 shadow-xl space-y-1">
        <div className="text-[9px] text-slate-500 font-bold uppercase">CANDIDATE PINS</div>
        {scenarios.map((scRes, idx) => (
          <div
            key={scRes.scenario.id}
            onClick={() => setActiveScenarioId(scRes.scenario.id)}
            className="flex items-center gap-1.5 cursor-pointer hover:text-white"
          >
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: MARKER_COLORS[idx % MARKER_COLORS.length] }}
            />
            <span className={activeScenarioId === scRes.scenario.id ? 'font-bold text-cyan-300' : 'text-slate-400'}>
              S{idx + 1}: {scRes.scenario.name.split('—')[1]?.trim() || scRes.scenario.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
