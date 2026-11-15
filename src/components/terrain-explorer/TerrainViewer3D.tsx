import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useLocationStore } from '../../stores/locationStore';
import { fetchElevationPoint, fetchTerrainMesh } from '../../services/terrainApi';
import { inspectTerrainPoint } from '../../services/dynamicAnalysisApi';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { TerrainMeshData } from '../../types/terrain';
import { RotateCcw, Mountain, Eye, Box, Compass, Navigation } from 'lucide-react';
import { PlainLanguageExplainer } from '../ui/PlainLanguageExplainer';

interface CardinalArrowMeshProps {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  length?: number;
  color: string;
  label: string;
  badgeStyle: string;
}

const CardinalArrowMesh: React.FC<CardinalArrowMeshProps> = ({
  origin,
  direction,
  length = 0.38,
  color,
  label,
  badgeStyle,
}) => {
  const quaternion = useMemo(() => {
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize()
    );
  }, [direction]);

  const stemLength = length - 0.07;
  const labelOffset = direction.clone().normalize().multiplyScalar(length + 0.09);

  return (
    <group position={[origin.x, origin.y, origin.z]}>
      <group quaternion={quaternion}>
        {/* Arrow Cylinder Shaft */}
        <mesh position={[0, stemLength / 2, 0]}>
          <cylinderGeometry args={[0.008, 0.008, stemLength, 10]} />
          <meshBasicMaterial color={color} />
        </mesh>
        {/* Arrow Cone Tip */}
        <mesh position={[0, stemLength + 0.035, 0]}>
          <coneGeometry args={[0.026, 0.07, 14]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>

      {/* Floating 3D Label attached to tip */}
      <Html
        position={[labelOffset.x, labelOffset.y + 0.02, labelOffset.z]}
        center
        distanceFactor={8}
        zIndexRange={[100, 0]}
      >
        <div className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap shadow-xl select-none border border-black/40 ${badgeStyle}`}>
          {label}
        </div>
      </Html>
    </group>
  );
};

interface TerrainSceneProps {
  meshData: TerrainMeshData | null;
  selectedLatitude: number;
  selectedLongitude: number;
  onPointSelect: (lat: number, lon: number) => void;
  showCompass: boolean;
  clickPin: THREE.Vector3 | null;
  setClickPin: (p: THREE.Vector3 | null) => void;
}

const TerrainMeshObject: React.FC<TerrainSceneProps> = ({
  meshData,
  selectedLongitude,
  onPointSelect,
  showCompass,
  clickPin,
  setClickPin,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Build Three.js BufferGeometry from NASA LOLA data
  const geometry = useMemo(() => {
    if (!meshData || meshData.positions.length === 0) {
      return null;
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

    // Center, orient and normalize mesh geometry so it is prominently visible in 3D
    geom.computeBoundingBox();
    geom.center(); // Center to (0, 0, 0)
    geom.rotateX(Math.PI); // Orient surface normal facing upward (+Y)

    // Normalize scale so terrain patch comfortably spans ~2.4 units in Three.js space
    geom.computeBoundingBox();
    const size = new THREE.Vector3();
    geom.boundingBox!.getSize(size);
    const maxDim = Math.max(size.x, size.z);
    const scaleFactor = 2.4 / (maxDim || 1);
    geom.scale(scaleFactor, scaleFactor, scaleFactor);
    geom.computeVertexNormals();

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
      // Dark Blue (basin) -> Navy -> Emerald -> Yellow -> White peaks
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

  // Compute cardinal direction unit vectors in Three.js space
  const cardinalVectors = useMemo(() => {
    if (!meshData) return null;
    const bounds = meshData.bounds_geographic;
    const centerLon = (bounds.min_longitude + bounds.max_longitude) / 2;
    const obsLon = selectedLongitude || centerLon;
    const radLon = (obsLon * Math.PI) / 180;

    // Unit vectors in 3D Three.js space:
    // North: toward higher latitude (away from South Pole)
    const dirNorth = new THREE.Vector3(Math.sin(radLon), 0, -Math.cos(radLon)).normalize();
    // East: toward increasing longitude
    const dirEast = new THREE.Vector3(Math.cos(radLon), 0, Math.sin(radLon)).normalize();
    const dirSouth = dirNorth.clone().negate();
    const dirWest = dirEast.clone().negate();

    return { dirNorth, dirEast, dirSouth, dirWest };
  }, [meshData, selectedLongitude]);

  const handleMeshClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.point) {
      setClickPin(e.point.clone());
    }
    if (!e.uv || !meshData) return;

    // e.uv gives normalized [0, 1] texture coordinates
    const b = meshData.bounds_geographic;
    const lon = b.min_longitude + e.uv.x * (b.max_longitude - b.min_longitude);
    const lat = b.min_latitude + (1 - e.uv.y) * (b.max_latitude - b.min_latitude);

    onPointSelect(lat, lon);
  };

  if (!geometry) return null;

  // Center of compass rose: either the observer pin or the terrain center
  const compassOrigin = clickPin ? clickPin.clone() : new THREE.Vector3(0, 0.04, 0);

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
          roughness={0.82}
          metalness={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Target marker beacon pin on terrain */}
      {clickPin && (
        <group position={[clickPin.x, clickPin.y, clickPin.z]}>
          {/* Vertical beacon pole */}
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.007, 0.007, 0.24, 12]} />
            <meshBasicMaterial color="#34d399" />
          </mesh>
          {/* Beacon head crystal */}
          <mesh position={[0, 0.26, 0]}>
            <octahedronGeometry args={[0.04, 0]} />
            <meshStandardMaterial
              color="#10b981"
              emissive="#34d399"
              emissiveIntensity={2.5}
            />
          </mesh>
          {/* Observer Base Ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <ringGeometry args={[0.03, 0.05, 24]} />
            <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {/* 3D Cardinal Compass Rose & Directional Arrows */}
      {showCompass && cardinalVectors && (
        <group>
          {/* Circular Ground Compass Ring around Observer */}
          <mesh
            position={[compassOrigin.x, compassOrigin.y + 0.006, compassOrigin.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.26, 0.275, 48]} />
            <meshBasicMaterial color="#34d399" opacity={0.6} transparent side={THREE.DoubleSide} />
          </mesh>

          {/* North Arrow (0°) - Vibrant Emerald */}
          <CardinalArrowMesh
            origin={compassOrigin}
            direction={cardinalVectors.dirNorth}
            length={0.42}
            color="#10b981"
            label="N (0°)"
            badgeStyle="bg-emerald-500 text-black font-bold ring-2 ring-emerald-300"
          />

          {/* East Arrow (90°) - Sky Blue */}
          <CardinalArrowMesh
            origin={compassOrigin}
            direction={cardinalVectors.dirEast}
            length={0.36}
            color="#38bdf8"
            label="E (90°)"
            badgeStyle="bg-sky-500 text-black font-bold ring-2 ring-sky-300"
          />

          {/* South Arrow (180°) - Slate White */}
          <CardinalArrowMesh
            origin={compassOrigin}
            direction={cardinalVectors.dirSouth}
            length={0.34}
            color="#cbd5e1"
            label="S (180°)"
            badgeStyle="bg-slate-800 text-slate-200 font-bold border border-slate-600"
          />

          {/* West Arrow (270°) - Slate White */}
          <CardinalArrowMesh
            origin={compassOrigin}
            direction={cardinalVectors.dirWest}
            length={0.34}
            color="#cbd5e1"
            label="W (270°)"
            badgeStyle="bg-slate-800 text-slate-200 font-bold border border-slate-600"
          />

          {/* Outer Terrain Edge Boundary Markers */}
          <Html
            position={[cardinalVectors.dirNorth.x * 1.34, 0.08, cardinalVectors.dirNorth.z * 1.34]}
            center
            distanceFactor={8}
            zIndexRange={[90, 0]}
          >
            <div className="px-2 py-0.5 rounded-lg bg-[#141619]/95 text-emerald-400 font-bold font-mono text-[10px] border border-emerald-500/50 shadow-2xl flex items-center gap-1 select-none whitespace-nowrap">
              <span>▲ NORTH (0°)</span>
            </div>
          </Html>

          <Html
            position={[cardinalVectors.dirEast.x * 1.34, 0.08, cardinalVectors.dirEast.z * 1.34]}
            center
            distanceFactor={8}
            zIndexRange={[90, 0]}
          >
            <div className="px-2 py-0.5 rounded-lg bg-[#141619]/95 text-sky-400 font-bold font-mono text-[10px] border border-sky-500/50 shadow-2xl flex items-center gap-1 select-none whitespace-nowrap">
              <span>► EAST (90°)</span>
            </div>
          </Html>

          <Html
            position={[cardinalVectors.dirSouth.x * 1.34, 0.08, cardinalVectors.dirSouth.z * 1.34]}
            center
            distanceFactor={8}
            zIndexRange={[90, 0]}
          >
            <div className="px-2 py-0.5 rounded-lg bg-[#141619]/95 text-slate-300 font-bold font-mono text-[10px] border border-[#2b2d32] shadow-2xl flex items-center gap-1 select-none whitespace-nowrap">
              <span>▼ SOUTH (180°)</span>
            </div>
          </Html>

          <Html
            position={[cardinalVectors.dirWest.x * 1.34, 0.08, cardinalVectors.dirWest.z * 1.34]}
            center
            distanceFactor={8}
            zIndexRange={[90, 0]}
          >
            <div className="px-2 py-0.5 rounded-lg bg-[#141619]/95 text-slate-300 font-bold font-mono text-[10px] border border-[#2b2d32] shadow-2xl flex items-center gap-1 select-none whitespace-nowrap">
              <span>◄ WEST (270°)</span>
            </div>
          </Html>
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
  const activeDatasetId = useDynamicAnalysisStore((state) => state.activeDatasetId) || 'site01';

  const [meshData, setMeshData] = useState<TerrainMeshData | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'top' | 'north'>('orbit');
  const [showCompass, setShowCompass] = useState(false);
  const [clickPin, setClickPin] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    setClickPin(null);
    setLoading(true);
    fetchTerrainMesh(activeDatasetId, terrainLod, terrainExaggeration)
      .then((data) => {
        if (data) setMeshData(data);
      })
      .finally(() => setLoading(false));
  }, [activeDatasetId, terrainLod, terrainExaggeration]);

  const handlePointSelect = (lat: number, lon: number) => {
    setSelectedCoordinates(lat, lon, 'terrain');
    fetchElevationPoint(lat, lon, activeDatasetId).then((data) => {
      if (data) setCurrentElevationData(data);
    });
    inspectTerrainPoint(lat, lon, activeDatasetId).then((pt) => {
      if (pt) setCurrentPointTelemetry(pt);
    });
  };

  const handleResetCamera = () => {
    if (!controlsRef.current) return;
    controlsRef.current.object.position.set(0, 2.0, 2.5);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    setCameraMode('orbit');
  };

  const handleTopDownCamera = () => {
    if (!controlsRef.current) return;
    controlsRef.current.object.position.set(0, 3.4, 0.001);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    setCameraMode('top');
  };

  const handleAlignNorth = () => {
    if (!controlsRef.current || !meshData) return;
    const bounds = meshData.bounds_geographic;
    const centerLon = (bounds.min_longitude + bounds.max_longitude) / 2;
    const obsLon = selectedLongitude || centerLon;
    const radLon = (obsLon * Math.PI) / 180;

    // In Three.js space, South vector points from North toward South
    // Position camera south of target looking north
    const dirNorth = new THREE.Vector3(Math.sin(radLon), 0, -Math.cos(radLon)).normalize();
    const dirSouth = dirNorth.clone().negate();

    const target = clickPin ? clickPin.clone() : new THREE.Vector3(0, 0, 0);
    const camPos = target.clone().add(dirSouth.multiplyScalar(2.5)).add(new THREE.Vector3(0, 1.8, 0));

    controlsRef.current.object.position.copy(camPos);
    controlsRef.current.target.copy(target);
    controlsRef.current.update();
    setCameraMode('north');
  };

  return (
    <div className="relative w-full h-full bg-[#05080e] border border-[#2b2d32] rounded-xl overflow-hidden shadow-2xl flex flex-col group select-none">
      {/* Top HUD Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between flex-wrap gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-[#141619]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#2b2d32]/60 shadow-lg pointer-events-auto">
          <Mountain className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold tracking-wider text-slate-200 uppercase font-mono">
            3D LUNAR TERRAIN — {activeDatasetId === 'site04' ? 'SITE 04 (SHACKLETON RIM)' : activeDatasetId === 'site11' ? 'SITE 11 (DE GERLACHE RIM)' : 'SITE 01 (CONNECTING RIDGE)'}
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

        {/* Exaggeration, LOD & Compass Controls */}
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          {/* Align North Action Button */}
          <button
            onClick={handleAlignNorth}
            title="Orient camera to look directly North (0°) to match Polar Radar & Horizon Graph"
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-bold transition-all shadow-md ${
              cameraMode === 'north'
                ? 'bg-emerald-500 text-black shadow-emerald-500/20'
                : 'bg-[#141619]/90 text-emerald-400 hover:text-white hover:bg-slate-800 border border-emerald-500/40'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>ALIGN NORTH (0°)</span>
          </button>

          {/* Compass Guides Toggle */}
          <button
            onClick={() => setShowCompass(!showCompass)}
            title="Toggle 3D Cardinal Compass Guides (N, E, S, W)"
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-bold transition-all border ${
              showCompass
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-[#141619]/90 text-slate-400 hover:text-slate-200 border-[#2b2d32]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>COMPASS {showCompass ? 'ON' : 'OFF'}</span>
          </button>

          {/* Vertical Exaggeration Switcher */}
          <div className="flex items-center gap-1 bg-[#141619]/90 backdrop-blur-md px-2 py-1 rounded-lg border border-[#2b2d32]/60 text-xs font-mono">
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
          <div className="flex items-center gap-1 bg-[#141619]/90 backdrop-blur-md px-2 py-1 rounded-lg border border-[#2b2d32]/60 text-xs font-mono">
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

      {/* Floating Camera Mode Toolstrip */}
      <div className="absolute right-3 top-16 z-20 flex flex-col gap-1.5 bg-[#141619]/90 backdrop-blur-md p-1.5 rounded-lg border border-[#2b2d32]/60 shadow-lg">
        <button
          onClick={handleAlignNorth}
          title="Face Directly North (0°)"
          className={`p-2 rounded transition-colors ${
            cameraMode === 'north'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'text-slate-300 hover:text-emerald-400 hover:bg-slate-800'
          }`}
        >
          <Navigation className="w-4 h-4" />
        </button>
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
          title="Nadir Top-Down Map View"
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

      {/* 3D WebGL Canvas */}
      <div className="flex-1 w-full h-full min-h-0">
        <Canvas
          camera={{ position: [0, 2.0, 2.5], fov: 45, near: 0.05, far: 50 }}
          gl={{ antialias: true, alpha: true }}
          className="w-full h-full"
        >
          <color attach="background" args={['#05080e']} />
          <ambientLight intensity={0.65} />
          <directionalLight position={[4, 6, 3]} intensity={1.8} castShadow />
          <directionalLight position={[-4, 3, -3]} intensity={0.6} />

          <Stars radius={100} depth={50} count={2000} factor={3} saturation={0} fade speed={0.5} />

          <TerrainMeshObject
            meshData={meshData}
            selectedLatitude={selectedLatitude}
            selectedLongitude={selectedLongitude}
            onPointSelect={handlePointSelect}
            showCompass={showCompass}
            clickPin={clickPin}
            setClickPin={setClickPin}
          />

          <OrbitControls
            ref={controlsRef}
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.06}
            minDistance={0.5}
            maxDistance={8.0}
            maxPolarAngle={Math.PI / 2 - 0.02}
          />
        </Canvas>
      </div>

      {/* Bottom Hint, Cardinal Legend & Dynamic Elevation Scale */}
      <div className="absolute bottom-2 left-3 right-3 z-20 pointer-events-none flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[10px] font-mono text-slate-400 bg-[#0e1013]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#2b2d32] shadow-md">
            <span className="text-emerald-400 font-bold">Orbit:</span> Left-Click + Drag &nbsp;|&nbsp; 
            <span className="text-emerald-400 font-bold">Pan:</span> Right-Click + Drag &nbsp;|&nbsp; 
            <span className="text-emerald-400 font-bold">Zoom:</span> Scroll Wheel
          </div>

          {/* Cardinal Directions Quick Legend */}
          <div className="text-[10px] font-mono bg-[#0e1013]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#2b2d32] shadow-md flex items-center gap-2">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
              N (0°)
            </span>
            <span className="flex items-center gap-1 text-sky-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-sky-400 inline-block"></span>
              E (90°)
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
              S (180°)
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
              W (270°)
            </span>
          </div>
        </div>

        {meshData && (
          <div className="bg-[#0e1013]/90 backdrop-blur-md px-3 py-1 rounded-lg border border-[#2b2d32] text-[10px] font-mono flex items-center gap-2 shadow-md pointer-events-auto">
            <span className="text-blue-400 font-bold">{meshData.min_elevation.toFixed(0)} m</span>
            <div
              className="w-24 h-2 rounded"
              style={{
                background: 'linear-gradient(to right, #1d0e40, #2b4984, #1b8770, #4db150, #d6d338, #ffffff)',
              }}
            />
            <span className="text-amber-200 font-bold">+{meshData.max_elevation.toFixed(0)} m</span>
            <PlainLanguageExplainer topic="elevation" compact />
          </div>
        )}
      </div>
    </div>
  );
};
