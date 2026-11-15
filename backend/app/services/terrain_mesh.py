from typing import Dict, Any, List, Optional
import numpy as np
from app.services.dem_loader import dem_loader, get_dem_loader
from app.services.coordinate_transform import transformer

def math_hypot(x: float, y: float, z: float) -> float:
    return float(np.sqrt(x*x + y*y + z*z))

class TerrainMeshService:
    def __init__(self):
        pass

    def generate_mesh_data(
        self,
        lod: str = "medium",
        vertical_exaggeration: float = 1.0,
        max_dim: Optional[int] = None,
        site_id: str = "site01",
    ) -> Dict[str, Any]:
        """
        Generates 3D terrain patch mesh data directly conforming to the
        spherical lunar surface in Three.js coordinates for any requested site.

        Returns BufferGeometry-ready typed arrays:
        - positions: [x0, y0, z0, x1, y1, z1, ...]
        - normals: [nx0, ny0, nz0, ...]
        - uvs: [u0, v0, u1, v1, ...]
        - indices: [i0, i1, i2, ...]
        - raw_elevations: [h0, h1, ...]
        """
        loader = get_dem_loader(site_id)
        grid_data = loader.get_downsampled_grid(lod=lod, max_dim=max_dim)
        elevations = grid_data["elevations"]
        h = grid_data["grid_height"]
        w = grid_data["grid_width"]

        left = grid_data["bounds_projected"]["left"]
        right = grid_data["bounds_projected"]["right"]
        bottom = grid_data["bounds_projected"]["bottom"]
        top = grid_data["bounds_projected"]["top"]

        x_coords = np.linspace(left, right, w)
        # Note: top is row 0, bottom is row h-1
        y_coords = np.linspace(top, bottom, h)

        positions = []
        normals = []
        uvs = []
        raw_elevs = []
        grid_vertex_indices = -np.ones((h, w), dtype=np.int32)

        v_idx = 0
        for r in range(h):
            y_proj = y_coords[r]
            v = 1.0 - (r / (h - 1)) if h > 1 else 0.5
            for c in range(w):
                x_proj = x_coords[c]
                u = c / (w - 1) if w > 1 else 0.5

                elev = elevations[r][c]
                if elev is None:
                    continue

                lat, lon = transformer.xy_to_lat_lon(x_proj, y_proj)
                gx, gy, gz = transformer.lat_lon_elevation_to_globe_3d(
                    lat=lat,
                    lon=lon,
                    elevation_m=elev,
                    vertical_exaggeration=vertical_exaggeration,
                    globe_radius_units=2.0
                )

                positions.extend([round(gx, 5), round(gy, 5), round(gz, 5)])
                uvs.extend([round(u, 4), round(v, 4)])
                raw_elevs.append(round(elev, 2))

                # Temporary radial normal vector pointing outwards from Moon center (0, 0, 0)
                norm_len = math_hypot(gx, gy, gz)
                if norm_len > 0:
                    normals.extend([round(gx / norm_len, 5), round(gy / norm_len, 5), round(gz / norm_len, 5)])
                else:
                    normals.extend([0.0, 1.0, 0.0])

                grid_vertex_indices[r, c] = v_idx
                v_idx += 1

        # Build indexed triangles (2 triangles per quad where all 4 vertices exist)
        indices = []
        for r in range(h - 1):
            for c in range(w - 1):
                idx_tl = grid_vertex_indices[r, c]
                idx_tr = grid_vertex_indices[r, c + 1]
                idx_bl = grid_vertex_indices[r + 1, c]
                idx_br = grid_vertex_indices[r + 1, c + 1]

                # First triangle: Top-Left, Bottom-Left, Top-Right
                if idx_tl != -1 and idx_bl != -1 and idx_tr != -1:
                    indices.extend([int(idx_tl), int(idx_bl), int(idx_tr)])

                # Second triangle: Top-Right, Bottom-Left, Bottom-Right
                if idx_tr != -1 and idx_bl != -1 and idx_br != -1:
                    indices.extend([int(idx_tr), int(idx_bl), int(idx_br)])

        return {
            "dataset_id": grid_data["dataset_id"],
            "site_id": site_id,
            "site_name": loader.cfg["name"],
            "lod": lod,
            "vertical_exaggeration": vertical_exaggeration,
            "vertex_count": v_idx,
            "triangle_count": len(indices) // 3,
            "positions": positions,
            "normals": normals,
            "uvs": uvs,
            "indices": indices,
            "raw_elevations": raw_elevs,
            "min_elevation": grid_data["min_elevation"],
            "max_elevation": grid_data["max_elevation"],
            "bounds_geographic": grid_data["bounds_geographic"],
            "center_geographic": grid_data["center_geographic"],
        }

def math_hypot(x, y, z):
    return (x*x + y*y + z*z)**0.5

terrain_mesh_service = TerrainMeshService()
