#!/usr/bin/env python3
"""
Inspect LOLA DEM GeoTIFF metadata, coordinate system, and statistics.
NASA PGDA Product 78 (Site01 - Connecting Ridge).
"""

import sys
import os
from pathlib import Path
import json

def inspect_dem(tif_path: str):
    import rasterio
    from rasterio.crs import CRS
    import numpy as np

    path = Path(tif_path)
    if not path.exists():
        print(f"Error: File not found: {tif_path}", file=sys.stderr)
        sys.exit(1)

    print(f"==================================================")
    print(f"LOLA DEM INSPECTION REPORT: {path.name}")
    print(f"==================================================")

    with rasterio.open(path) as src:
        width = src.width
        height = src.height
        count = src.count
        dtypes = src.dtypes
        nodata = src.nodata
        bounds = src.bounds
        res = src.res
        transform = src.transform
        crs = src.crs

        print(f"File Path:          {path.resolve()}")
        print(f"File Size:          {path.stat().st_size / (1024*1024):.2f} MB")
        print(f"Raster Dimensions:  {width} columns x {height} rows x {count} band(s)")
        print(f"Data Type:          {dtypes[0]}")
        print(f"Pixel Size (Res):   X={res[0]:.4f} m, Y={res[1]:.4f} m")
        print(f"NoData Value:       {nodata}")
        print(f"Affine Transform:   {list(transform)}")
        print(f"Spatial Bounds:     Left={bounds.left:.2f}, Bottom={bounds.bottom:.2f}, Right={bounds.right:.2f}, Top={bounds.top:.2f} (meters)")
        print(f"Coordinate System:  {crs}")
        if crs:
            print(f"CRS WKT / Proj4:    {crs.to_string()}")

        # Read elevation data
        data = src.read(1)
        if nodata is not None:
            valid_mask = data != nodata
            if np.isnan(nodata):
                valid_mask = ~np.isnan(data)
        else:
            valid_mask = np.ones_like(data, dtype=bool)

        valid_count = np.count_nonzero(valid_mask)
        total_count = data.size
        missing_count = total_count - valid_count

        print(f"\n--- DATA QUALITY & STATISTICS ---")
        print(f"Total Pixels:       {total_count:,}")
        print(f"Valid Pixels:       {valid_count:,} ({valid_count/total_count*100:.2f}%)")
        print(f"Missing (NoData):   {missing_count:,} ({missing_count/total_count*100:.2f}%)")

        if valid_count > 0:
            valid_data = data[valid_mask]
            min_val = float(np.min(valid_data))
            max_val = float(np.max(valid_data))
            mean_val = float(np.mean(valid_data))
            std_val = float(np.std(valid_data))

            print(f"Min Elevation:      {min_val:.3f} m")
            print(f"Max Elevation:      {max_val:.3f} m")
            print(f"Elevation Range:    {max_val - min_val:.3f} m")
            print(f"Mean Elevation:     {mean_val:.3f} m")
            print(f"Std Deviation:      {std_val:.3f} m")
        else:
            print("Warning: No valid pixels found in raster!")

        # Check companion products
        dir_path = path.parent
        base_prefix = path.stem.replace("_surf", "").replace("_ldec", "").replace("_slp", "").replace("_toterr", "").replace("_slperr", "")
        companions = {
            "surf": dir_path / f"{base_prefix}_surf.tif",
            "ldec": dir_path / f"{base_prefix}_ldec.tif",
            "slp": dir_path / f"{base_prefix}_slp.tif",
            "toterr": dir_path / f"{base_prefix}_toterr.tif",
            "slperr": dir_path / f"{base_prefix}_slperr.tif",
        }

        print(f"\n--- COMPANION DATASETS (Site01) ---")
        for k, p in companions.items():
            status = "FOUND" if p.exists() else "NOT FOUND"
            print(f"[{status:9}] {k.upper():6}: {p.name}")

        return {
            "filename": path.name,
            "dimensions": {"width": width, "height": height, "bands": count},
            "pixel_size_m": res,
            "bounds": {"left": bounds.left, "bottom": bounds.bottom, "right": bounds.right, "top": bounds.top},
            "crs": str(crs),
            "nodata": float(nodata) if nodata is not None else None,
            "statistics": {
                "valid_pixels": int(valid_count),
                "total_pixels": int(total_count),
                "min": float(min_val) if valid_count > 0 else None,
                "max": float(max_val) if valid_count > 0 else None,
                "mean": float(mean_val) if valid_count > 0 else None,
                "std": float(std_val) if valid_count > 0 else None,
            }
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: inspect_dem.py <path_to_geotiff>")
        sys.exit(1)
    inspect_dem(sys.argv[1])
