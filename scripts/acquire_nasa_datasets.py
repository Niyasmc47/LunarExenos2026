#!/usr/bin/env python3
"""
NASA LOLA Product 78 Multi-Site Dataset Downloader, Validator & ROI Extractor.
Uses concurrent downloads for high-throughput acquisition of authentic NASA products.
Extracts official NASA ROIs for Site01, Site04, and Site11 to derive genuine candidate locations.
"""

import os
import sys
import tarfile
import urllib.request
import json
import time
import struct
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from app.services.coordinate_transform import transformer

LUNAR_DATA_DIR = BASE_DIR / "backend" / "data" / "lunar"
SITES_DIR = LUNAR_DATA_DIR / "sites"
LEGACY_SITE01_DIR = LUNAR_DATA_DIR / "site01"

NASA_BASE_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp"

SITES_CONFIG = {
    "site01": {
        "nasa_name": "Site01",
        "display_name": "Site 01 — Connecting Ridge",
        "region_name": "Connecting Ridge (Shackleton-de Gerlache)",
        "files": [
            "Site01_ROIs.tgz",
            "Site01_final_adj_5mpp_surf.tif",
            "Site01_final_adj_5mpp_slp.tif",
            "Site01_final_adj_5mpp_ldec.tif",
            "Site01_final_adj_5mpp_toterr.tif",
            "Site01_final_adj_5mpp_slperr.tif",
        ],
    },
    "site04": {
        "nasa_name": "Site04",
        "display_name": "Site 04 — Shackleton Rim",
        "region_name": "Shackleton Crater Rim",
        "files": [
            "Site04_ROIs.tgz",
            "Site04_final_adj_5mpp_surf.tif",
            "Site04_final_adj_5mpp_slp.tif",
            "Site04_final_adj_5mpp_ldec.tif",
            "Site04_final_adj_5mpp_toterr.tif",
            "Site04_final_adj_5mpp_slperr.tif",
        ],
    },
    "site11": {
        "nasa_name": "Site11",
        "display_name": "Site 11 — de Gerlache Rim",
        "region_name": "de Gerlache Crater Rim",
        "files": [
            "Site11_ROIs.tgz",
            "Site11_final_adj_5mpp_surf.tif",
            "Site11_final_adj_5mpp_slp.tif",
            "Site11_final_adj_5mpp_ldec.tif",
            "Site11_final_adj_5mpp_toterr.tif",
            "Site11_final_adj_5mpp_slperr.tif",
        ],
    },
}

def download_file_worker(item):
    url, dest_path = item
    if dest_path.exists() and dest_path.stat().st_size > 1000:
        print(f"  [EXISTS] {dest_path.name} ({dest_path.stat().st_size / 1024 / 1024:.2f} MB)")
        return dest_path.name, True, dest_path.stat().st_size

    temp_path = dest_path.with_suffix(dest_path.suffix + f".tmp_{int(time.time()*1000)}")
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "LUNAVISTA-NASA-Hackathon/1.0"})
            with urllib.request.urlopen(req, timeout=120) as resp, open(temp_path, "wb") as f_out:
                chunk_size = 512 * 1024
                while True:
                    chunk = resp.read(chunk_size)
                    if not chunk:
                        break
                    f_out.write(chunk)
            temp_path.replace(dest_path)
            size_mb = dest_path.stat().st_size / 1024 / 1024
            print(f"  [SUCCESS] {dest_path.name} ({size_mb:.2f} MB)")
            return dest_path.name, True, dest_path.stat().st_size
        except Exception as e:
            if temp_path.exists():
                temp_path.unlink()
            print(f"  [RETRY {attempt}/3] {dest_path.name} error: {e}")
            time.sleep(2 * attempt)
    return dest_path.name, False, 0

