/**
 * Keplerian Elements Module
 * 
 * Calculate and convert between different orbital element representations:
 * - Classical Keplerian elements
 * - State vectors (position/velocity)
 * - TLE mean elements
 */

import { XKMPER, XKE, TWOPI, PI, DEG2RAD, CK2, TOTHRD } from './constants';
import { OrbitalElements, StateVector } from './types';

/** Classical Keplerian orbital elements */
export interface KeplerianElements {
  /** Semi-major axis (km) */
  semiMajorAxis: number;
  /** Eccentricity (0 = circular, 0-1 = elliptical, 1 = parabolic, >1 = hyperbolic) */
  eccentricity: number;
  /** Inclination (degrees) */
  inclination: number;
  /** Right Ascension of Ascending Node - RAAN (degrees) */
  raan: number;
  /** Argument of Perigee (degrees) */
  argumentOfPerigee: number;
  /** True Anomaly (degrees) */
  trueAnomaly: number;
  /** Mean Anomaly (degrees) */
  meanAnomaly: number;
  /** Eccentric Anomaly (degrees) */
  eccentricAnomaly: number;
  /** Orbital Period (minutes) */
  period: number;
  /** Mean Motion (revolutions per day) */
  meanMotion: number;
  /** Apogee altitude (km above Earth surface) */
  apogee: number;
  /** Perigee altitude (km above Earth surface) */
  perigee: number;
  /** Specific orbital energy (km²/s²) */
  energy: number;
  /** Specific angular momentum magnitude (km²/s) */
  angularMomentum: number;
}

/** Orbital state at a specific time */
export interface OrbitalState {
  /** Keplerian elements */
  elements: KeplerianElements;
  /** Position vector (km) */
  position: { x: number; y: number; z: number };
  /** Velocity vector (km/s) */
  velocity: { x: number; y: number; z: number };
  /** Time since epoch (minutes) */
  tsince: number;
}

// Earth gravitational parameter (km³/s²)
const MU = 398600.4418;

/**
 * Calculate Keplerian elements from TLE orbital elements
 */
