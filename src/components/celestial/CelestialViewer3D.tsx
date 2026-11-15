import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useLocationStore } from '../../stores/locationStore';
import { fetchElevationPoint, fetchTerrainMesh } from '../../services/terrainApi';
import { inspectTerrainPoint } from '../../services/dynamicAnalysisApi';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { useCelestialSimulationStore } from '../../stores/celestialSimulationStore';
import { TerrainMeshData } from '../../types/terrain';
import {
  Navigation,
  Sparkles,
  Mountain,
  Sun,
  Globe2,
  BookmarkPlus,
} from 'lucide-react';

// -------------------------------------------------------------
// Direction conversion helper from Azimuth and Elevation to 3D Vector
// -------------------------------------------------------------
function getDirectionVector(
  azimuthDeg: number,
  elevationDeg: number,
  dirNorth: THREE.Vector3,
  dirEast: THREE.Vector3
): THREE.Vector3 {
  const cosE = Math.cos((elevationDeg * Math.PI) / 180);
  const sinE = Math.sin((elevationDeg * Math.PI) / 180);
  const cosA = Math.cos((azimuthDeg * Math.PI) / 180);
  const sinA = Math.sin((azimuthDeg * Math.PI) / 180);

  return new THREE.Vector3()
    .addScaledVector(dirNorth, cosE * cosA)
    .addScaledVector(dirEast, cosE * sinA)
    .addScaledVector(new THREE.Vector3(0, 1, 0), sinE)
    .normalize();
}

// -------------------------------------------------------------
// 3D Sun Object & Corona
// -------------------------------------------------------------
interface CelestialSunProps {
  position: THREE.Vector3;
  azimuth: number;
  elevation: number;
  distanceKm: number;
  angularDiameterDeg: number;
  showLabel: boolean;
  onFocus: () => void;
}

