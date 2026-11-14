import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { lunarToSpherePosition, getSurfaceNormal } from '../../utils/sphereCoordinates';

interface LocationMarkerProps {
  latitude: number;
  longitude: number;
  radius?: number;
}

export const LocationMarker: React.FC<LocationMarkerProps> = ({
  latitude,
  longitude,
  radius = 2.0,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const tipRef = useRef<THREE.Mesh>(null);

  // Surface position and normal orientation
  const { position, quaternion } = useMemo(() => {
    const pos = lunarToSpherePosition(latitude, longitude, radius, 0.01);
    const normal = getSurfaceNormal(latitude, longitude);

    // Compute rotation quaternion to orient marker along the surface normal (Z-up or Y-up)
    // Default cylinder / beam points along +Y
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);

    return { position: pos, quaternion: quat };
  }, [latitude, longitude, radius]);

  // Subtle pulsing animation
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      const s = 1.0 + 0.15 * Math.sin(t * 3);
      ringRef.current.scale.set(s, s, s);
    }
    if (tipRef.current) {
      tipRef.current.rotation.y = t * 2;
    }
  });

  return (
    <group ref={groupRef} position={position} quaternion={quaternion}>
      {/* Surface target disc / ring (flat against tangent plane) */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.04, 0.07, 32]} />
        <meshBasicMaterial
          color="#10b981"
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Outer faint reticle ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[0.08, 0.09, 32]} />
        <meshBasicMaterial
          color="#34d399"
          side={THREE.DoubleSide}
          transparent
          opacity={0.45}
        />
      </mesh>

      {/* Vertical locator beacon / laser beam */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.004, 0.008, 0.24, 16]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.8} />
      </mesh>

      {/* Floating apex beacon head */}
      <mesh ref={tipRef} position={[0, 0.25, 0]}>
        <octahedronGeometry args={[0.028, 0]} />
        <meshStandardMaterial
          color="#10b981"
          emissive="#34d399"
          emissiveIntensity={2.0}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
    </group>
  );
};
