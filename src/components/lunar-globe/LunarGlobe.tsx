import { Component, ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { MoonSphere } from './MoonSphere';
import { useLocationStore } from '../../stores/locationStore';
import { formatCoordinates } from '../../utils/lunarCoordinates';
import { lunarToSpherePosition } from '../../utils/sphereCoordinates';

class GlobeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="globe-fallback" role="alert">3D graphics are unavailable. Use 2D Map and the location controls to continue exploring.</div> : this.props.children; }
}
function CameraSelection({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { selectedLatitude: lat, selectedLongitude: lon, selectedLocationSource: source } = useLocationStore();
  useEffect(() => {
    if (!controls.current || source === 'globe') return;
    const point = lunarToSpherePosition(lat, lon, 4.5);
    controls.current.object.position.copy(point);
    controls.current.target.set(0, 0, 0);
    controls.current.update();
  }, [lat, lon, source, controls]);
  return null;
}
export function LunarGlobe() {
  const controls = useRef<OrbitControlsImpl>(null);
  const [retry, setRetry] = useState(0);
  const { selectedLatitude: latitude, selectedLongitude: longitude, globeLoading, globeError, setSelectedCoordinates } = useLocationStore();
  const focus = (lat: number, lon: number) => {
    if (!controls.current) return;
    controls.current.object.position.copy(lunarToSpherePosition(lat, lon, 4.5));
    controls.current.target.set(0, 0, 0); controls.current.update();
  };
  return <div className="visualization">
    <div className="visualization-heading"><h2>3D lunar globe</h2><span>Imagery on a reference sphere</span></div>
    <div className="globe-canvas" role="img" aria-label="Interactive lunar globe. Drag to orbit, scroll to zoom, click to select. Equivalent location selection is available in the location controls.">
      <GlobeBoundary key={retry}><Canvas camera={{ position: [0, 0, 4.5], fov: 45, near: 0.05, far: 50 }} dpr={[1, 1.5]} fallback={<div className="globe-fallback">WebGL is unavailable. Use the 2D map to continue.</div>}>
        <color attach="background" args={['#04080e']} />
        <ambientLight intensity={2} />
        <Suspense fallback={null}><MoonSphere key={retry} radius={2} /></Suspense>
        <OrbitControls ref={controls} enablePan={false} minDistance={2.15} maxDistance={8} enableDamping dampingFactor={0.08} />
        <CameraSelection controls={controls} />
      </Canvas></GlobeBoundary>
    </div>
    <div className="map-actions" role="group" aria-label="Globe navigation">
      <button onClick={() => focus(latitude, longitude)}>Focus selection</button><button onClick={() => focus(-90, 0)}>South pole</button><button onClick={() => focus(90, 0)}>North pole</button><button onClick={() => focus(0, 0)}>Prime meridian</button>
      <button onClick={() => setSelectedCoordinates(-89.4632, -137.4896, 'preset')}>Site 01</button>
      <button onClick={() => setSelectedCoordinates(-89.7614, -157.1156, 'preset')}>Site 04</button>
      <button onClick={() => setSelectedCoordinates(-88.6682, -68.3820, 'preset')}>Site 11</button>
    </div>
    <div className="map-state" role="status">{globeError ? <><span>{globeError}</span><button className="text-button" onClick={() => setRetry(v => v + 1)}>Retry globe imagery</button></> : globeLoading ? 'Loading lunar imagery…' : 'Drag to orbit · Scroll to zoom · Click to select'}</div>
    <footer className="visualization-footer"><span data-testid="globe-coordinates">{formatCoordinates({ latitude, longitude }, 5)}</span><span>Illustrative lighting · No global elevation model</span><a href="https://trek.nasa.gov/moon/" target="_blank" rel="noreferrer">Imagery: NASA / GSFC / ASU · Moon Trek ↗</a></footer>
  </div>;
}
