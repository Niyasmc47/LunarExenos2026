export interface HorizonPoint {
  azimuth_deg: number;
  horizon_elevation_deg: number;
  distance_to_horizon_m: number;
  horizon_surface_elevation_m: number;
  horizon_lat: number;
  horizon_lon: number;
}

export interface HorizonSummary {
  max_horizon_elevation_deg: number;
  max_horizon_azimuth_deg: number;
  min_horizon_elevation_deg: number;
  min_horizon_azimuth_deg: number;
  mean_horizon_elevation_deg: number;
  total_azimuths_computed: number;
  valid_samples_count: number;
  coverage_status: 'complete' | 'partial' | 'no_data';
}

export interface HorizonAnalysisResponse {
  observer_lat: number;
  observer_lon: number;
  observer_surface_elevation_m: number;
  observer_height_m: number;
  total_observer_elevation_m: number;
  summary: HorizonSummary;
  horizon_profile: HorizonPoint[];
  parameters: {
    azimuth_resolution_deg: number;
    max_search_distance_m: number;
    sampling_interval_m: number;
    lunar_radius_m: number;
  };
  warnings: string[];
  dataset_id: string;
  dataset_name: string;
  reference_frame: string;
  citation: string;
}

export interface HorizonAnalysisRequest {
  latitude: number;
  longitude: number;
  observer_height_m: number;
  azimuth_resolution_deg: number;
  max_search_distance_m: number;
  sampling_interval_m: number;
  dataset_id: string;
}
