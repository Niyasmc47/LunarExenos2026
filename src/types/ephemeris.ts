export interface CelestialBodyPosition {
  body_name: 'Sun' | 'Earth' | string;
  azimuth_deg: number;
  elevation_deg: number;
  distance_km: number;
  apparent_angular_diameter_deg: number;
  topocentric_vector_moon_me_km: [number, number, number];
  light_time_seconds: number;
}

export interface EphemerisPositionResponse {
  observer_latitude: number;
  observer_longitude: number;
  observer_surface_elevation_m: number;
  observer_height_m: number;
  total_observer_elevation_m: number;
  observer_cartesian_moon_me_km: [number, number, number];
  requested_timestamp_iso: string;
  ephemeris_time_tdb_seconds: number;
  sun: CelestialBodyPosition;
  earth: CelestialBodyPosition;
  reference_frame: string;
  aberration_correction: string;
  lunar_radius_model_m: number;
  dataset_id: string;
  kernel_provenance: {
    toolkit: string;
    spiceypy: string;
    ephemeris_model: string;
    lunar_frame: string;
    lunar_orientation: string;
    leapseconds_kernel: string;
    planetary_constants: string;
    aberration_correction_available: string[];
  };
  warnings: string[];
}

export interface EphemerisTimeSeriesPoint {
  timestamp_iso: string;
  ephemeris_time_tdb: number;
  sun_azimuth_deg: number;
  sun_elevation_deg: number;
  sun_distance_km: number;
  sun_angular_diameter_deg: number;
  earth_azimuth_deg: number;
  earth_elevation_deg: number;
  earth_distance_km: number;
  earth_angular_diameter_deg: number;
}

export interface EphemerisTimeSeriesResponse {
  observer_latitude: number;
  observer_longitude: number;
  observer_surface_elevation_m: number;
  observer_height_m: number;
  start_timestamp_iso: string;
  end_timestamp_iso: string;
  step_interval_hours: number;
  total_epochs_computed: number;
  series: EphemerisTimeSeriesPoint[];
  reference_frame: string;
  aberration_correction: string;
  kernel_provenance: Record<string, any>;
  warnings: string[];
}

export interface KernelInfo {
  filename: string;
  kernel_type: string;
  description: string;
  file_size_bytes: number;
  loaded: boolean;
  source_url: string;
}

export interface EphemerisStatusResponse {
  service_status: string;
  spice_toolkit_version: string;
  spiceypy_version: string;
  primary_lunar_frame: string;
  active_kernels: KernelInfo[];
  total_kernels_loaded: number;
  lunar_ephemeris_model: string;
}

export interface EphemerisPositionRequest {
  latitude: number;
  longitude: number;
  timestamp_iso: string;
  observer_height_m: number;
  dataset_id?: string;
  aberration_correction?: string;
}

export interface EphemerisTimeSeriesRequest {
  latitude: number;
  longitude: number;
  start_timestamp_iso: string;
  end_timestamp_iso: string;
  step_interval_hours?: number;
  observer_height_m?: number;
  dataset_id?: string;
  aberration_correction?: string;
}
