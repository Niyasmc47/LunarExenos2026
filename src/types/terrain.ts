export interface TerrainMetadata {
  dataset_id: string;
  name: string;
  region_name: string;
  description: string;
  source_url: string;
  publication_ref: string;
  reference_frame: string;
  projection_crs: string;
  pixel_spacing_m: float;
  effective_resolution_note: string;
  dimensions: {
    width: number;
    height: number;
    bands: number;
  };
  bounds_projected: {
    left: number;
    bottom: number;
    right: number;
    top: number;
  };
  bounds_geographic: {
    min_latitude: number;
    max_latitude: number;
    min_longitude: number;
    max_longitude: number;
  };
  center_geographic: {
    latitude: number;
    longitude: number;
  };
  elevation_stats: {
    min_m: number;
    max_m: number;
    mean_m: number;
    std_m: number;
    range_m: number;
  };
  companions: {
    type: string;
    filename: string;
    available: boolean;
    description: string;
  }[];
  quality_summary: Record<string, any>;
}

type float = number;

export interface ElevationPoint {
  latitude: number;
  longitude: number;
  projected_x?: number | null;
  projected_y?: number | null;
  in_bounds: boolean;
  elevation_m?: number | null;
  slope_deg?: number | null;
  lola_count?: number | null;
  elevation_uncertainty_m?: number | null;
  slope_uncertainty_deg?: number | null;
  quality_status: 'measured' | 'interpolated' | 'out_of_bounds' | 'nodata';
  note?: string | null;
}

export interface TerrainMeshData {
  dataset_id: string;
  lod: 'low' | 'medium' | 'high';
  vertical_exaggeration: number;
  vertex_count: number;
  triangle_count: number;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  raw_elevations: number[];
  min_elevation: number;
  max_elevation: number;
  bounds_geographic: {
    min_latitude: number;
    max_latitude: number;
    min_longitude: number;
    max_longitude: number;
  };
  center_geographic: {
    latitude: number;
    longitude: number;
  };
}

export interface ProfileSample {
  distance_m: number;
  latitude: number;
  longitude: number;
  projected_x: number;
  projected_y: number;
  elevation_m?: number | null;
  slope_deg?: number | null;
  quality_status: string;
}

export interface ElevationProfileData {
  dataset_id: string;
  start_latitude: number;
  start_longitude: number;
  end_latitude: number;
  end_longitude: number;
  total_distance_m: number;
  sample_count: number;
  min_elevation_m?: number | null;
  max_elevation_m?: number | null;
  elevation_diff_m?: number | null;
  mean_slope_deg?: number | null;
  max_slope_deg?: number | null;
  samples: ProfileSample[];
}