def parse_shapefile_polygons(shp_path: Path):
    """
    Parses Shapefile (type 5: Polygon) directly into list of polygon coordinate rings and centroids.
    """
    if not shp_path.exists():
        return []
    polygons = []
    try:
        with open(shp_path, "rb") as f:
            header = f.read(100)
            file_length, = struct.unpack(">i", header[24:28])
            total_bytes = file_length * 2
            
            while f.tell() < total_bytes:
                rec_hdr = f.read(8)
                if len(rec_hdr) < 8:
                    break
                rec_num, content_len = struct.unpack(">ii", rec_hdr)
                rec_bytes = content_len * 2
                rec_data = f.read(rec_bytes)
                if len(rec_data) < 36:
                    continue
                shape_type, = struct.unpack("<i", rec_data[0:4])
                if shape_type != 5:  # Polygon
                    continue
                box = struct.unpack("<dddd", rec_data[4:36])
                num_parts, num_points = struct.unpack("<ii", rec_data[36:44])
                
                parts_start = 44
                points_start = parts_start + num_parts * 4
                
                # Read points
                pts = []
                for i in range(num_points):
                    px, py = struct.unpack("<dd", rec_data[points_start + i*16 : points_start + (i+1)*16])
                    pts.append((px, py))
                
                if pts:
                    # Centroid (mean of vertices)
                    cx = sum(p[0] for p in pts) / len(pts)
                    cy = sum(p[1] for p in pts) / len(pts)
                    clat, clon = transformer.xy_to_lat_lon(cx, cy)
                    min_x, min_y, max_x, max_y = box
                    sw_lat, sw_lon = transformer.xy_to_lat_lon(min_x, min_y)
                    ne_lat, ne_lon = transformer.xy_to_lat_lon(max_x, max_y)
                    
                    polygons.append({
                        "roi_index": rec_num,
                        "projected_box": {"min_x": min_x, "min_y": min_y, "max_x": max_x, "max_y": max_y},
                        "geographic_box": {
                            "min_lat": min(sw_lat, ne_lat),
                            "max_lat": max(sw_lat, ne_lat),
                            "min_lon": min(sw_lon, ne_lon),
                            "max_lon": max(sw_lon, ne_lon),
                        },
                        "centroid_projected": {"x": round(cx, 2), "y": round(cy, 2)},
                        "centroid_geographic": {"latitude": round(clat, 5), "longitude": round(clon, 5)},
                        "num_vertices": len(pts),
                    })
    except Exception as e:
        print(f"  [ERROR parsing {shp_path.name}]: {e}")
    return polygons

