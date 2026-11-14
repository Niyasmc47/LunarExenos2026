import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { getMoonTrekTileUrl } from '../../services/moonTrek/wmtsConfig';

interface DynamicTile {
  key: string;
  zoom: number;
  row: number;
  col: number;
  texture: THREE.Texture;
  mesh: THREE.Mesh;
}

interface DynamicTileOverlayProps {
  radius?: number;
}

/**
 * Creates curved spherical patch geometry for a specific WMTS tile (zoom, row, col)
 * matching NASA Moon Trek's standard EPSG:104903 equirectangular scheme:
 * - Lon: from -180 to +180 (matrixWidth = 2^(zoom + 1))
 * - Lat: from +90 (row 0) to -90 (row matrixHeight-1, matrixHeight = 2^zoom)
 */
function createCurvedTileGeometry(
  zoom: number,
  row: number,
  col: number,
  radius: number,
  segments: number = 24
): THREE.BufferGeometry {
  const cols = Math.pow(2, zoom + 1);
  const rows = Math.pow(2, zoom);

  const lonStep = 360 / cols;
  const latStep = 180 / rows;

  const minLon = -180 + col * lonStep;
  const maxLon = minLon + lonStep;

  // NASA WMTS row 0 is top (+90° Lat), row rows-1 is bottom (-90° Lat)
  const maxLat = 90 - row * latStep;
  const minLat = maxLat - latStep;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Elevation offset to sit cleanly above base sphere
  const r = radius * 1.004;

  for (let y = 0; y <= segments; y++) {
    const v = y / segments;
    const lat = maxLat - v * (maxLat - minLat);
    const phi = (lat * Math.PI) / 180;

    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const lon = minLon + u * (maxLon - minLon);
      const lambda = (lon * Math.PI) / 180;

      // Coordinate mapping consistent with Three.js lunar sphere:
      // Sub-Earth point (0° Lat, 0° Lon) faces +Z
      // Lat 0°, Lon 90° faces +X
      // Lat 90° faces +Y
      const px = r * Math.cos(phi) * Math.sin(lambda);
      const py = r * Math.sin(phi);
      const pz = r * Math.cos(phi) * Math.cos(lambda);

      positions.push(px, py, pz);
      // Equirectangular patch UV mapping
      uvs.push(u, 1.0 - v);
    }
  }

  for (let y = 0; y < segments; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = y * (segments + 1) + (x + 1);
      const c = (y + 1) * (segments + 1) + (x + 1);
      const d = (y + 1) * (segments + 1) + x;

      // Counter-clockwise winding so front face points outwards
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

export const DynamicTileOverlay: React.FC<DynamicTileOverlayProps> = ({ radius = 2.0 }) => {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const activeTilesRef = useRef<Map<string, DynamicTile>>(new Map());
  const textureLoader = useMemo(() => new THREE.TextureLoader(), []);

  const lastCheckTime = useRef(0);
  const lastCameraPos = useRef(new THREE.Vector3());

  const updateVisibleTiles = useCallback(() => {
    if (!groupRef.current) return;

    const camDist = camera.position.length();

    // Trigger high-resolution streaming whenever zoomed in closer than starting view (4.5)
    let targetZoom = 0;
    if (camDist < 2.3) {
      targetZoom = 7; // Extreme close-up
    } else if (camDist < 2.7) {
      targetZoom = 6;
    } else if (camDist < 3.3) {
      targetZoom = 5;
    } else if (camDist < 4.1) {
      targetZoom = 4;
    } else {
      targetZoom = 0;
    }

    if (targetZoom === 0) {
      activeTilesRef.current.forEach((tile) => {
        groupRef.current?.remove(tile.mesh);
        tile.mesh.geometry.dispose();
        if (tile.mesh.material instanceof THREE.Material) tile.mesh.material.dispose();
        tile.texture.dispose();
      });
      activeTilesRef.current.clear();
      return;
    }

    // Camera surface normal vector
    const camDir = camera.position.clone().normalize();
    const clampedY = Math.max(-1, Math.min(1, camDir.y));
    const centerLat = (Math.asin(clampedY) * 180) / Math.PI;
    const centerLon = (Math.atan2(camDir.x, camDir.z) * 180) / Math.PI;

    const cols = Math.pow(2, targetZoom + 1);
    const rows = Math.pow(2, targetZoom);

    const centerCol = Math.floor(((centerLon + 180) / 360) * cols);
    const centerRow = Math.floor(((90 - centerLat) / 180) * rows);

    const tileRadius = camDist < 2.6 ? 2 : 3;
    const neededKeys = new Set<string>();

    for (let rOffset = -tileRadius; rOffset <= tileRadius; rOffset++) {
      for (let cOffset = -tileRadius; cOffset <= tileRadius; cOffset++) {
        const r = centerRow + rOffset;
        if (r < 0 || r >= rows) continue;

        const c = (centerCol + cOffset + cols) % cols;
        const key = `${targetZoom}_${r}_${c}`;
        neededKeys.add(key);

        if (!activeTilesRef.current.has(key)) {
          const tileUrl = getMoonTrekTileUrl(targetZoom, r, c);

          textureLoader.load(
            tileUrl,
            (loadedTex) => {
              loadedTex.colorSpace = THREE.SRGBColorSpace;
              loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
              loadedTex.magFilter = THREE.LinearFilter;
              loadedTex.needsUpdate = true;

              const geom = createCurvedTileGeometry(targetZoom, r, c, radius);
              // MeshBasicMaterial with DepthTest true & depthWrite true ensures instant visible drape
              const mat = new THREE.MeshBasicMaterial({
                map: loadedTex,
                side: THREE.DoubleSide,
                depthTest: true,
                depthWrite: true,
                transparent: false,
              });

              const mesh = new THREE.Mesh(geom, mat);
              mesh.renderOrder = 10; // Guarantees rendering directly on top of base sphere

              if (groupRef.current && neededKeys.has(key)) {
                groupRef.current.add(mesh);
                activeTilesRef.current.set(key, {
                  key,
                  zoom: targetZoom,
                  row: r,
                  col: c,
                  texture: loadedTex,
                  mesh,
                });
              } else {
                geom.dispose();
                mat.dispose();
                loadedTex.dispose();
              }
            },
            undefined,
            () => {}
          );
        }
      }
    }

    // Clean up out-of-view tiles
    activeTilesRef.current.forEach((tile, key) => {
      if (!neededKeys.has(key)) {
        groupRef.current?.remove(tile.mesh);
        tile.mesh.geometry.dispose();
        if (tile.mesh.material instanceof THREE.Material) tile.mesh.material.dispose();
        tile.texture.dispose();
        activeTilesRef.current.delete(key);
      }
    });
  }, [camera, radius, textureLoader]);

  useFrame((state) => {
    const now = state.clock.getElapsedTime();
    if (now - lastCheckTime.current > 0.08) {
      const moved = camera.position.distanceToSquared(lastCameraPos.current) > 0.0001;
      if (moved) {
        lastCameraPos.current.copy(camera.position);
        updateVisibleTiles();
      }
      lastCheckTime.current = now;
    }
  });

  useEffect(() => {
    return () => {
      activeTilesRef.current.forEach((tile) => {
        tile.mesh.geometry.dispose();
        if (tile.mesh.material instanceof THREE.Material) tile.mesh.material.dispose();
        tile.texture.dispose();
      });
      activeTilesRef.current.clear();
    };
  }, []);

  return <group ref={groupRef} />;
};
