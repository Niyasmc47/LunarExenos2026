export type RequirementClassification = 
  | 'HARD_CONSTRAINT'
  | 'SOFT_PREFERENCE'
  | 'INFORMATIONAL_METRIC';

export type MissionType = 
  | 'robotic_exploration'
  | 'robotic_lander'
  | 'crewed_surface'
  | 'long_duration_station'
  | 'custom';

export type TimeDisplayPreference = 'UTC' | 'MISSION_ELAPSED_TIME' | 'LOCAL_LUNAR_TIME';

export interface SingleRequirement {
  id: string;
  name: string;
  classification: RequirementClassification;
  enabled: boolean;
  value: number | null;
  unit: string;
  operator: 'ge' | 'le' | 'eq' | 'info';
  description: string;
  scientific_disclaimer?: string | null;
}

export interface SolarRequirementsConfig {
  min_total_sunlight_hours: SingleRequirement;
  min_full_sunlight_hours: SingleRequirement;
  max_continuous_darkness_hours: SingleRequirement;
  min_sunlight_percentage: SingleRequirement;
  min_daily_sunlight_hours: SingleRequirement;
}

export interface EarthRequirementsConfig {
  min_total_earth_visible_hours: SingleRequirement;
  max_continuous_earth_blackout_hours: SingleRequirement;
  min_daily_earth_visible_hours: SingleRequirement;
  min_full_disk_earth_visible_hours: SingleRequirement;
}

export interface TerrainRequirementsConfig {
  max_local_slope_deg: SingleRequirement;
  min_elevation_m: SingleRequirement;
  max_elevation_m: SingleRequirement;
  max_roughness_factor: SingleRequirement;
}

export interface MissionRequirementsSet {
  solar: SolarRequirementsConfig;
  earth: EarthRequirementsConfig;
  terrain: TerrainRequirementsConfig;
}

export interface MissionProfile {
  id: string;
  name: string;
  description: string;
  mission_type: MissionType;
  duration_days: number;
  start_timestamp_iso: string;
  end_timestamp_iso: string;
  observer_height_m: number;
  time_display_preference: TimeDisplayPreference;
  requirements: MissionRequirementsSet;
  version: number;
  is_template: boolean;
  created_at_iso: string;
  updated_at_iso: string;
}

export interface MissionProfileCreateRequest {
  name: string;
  description?: string;
  mission_type?: MissionType;
  duration_days?: number;
  start_timestamp_iso?: string;
  end_timestamp_iso?: string;
  observer_height_m?: number;
  time_display_preference?: TimeDisplayPreference;
  requirements?: MissionRequirementsSet;
}

export interface MissionProfileUpdateRequest {
  name?: string;
  description?: string;
  mission_type?: MissionType;
  duration_days?: number;
  start_timestamp_iso?: string;
  end_timestamp_iso?: string;
  observer_height_m?: number;
  time_display_preference?: TimeDisplayPreference;
  requirements?: MissionRequirementsSet;
}

export interface ValidationFeedbackItem {
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
}

export interface MissionProfileValidationResponse {
  is_valid: boolean;
  errors: ValidationFeedbackItem[];
  warnings: ValidationFeedbackItem[];
  info_notes: ValidationFeedbackItem[];
}
