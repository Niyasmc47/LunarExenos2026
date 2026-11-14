import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useLocationStore } from '../../stores/locationStore';
import { fetchElevationPoint, fetchTerrainMesh } from '../../services/terrainApi';
import { inspectTerrainPoint } from '../../services/dynamicAnalysisApi';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { TerrainMeshData } from '../../types/terrain';
import { RotateCcw, Mountain, Eye, Box } from 'lucide-react';

interface TerrainSceneProps {
  meshData: TerrainMeshData | null;
  selectedLatitude: number;
  selectedLongitude: number;
  onPointSelect: (lat: number, lon: number) => void;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

const TerrainMeshObject: React.FC<TerrainSceneProps> = ({
  meshData,
  selectedLatitude,
  selectedLongitude,
  onPointSelect,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Build Three.js BufferGeometry from NASA LOLA data
  const { geometry, localBounds } = useMemo(() => {
    if (!meshData || meshData.positions.length === 0) {
      return { geometry: null, localBounds: null };
    }

    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(meshData.positions);
    const normals = new Float32Array(meshData.normals);
    const uvs = new Float32Array(meshData.uvs);
    const indices = new Uint32Array(meshData.indices);

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));

    // Center mesh geometry so it is easily viewable and inspectable in local coordinates
    geom.computeBoundingBox();
    const bbox = geom.boundingBox!;
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    // Vertex colors based on elevation
    const count = meshData.raw_elevations.length;
    const colors = new Float32Array(count * 3);
    const minZ = meshData.min_elevation;
    const maxZ = meshData.max_elevation;
    const range = Math.max(1, maxZ - minZ);

    for (let i = 0; i < count; i++) {
      const z = meshData.raw_elevations[i];
      const t = Math.max(0, Math.min(1, (z - minZ) / range));

      // Scientific hypsometric tinting:
      // Dark Blue (basin) -> Teal -> Green -> Yellow -> White (peaks)
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

    return {
      geometry: geom,
      localBounds: {
        center,
        min: bbox.min,
        max: bbox.max,
      },
    };
  }, [meshData]);

  // Compute selected pin position on local mesh
  const markerPosition = useMemo(() => {
    if (!meshData || !localBounds) return null;

    const b = meshData.bounds_geographic;
    const latSpan = Math.abs(b.max_latitude - b.min_latitude);
    const lonSpan = Math.abs(b.max_longitude - b.min_longitude);

    if (latSpan === 0 || lonSpan === 0) return null;

    // Check if in bounds
    if (
      selectedLatitude < Math.min(b.min_latitude, b.max_latitude) ||
      selectedLatitude > Math.max(b.min_latitude, b.max_latitude) ||
      selectedLongitude < Math.min(b.min_longitude, b.max_longitude) ||
      selectedLongitude > Math.max(b.min_longitude, b.max_longitude)
    ) {
      return null;
    }

    // Normalized UV coordinate in the patch
    const u = (selectedLongitude - b.min_longitude) / lonSpan;
    const v = (selectedLatitude - b.min_latitude) / latSpan;

    const x = localBounds.min.x + u * (localBounds.max.x - localBounds.min.x);
    const z = localBounds.min.z + (1 - v) * (localBounds.max.z - localBounds.min.z);

    // Approximate surface height above center
    const y = localBounds.max.y * 0.5;

    return new THREE.Vector3(x, y, z);
  }, [meshData, localBounds, selectedLatitude, selectedLongitude]);

  const handleMeshClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!e.uv || !meshData) return;

    // e.uv gives normalized [0, 1] texture coordinates
    const b = meshData.bounds_geographic;
    const lon = b.min_longitude + e.uv.x * (b.max_longitude - b.min_longitude);
    const lat = b.min_latitude + (1 - e.uv.y) * (b.max_latitude - b.min_latitude);

