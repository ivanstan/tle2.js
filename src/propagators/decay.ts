/**
 * Orbital Decay Module
 * 
 * Calculate and predict orbital decay due to atmospheric drag.
 * Provides decay profile, lifetime estimation, and orbital evolution.
 */

import { XKMPER, TWOPI, PI } from './constants';
import { OrbitalElements, PropagationResult } from './types';
import { stateToKeplerian, KeplerianElements } from './keplerian';

/** Decay profile data point */
export interface DecayPoint {
  /** Time since epoch (minutes) */
  tsince: number;
  /** Days since epoch */
  days: number;
  /** Semi-major axis (km) */
  semiMajorAxis: number;
  /** Eccentricity */
  eccentricity: number;
  /** Apogee altitude (km) */
  apogee: number;
  /** Perigee altitude (km) */
  perigee: number;
  /** Orbital period (minutes) */
  period: number;
  /** Mean motion (rev/day) */
  meanMotion: number;
  /** Estimated remaining lifetime (days) */
  remainingLifetime: number;
  /** Has satellite decayed (perigee < ~80 km) */
  decayed: boolean;
}

/** Complete decay profile */
export interface DecayProfile {
  /** Satellite catalog number */
  satnum: number;
  /** Profile data points */
  points: DecayPoint[];
  /** Estimated decay date (days since epoch, null if stable) */
  estimatedDecayDays: number | null;
  /** Initial orbital elements */
  initialElements: KeplerianElements;
  /** Final orbital elements (at end of profile or decay) */
  finalElements: KeplerianElements | null;
  /** Analysis summary */
  summary: {
    /** Initial perigee (km) */
    initialPerigee: number;
    /** Final perigee (km) */
    finalPerigee: number;
    /** Perigee change rate (km/day) */
    perigeeChangeRate: number;
    /** Initial period (min) */
    initialPeriod: number;
    /** Final period (min) */
    finalPeriod: number;
    /** Period change rate (min/day) */
    periodChangeRate: number;
    /** Is orbit decaying */
    isDecaying: boolean;
    /** Estimated lifetime category */
    lifetimeCategory: 'days' | 'weeks' | 'months' | 'years' | 'decades' | 'stable';
  };
}

/** Decay analysis options */
export interface DecayOptions {
  /** Duration to analyze (days) */
  durationDays?: number;
  /** Time step (days) */
  stepDays?: number;
  /** Minimum altitude for decay threshold (km) */
  decayAltitude?: number;
}

// Decay altitude threshold (km) - below this is considered decayed
const DECAY_ALTITUDE = 80;

/**
 * Calculate decay profile for a satellite
 * 
 * @param elements - Orbital elements from TLE
 * @param propagateFn - Propagation function to use
 * @param options - Analysis options
 * @returns Decay profile with timeline and predictions
 */
export function calculateDecayProfile(
  elements: OrbitalElements,
  propagateFn: (elements: OrbitalElements, tsince: number) => PropagationResult,
  options: DecayOptions = {}
): DecayProfile {
  const {
    durationDays = 365,
    stepDays = 1,
    decayAltitude = DECAY_ALTITUDE
  } = options;
  
  const points: DecayPoint[] = [];
  let decayed = false;
  let estimatedDecayDays: number | null = null;
  let finalElements: KeplerianElements | null = null;
  
  // Get initial state
  const initialResult = propagateFn(elements, 0);
  if (initialResult.error) {
    throw new Error('Failed to propagate at epoch');
  }
  
  const { x, y, z, xdot, ydot, zdot } = initialResult.state;
  const initialElements = stateToKeplerian(x, y, z, xdot, ydot, zdot);
  
  // Calculate profile
  for (let day = 0; day <= durationDays && !decayed; day += stepDays) {
    const tsince = day * 1440; // Convert days to minutes
    const result = propagateFn(elements, tsince);
    
    if (result.error) {
      decayed = true;
      estimatedDecayDays = day;
      break;
    }
    
    const { x, y, z, xdot, ydot, zdot } = result.state;
    const kep = stateToKeplerian(x, y, z, xdot, ydot, zdot);
    
    // Check for decay
    if (kep.perigee < decayAltitude) {
      decayed = true;
      estimatedDecayDays = day;
    }
    
    // Estimate remaining lifetime based on current decay rate
    let remainingLifetime = Infinity;
    if (points.length > 0) {
      const prevPoint = points[points.length - 1];
      const perigeeRate = (kep.perigee - prevPoint.perigee) / stepDays;
      if (perigeeRate < 0) {
        remainingLifetime = (kep.perigee - decayAltitude) / Math.abs(perigeeRate);
      }
    }
    
    const point: DecayPoint = {
      tsince,
      days: day,
      semiMajorAxis: kep.semiMajorAxis,
      eccentricity: kep.eccentricity,
      apogee: kep.apogee,
      perigee: kep.perigee,
      period: kep.period,
      meanMotion: kep.meanMotion,
      remainingLifetime: Math.min(remainingLifetime, 36500), // Cap at 100 years
      decayed
    };
    
    points.push(point);
    finalElements = kep;
  }
  
  // Calculate summary statistics
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const elapsedDays = lastPoint.days - firstPoint.days;
  
  const perigeeChangeRate = elapsedDays > 0 
    ? (lastPoint.perigee - firstPoint.perigee) / elapsedDays 
    : 0;
  const periodChangeRate = elapsedDays > 0 
    ? (lastPoint.period - firstPoint.period) / elapsedDays 
    : 0;
  
  // Determine lifetime category
  let lifetimeCategory: DecayProfile['summary']['lifetimeCategory'];
  const estimatedLife = estimatedDecayDays ?? lastPoint.remainingLifetime;
  
  if (estimatedLife < 30) {
    lifetimeCategory = 'days';
  } else if (estimatedLife < 90) {
    lifetimeCategory = 'weeks';
  } else if (estimatedLife < 365) {
    lifetimeCategory = 'months';
  } else if (estimatedLife < 3650) {
    lifetimeCategory = 'years';
  } else if (estimatedLife < 36500) {
    lifetimeCategory = 'decades';
  } else {
    lifetimeCategory = 'stable';
  }
  
  return {
    satnum: elements.satnum,
    points,
    estimatedDecayDays,
    initialElements,
    finalElements,
    summary: {
      initialPerigee: firstPoint.perigee,
      finalPerigee: lastPoint.perigee,
      perigeeChangeRate,
      initialPeriod: firstPoint.period,
      finalPeriod: lastPoint.period,
      periodChangeRate,
      isDecaying: perigeeChangeRate < -0.001,
      lifetimeCategory
    }
  };
}

