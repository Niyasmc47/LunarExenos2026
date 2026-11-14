export interface DatasetRecord {
  dataset_id: str;
  product_series: str;
  name: str;
  region_name: str;
  description: str;
  source_url: str;
  citation: str;
  reference_frame: str;
  projection_crs: str;
  nominal_pixel_spacing_m: number;
  effective_resolution_note: str;
  bounds_projected: { left: number; bottom: number; right: number; top: number };
  bounds_geographic: { min_lat: number; max_lat: number; min_lon: number; max_lon: number };
  elevation_datum: str;
  elevation_units: str;
  nodata_value: number;
  file_size_mb: number;
  access_method: str;
  is_local_available: boolean;
  companion_layers: string[];
  quality_notes: string[];
}

type str = string;

export interface DatasetCatalogueResponse {
  total_datasets: number;
  datasets: DatasetRecord[];
}

export interface DatasetDiscoveryCandidate {
  dataset: DatasetRecord;
  coverage_percentage: number;
  overlaps_completely: boolean;
  intersection_bounds_geographic: { min_lat: number; max_lat: number; min_lon: number; max_lon: number };
  resolution_rank: number;
  recommendation_type?: 'best_resolution' | 'best_coverage' | 'alternative';
  notes: string[];
}

export interface DatasetDiscoveryResponse {
  selected_region_geographic: { min_lat: number; max_lat: number; min_lon: number; max_lon: number };
  selected_region_area_km2: number;
  best_resolution_candidate?: DatasetDiscoveryCandidate | null;
  best_coverage_candidate?: DatasetDiscoveryCandidate | null;
  all_candidates: DatasetDiscoveryCandidate[];
  coverage_warnings: string[];
}

export interface RegionalStatistics {
  dataset_id: string;
  dataset_name: string;
  bounding_box: { min_latitude: number; max_latitude: number; min_longitude: number; max_longitude: number };
  nominal_pixel_spacing_m: number;
  total_pixels: number;
  valid_pixels: number;
  nodata_pixels: number;
  data_coverage_percentage: number;
  total_area_km2: number;
  valid_data_area_km2: number;
  elevation_min_m?: number | null;
  elevation_max_m?: number | null;
  elevation_mean_m?: number | null;
  elevation_median_m?: number | null;
  elevation_std_m?: number | null;
  elevation_range_m?: number | null;
  slope_min_deg?: number | null;
  slope_max_deg?: number | null;
  slope_mean_deg?: number | null;
  slope_median_deg?: number | null;
  slope_distribution_percentage: Record<string, number>;
  citation: string;
  scientific_notes: string[];
}

export interface TerrainInspectionPoint {
  latitude: number;
  longitude: number;
  projected_x: number;
  projected_y: number;
  in_bounds: boolean;
  elevation_m?: number | null;
  slope_deg?: number | null;
  quality_status: string;
  dataset_id: string;
  dataset_name: string;
  slope_source: string;
  effective_resolution_note: string;
  citation: string;
}

export interface TransectPoint {
  index: number;
  distance_m: number;
  distance_km: number;
  latitude: number;
  longitude: number;
  projected_x: number;
  projected_y: number;
  elevation_m?: number | null;
  slope_deg?: number | null;
  quality_status: string;
}

export interface TransectProfileResponse {
  dataset_id: string;
  dataset_name: string;
  start_latitude: number;
  start_longitude: number;
  end_latitude: number;
  end_longitude: number;
  total_distance_m: number;
  total_distance_km: number;
  sample_count: number;
  elevation_min_m?: number | null;
  elevation_max_m?: number | null;
  elevation_mean_m?: number | null;
  total_relief_m?: number | null;
  elevation_gain_m?: number | null;
  elevation_loss_m?: number | null;
  slope_mean_deg?: number | null;
  slope_max_deg?: number | null;
  nodata_segments_count: number;
  samples: TransectPoint[];
  citation: string;
}
