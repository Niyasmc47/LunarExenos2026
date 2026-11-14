import os
import hashlib
from pathlib import Path
from typing import Dict, Any, List
import spiceypy as spice

KERNEL_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "kernels"

KERNEL_MANIFEST = [
    {
        "filename": "naif0012.tls",
        "kernel_type": "LSK (Leapseconds Kernel)",
        "description": "Official NAIF leapseconds kernel for UTC <-> ET/TDB transformations",
        "source_url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
        "expected_min_bytes": 5000,
    },
    {
        "filename": "pck00010.tpc",
        "kernel_type": "PCK (Planetary Constants)",
        "description": "IAU planetary constants kernel containing physical dimensions of Sun, Moon, and planets",
        "source_url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc",
        "expected_min_bytes": 100000,
    },
    {
        "filename": "moon_pa_de421_1900-2050.bpc",
        "kernel_type": "PCK (Binary Lunar Orientation)",
        "description": "High-precision DE421 lunar orientation and physical libration kernel (1900-2050)",
        "source_url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de421_1900-2050.bpc",
        "expected_min_bytes": 1500000,
    },
    {
        "filename": "moon_080317.tf",
        "kernel_type": "FK (Lunar Frames Definition)",
        "description": "NASA frame definition kernel establishing MOON_ME (Mean Earth/Polar Axis DE421 realization)",
        "source_url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf",
        "expected_min_bytes": 20000,
    },
    {
        "filename": "de421.bsp",
        "kernel_type": "SPK (Planetary Ephemeris)",
        "description": "NASA JPL DE421 planetary ephemeris kernel providing high-precision states for Sun, Earth, Moon",
        "source_url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/de421.bsp",
        "expected_min_bytes": 16000000,
    },
]

class SpiceKernelManager:
    def __init__(self, kernel_dir: Path = KERNEL_DIR):
        self.kernel_dir = kernel_dir
        self.kernel_dir.mkdir(parents=True, exist_ok=True)
        self._loaded = False
        self._loaded_files: List[str] = []

    def ensure_kernels_loaded(self) -> None:
        """
        Validates presence of all required kernels and loads them into SPICE pool.
        """
        if self._loaded and len(self._loaded_files) == len(KERNEL_MANIFEST):
            return

        for item in KERNEL_MANIFEST:
            path = self.kernel_dir / item["filename"]
            if not path.exists() or path.stat().st_size < item["expected_min_bytes"]:
                raise FileNotFoundError(
                    f"Required SPICE kernel '{item['filename']}' not found or corrupt at {path}. "
                    f"Source: {item['source_url']}"
                )

            # Load into SPICE kernel pool if not already loaded
            if str(path) not in self._loaded_files:
                spice.furnsh(str(path))
                self._loaded_files.append(str(path))

        self._loaded = True

    def get_status(self) -> Dict[str, Any]:
        """
        Returns complete kernel status, versions, and file verification metadata.
        """
        kernel_infos = []
        for item in KERNEL_MANIFEST:
            path = self.kernel_dir / item["filename"]
            exists = path.exists()
            size = path.stat().st_size if exists else 0
            is_loaded = str(path) in self._loaded_files

            kernel_infos.append({
                "filename": item["filename"],
                "kernel_type": item["kernel_type"],
                "description": item["description"],
                "file_size_bytes": size,
                "loaded": is_loaded,
                "source_url": item["source_url"],
            })

        return {
            "service_status": "operational" if self._loaded else "uninitialized",
            "spice_toolkit_version": spice.tkvrsn("TOOLKIT"),
            "spiceypy_version": spice.__version__,
            "primary_lunar_frame": "MOON_ME (DE421)",
            "active_kernels": kernel_infos,
            "total_kernels_loaded": len(self._loaded_files),
            "lunar_ephemeris_model": "JPL DE421 / MOON_ME Mean Earth & Polar Axis",
        }

    def get_provenance_metadata(self) -> Dict[str, Any]:
        """
        Detailed provenance dictionary returned with every ephemeris calculation.
        """
        return {
            "toolkit": f"NASA/JPL CSPICE {spice.tkvrsn('TOOLKIT')}",
            "spiceypy": f"SpiceyPy {spice.__version__}",
            "ephemeris_model": "JPL DE421 (Planetary & Lunar Ephemeris)",
            "lunar_frame": "MOON_ME (DE421 realization, Mean Earth / Polar Axis)",
            "lunar_orientation": "moon_pa_de421_1900-2050.bpc + moon_080317.tf",
            "leapseconds_kernel": "naif0012.tls",
            "planetary_constants": "pck00010.tpc",
            "aberration_correction_available": ["NONE", "LT", "LT+S"],
        }

kernel_manager = SpiceKernelManager()
