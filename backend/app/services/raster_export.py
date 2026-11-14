"""
Export operations for Lunar Elevation, Slope, Hillshades, Transects, and Clipped GeoTIFFs.
"""

import io
import csv
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import numpy as np
from PIL import Image
import rasterio
from rasterio.transform import from_bounds

from app.schemas.profile import ProfilePoint
from app.schemas.analysis import RegionalStatisticsResponse
from app.schemas.dataset import DatasetRecord
from app.schemas.export import ExportMetadata

class RasterExportService:
    @staticmethod
    def rgba_to_png_bytes(rgba: np.ndarray) -> bytes:
        """Encodes an (H, W, 4) uint8 numpy array to PNG bytes in memory."""
        img = Image.fromarray(rgba, mode="RGBA")
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return buf.getvalue()

    @staticmethod
    def profile_to_csv(points: List[ProfilePoint], dataset_name: str, citation: str) -> str:
        """Serializes elevation transect samples to standard scientific CSV format."""
        output = io.StringIO()
        writer = csv.writer(output)

        # Header metadata comments
        writer.writerow(["# LUNAVISTA Elevation Transect Export"])
        writer.writerow([f"# Dataset: {dataset_name}"])
        writer.writerow([f"# Citation: {citation}"])
        writer.writerow([f"# Generated: {datetime.now(timezone.utc).isoformat()}"])
        writer.writerow([
            "index",
            "distance_m",
            "distance_km",
            "latitude",
            "longitude",
            "projected_x_m",
            "projected_y_m",
            "elevation_m",
            "slope_deg",
            "quality_status",
        ])

        for p in points:
            writer.writerow([
                p.index,
                p.distance_m,
                p.distance_km,
                p.latitude,
                p.longitude,
                p.projected_x,
                p.projected_y,
                p.elevation_m if p.elevation_m is not None else "NaN",
                p.slope_deg if p.slope_deg is not None else "NaN",
                p.quality_status,
            ])

        return output.getvalue()

    @staticmethod
    def statistics_to_csv(stats: RegionalStatisticsResponse) -> str:
        """Serializes regional statistics to CSV."""
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["Metric", "Value", "Unit"])
        writer.writerow(["Dataset ID", stats.dataset_id, ""])
        writer.writerow(["Dataset Name", stats.dataset_name, ""])
        writer.writerow(["Nominal Pixel Spacing", stats.nominal_pixel_spacing_m, "meters"])
        writer.writerow(["Data Coverage", stats.data_coverage_percentage, "%"])
        writer.writerow(["Total Area", stats.total_area_km2, "km^2"])
        writer.writerow(["Valid Data Area", stats.valid_data_area_km2, "km^2"])
        writer.writerow(["Minimum Elevation", stats.elevation_min_m if stats.elevation_min_m is not None else "N/A", "meters"])
        writer.writerow(["Maximum Elevation", stats.elevation_max_m if stats.elevation_max_m is not None else "N/A", "meters"])
        writer.writerow(["Mean Elevation", stats.elevation_mean_m if stats.elevation_mean_m is not None else "N/A", "meters"])
        writer.writerow(["Elevation Relief", stats.elevation_range_m if stats.elevation_range_m is not None else "N/A", "meters"])
        writer.writerow(["Mean Slope", stats.slope_mean_deg if stats.slope_mean_deg is not None else "N/A", "degrees"])
        writer.writerow(["Max Slope", stats.slope_max_deg if stats.slope_max_deg is not None else "N/A", "degrees"])
        writer.writerow(["Citation", stats.citation, ""])

        return output.getvalue()

    @staticmethod
    def create_clipped_geotiff(
        dem: np.ndarray,
        bounds_projected: Dict[str, float],
        dataset: DatasetRecord,
    ) -> bytes:
        """
        Creates an in-memory Cloud-compatible GeoTIFF containing raw scientific float32
        elevations, georeferenced to NASA South Polar Stereographic CRS.
        """
        h, w = dem.shape
        left = bounds_projected["left"]
        bottom = bounds_projected["bottom"]
        right = bounds_projected["right"]
        top = bounds_projected["top"]

        transform = from_bounds(left, bottom, right, top, w, h)
        nodata = dataset.nodata_value

        clean_dem = dem.copy()
        clean_dem[np.isnan(clean_dem)] = nodata

        # Write to in-memory buffer via rasterio MemoryFile
        with rasterio.io.MemoryFile() as memfile:
            with memfile.open(
                driver="GTiff",
                height=h,
                width=w,
                count=1,
                dtype="float32",
                crs=dataset.projection_crs,
                transform=transform,
                nodata=nodata,
            ) as dst:
                dst.write(clean_dem.astype(np.float32), 1)
                dst.update_tags(
                    title=f"LUNAVISTA Clipped Elevation - {dataset.name}",
                    source=dataset.source_url,
                    citation=dataset.citation,
                    reference_frame=dataset.reference_frame,
                    elevation_datum=dataset.elevation_datum,
                    generated_by="LUNAVISTA Lunar Terrain Analysis System",
                )
            return memfile.read()

raster_export_service = RasterExportService()
