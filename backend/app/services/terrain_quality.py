"""
Lunar terrain data quality and scientific provenance service.
"""

from typing import Dict, Any

def get_terrain_quality_report(dataset_id: str) -> Dict[str, Any]:
    """
    Returns scientific data quality, reference frames, and interpolation disclosures.
    """
    if dataset_id == "site01":
        return {
            "dataset_id": "site01",
            "name": "Site 01 — Connecting Ridge",
            "source": "NASA Planetary Geodynamics Data Archive (GSFC)",
            "product_id": "LOLA_South_Pole_5mpp_Site01",
            "reference_frame": "MOON_ME (DE421 Mean Earth/Polar Axis)",
            "projection": "South Polar Stereographic (EPSG-independent PROJ)",
            "projection_parameters": {
                "latitude_of_origin": -90.0,
                "central_meridian": 0.0,
                "scale_factor": 1.0,
                "false_easting": 0.0,
                "false_northing": 0.0,
                "datum_radius_m": 1737400.0,
            },
            "grid_spacing_m": 5.0,
            "elevation_datum": "Sphere R = 1,737,400 m",
            "effective_resolution": "Variable (LOLA laser track along-track spacing ~10-20 m; cross-track spacing variable; ~90% of pixels interpolated via Delaunay/spline triangulation)",
            "precision_vertical_m": "Typically ~1 m in well-tracked areas",
            "slope_units": "Degrees [0, 90]",
            "slope_window": "Calculated via 3x3 Sobel/Horn surface filter over 5 m grid",
            "nodata_value": -32767.0,
            "caveats": [
                "5 m pixel spacing reflects the raster grid resolution, not the effective optical/laser sensor footprint.",
                "Permanent shadows near Shackleton Crater create extreme thermal and visual contrast.",
                "Elevations are topographic heights relative to the reference 1737.4 km lunar sphere, not an Earth geoid/sea level.",
            ],
        }
    return {"dataset_id": dataset_id, "status": "unknown"}
