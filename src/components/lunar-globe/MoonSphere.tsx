import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { createMoonTrekCanvasTexture } from './MoonTexture';
import { LocationMarker } from './LocationMarker';
import { useLocationStore } from '../../stores/locationStore';
import { spherePositionToLunar } from '../../utils/sphereCoordinates';

interface MoonSphereProps {
  radius?: number;
}

export const MoonSphere: React.FC<MoonSphereProps> = ({ radius = 2.0 }) => {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  const selectedLatitude = useLocationStore((state) => state.selectedLatitude);
  const selectedLongitude = useLocationStore((state) => state.selectedLongitude);
  const setSelectedCoordinates = useLocationStore((state) => state.setSelectedCoordinates);
  const setGlobeLoading = useLocationStore((state) => state.setGlobeLoading);
  const setGlobeError = useLocationStore((state) => state.setGlobeError);

  useEffect(() => {
    setGlobeLoading(true);
    setGlobeError(null);

    const { texture: canvasTexture, dispose } = createMoonTrekCanvasTexture((progress) => {
      if (progress.loaded >= 8) {
        // Stage 1 (8 tiles) is sufficient for initial interaction
        setGlobeLoading(false);
      }
      if (progress.error) {
        setGlobeError(progress.error);
      }
    });

    setTexture(canvasTexture);

    return () => {
      dispose();
    };
  }, [setGlobeLoading, setGlobeError]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    // Stop propagation so only the moon sphere responds
    e.stopPropagation();

    if (!e.point) return;

    // e.point is the 3D surface intersection in world coordinates
    const coords = spherePositionToLunar(e.point);
    setSelectedCoordinates(coords.latitude, coords.longitude, 'globe');
  };

  return (
    <group>
      {/* 
        The Moon Sphere Mesh
        Rotation [0, -Math.PI / 2, 0] ensures texture UV alignment:
        - Lat 0°, Lon 0° (Sub-Earth point) faces +Z (towards initial camera)
        - North (+90° Lat) faces +Y
        - South (-90° Lat) faces -Y
        - East (+90° Lon) faces +X
        - West (-90° Lon) faces -X
      */}
      <mesh
        rotation={[0, -Math.PI / 2, 0]}
        onClick={handleClick}
        receiveShadow
        castShadow
      >
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#64748b'}
          roughness={0.92}
          metalness={0.04}
        />
      </mesh>

      {/* Synchronized 3D Target Pin Marker */}
      <LocationMarker
        latitude={selectedLatitude}
        longitude={selectedLongitude}
        radius={radius}
      />
    </group>
  );
};
