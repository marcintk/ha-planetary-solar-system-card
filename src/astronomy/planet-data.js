export const SUN = {
  name: "Sun",
  color: "#ffd700",
  size: 16,
};

// Mean longitudes at J2000 epoch (degrees) and orbital periods (days)
// Sources: NASA planetary fact sheets
export const PLANETS = [
  {
    name: "Mercury",
    au: 0.39,
    periodDays: 87.97,
    color: "#b0b0b0",
    size: 6,
    meanLongitudeJ2000: 252.25,
  },
  {
    name: "Venus",
    au: 0.72,
    periodDays: 224.7,
    color: "#e8cda0",
    size: 9,
    meanLongitudeJ2000: 181.98,
  },
  {
    name: "Earth",
    au: 1.0,
    periodDays: 365.25,
    color: "#4a90d9",
    size: 10,
    meanLongitudeJ2000: 100.46,
  },
  {
    name: "Mars",
    au: 1.52,
    periodDays: 687.0,
    color: "#c1440e",
    size: 7,
    meanLongitudeJ2000: 355.45,
  },
  {
    name: "Jupiter",
    au: 5.2,
    periodDays: 4332.6,
    color: "#c88b3a",
    size: 21,
    meanLongitudeJ2000: 34.4,
  },
  {
    name: "Saturn",
    au: 9.58,
    periodDays: 10759.2,
    color: "#e0c080",
    size: 25,
    meanLongitudeJ2000: 49.94,
  },
  {
    name: "Uranus",
    au: 19.22,
    periodDays: 30688.5,
    color: "#7ec8e3",
    size: 13,
    meanLongitudeJ2000: 313.23,
  },
  {
    name: "Neptune",
    au: 30.05,
    periodDays: 60182.0,
    color: "#3f54ba",
    size: 13,
    meanLongitudeJ2000: 304.88,
  },
];

export const MOON = {
  name: "Moon",
  auFromEarth: 0.00257,
  periodDays: 27.32,
  color: "#cccccc",
  size: 5,
  meanLongitudeJ2000: 218.32,
};
