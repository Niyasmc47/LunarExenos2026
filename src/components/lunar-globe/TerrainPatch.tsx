import React, { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { useLocationStore } from '../../stores/locationStore';
import { fetchTerrainMesh, fetchElevationPoint } from '../../services/terrainApi';
import { TerrainMeshData } from '../../types/terrain';
import { spherePositionToLunar } from '../../utils/sphereCoordinates';

export const TerrainPatch: React.FC = () => {
  const terrainEnabled = useLocationStore((state) => state.terrainEnabled);
  const terrainExaggeration = useLocationStore((state) => state.terrainExaggeration);
  const terrainLod = useLocationStore((state) => state.terrainLod);
  const elevationLayerType = useLocationStore((state) => state.elevationLayerType);
  const setSelectedCoordinates = useLocationStore((state) => state.setSelectedCoordinates);
  const setCurrentElevationData = useLocationStore((state) => state.setCurrentElevationData);

  const [meshData, setMeshData] = useState<TerrainMeshData | null>(null);

  useEffect(() => {
    if (!terrainEnabled) return;

    let isMounted = true;

    fetchTerrainMesh('site01', terrainLod, terrainExaggeration)
      .then((data) => {
        if (isMounted && data) {
          setMeshData(data);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [terrainEnabled, terrainLod, terrainExaggeration]);

  // Construct Three.js BufferGeometry with per-vertex hypsometric colors
  const geometry = useMemo(() => {
    if (!meshData || !meshData.positions || meshData.positions.length === 0) {
      return null;
    }

    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(meshData.positions);
    const normArr = new Float32Array(meshData.normals);
    const uvArr = new Float32Array(meshData.uvs);

    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    geo.setIndex(meshData.indices);

    // Compute dynamic vertex colors based on elevation and selected layer type
    const colorArr = new Float32Array(meshData.vertex_count * 3);
    const minElev = meshData.min_elevation;
    const maxElev = meshData.max_elevation;
    const rangeElev = maxElev - minElev + 1e-6;

    for (let i = 0; i < meshData.vertex_count; i++) {
      const h = meshData.raw_elevations[i] ?? minElev;
      const t = Math.max(0, Math.min(1, (h - minElev) / rangeElev));

      let r: number, g: number, b: number;
      if (elevationLayerType === 'slope') {
        // Approximate slope tint: higher variation gets warmer tint
        r = Math.min(1.0, 0.2 + t * 0.9);
        g = Math.max(0.2, 0.9 - t * 0.6);
        b = 0.2;
      } else {
        // Lunar elevation gradient: deep crater violet/indigo -> mid gray/cyan -> bright peak white
        if (t < 0.3) {
          r = 0.2 + t * 0.5;
          g = 0.25 + t * 0.7;
          b = 0.5 + t * 0.8;
        } else if (t < 0.7) {
          r = 0.35 + t * 0.5;
          g = 0.45 + t * 0.5;
          b = 0.6 + t * 0.3;
        } else {
          r = 0.7 + (t - 0.7) * 1.0;
          g = 0.75 + (t - 0.7) * 0.8;
          b = 0.8 + (t - 0.7) * 0.6;
        }
      }

      colorArr[i * 3 + 0] = Math.min(1.0, r);
      colorArr[i * 3 + 1] = Math.min(1.0, g);
      colorArr[i * 3 + 2] = Math.min(1.0, b);
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
    geo.computeVertexNormals();

    return geo;
  }, [meshData, elevationLayerType]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!e.point) return;

    const coords = spherePositionToLunar(e.point);
    setSelectedCoordinates(coords.latitude, coords.longitude, 'globe');

    // Fetch exact elevation data at clicked terrain point
    fetchElevationPoint(coords.latitude, coords.longitude).then((pt) => {
      if (pt) setCurrentElevationData(pt);
    });
  };

  if (!terrainEnabled || !geometry) {
    return null;
  }

  return (
    <group>
      {/* 3D Real Lunar Terrain Mesh */}
      <mesh
        geometry={geometry}
        onClick={handleClick}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          vertexColors={true}
          roughness={0.88}
          metalness={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Subtle Site01 Boundary Marker Disc / Base Ring */}
      {meshData && (
        <mesh
          position={[0, -2.0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.075, 0.082, 32]} />
          <meshBasicMaterial
            color="#10b981"
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
};