export function tleToKeplerian(elements: OrbitalElements): KeplerianElements {
  // Recover mean motion in rad/min and calculate semi-major axis
  const n0 = elements.no; // rad/min
  const e0 = elements.ecco;
  const i0 = elements.inclo;
  const omega0 = elements.argpo;
  const Omega0 = elements.nodeo;
  const M0 = elements.mo;
  
  // Calculate semi-major axis from mean motion
  // n = sqrt(mu/a³) → a = (mu/n²)^(1/3)
  const nRadPerSec = n0 / 60.0; // Convert to rad/s
  const a = Math.pow(MU / (nRadPerSec * nRadPerSec), 1/3);
  
  // Calculate eccentric anomaly from mean anomaly (Newton-Raphson)
  let E = M0;
  for (let i = 0; i < 10; i++) {
    const dE = (M0 - E + e0 * Math.sin(E)) / (1 - e0 * Math.cos(E));
    E = E + dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  
  // Calculate true anomaly
  const sinNu = Math.sqrt(1 - e0 * e0) * Math.sin(E) / (1 - e0 * Math.cos(E));
  const cosNu = (Math.cos(E) - e0) / (1 - e0 * Math.cos(E));
  const nu = Math.atan2(sinNu, cosNu);
  
  // Calculate orbital period
  const period = TWOPI / n0; // minutes
  
  // Mean motion in rev/day
  const meanMotion = n0 * 1440.0 / TWOPI;
  
  // Apogee and perigee
  const apogee = a * (1 + e0) - XKMPER;
  const perigee = a * (1 - e0) - XKMPER;
  
  // Specific orbital energy
  const energy = -MU / (2 * a);
  
  // Specific angular momentum
  const h = Math.sqrt(MU * a * (1 - e0 * e0));
  
  return {
    semiMajorAxis: a,
    eccentricity: e0,
    inclination: i0 / DEG2RAD,
    raan: Omega0 / DEG2RAD,
    argumentOfPerigee: omega0 / DEG2RAD,
    trueAnomaly: (nu < 0 ? nu + TWOPI : nu) / DEG2RAD,
    meanAnomaly: (M0 < 0 ? M0 + TWOPI : M0) / DEG2RAD,
    eccentricAnomaly: (E < 0 ? E + TWOPI : E) / DEG2RAD,
    period,
    meanMotion,
    apogee,
    perigee,
    energy,
    angularMomentum: h
  };
}

/**
 * Calculate Keplerian elements from state vectors (position and velocity)
 */
export function stateToKeplerian(
  x: number, y: number, z: number,
  vx: number, vy: number, vz: number
): KeplerianElements {
  // Position and velocity magnitudes
  const r = Math.sqrt(x * x + y * y + z * z);
  const v = Math.sqrt(vx * vx + vy * vy + vz * vz);
  
  // Specific angular momentum vector h = r × v
  const hx = y * vz - z * vy;
  const hy = z * vx - x * vz;
  const hz = x * vy - y * vx;
  const h = Math.sqrt(hx * hx + hy * hy + hz * hz);
  
  // Node vector n = k × h (k is z-unit vector)
  const nx = -hy;
  const ny = hx;
  const n = Math.sqrt(nx * nx + ny * ny);
  
  // Eccentricity vector
  const rdotv = x * vx + y * vy + z * vz;
  const ex = (1/MU) * ((v*v - MU/r) * x - rdotv * vx);
  const ey = (1/MU) * ((v*v - MU/r) * y - rdotv * vy);
  const ez = (1/MU) * ((v*v - MU/r) * z - rdotv * vz);
  const e = Math.sqrt(ex * ex + ey * ey + ez * ez);
  
  // Specific orbital energy
  const energy = v*v/2 - MU/r;
  
  // Semi-major axis
  let a: number;
  if (Math.abs(1 - e) > 1e-10) {
    a = -MU / (2 * energy);
  } else {
    a = Infinity; // Parabolic
  }
  
  // Inclination
  const i = Math.acos(hz / h);
  
  // Right Ascension of Ascending Node
  let Omega: number;
  if (n > 1e-10) {
    Omega = Math.acos(nx / n);
    if (ny < 0) Omega = TWOPI - Omega;
  } else {
    Omega = 0;
  }
  
  // Argument of Perigee
  let omega: number;
  if (n > 1e-10 && e > 1e-10) {
    omega = Math.acos((nx * ex + ny * ey) / (n * e));
    if (ez < 0) omega = TWOPI - omega;
  } else {
    omega = 0;
  }
  
  // True Anomaly
  let nu: number;
  if (e > 1e-10) {
    nu = Math.acos((ex * x + ey * y + ez * z) / (e * r));
    if (rdotv < 0) nu = TWOPI - nu;
  } else {
    nu = 0;
  }
  
  // Eccentric Anomaly
  let E: number;
  if (e < 1) {
    E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
    if (E < 0) E += TWOPI;
  } else {
    E = 0;
  }
  
  // Mean Anomaly
  let M = E - e * Math.sin(E);
  if (M < 0) M += TWOPI;
  
  // Period and mean motion
  const period = a > 0 ? TWOPI * Math.sqrt(a * a * a / MU) / 60 : Infinity;
  const meanMotion = period > 0 && period < Infinity ? 1440 / period : 0;
  
  // Apogee and perigee
  const apogee = a > 0 ? a * (1 + e) - XKMPER : Infinity;
  const perigee = a > 0 ? a * (1 - e) - XKMPER : -Infinity;
  
  return {
    semiMajorAxis: a,
    eccentricity: e,
    inclination: i / DEG2RAD,
    raan: Omega / DEG2RAD,
    argumentOfPerigee: omega / DEG2RAD,
    trueAnomaly: nu / DEG2RAD,
    meanAnomaly: M / DEG2RAD,
    eccentricAnomaly: E / DEG2RAD,
    period,
    meanMotion,
    apogee,
    perigee,
    energy,
    angularMomentum: h
  };
}

/**
 * Get orbital state (elements + vectors) at a given time
 */
export function getOrbitalState(
  elements: OrbitalElements,
  propagateFn: (elements: OrbitalElements, tsince: number) => { state: StateVector; error: boolean },
  tsince: number
): OrbitalState {
  const result = propagateFn(elements, tsince);
  
  if (result.error) {
    throw new Error('Satellite has decayed or propagation error');
  }
  
  const { x, y, z, xdot, ydot, zdot } = result.state;
  
  return {
    elements: stateToKeplerian(x, y, z, xdot, ydot, zdot),
    position: { x, y, z },
    velocity: { x: xdot, y: ydot, z: zdot },
    tsince
  };
}

/**
 * Format Keplerian elements as a human-readable string
 */
export function formatKeplerianElements(kep: KeplerianElements): string {
  const lines = [
    `Semi-major axis:      ${kep.semiMajorAxis.toFixed(3)} km`,
    `Eccentricity:         ${kep.eccentricity.toFixed(6)}`,
    `Inclination:          ${kep.inclination.toFixed(4)}°`,
    `RAAN:                 ${kep.raan.toFixed(4)}°`,
    `Arg of Perigee:       ${kep.argumentOfPerigee.toFixed(4)}°`,
    `True Anomaly:         ${kep.trueAnomaly.toFixed(4)}°`,
    `Mean Anomaly:         ${kep.meanAnomaly.toFixed(4)}°`,
    `Eccentric Anomaly:    ${kep.eccentricAnomaly.toFixed(4)}°`,
    `Period:               ${kep.period.toFixed(2)} min`,
    `Mean Motion:          ${kep.meanMotion.toFixed(8)} rev/day`,
    `Apogee:               ${kep.apogee.toFixed(2)} km`,
    `Perigee:              ${kep.perigee.toFixed(2)} km`,
    `Orbital Energy:       ${kep.energy.toFixed(4)} km²/s²`,
    `Angular Momentum:     ${kep.angularMomentum.toFixed(2)} km²/s`
  ];
  return lines.join('\n');
}

