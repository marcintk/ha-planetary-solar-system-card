// Celestial body data types

export interface CelestialBody {
  name: string;
  color: string;
  size: number;
}

export interface Planet extends CelestialBody {
  au: number;
  periodDays: number;
  meanLongitudeJ2000: number;
}

export type MoonData = Omit<Planet, "au">;

export interface Comet {
  name: string;
  semiMajorAxis: number;
  eccentricity: number;
  periodDays: number;
  longitudeOfPerihelion: number;
  meanAnomalyJ2000: number;
  color: string;
  size: number;
  tailLength: number;
}

// View and config types

export interface LocationData {
  lat: number;
  lon: number;
  timezone: string;
}

export interface Colors {
  background?: string;
  orbit?: string;
  label?: string;
  season_line?: string;
  season_label?: string;
}

export type ZoomLevel = 1 | 2 | 3 | 4;
export type Hemisphere = "north" | "south";

export interface ViewPosition {
  name: string;
  x: number;
  y: number;
  color: string;
  offscreen?: boolean;
}

export interface PanZoomState {
  centerX: number;
  centerY: number;
  width: number;
}

// Computed/return types

export interface CometVisualEllipse {
  aPx: number;
  bPx: number;
  cPx: number;
  ePx: number;
  rotationDeg: number;
}

export interface CometPosition {
  angle: number;
  radius: number;
  trueAnomaly: number;
}

export interface MoonPhase {
  phase: number;
  phaseName: string;
  illumination: number;
}

export interface NextTransition {
  time: Date;
  toMode: string;
}

// Home Assistant types

export interface HASSConfig {
  config?: {
    latitude?: number;
    longitude?: number;
    time_zone?: string;
    location_name?: string;
  };
}

export interface CardConfig {
  default_zoom?: number;
  refresh_mins?: number;
  periodic_zoom_change?: boolean;
  periodic_zoom_max?: number;
  zoom_animate?: boolean;
  colors?: Colors;
  ecliptic_view?: string;
  show_version?: boolean;
}
