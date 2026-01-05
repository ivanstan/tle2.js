/**
 * SPACETRACK REPORT NO. 3 Propagation Models
 * 
 * This module implements the five satellite orbit propagation models
 * described in SPACETRACK Report No. 3:
 * 
 * - SGP: Simplified General Perturbations (near-Earth, simple)
 * - SGP4: Simplified General Perturbations 4 (near-Earth, primary)
 * - SDP4: Simplified Deep-Space Perturbations 4 (deep-space, primary)
 * - SGP8: Simplified General Perturbations 8 (near-Earth, alternative)
 * - SDP8: Simplified Deep-Space Perturbations 8 (deep-space, alternative)
 * 
 * Near-Earth satellites have orbital periods < 225 minutes.
 * Deep-Space satellites have orbital periods >= 225 minutes.
 * 
 * @see SPACETRACK REPORT NO. 3: Models for Propagation of NORAD Element Sets
 *      Felix R. Hoots, Ronald L. Roehrich, December 1980
 */

// Types
export * from './types';

// Constants
export * from './constants';

// TLE Parser
export { parseTLE, getOrbitalPeriod, getSemiMajorAxis } from './tle-parser';

// SGP Model
export { sgp } from './sgp';

// SGP4 Model
export { sgp4, sgp4init } from './sgp4';
export type { Sgp4InitState } from './types';

// SDP4 Model
export { sdp4, sdp4init } from './sdp4';
export type { Sdp4InitState } from './sdp4';

// SGP8 Model
export { sgp8, sgp8init } from './sgp8';
export type { Sgp8InitState } from './sgp8';

// SDP8 Model
export { sdp8, sdp8init } from './sdp8';
export type { Sdp8InitState } from './sdp8';

// Deep-space utilities
export { gstime } from './deep-space';

// Observer module
export {
  observe,
  createObserver,
  calculateLookAngles,
  calculateTopocentric,
  eciToGeodetic,
  geodeticToECEF,
  calculateGST,
  dateToJD,
  calculateTsince,
  findNextPass,
  calculateVisibilityFootprint,
  isWithinFootprint,
  distanceToSubSatellite,
  formatFootprint,
  footprintToGeoJSON
} from './observer';
export type {
  Observer,
  LookAngles,
  GeodeticCoordinates,
  TopocentricCoordinates,
  VisibilityFootprint,
  ObservationResult
} from './observer';

// Keplerian elements module
export {
  tleToKeplerian,
  stateToKeplerian,
  getOrbitalState,
  formatKeplerianElements
} from './keplerian';
export type {
  KeplerianElements,
  OrbitalState
} from './keplerian';

// Decay analysis module
export {
  calculateDecayProfile,
  estimateLifetime,
  formatDecayProfile
} from './decay';
export type {
  DecayPoint,
  DecayProfile,
  DecayOptions
} from './decay';

// Satellite passes module
export {
  findPasses,
  getNextPass,
  formatPass,
  formatSkyPath,
  generateSkyChart
} from './passes';
export type {
  SkyPoint,
  SatellitePass,
  PassSearchResult,
  PassSearchOptions
} from './passes';

// Ground track / flight path module
export {
  calculateGroundTrack,
  groundTrackToGeoJSON,
  getTrackCoordinates,
  formatGroundTrack,
  sampleGroundTrack
} from './ground-track';
export type {
  GroundTrackPoint,
  GroundTrack,
  GroundTrackOptions
} from './ground-track';

import { OrbitalElements, PropagationResult, SatelliteType } from './types';
import { DEEP_SPACE_THRESHOLD, TWOPI } from './constants';
import { parseTLE } from './tle-parser';
import { sgp } from './sgp';
import { sgp4 } from './sgp4';
import { sdp4 } from './sdp4';
import { sgp8 } from './sgp8';
import { sdp8 } from './sdp8';

/**
 * Determine if a satellite is near-Earth or deep-space based on its period
 */
export function getSatelliteType(no: number): SatelliteType {
  const period = TWOPI / no; // Period in minutes
  return period < DEEP_SPACE_THRESHOLD ? 'near-earth' : 'deep-space';
}

/**
 * Automatically select the appropriate propagator based on orbital period
 * Uses SGP4/SDP4 as the primary models (as per NORAD standard)
 * 
 * @param elements - Orbital elements from TLE
 * @param tsince - Time since epoch in minutes
 * @returns Propagation result
 */
export function propagate(elements: OrbitalElements, tsince: number): PropagationResult {
  const satType = getSatelliteType(elements.no);
  
  if (satType === 'near-earth') {
    return sgp4(elements, tsince);
  } else {
    return sdp4(elements, tsince);
  }
}

/**
 * Propagate a satellite using a specific model
 * 
 * @param elements - Orbital elements from TLE
 * @param tsince - Time since epoch in minutes
 * @param model - The propagation model to use
 * @returns Propagation result
 */
export function propagateWithModel(
  elements: OrbitalElements, 
  tsince: number, 
  model: 'SGP' | 'SGP4' | 'SDP4' | 'SGP8' | 'SDP8'
): PropagationResult {
  switch (model) {
    case 'SGP':
      return sgp(elements, tsince);
    case 'SGP4':
      return sgp4(elements, tsince);
    case 'SDP4':
      return sdp4(elements, tsince);
    case 'SGP8':
      return sgp8(elements, tsince);
    case 'SDP8':
      return sdp8(elements, tsince);
    default:
      throw new Error(`Unknown propagation model: ${model}`);
  }
}

/**
 * Parse TLE and propagate in one step
 * 
 * @param line1 - First line of TLE
 * @param line2 - Second line of TLE
 * @param tsince - Time since epoch in minutes
 * @returns Propagation result
 */
export function propagateTLE(line1: string, line2: string, tsince: number): PropagationResult {
  const elements = parseTLE(line1, line2);
  return propagate(elements, tsince);
}

import { observe, Observer, ObservationResult, dateToJD, calculateTsince } from './observer';

/**
 * Propagate satellite and calculate observation from a ground observer
 * 
 * @param elements - Orbital elements from TLE
 * @param observer - Ground observer location
 * @param date - Date/time of observation (default: now)
 * @returns Observation result with look angles and visibility
 */
export function observeSatellite(
  elements: OrbitalElements,
  observer: Observer,
  date: Date = new Date()
): ObservationResult {
  const tsince = calculateTsince(date, elements.jdsatepoch);
  const result = propagate(elements, tsince);
  const jd = dateToJD(date);
  return observe(result, observer, jd);
}

/**
 * Propagate satellite from TLE and calculate observation
 * 
 * @param line1 - First line of TLE
 * @param line2 - Second line of TLE
 * @param observer - Ground observer location
 * @param date - Date/time of observation (default: now)
 * @returns Observation result with look angles and visibility
 */
export function observeTLE(
  line1: string,
  line2: string,
  observer: Observer,
  date: Date = new Date()
): ObservationResult {
  const elements = parseTLE(line1, line2);
  return observeSatellite(elements, observer, date);
}

