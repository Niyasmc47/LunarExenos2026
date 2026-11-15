import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Stroke, Style, Fill } from 'ol/style.js';
import { defaults as defaultControls } from 'ol/control.js';
import { useLocationStore } from '../../stores/locationStore';
import { createMoonTrekLayer, LUNAR_PROJECTION } from './WmtsLayer';
import { createMarkerLayer } from './MapMarker';
import { formatCoordinates, normalizeLongitude } from '../../utils/lunarCoordinates';
import { allSiteFootprints } from '../../utils/explorerCoverage';

export function LunarMap() {
  const target = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const updateMarker = useRef<((lon: number, lat: number) => void) | null>(null);
  const [retry, setRetry] = useState(0);
  const { selectedLatitude: latitude, selectedLongitude: longitude, selectedLocationSource: source, setSelectedCoordinates, mapLoading, mapError, liveCapabilitiesActive } = useLocationStore();
  useEffect(() => {
    if (!target.current) return;
    let alive = true;
    const state = useLocationStore.getState();
    state.setMapError(null);
    const imagery = createMoonTrekLayer(
      loading => { if (alive) state.setMapLoading(loading); },
      error => { if (alive) state.setMapError(error); },
      active => { if (alive) state.setLiveCapabilitiesActive(active); }
    );
    const footprintFeatures = allSiteFootprints().map(
      (s) => new Feature(new Polygon([s.coordinates]))
    );
    const footprint = new VectorLayer({
      source: new VectorSource({ features: footprintFeatures }),
      style: new Style({ stroke: new Stroke({ color: '#34d399', width: 2, lineDash: [6, 4] }), fill: new Fill({ color: 'rgba(52,211,153,0.08)' }) })
    });
    const marker = createMarkerLayer(state.selectedLongitude, state.selectedLatitude);
    updateMarker.current = marker.updatePosition;
    const instance = new Map({
      target: target.current, layers: [imagery, footprint, marker.layer],
      view: new View({ projection: LUNAR_PROJECTION, center: [state.selectedLongitude, state.selectedLatitude], zoom: 1.5, minZoom: 0, maxZoom: 8, extent: [-180, -90, 180, 90], constrainOnlyCenter: true }),
      controls: defaultControls({ zoom: false, rotate: false, attribution: false })
    });
    map.current = instance;
    instance.on('singleclick', event => {
      const [lon, lat] = event.coordinate;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
      state.setSelectedCoordinates(lat, normalizeLongitude(lon), 'map');
    });
    const observer = new ResizeObserver(() => instance.updateSize());
    observer.observe(target.current);
    return () => { alive = false; observer.disconnect(); instance.dispose(); map.current = null; updateMarker.current = null; };
  }, [retry]);
  useEffect(() => {
    updateMarker.current?.(longitude, latitude);
    if (source !== 'map') map.current?.getView().setCenter([longitude, latitude]);
  }, [latitude, longitude, source, retry]);
  const zoom = (delta: number) => {
    const view = map.current?.getView();
    if (view) view.setZoom(Math.max(0, Math.min(8, (view.getZoom() ?? 1) + delta)));
  };
  return <div className="visualization">
    <div className="visualization-heading"><h2>2D lunar map</h2><span>NASA LRO WAC imagery</span></div>
    <div ref={target} className="map-canvas" tabIndex={0} role="region" aria-label="Interactive lunar map. Arrow keys pan; plus and minus zoom. Use location controls to select coordinates." />
    <div className="map-actions" role="group" aria-label="Map navigation">
      <button onClick={() => zoom(1)} aria-label="Zoom map in">+</button><button onClick={() => zoom(-1)} aria-label="Zoom map out">−</button>
      <button onClick={() => map.current?.getView().setCenter([longitude, latitude])}>Recenter</button>
      <button onClick={() => { const view = map.current?.getView(); if (view) view.fit([-180, -90, 180, 90], { padding: [30, 30, 30, 30] }); }}>Whole Moon</button>
      <button onClick={() => { setSelectedCoordinates(-89.4632, -137.4896, 'preset'); map.current?.getView().setZoom(6); }}>Site 01</button>
      <button onClick={() => { setSelectedCoordinates(-89.7614, -157.1156, 'preset'); map.current?.getView().setZoom(6); }}>Site 04</button>
      <button onClick={() => { setSelectedCoordinates(-88.6682, -68.3820, 'preset'); map.current?.getView().setZoom(6); }}>Site 11</button>
    </div>
    <div className="map-state" role="status">{mapError ? <><span>{mapError}</span><button className="text-button" onClick={() => setRetry(v => v + 1)}>Retry map imagery</button></> : mapLoading ? 'Loading imagery…' : liveCapabilitiesActive ? 'NASA layer catalogue verified' : 'Using saved layer settings'}</div>
    <footer className="visualization-footer"><span data-testid="map-coordinates">{formatCoordinates({ latitude, longitude }, 5)}</span><span>Dashed green outline: Available NASA terrain footprints (Site 01, Site 04, Site 11)</span><a href="https://trek.nasa.gov/moon/" target="_blank" rel="noreferrer">Imagery: NASA / GSFC / ASU · Moon Trek ↗</a></footer>
  </div>;
}