    onPointSelect(lat, lon);
  };

  if (!geometry) return null;

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        onClick={handleMeshClick}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.88}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Target marker pin on terrain */}
      {markerPosition && (
        <group position={markerPosition}>
          {/* Vertical beacon line */}
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.003, 0.003, 0.16, 12]} />
            <meshBasicMaterial color="#34d399" />
          </mesh>
          {/* Beacon head */}
          <mesh position={[0, 0.17, 0]}>
            <octahedronGeometry args={[0.02, 0]} />
            <meshStandardMaterial
              color="#10b981"
              emissive="#34d399"
              emissiveIntensity={2.0}
            />
          </mesh>
          {/* Surface ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <ringGeometry args={[0.02, 0.035, 24]} />
            <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
};

export const TerrainViewer3D: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const selectedLatitude = useLocationStore((state) => state.selectedLatitude);
  const selectedLongitude = useLocationStore((state) => state.selectedLongitude);
  const terrainLod = useLocationStore((state) => state.terrainLod);
  const setTerrainLod = useLocationStore((state) => state.setTerrainLod);
  const terrainExaggeration = useLocationStore((state) => state.terrainExaggeration);
  const setTerrainExaggeration = useLocationStore((state) => state.setTerrainExaggeration);
  const setSelectedCoordinates = useLocationStore((state) => state.setSelectedCoordinates);
  const setCurrentElevationData = useLocationStore((state) => state.setCurrentElevationData);
  const setCurrentPointTelemetry = useDynamicAnalysisStore((state) => state.setCurrentPointTelemetry);

  const [meshData, setMeshData] = useState<TerrainMeshData | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'top'>('orbit');

  useEffect(() => {
    setLoading(true);
    fetchTerrainMesh('site01', terrainLod, terrainExaggeration)
      .then((data) => {
        if (data) setMeshData(data);
      })
      .finally(() => setLoading(false));
  }, [terrainLod, terrainExaggeration]);

  const handlePointSelect = (lat: number, lon: number) => {
    setSelectedCoordinates(lat, lon, 'terrain');
    fetchElevationPoint(lat, lon).then((data) => {
      if (data) setCurrentElevationData(data);
    });
    inspectTerrainPoint(lat, lon, 'site01').then((pt) => {
      if (pt) setCurrentPointTelemetry(pt);
    });
  };

  const handleResetCamera = () => {
    if (!controlsRef.current) return;
    controlsRef.current.object.position.set(0, 1.2, 1.8);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    setCameraMode('orbit');
  };

  const handleTopDownCamera = () => {
    if (!controlsRef.current) return;
    controlsRef.current.object.position.set(0, 2.2, 0.01);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    setCameraMode('top');
  };

  return (
    <div className="relative w-full h-full bg-[#05080e] border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col group">
      {/* Top HUD Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between flex-wrap gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-[#0c121e]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-lg pointer-events-auto">
          <Mountain className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold tracking-wider text-slate-200 uppercase font-mono">
            3D LUNAR TERRAIN — SITE 01
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
            NASA LOLA DEM
          </span>
          {loading && (
            <span className="text-[10px] text-emerald-400 font-mono animate-pulse">
              LOADING MESH...
            </span>
          )}
        </div>

        {/* Exaggeration & LOD Controls */}
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          {/* Vertical Exaggeration Switcher */}
          <div className="flex items-center gap-1 bg-[#0c121e]/90 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-700/60 text-xs font-mono">
            <span className="text-[10px] text-slate-400">RELIEF:</span>
            {[1.0, 1.5, 2.0, 3.0, 5.0].map((exag) => (
              <button
                key={exag}
                onClick={() => setTerrainExaggeration(exag)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                  terrainExaggeration === exag
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
                }`}
              >
                {exag.toFixed(1)}×
              </button>
            ))}
          </div>

          {/* LOD Switcher */}
          <div className="flex items-center gap-1 bg-[#0c121e]/90 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-700/60 text-xs font-mono">
            <span className="text-[10px] text-slate-400">MESH:</span>
            {(['low', 'medium', 'high'] as const).map((lod) => (
              <button
                key={lod}
                onClick={() => setTerrainLod(lod)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                  terrainLod === lod
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
                }`}
              >
                {lod}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Camera Actions */}
      <div className="absolute right-3 top-16 z-20 flex flex-col gap-1.5 bg-[#0c121e]/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700/60 shadow-lg">
        <button
          onClick={handleResetCamera}
          title="3D Orbit Perspective View"
          className={`p-2 rounded transition-colors ${
            cameraMode === 'orbit'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'text-slate-300 hover:text-emerald-400 hover:bg-slate-800'
          }`}
        >
          <Box className="w-4 h-4" />
        </button>
        <button
          onClick={handleTopDownCamera}
          title="Nadir Top-Down View"
          className={`p-2 rounded transition-colors ${
            cameraMode === 'top'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'text-slate-300 hover:text-emerald-400 hover:bg-slate-800'
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetCamera}
          title="Reset Camera Position"
          className="p-2 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* 3D Canvas */}
      <div className="flex-1 w-full h-full min-h-0">
        <Canvas
          camera={{ position: [0, 1.2, 1.8], fov: 42 }}
          gl={{ antialias: true, alpha: true }}
          className="w-full h-full"
        >
          <color attach="background" args={['#05080e']} />
          <ambientLight intensity={0.45} />
          <directionalLight position={[3, 5, 2]} intensity={1.5} castShadow />
          <directionalLight position={[-3, 2, -2]} intensity={0.4} />

          <Stars radius={100} depth={50} count={2000} factor={3} saturation={0} fade speed={0.5} />

          <TerrainMeshObject
            meshData={meshData}
            selectedLatitude={selectedLatitude}
            selectedLongitude={selectedLongitude}
            onPointSelect={handlePointSelect}
            controlsRef={controlsRef}
          />

          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.06}
            minDistance={0.3}
            maxDistance={6.0}
            maxPolarAngle={Math.PI / 2 + 0.1}
          />
        </Canvas>
      </div>

      {/* Bottom Hint & Dynamic Elevation Scale */}
      <div className="absolute bottom-2 left-3 right-3 z-20 pointer-events-none flex items-center justify-between flex-wrap gap-2">
        <div className="text-[10px] font-mono text-slate-400 bg-[#070b12]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 shadow-md">
          <span className="text-emerald-400 font-bold">Orbit:</span> Left-Click + Drag &nbsp;|&nbsp; 
          <span className="text-emerald-400 font-bold">Pan:</span> Right-Click + Drag &nbsp;|&nbsp; 
          <span className="text-emerald-400 font-bold">Zoom:</span> Scroll Wheel
        </div>

        {meshData && (
          <div className="bg-[#070b12]/90 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-800 text-[10px] font-mono flex items-center gap-2 shadow-md">
            <span className="text-blue-400 font-bold">{meshData.min_elevation.toFixed(0)} m</span>
            <div
              className="w-24 h-2 rounded"
              style={{
                background: 'linear-gradient(to right, #1d0e40, #2b4984, #1b8770, #4db150, #d6d338, #ffffff)',
              }}
            />
            <span className="text-amber-200 font-bold">+{meshData.max_elevation.toFixed(0)} m</span>
          </div>
        )}
      </div>
    </div>
  );
};
