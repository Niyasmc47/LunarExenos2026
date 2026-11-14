import React, { useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { MoonSphere } from './MoonSphere';
import { useLocationStore } from '../../stores/locationStore';
import { formatCoordinates } from '../../utils/lunarCoordinates';
import { lunarToSpherePosition } from '../../utils/sphereCoordinates';
import { fetchElevationPoint } from '../../services/terrainApi';
import { Globe, Crosshair, RotateCcw, Sparkles } from 'lucide-react';

export const LunarGlobe: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const selectedLatitude = useLocationStore((state) => state.selectedLatitude);
  const selectedLongitude = useLocationStore((state) => state.selectedLongitude);
  const setSelectedCoordinates = useLocationStore((state) => state.setSelectedCoordinates);
  const setCurrentElevationData = useLocationStore((state) => state.setCurrentElevationData);

  // Jump to Site01 Connecting Ridge (LOLA 5m DEM)
  const handleFlyToSite01 = () => {
    const lat = -89.4632;
    const lon = -137.4896;
    setSelectedCoordinates(lat, lon, 'preset');
    fetchElevationPoint(lat, lon).then((pt) => {
      if (pt) setCurrentElevationData(pt);
    });

    if (!controlsRef.current) return;
    const pos = lunarToSpherePosition(lat, lon, 2.0);
    const camPos = pos.clone().normalize().multiplyScalar(2.4);
    controlsRef.current.object.position.set(camPos.x, camPos.y, camPos.z);
    controlsRef.current.target.set(pos.x * 0.9, pos.y * 0.9, pos.z * 0.9);
    controlsRef.current.update();
  };

  // Recenter camera to focus on the current marker
  const handleFocusMarker = () => {
    if (!controlsRef.current) return;
    const markerPos = lunarToSpherePosition(selectedLatitude, selectedLongitude, 2.0);
    const camPos = markerPos.clone().normalize().multiplyScalar(3.0);

    controlsRef.current.object.position.set(camPos.x, camPos.y, camPos.z);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  // Reset to Near-side Prime Meridian view (0, 0)
  const handleResetView = () => {
    if (!controlsRef.current) return;
    controlsRef.current.object.position.set(0, 0, 4.5);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  // View South Pole
  const handleViewSouthPole = () => {
    if (!controlsRef.current) return;
    controlsRef.current.object.position.set(0, -4.5, 0.01);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  // View North Pole
  const handleViewNorthPole = () => {
    if (!controlsRef.current) return;
    controlsRef.current.object.position.set(0, 4.5, 0.01);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#05080e] border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl shadow-black/60 group">
      {/* Top HUD Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-[#0c121e]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-lg pointer-events-auto">
          <Globe className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider text-slate-200 uppercase font-mono">
            3D LUNAR GLOBE (LRO WAC)
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-[#0c121e]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/60 text-[11px] font-mono text-slate-300">
            TEXTURE: <span className="text-emerald-400 font-semibold">NASA 4K UHD (L3)</span>
          </div>
        </div>
      </div>

      {/* Floating 3D Navigation Quick-Buttons */}
      <div className="absolute right-3 top-16 z-20 flex flex-col gap-1.5 bg-[#0c121e]/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700/60 shadow-lg">
        <button
          onClick={handleFlyToSite01}
          title="Fly directly to Site 01 (Connecting Ridge LOLA 3D Terrain)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>SITE 01 TERRAIN</span>
        </button>
        <button
          onClick={handleFocusMarker}
          title="Focus Camera on Selected Landing Site"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-emerald-400 hover:bg-slate-800/80 rounded transition-colors"
        >
          <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
          <span>FOCUS TARGET</span>
        </button>
        <button
          onClick={handleResetView}
          title="Reset to Sub-Earth View (0° Lat, 0° Lon)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-emerald-400 hover:bg-slate-800/80 rounded transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>PRIME MERIDIAN</span>
        </button>
        <div className="h-px bg-slate-700/80 my-0.5" />
        <button
          onClick={handleViewSouthPole}
          title="Orbit directly to Lunar South Pole"
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 rounded transition-colors"
        >
          <span>SOUTH POLE (-90°)</span>
        </button>
        <button
          onClick={handleViewNorthPole}
          title="Orbit directly to Lunar North Pole"
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 rounded transition-colors"
        >
          <span>NORTH POLE (+90°)</span>
        </button>
      </div>

      {/* Three.js Canvas Container */}
      <div className="w-full h-full cursor-grab active:cursor-grabbing">
        <Canvas
          camera={{ position: [0, 0, 4.5], fov: 45, near: 0.05, far: 50.0 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.15,
            powerPreference: 'high-performance',
          }}
        >
          <color attach="background" args={['#04060a']} />

          {/* Deep space starry environment */}
          <Stars radius={80} depth={40} count={2200} factor={4} saturation={0} fade speed={0.6} />

          {/* High-fidelity solar and space lighting */}
          <ambientLight intensity={0.2} />
          <directionalLight
            position={[10, 6, 8]}
            intensity={2.4}
            color="#fffcf5"
            castShadow
          />
          {/* Earthshine fill light */}
          <directionalLight position={[-8, -4, -6]} intensity={0.12} color="#94a3b8" />

          <Suspense fallback={null}>
            <MoonSphere radius={2.0} />
          </Suspense>

          {/* Orbit Controls with close-up zoom range */}
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            minDistance={2.08}
            maxDistance={8.0}
            dampingFactor={0.08}
            rotateSpeed={0.8}
            zoomSpeed={1.0}
          />
        </Canvas>
      </div>

      {/* Bottom Status / Coordinate HUD */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none text-xs">
        <div className="bg-[#0c121e]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-slate-300 font-mono shadow-lg pointer-events-auto flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
          <span>TARGET:</span>
          <span className="text-emerald-400 font-semibold">
            {formatCoordinates({ latitude: selectedLatitude, longitude: selectedLongitude })}
          </span>
          <span className="text-slate-500 text-[11px] hidden sm:inline">(Click globe to relocate)</span>
        </div>

        <div className="bg-[#0c121e]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/60 text-[11px] font-mono text-slate-400 hidden md:flex items-center gap-1.5">
          <span>DRAG: Orbit • SCROLL: Zoom In • CLICK: Pick Coords</span>
        </div>
      </div>
    </div>
  );
};