/**
 * Estimate satellite lifetime based on current orbital parameters
 * Uses simplified King-Hele decay theory
 * 
 * @param perigeeAltitude - Perigee altitude in km
 * @param apogeeAltitude - Apogee altitude in km
 * @param ballisticCoefficient - B* from TLE (optional, uses default if not provided)
 * @returns Estimated lifetime in days
 */
export function estimateLifetime(
  perigeeAltitude: number,
  apogeeAltitude: number,
  ballisticCoefficient?: number
): number {
  // Simplified atmospheric density model (exponential)
  // ρ = ρ₀ * exp(-h/H)
  const scaleHeight = 50; // km (rough average for LEO)
  const rho0 = 1.225e-12; // kg/m³ at 200 km (rough)
  
  // Average altitude
  const avgAlt = (perigeeAltitude + apogeeAltitude) / 2;
  
  // If above ~1000 km, orbit is essentially stable
  if (perigeeAltitude > 1000) {
    return 36500; // 100 years (essentially stable)
  }
  
  // Rough lifetime estimate based on perigee altitude
  // This is a simplified empirical model
  if (perigeeAltitude < 150) {
    return perigeeAltitude / 10; // Very rapid decay
  } else if (perigeeAltitude < 200) {
    return (perigeeAltitude - 100) / 2;
  } else if (perigeeAltitude < 300) {
    return (perigeeAltitude - 150) * 2;
  } else if (perigeeAltitude < 400) {
    return (perigeeAltitude - 200) * 5;
  } else if (perigeeAltitude < 500) {
    return (perigeeAltitude - 300) * 15;
  } else if (perigeeAltitude < 600) {
    return (perigeeAltitude - 400) * 50 + 365;
  } else if (perigeeAltitude < 800) {
    return (perigeeAltitude - 500) * 100 + 1825;
  } else {
    return (perigeeAltitude - 600) * 200 + 5475;
  }
}

/**
 * Format decay profile as a human-readable report
 */
export function formatDecayProfile(profile: DecayProfile): string {
  const lines: string[] = [];
  
  lines.push(`=== Orbital Decay Analysis ===`);
  lines.push(`Satellite: ${profile.satnum}`);
  lines.push(``);
  
  lines.push(`Initial Orbit:`);
  lines.push(`  Perigee:  ${profile.summary.initialPerigee.toFixed(1)} km`);
  lines.push(`  Apogee:   ${profile.initialElements.apogee.toFixed(1)} km`);
  lines.push(`  Period:   ${profile.summary.initialPeriod.toFixed(2)} min`);
  lines.push(``);
  
  if (profile.finalElements) {
    lines.push(`Final Orbit (after ${profile.points[profile.points.length - 1].days} days):`);
    lines.push(`  Perigee:  ${profile.summary.finalPerigee.toFixed(1)} km`);
    lines.push(`  Apogee:   ${profile.finalElements.apogee.toFixed(1)} km`);
    lines.push(`  Period:   ${profile.summary.finalPeriod.toFixed(2)} min`);
    lines.push(``);
  }
  
  lines.push(`Decay Analysis:`);
  lines.push(`  Perigee change: ${(profile.summary.perigeeChangeRate * 30).toFixed(2)} km/month`);
  lines.push(`  Period change:  ${(profile.summary.periodChangeRate * 30).toFixed(4)} min/month`);
  lines.push(`  Status:         ${profile.summary.isDecaying ? 'Decaying' : 'Stable'}`);
  lines.push(`  Lifetime:       ${profile.summary.lifetimeCategory}`);
  
  if (profile.estimatedDecayDays !== null) {
    lines.push(`  Decay in:       ~${profile.estimatedDecayDays.toFixed(0)} days`);
  }
  
  return lines.join('\n');
}