const CelestialSunObject: React.FC<CelestialSunProps> = ({
  position,
  azimuth,
  elevation,
  distanceKm,
  angularDiameterDeg,
  showLabel,
  onFocus,
}) => {
  const isAboveHorizon = elevation > 0;

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Sun glowing core sphere */}
      <mesh onClick={onFocus}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshBasicMaterial color="#fffbeb" />
      </mesh>

      {/* Sun outer corona glow */}
      <mesh>
        <sphereGeometry args={[0.78, 24, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.38} />
      </mesh>

      {/* Point light from Sun */}
      <pointLight color="#fef08a" intensity={isAboveHorizon ? 2.5 : 0.2} distance={35} />

      {/* Floating 3D Scientific Label */}
      {showLabel && (
        <Html position={[0, 0.95, 0]} center distanceFactor={14} zIndexRange={[120, 0]}>
          <div
            onClick={onFocus}
            className="cursor-pointer bg-[#0c121e]/95 backdrop-blur-md border border-amber-500/50 p-2 rounded-xl text-xs font-mono shadow-2xl select-none hover:border-amber-400 transition-all text-left whitespace-nowrap"
          >
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Sun className="w-3.5 h-3.5 fill-current" />
              <span>THE SUN</span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                  isAboveHorizon ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isAboveHorizon ? 'ABOVE HORIZON' : 'SUB-HORIZON'}
              </span>
            </div>
            <div className="text-[11px] text-slate-200 mt-0.5">
              Azimuth: <b className="text-white">{azimuth.toFixed(1)}°</b> • Elevation:{' '}
              <b className={elevation >= 0 ? 'text-emerald-400' : 'text-slate-400'}>
                {elevation > 0 ? '+' : ''}
                {elevation.toFixed(2)}°
              </b>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {(distanceKm / 1e6).toFixed(2)}M km • Angular size: {angularDiameterDeg.toFixed(2)}°
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

// -------------------------------------------------------------
// 3D Earth Object with Phases & Atmosphere
// -------------------------------------------------------------
interface CelestialEarthProps {
  position: THREE.Vector3;
  azimuth: number;
  elevation: number;
  distanceKm: number;
  angularDiameterDeg: number;
  showLabel: boolean;
  onFocus: () => void;
}

const CelestialEarthObject: React.FC<CelestialEarthProps> = ({
  position,
  azimuth,
  elevation,
  distanceKm,
  angularDiameterDeg,
  showLabel,
  onFocus,
}) => {
  const isDirectLOS = elevation > 0;

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Earth Surface Sphere - lit by Sun directional light to show authentic lunar perspective phases */}
      <mesh onClick={onFocus} castShadow receiveShadow>
        <sphereGeometry args={[0.62, 36, 36]} />
        <meshStandardMaterial
          color="#1e3a8a" // deep blue oceans
          roughness={0.65}
          metalness={0.12}
        />
      </mesh>

      {/* Earth Continents / Clouds Layer */}
      <mesh>
        <sphereGeometry args={[0.624, 32, 32]} />
        <meshStandardMaterial
          color="#38bdf8"
          roughness={0.9}
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* Earth Atmospheric Rim Glow */}
      <mesh>
        <sphereGeometry args={[0.68, 24, 24]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.18} side={THREE.BackSide} />
      </mesh>

      {/* Floating 3D Scientific Label */}
      {showLabel && (
        <Html position={[0, 1.0, 0]} center distanceFactor={14} zIndexRange={[120, 0]}>
          <div
            onClick={onFocus}
            className="cursor-pointer bg-[#0c121e]/95 backdrop-blur-md border border-cyan-500/50 p-2 rounded-xl text-xs font-mono shadow-2xl select-none hover:border-cyan-400 transition-all text-left whitespace-nowrap"
          >
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <Globe2 className="w-3.5 h-3.5" />
              <span>THE EARTH</span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                  isDirectLOS ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isDirectLOS ? 'DIRECT LOS' : 'OBSTRUCTED'}
              </span>
            </div>
            <div className="text-[11px] text-slate-200 mt-0.5">
              Azimuth: <b className="text-white">{azimuth.toFixed(1)}°</b> • Elevation:{' '}
              <b className={elevation >= 0 ? 'text-emerald-400' : 'text-slate-400'}>
                {elevation > 0 ? '+' : ''}
                {elevation.toFixed(2)}°
              </b>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {distanceKm.toLocaleString()} km • Angular size: {angularDiameterDeg.toFixed(2)}°
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

// -------------------------------------------------------------
// 360° Tangent Horizon Ring in Observer Plane
// -------------------------------------------------------------
interface HorizonRingProps {
  dirNorth: THREE.Vector3;
  dirEast: THREE.Vector3;
}

const TangentHorizonRing: React.FC<HorizonRingProps> = ({ dirNorth, dirEast }) => {
  const radius = 3.6;

  return (
    <group position={[0, 0.004, 0]}>
      {/* Horizontal Circle Ring representing 0° Elevation plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.02, radius + 0.02, 64]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* Cardinal Labels on Horizon Ring */}
      <Html
        position={[dirNorth.x * radius * 1.08, 0.05, dirNorth.z * radius * 1.08]}
        center
        distanceFactor={10}
        zIndexRange={[90, 0]}
      >
        <div className="px-1.5 py-0.5 rounded bg-emerald-500 text-black font-bold font-mono text-[9px] shadow-lg select-none whitespace-nowrap">
          NORTH (0°)
        </div>
      </Html>

      <Html
        position={[dirEast.x * radius * 1.08, 0.05, dirEast.z * radius * 1.08]}
        center
        distanceFactor={10}
        zIndexRange={[90, 0]}
      >
        <div className="px-1.5 py-0.5 rounded bg-sky-500 text-black font-bold font-mono text-[9px] shadow-lg select-none whitespace-nowrap">
          EAST (90°)
        </div>
      </Html>

      <Html
        position={[-dirNorth.x * radius * 1.08, 0.05, -dirNorth.z * radius * 1.08]}
        center
        distanceFactor={10}
        zIndexRange={[90, 0]}
      >
        <div className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-600 font-bold font-mono text-[9px] shadow-lg select-none whitespace-nowrap">
          SOUTH (180°)
        </div>
      </Html>

      <Html
        position={[-dirEast.x * radius * 1.08, 0.05, -dirEast.z * radius * 1.08]}
        center
        distanceFactor={10}
        zIndexRange={[90, 0]}
      >
        <div className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-600 font-bold font-mono text-[9px] shadow-lg select-none whitespace-nowrap">
          WEST (270°)
        </div>
      </Html>
    </group>
  );
};

// -------------------------------------------------------------
// Terrain Mesh Object with Shadows and Texture Coloring
// -------------------------------------------------------------
interface TerrainObjectProps {
  meshData: TerrainMeshData | null;
  onPointSelect: (lat: number, lon: number) => void;
  clickPin: THREE.Vector3 | null;
  setClickPin: (p: THREE.Vector3 | null) => void;
  showTerrain: boolean;
  showShadows: boolean;
}

const TerrainMeshScene: React.FC<TerrainObjectProps> = ({
  meshData,
  onPointSelect,
  clickPin,
  setClickPin,
  showTerrain,
  showShadows,
}) => {
  const geometry = useMemo(() => {
    if (!meshData || meshData.positions.length === 0) return null;

    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(meshData.positions);
    const normals = new Float32Array(meshData.normals);
    const uvs = new Float32Array(meshData.uvs);
    const indices = new Uint32Array(meshData.indices);

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));

    geom.computeBoundingBox();
    geom.center();
    geom.rotateX(Math.PI);

    geom.computeBoundingBox();
    const size = new THREE.Vector3();
    geom.boundingBox!.getSize(size);
    const maxDim = Math.max(size.x, size.z);
    const scaleFactor = 2.4 / (maxDim || 1);
    geom.scale(scaleFactor, scaleFactor, scaleFactor);
    geom.computeVertexNormals();

    const count = meshData.raw_elevations.length;
    const colors = new Float32Array(count * 3);
    const minZ = meshData.min_elevation;
    const maxZ = meshData.max_elevation;
    const range = Math.max(1, maxZ - minZ);

    for (let i = 0; i < count; i++) {
      const z = meshData.raw_elevations[i];
      const t = Math.max(0, Math.min(1, (z - minZ) / range));
      let r = 0, g = 0, b = 0;
      if (t < 0.25) {
        const s = t / 0.25;
        r = 0.1 + 0.1 * s;
        g = 0.15 + 0.3 * s;
        b = 0.4 + 0.4 * s;
      } else if (t < 0.5) {
        const s = (t - 0.25) / 0.25;
        r = 0.2 + 0.1 * s;
        g = 0.45 + 0.35 * s;
        b = 0.8 - 0.3 * s;
      } else if (t < 0.75) {
        const s = (t - 0.5) / 0.25;
        r = 0.3 + 0.5 * s;
        g = 0.8 + 0.1 * s;
        b = 0.5 - 0.3 * s;
      } else {
        const s = (t - 0.75) / 0.25;
        r = 0.8 + 0.2 * s;
        g = 0.9 + 0.1 * s;
        b = 0.2 + 0.8 * s;
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geom;
  }, [meshData]);

  const handleMeshClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.point) {
      setClickPin(e.point.clone());
    }
    if (!e.uv || !meshData) return;

    const b = meshData.bounds_geographic;
    const lon = b.min_longitude + e.uv.x * (b.max_longitude - b.min_longitude);
    const lat = b.min_latitude + (1 - e.uv.y) * (b.max_latitude - b.min_latitude);
    onPointSelect(lat, lon);
  };

  return (
    <group>
      {/* 3D Terrain Surface Mesh */}
      {showTerrain && geometry && (
        <mesh
          geometry={geometry}
          onClick={handleMeshClick}
          castShadow={showShadows}
          receiveShadow={showShadows}
        >
          <meshStandardMaterial
            vertexColors
            roughness={0.88}
            metalness={0.06}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Target Marker Beacon on Terrain */}
      {clickPin && (
        <group position={[clickPin.x, clickPin.y, clickPin.z]}>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.007, 0.007, 0.28, 12]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
          <mesh position={[0, 0.29, 0]}>
            <octahedronGeometry args={[0.045, 0]} />
            <meshStandardMaterial color="#10b981" emissive="#34d399" emissiveIntensity={2.5} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <ringGeometry args={[0.03, 0.06, 24]} />
            <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
};

// -------------------------------------------------------------
// Primary CelestialViewer3D Component
// -------------------------------------------------------------
interface CelestialViewer3DProps {
  onOpenCandidateModal?: () => void;
}

export const CelestialViewer3D: React.FC<CelestialViewer3DProps> = ({ onOpenCandidateModal }) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const selectedLatitude = useLocationStore((state) => state.selectedLatitude);
  const selectedLongitude = useLocationStore((state) => state.selectedLongitude);
  const setSelectedCoordinates = useLocationStore((state) => state.setSelectedCoordinates);
  const setCurrentElevationData = useLocationStore((state) => state.setCurrentElevationData);
  const setCurrentPointTelemetry = useDynamicAnalysisStore((state) => state.setCurrentPointTelemetry);
  const activeDatasetId = useDynamicAnalysisStore((state) => state.activeDatasetId) || 'site01';
  const terrainLod = useLocationStore((state) => state.terrainLod);
  const terrainExaggeration = useLocationStore((state) => state.terrainExaggeration);

  const sun = useCelestialSimulationStore((state) => state.sun);
  const earth = useCelestialSimulationStore((state) => state.earth);
  const showTerrain = useCelestialSimulationStore((state) => state.showTerrain);
  const showShadows = useCelestialSimulationStore((state) => state.showShadows);
  const showCelestialLabels = useCelestialSimulationStore((state) => state.showCelestialLabels);
  const showHorizonRing = useCelestialSimulationStore((state) => state.showHorizonRing);
  const setShowTerrain = useCelestialSimulationStore((state) => state.setShowTerrain);
  const setShowShadows = useCelestialSimulationStore((state) => state.setShowShadows);
  const setShowCelestialLabels = useCelestialSimulationStore((state) => state.setShowCelestialLabels);
  const setShowHorizonRing = useCelestialSimulationStore((state) => state.setShowHorizonRing);
  const analyzeLocation = useCelestialSimulationStore((state) => state.analyzeLocation);
  const isAnalyzing = useCelestialSimulationStore((state) => state.isAnalyzing);

  const [meshData, setMeshData] = useState<TerrainMeshData | null>(null);
  const [clickPin, setClickPin] = useState<THREE.Vector3 | null>(null);

  // Load NASA LOLA DEM mesh
  useEffect(() => {
    fetchTerrainMesh(activeDatasetId, terrainLod, terrainExaggeration).then((data) => {
      if (data) setMeshData(data);
    });
  }, [activeDatasetId, terrainLod, terrainExaggeration]);

  // Compute cardinal vectors in Three.js space
  const { dirNorth, dirEast } = useMemo(() => {
    const centerLon = meshData
      ? (meshData.bounds_geographic.min_longitude + meshData.bounds_geographic.max_longitude) / 2
      : selectedLongitude;
    const radLon = ((selectedLongitude || centerLon) * Math.PI) / 180;

    const north = new THREE.Vector3(Math.sin(radLon), 0, -Math.cos(radLon)).normalize();
    const east = new THREE.Vector3(Math.cos(radLon), 0, Math.sin(radLon)).normalize();
    return { dirNorth: north, dirEast: east };
  }, [meshData, selectedLongitude]);

  // Compute 3D positions of Sun and Earth at visualization radii
  const sun3DPos = useMemo(() => {
    const dir = getDirectionVector(sun.azimuth_deg, sun.elevation_deg, dirNorth, dirEast);
    return dir.multiplyScalar(16.5);
  }, [sun.azimuth_deg, sun.elevation_deg, dirNorth, dirEast]);

  const earth3DPos = useMemo(() => {
    const dir = getDirectionVector(earth.azimuth_deg, earth.elevation_deg, dirNorth, dirEast);
    return dir.multiplyScalar(13.2);
  }, [earth.azimuth_deg, earth.elevation_deg, dirNorth, dirEast]);

  // Dynamic directional sunlight intensity based on calculated Sun elevation
  const sunLightIntensity = useMemo(() => {
    if (sun.elevation_deg > 0) {
      return 1.8 + sun.fraction_visible * 0.7;
    }
    // Twilight fade when Sun upper limb is grazing or below horizon
    if (sun.elevation_deg > -1.5) {
      return 0.3;
    }
    return 0.06; // lunar night starlight
  }, [sun.elevation_deg, sun.fraction_visible]);

  // Camera Focus Actions
  const handleFocusMoon = () => {
    if (!controlsRef.current) return;
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.object.position.set(0, 2.2, 2.8);
    controlsRef.current.update();
  };

  const handleFocusSun = () => {
    if (!controlsRef.current) return;
    controlsRef.current.target.set(sun3DPos.x * 0.3, sun3DPos.y * 0.3, sun3DPos.z * 0.3);
    controlsRef.current.object.position.set(-sun3DPos.x * 0.25, 1.5, -sun3DPos.z * 0.25);
    controlsRef.current.update();
  };

  const handleFocusEarth = () => {
    if (!controlsRef.current) return;
    controlsRef.current.target.set(earth3DPos.x * 0.3, earth3DPos.y * 0.3, earth3DPos.z * 0.3);
    controlsRef.current.object.position.set(-earth3DPos.x * 0.2, 1.4, -earth3DPos.z * 0.2);
    controlsRef.current.update();
  };

  const handleAlignNorth = () => {
    if (!controlsRef.current) return;
    const southOfCenter = dirNorth.clone().negate().multiplyScalar(3.2);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.object.position.set(southOfCenter.x, 1.8, southOfCenter.z);
    controlsRef.current.update();
  };

  const handlePointSelect = (lat: number, lon: number) => {
    setSelectedCoordinates(lat, lon, 'terrain');
    fetchElevationPoint(lat, lon, activeDatasetId).then((data) => {
      if (data) setCurrentElevationData(data);
    });
    inspectTerrainPoint(lat, lon, activeDatasetId).then((pt) => {
      if (pt) setCurrentPointTelemetry(pt);
    });
  };

  const handleAnalyzeClick = () => {
    analyzeLocation(selectedLatitude, selectedLongitude, activeDatasetId);
  };

  return (
    <div className="relative w-full h-full flex flex-col min-h-0 overflow-hidden bg-[#040711]">
      {/* Top HUD: Title, Region, & Scale Disclosure Banner */}
      <div className="absolute top-2 left-3 right-3 z-30 pointer-events-none flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
        <div className="flex items-center gap-2 pointer-events-auto bg-[#070c18]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-xl">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-100 uppercase tracking-wide">
            3D CELESTIAL ENVIRONMENT
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-emerald-400 font-bold uppercase">
            {activeDatasetId === 'site04'
              ? 'Site 04 (Shackleton Rim)'
              : activeDatasetId === 'site11'
              ? 'Site 11 (de Gerlache Rim)'
              : 'Site 01 (Connecting Ridge)'}
          </span>
        </div>

        {/* Scientific Scale Badge */}
        <div className="pointer-events-auto hidden md:flex items-center gap-1.5 bg-[#070c18]/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-800 text-[10px] text-slate-400 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block animate-pulse"></span>
          <span>Astronomical Scale: Angles & Directions exact (CSPICE / DE421)</span>
        </div>
      </div>

      {/* Right Floating Control Toolstrip */}
      <div className="absolute right-3 top-14 z-30 pointer-events-auto flex flex-col gap-1.5 bg-[#080d1a]/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-2xl text-xs font-mono">
        {/* Camera Focus Controls */}
        <div className="text-[9px] text-slate-400 font-bold uppercase px-1 pb-1 border-b border-slate-800">
          Focus
        </div>
        <button
          onClick={handleFocusMoon}
          title="Focus Camera on Moon / Lunar Terrain"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition-colors"
        >
          <Mountain className="w-3.5 h-3.5 text-emerald-400" />
          <span>Moon</span>
        </button>

        <button
          onClick={handleFocusSun}
          title="Focus Camera on the Sun"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
        >
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>Sun</span>
        </button>

        <button
          onClick={handleFocusEarth}
          title="Focus Camera on the Earth"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition-colors"
        >
          <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Earth</span>
        </button>

        <button
          onClick={handleAlignNorth}
          title="Align Camera View looking North (0°)"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
        >
          <Navigation className="w-3.5 h-3.5 text-emerald-400" />
          <span>North</span>
        </button>

        {/* Scene Toggles */}
        <div className="text-[9px] text-slate-400 font-bold uppercase px-1 pt-1.5 pb-1 border-t border-slate-800">
          Toggles
        </div>

        <button
          onClick={() => setShowTerrain(!showTerrain)}
          className={`flex items-center justify-between px-2 py-1 rounded transition-colors ${
            showTerrain ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <span>Terrain</span>
          <span className="text-[10px] font-bold">{showTerrain ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={() => setShowShadows(!showShadows)}
          className={`flex items-center justify-between px-2 py-1 rounded transition-colors ${
            showShadows ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <span>Shadows</span>
          <span className="text-[10px] font-bold">{showShadows ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={() => setShowCelestialLabels(!showCelestialLabels)}
          className={`flex items-center justify-between px-2 py-1 rounded transition-colors ${
            showCelestialLabels ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <span>Labels</span>
          <span className="text-[10px] font-bold">{showCelestialLabels ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={() => setShowHorizonRing(!showHorizonRing)}
          className={`flex items-center justify-between px-2 py-1 rounded transition-colors ${
            showHorizonRing ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <span>Horizon</span>
          <span className="text-[10px] font-bold">{showHorizonRing ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* 3D WebGL Canvas */}
      <div className="flex-1 w-full h-full min-h-0">
        <Canvas
          shadows
          camera={{ position: [0, 2.2, 2.8], fov: 45, near: 0.05, far: 80 }}
          gl={{ antialias: true, alpha: true }}
          className="w-full h-full"
        >
          <color attach="background" args={['#03050c']} />

          {/* Directional Sunlight matching real calculated topocentric Sun vector */}
          <directionalLight
            position={[sun3DPos.x, sun3DPos.y, sun3DPos.z]}
            intensity={sunLightIntensity}
            castShadow={showShadows}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.5}
            shadow-camera-far={45}
            shadow-camera-left={-2.2}
            shadow-camera-right={2.2}
            shadow-camera-top={2.2}
            shadow-camera-bottom={-2.2}
            shadow-bias={-0.0004}
          />

          {/* Ambient Starlight / Earthshine */}
          <ambientLight intensity={0.25} />

          {/* Stars background */}
          <Stars radius={60} depth={40} count={3000} factor={4} saturation={0} fade speed={0.2} />

          {/* Central Moon / NASA LOLA 3D Terrain */}
          <TerrainMeshScene
            meshData={meshData}
            onPointSelect={handlePointSelect}
            clickPin={clickPin}
            setClickPin={setClickPin}
            showTerrain={showTerrain}
            showShadows={showShadows}
          />

          {/* Calculated 3D Sun Object */}
          <CelestialSunObject
            position={sun3DPos}
            azimuth={sun.azimuth_deg}
            elevation={sun.elevation_deg}
            distanceKm={sun.distance_km}
            angularDiameterDeg={sun.angular_diameter_deg}
            showLabel={showCelestialLabels}
            onFocus={handleFocusSun}
          />

          {/* Calculated 3D Earth Object */}
          <CelestialEarthObject
            position={earth3DPos}
            azimuth={earth.azimuth_deg}
            elevation={earth.elevation_deg}
            distanceKm={earth.distance_km}
            angularDiameterDeg={earth.angular_diameter_deg}
            showLabel={showCelestialLabels}
            onFocus={handleFocusEarth}
          />

          {/* 360° Tangent Horizon Ring */}
          {showHorizonRing && (
            <TangentHorizonRing dirNorth={dirNorth} dirEast={dirEast} />
          )}

          <OrbitControls
            ref={controlsRef}
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.06}
            minDistance={0.4}
            maxDistance={25.0}
            maxPolarAngle={Math.PI / 2 + 0.3} // allow seeing slightly under horizon
          />
        </Canvas>
      </div>

      {/* Bottom Action Strip: Analyze Location, Save Candidate, & Telemetry */}
      <div className="absolute bottom-2 left-3 right-3 z-30 pointer-events-none flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
        <div className="pointer-events-auto flex items-center gap-2 flex-wrap">
          {/* Analyze Location Action Button */}
          <button
            onClick={handleAnalyzeClick}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-xl shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isAnalyzing ? 'Analyzing…' : 'Analyze this location'}</span>
          </button>

          {/* Save Location as Candidate Action Button */}
          {onOpenCandidateModal && (
            <button
              onClick={onOpenCandidateModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0c1220]/95 hover:bg-slate-800 text-slate-200 hover:text-emerald-400 border border-slate-700 shadow-xl transition-all"
            >
              <BookmarkPlus className="w-4 h-4 text-emerald-400" />
              <span>Save as candidate</span>
            </button>
          )}

          {/* Observer Lat/Lon Badge */}
          <div className="bg-[#070b14]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
            Observer: <span className="text-white font-bold">{selectedLatitude.toFixed(4)}°, {selectedLongitude.toFixed(4)}°</span>
          </div>
        </div>

        {/* Live Sun & Earth telemetry badges */}
        <div className="pointer-events-auto hidden lg:flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#070b14]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px]">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Sun:</span>
            <span className="text-slate-100 font-bold">Az {sun.azimuth_deg.toFixed(1)}°</span>
            <span className={sun.elevation_deg > 0 ? 'text-emerald-400 font-bold' : 'text-slate-500 font-bold'}>
              El {sun.elevation_deg > 0 ? '+' : ''}{sun.elevation_deg.toFixed(1)}°
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#070b14]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px]">
            <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Earth:</span>
            <span className="text-slate-100 font-bold">Az {earth.azimuth_deg.toFixed(1)}°</span>
            <span className={earth.elevation_deg > 0 ? 'text-emerald-400 font-bold' : 'text-slate-500 font-bold'}>
              El {earth.elevation_deg > 0 ? '+' : ''}{earth.elevation_deg.toFixed(1)}°
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
