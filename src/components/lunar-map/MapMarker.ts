import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import Icon from 'ol/style/Icon.js';

/**
 * Generates an SVG data URL for a glowing tactical reticle marker.
 */
function createReticleSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <defs>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <!-- Outer dashed/bracket circle -->
    <circle cx="24" cy="24" r="18" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="6, 3" opacity="0.8" />
    <!-- Outer ring glow -->
    <circle cx="24" cy="24" r="14" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" stroke-width="2" filter="url(#glow)" />
    <!-- Crosshair ticks -->
    <line x1="24" y1="4" x2="24" y2="10" stroke="#34d399" stroke-width="2" stroke-linecap="round" />
    <line x1="24" y1="38" x2="24" y2="44" stroke="#34d399" stroke-width="2" stroke-linecap="round" />
    <line x1="4" y1="24" x2="10" y2="24" stroke="#34d399" stroke-width="2" stroke-linecap="round" />
    <line x1="38" y1="24" x2="44" y2="24" stroke="#34d399" stroke-width="2" stroke-linecap="round" />
    <!-- Center bulls-eye -->
    <circle cx="24" cy="24" r="3.5" fill="#10b981" stroke="#ffffff" stroke-width="1.5" />
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createMarkerLayer(initialLon: number, initialLat: number): {
  layer: VectorLayer<VectorSource>;
  updatePosition: (lon: number, lat: number) => void;
} {
  const feature = new Feature({
    geometry: new Point([initialLon, initialLat]),
  });

  const style = new Style({
    image: new Icon({
      src: createReticleSvg(),
      anchor: [0.5, 0.5],
      scale: 1,
    }),
  });

  feature.setStyle(style);

  const source = new VectorSource({
    features: [feature],
  });

  const layer = new VectorLayer({
    source,
    zIndex: 100,
  });

  const updatePosition = (lon: number, lat: number) => {
    feature.setGeometry(new Point([lon, lat]));
  };

  return { layer, updatePosition };
}