def validate_raster(path: Path):
    import rasterio
    import numpy as np

    if not path.exists():
        return None

    try:
        with rasterio.open(path) as src:
            bounds = src.bounds
            res = src.res
            nodata = src.nodata
            
            # Geographic bounds
            corners_xy = [
                (bounds.left, bounds.bottom),
                (bounds.left, bounds.top),
                (bounds.right, bounds.bottom),
                (bounds.right, bounds.top),
            ]
            corners_geo = [transformer.xy_to_lat_lon(x, y) for x, y in corners_xy]
            min_lat = min(c[0] for c in corners_geo)
            max_lat = max(c[0] for c in corners_geo)
            min_lon = min(c[1] for c in corners_geo)
            max_lon = max(c[1] for c in corners_geo)
            
            # Center
            center_x = (bounds.left + bounds.right) / 2.0
            center_y = (bounds.bottom + bounds.top) / 2.0
            center_lat, center_lon = transformer.xy_to_lat_lon(center_x, center_y)

            # Sample slice for value stats
            sample = src.read(1, out_shape=(src.height // 8, src.width // 8))
            valid = sample[sample != nodata] if nodata is not None else sample
            min_val = float(np.min(valid)) if valid.size > 0 else 0.0
            max_val = float(np.max(valid)) if valid.size > 0 else 0.0
            mean_val = float(np.mean(valid)) if valid.size > 0 else 0.0

            return {
                "file_name": path.name,
                "file_size_bytes": path.stat().st_size,
                "width": src.width,
                "height": src.height,
                "count": src.count,
                "crs": str(src.crs),
                "transform": [round(v, 4) for v in src.transform],
                "bounds_projected": {
                    "left": bounds.left,
                    "bottom": bounds.bottom,
                    "right": bounds.right,
                    "top": bounds.top,
                },
                "bounds_geographic": {
                    "min_lat": round(min_lat, 5),
                    "max_lat": round(max_lat, 5),
                    "min_lon": round(min_lon, 5),
                    "max_lon": round(max_lon, 5),
                },
                "center_geographic": {
                    "latitude": round(center_lat, 5),
                    "longitude": round(center_lon, 5),
                },
                "resolution_m": [res[0], res[1]],
                "nodata": nodata,
                "stats": {
                    "min": round(min_val, 2),
                    "max": round(max_val, 2),
                    "mean": round(mean_val, 2),
                },
            }
    except Exception as e:
        print(f"  [VALIDATION ERROR] {path.name}: {e}")
        return None

def main():
    print("=== LUNAVISTA Multi-Region NASA Dataset Acquisition & Validation ===")
    SITES_DIR.mkdir(parents=True, exist_ok=True)

    # Link/Copy legacy site01 files if present
    site01_dest = SITES_DIR / "site01"
    site01_dest.mkdir(parents=True, exist_ok=True)
    if LEGACY_SITE01_DIR.exists():
        for f in LEGACY_SITE01_DIR.glob("*.tif"):
            target = site01_dest / f.name
            if not target.exists():
                try:
                    os.link(f, target)
                    print(f"Hardlinked {f.name} to {target}")
                except Exception:
                    import shutil
                    shutil.copy2(f, target)
                    print(f"Copied {f.name} to {target}")

    # Build queue of primary downloads:
    # Tier 1: ROIs, surf.tif, slp.tif for all sites
    # Tier 2: ldec.tif, toterr.tif, slperr.tif
    tier1_items = []
    tier2_items = []

    for site_key, site_info in SITES_CONFIG.items():
        site_dir = SITES_DIR / site_key
        site_dir.mkdir(parents=True, exist_ok=True)
        for fname in site_info["files"]:
            url = f"{NASA_BASE_URL}/{site_info['nasa_name']}/{fname}"
            dest = site_dir / fname
            if fname.endswith("ROIs.tgz") or "surf.tif" in fname or "slp.tif" in fname:
                tier1_items.append((url, dest))
            else:
                tier2_items.append((url, dest))

    print(f"\nPhase 1: Downloading {len(tier1_items)} Primary Terrain & ROI Datasets (Parallel)...")
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(download_file_worker, item): item for item in tier1_items}
        for future in as_completed(futures):
            name, ok, sz = future.result()

    print(f"\nPhase 2: Downloading {len(tier2_items)} Companion Uncertainty & Measurement Products (Parallel)...")
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(download_file_worker, item): item for item in tier2_items}
        for future in as_completed(futures):
            name, ok, sz = future.result()

    # Extract ROIs and validate rasters
    print("\nPhase 3: Inspecting Official NASA ROIs and Validating GeoTIFF Rasters...")
    verified_catalogue = {}

    for site_key, site_info in SITES_CONFIG.items():
        site_dir = SITES_DIR / site_key
        print(f"\nValidating {site_info['display_name']} ({site_key})...")
        
        # Extract ROIs
        roi_tar = site_dir / f"{site_info['nasa_name']}_ROIs.tgz"
        roi_dir = site_dir / "rois"
        roi_dir.mkdir(exist_ok=True)
        if roi_tar.exists():
            try:
                with tarfile.open(roi_tar, "r:gz") as tar:
                    tar.extractall(path=roi_dir)
                    print(f"  Extracted ROI archive: {roi_tar.name}")
            except Exception as e:
                print(f"  Error extracting ROI archive: {e}")

        # Parse ROI polygons from shapefile
        shp_file = roi_dir / f"{site_info['nasa_name']}_ROIs.shp"
        rois = parse_shapefile_polygons(shp_file)
        print(f"  Extracted {len(rois)} authentic NASA candidate ROIs from {shp_file.name}")

        site_meta = {
            "site_id": site_key,
            "nasa_name": site_info["nasa_name"],
            "display_name": site_info["display_name"],
            "region_name": site_info["region_name"],
            "source_url": f"https://pgda.gsfc.nasa.gov/products/78",
            "source_directory": f"{NASA_BASE_URL}/{site_info['nasa_name']}/",
            "citation": "Barker, M. K., et al. (2021). Improved LOLA Elevation Maps for South Pole Landing Sites. PSS, 203, 105119.",
            "reference_frame": "MOON_ME (DE421)",
            "vertical_datum": "IAU Moon 2000 Reference Sphere (R = 1,737,400 m)",
            "projection_crs": "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs",
            "download_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "files": {},
            "rois": rois,
        }

        # Validate each raster
        for fname in site_info["files"]:
            if fname.endswith(".tif"):
                dest = site_dir / fname
                rinfo = validate_raster(dest)
                site_meta["files"][fname] = {
                    "available": rinfo is not None,
                    "info": rinfo,
                }
                if rinfo and "surf.tif" in fname:
                    site_meta["bounds_projected"] = rinfo["bounds_projected"]
                    site_meta["bounds_geographic"] = rinfo["bounds_geographic"]
                    site_meta["center_geographic"] = rinfo["center_geographic"]
                    site_meta["elevation_stats"] = rinfo["stats"]

        verified_catalogue[site_key] = site_meta

    # Ensure backward compatible symlinks
    for site_key in SITES_CONFIG.keys():
        legacy_compat_dir = LUNAR_DATA_DIR / site_key
        if not legacy_compat_dir.exists():
            try:
                legacy_compat_dir.symlink_to(f"sites/{site_key}", target_is_directory=True)
                print(f"Created compatibility symlink: {legacy_compat_dir} -> sites/{site_key}")
            except Exception as e:
                pass

    summary_path = SITES_DIR / "verified_nasa_catalog.json"
    with open(summary_path, "w") as f:
        json.dump(verified_catalogue, f, indent=2)
    print(f"\nCatalogue written to {summary_path}")
    print("=== Multi-Region NASA Dataset Acquisition & Validation Complete ===")

if __name__ == "__main__":
    main()
