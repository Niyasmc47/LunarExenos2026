import math
from typing import Tuple, Optional
import pyproj

# Standard Lunar Mean Radius in meters (DE421 / MOON_ME reference sphere)
LUNAR_RADIUS_M = 1737400.0

# PROJ definition for NASA LOLA South Polar Stereographic
# Central meridian: 0° (Prime Meridian), Lat of origin: -90° (South Pole)
LOLA_POLAR_STERE_PROJ4 = (
    "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 "
    f"+R={LUNAR_RADIUS_M} +units=m +no_defs"
)

# Geographic lunar CRS (decimal degrees)
LUNAR_GEOGRAPHIC_PROJ4 = f"+proj=longlat +R={LUNAR_RADIUS_M} +no_defs"

class CoordinateTransformService:
    def __init__(self):
        # Create transformers using pyproj
        self.crs_polar = pyproj.CRS.from_proj4(LOLA_POLAR_STERE_PROJ4)
        self.crs_geo = pyproj.CRS.from_proj4(LUNAR_GEOGRAPHIC_PROJ4)

        self._to_polar = pyproj.Transformer.from_crs(
            self.crs_geo, self.crs_polar, always_xy=True
        )
        self._to_geo = pyproj.Transformer.from_crs(
            self.crs_polar, self.crs_geo, always_xy=True
        )

    def lat_lon_to_xy(self, lat: float, lon: float) -> Tuple[float, float]:
        """
        Convert Lunar Latitude (-90 to 90) and Longitude (-180 to 180)
        to South Polar Stereographic (X, Y) in meters.
        """
        # Analytical polar stereographic conversion for absolute consistency
        # co-latitude c in radians from South Pole
        c = (90.0 + lat) * (math.pi / 180.0)
        lam = lon * (math.pi / 180.0)

        # stereographic scale rho = 2 * R * tan(c / 2)
        rho = 2.0 * LUNAR_RADIUS_M * math.tan(c / 2.0)
        x = rho * math.sin(lam)
        y = rho * math.cos(lam)

        return float(x), float(y)

    def xy_to_lat_lon(self, x: float, y: float) -> Tuple[float, float]:
        """
        Convert South Polar Stereographic (X, Y) in meters
        to Lunar Latitude (-90 to 90) and Longitude (-180 to 180).
        """
        rho = math.hypot(x, y)
        if rho == 0.0:
            return -90.0, 0.0

        c = 2.0 * math.atan2(rho, 2.0 * LUNAR_RADIUS_M)
        lat = -90.0 + (c * 180.0 / math.pi)

        lam_rad = math.atan2(x, y)
        lon = lam_rad * (180.0 / math.pi)

        # Normalize longitude to [-180, 180]
        lon = ((lon + 180.0) % 360.0 + 360.0) % 360.0 - 180.0
        return float(lat), float(lon)

    def pixel_to_xy(self, col: float, row: float, transform) -> Tuple[float, float]:
        """
        Converts raster pixel (col, row) to projected (X, Y) in meters
        using affine GeoTransform.
        """
        # In pixel-registered rasters, col+0.5, row+0.5 is pixel center
        x, y = transform @ (col + 0.5, row + 0.5)
        return float(x), float(y)

    def xy_to_pixel(self, x: float, y: float, transform) -> Tuple[float, float]:
        """
        Converts projected (X, Y) in meters to continuous raster pixel coordinates (col, row).
        """
        inv_transform = ~transform
        col, row = inv_transform @ (x, y)
        return float(col - 0.5), float(row - 0.5)

    def lat_lon_elevation_to_globe_3d(
        self,
        lat: float,
        lon: float,
        elevation_m: float = 0.0,
        vertical_exaggeration: float = 1.0,
        globe_radius_units: float = 2.0
    ) -> Tuple[float, float, float]:
        """
        Transforms lunar lat/lon and physical elevation in meters to
        Three.js 3D coordinates matching the LUNAVISTA Moon globe.

        Globe convention:
        - Globe sphere radius = globe_radius_units (e.g. 2.0) representing 1,737,400 m.
        - Rotation [0, -pi/2, 0]:
          x = (R + delta_r) * cos(lat) * sin(lon)
          y = (R + delta_r) * sin(lat)
          z = (R + delta_r) * cos(lat) * cos(lon)
        """
        scale_factor = globe_radius_units / LUNAR_RADIUS_M
        scaled_elevation = (elevation_m * vertical_exaggeration) * scale_factor
        r = globe_radius_units + scaled_elevation

        phi = lat * (math.pi / 180.0)
        lam = lon * (math.pi / 180.0)

        x = r * math.cos(phi) * math.sin(lam)
        y = r * math.sin(phi)
        z = r * math.cos(phi) * math.cos(lam)

        return float(x), float(y), float(z)

# Global singleton
transformer = CoordinateTransformService()

def lat_lon_to_stereographic(lat: float, lon: float) -> Tuple[float, float]:
    return transformer.lat_lon_to_xy(lat, lon)

def stereographic_to_lat_lon(x: float, y: float) -> Tuple[float, float]:
    return transformer.xy_to_lat_lon(x, y)

