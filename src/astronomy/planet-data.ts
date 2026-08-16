import type { CelestialBody, MoonData, Planet } from "../types.js";

export const SUN: CelestialBody = {
  name: "Sun",
  color: "#ffd700",
  size: 16,
};

// Mean longitudes, eccentricities, and longitudes of perihelion at J2000
// epoch (degrees), plus orbital periods (days).
// Sources: NASA planetary fact sheets; eccentricity/longitudeOfPerihelion
// from Meeus, "Astronomical Algorithms" table 5.8.1 (J2000 mean elements).
export const PLANETS: Planet[] = [
  {
    name: "Mercury",
    au: 0.39,
    periodDays: 87.97,
    color: "#b0b0b0",
    size: 6,
    meanLongitudeJ2000: 252.25,
    eccentricity: 0.20563,
    longitudeOfPerihelion: 77.45645,
  },
  {
    name: "Venus",
    au: 0.72,
    periodDays: 224.7,
    color: "#e8cda0",
    size: 9,
    meanLongitudeJ2000: 181.98,
    eccentricity: 0.00677,
    longitudeOfPerihelion: 131.53298,
  },
  {
    name: "Earth",
    au: 1.0,
    periodDays: 365.25,
    color: "#4a90d9",
    size: 10,
    meanLongitudeJ2000: 100.46,
    eccentricity: 0.01671,
    longitudeOfPerihelion: 102.94719,
  },
  {
    name: "Mars",
    au: 1.52,
    periodDays: 687.0,
    color: "#c1440e",
    size: 7,
    meanLongitudeJ2000: 355.45,
    eccentricity: 0.0934,
    longitudeOfPerihelion: 336.04084,
  },
  {
    name: "Jupiter",
    au: 5.2,
    periodDays: 4332.6,
    color: "#c88b3a",
    size: 21,
    meanLongitudeJ2000: 34.4,
    eccentricity: 0.04849,
    longitudeOfPerihelion: 14.75385,
  },
  {
    name: "Saturn",
    au: 9.58,
    periodDays: 10759.2,
    color: "#e0c080",
    size: 25,
    meanLongitudeJ2000: 49.94,
    eccentricity: 0.05551,
    longitudeOfPerihelion: 92.43194,
  },
  {
    name: "Uranus",
    au: 19.22,
    periodDays: 30688.5,
    color: "#7ec8e3",
    size: 13,
    meanLongitudeJ2000: 313.23,
    eccentricity: 0.0463,
    longitudeOfPerihelion: 170.96424,
  },
  {
    name: "Neptune",
    au: 30.05,
    periodDays: 60182.0,
    color: "#3f54ba",
    size: 13,
    meanLongitudeJ2000: 304.88,
    eccentricity: 0.00899,
    longitudeOfPerihelion: 44.97135,
  },
];

export const EARTH: Planet = PLANETS[2];

export const MOON: MoonData = {
  name: "Moon",
  periodDays: 27.32,
  color: "#cccccc",
  size: 5,
  meanLongitudeJ2000: 218.32,
};

export const MOON_PIXEL_OFFSET = 22; // pixels from Earth
