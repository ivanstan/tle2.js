/**
 * Ground Track / Flight Path Module
 * 
 * Calculate satellite ground track over multiple orbits.
 * Useful for visualizing satellite path on a map.
 */

import { XKMPER, TWOPI } from './constants';
import { OrbitalElements, PropagationResult } from './types';
import { eciToGeodetic, calculateGST, VisibilityFootprint, calculateVisibilityFootprint } from './observer';

/** A single point along the ground track */
export interface GroundTrackPoint {
  /** Time since epoch (minutes) */
  tsince: number;
  /** Time offset from reference time (seconds) */
  timeOffset: number;
  /** Latitude (degrees) */
  latitude: number;
  /** Longitude (degrees) */
  longitude: number;
  /** Altitude above Earth surface (km) */
  altitude: number;
  /** Position in ECI coordinates (km) */
  position: { x: number; y: number; z: number };
  /** Velocity in ECI coordinates (km/s) */
  velocity: { x: number; y: number; z: number };
  /** Velocity magnitude (km/s) */
  speed: number;
  /** Is this point in the past (relative to reference time) */
  isPast: boolean;
}

/** Complete ground track result */
export interface GroundTrack {
  /** Satellite catalog number */
  satnum: number;
  /** Reference time (tsince in minutes) - the "now" point */
  referenceTsince: number;
  /** All track points */
  points: GroundTrackPoint[];
  /** Points in the past */
  pastPoints: GroundTrackPoint[];
  /** Points in the future */
  futurePoints: GroundTrackPoint[];
  /** Current position (at reference time) */
  currentPosition: GroundTrackPoint | null;
  /** Track parameters */
  parameters: {
    /** Time step in seconds */
    stepSeconds: number;
    /** Number of orbits */
    numOrbits: number;
    /** Orbital period in minutes */
    orbitalPeriod: number;
    /** Total track duration in minutes */
    totalDuration: number;
  };
  /** Track statistics */
  stats: {
    /** Total number of points */
    totalPoints: number;
    /** Minimum latitude */
    minLatitude: number;
    /** Maximum latitude */
    maxLatitude: number;
    /** Minimum altitude */
    minAltitude: number;
    /** Maximum altitude */
    maxAltitude: number;
  };
}

/** Options for ground track calculation */
export interface GroundTrackOptions {
  /** Time step in seconds (default: 5) */
  stepSeconds?: number;
  /** Number of orbits to calculate (default: 3) */
  numOrbits?: number;
  /** Reference time (tsince in minutes, default: 0 = epoch) */
  referenceTsince?: number;
  /** Include visibility footprint at each point (default: false, slower) */
  includeFootprints?: boolean;
}

/**
 * Calculate ground track / flight path for a satellite
 * 
 * Calculates positions for the specified number of orbits, centered around
 * the reference time (half in the past, half in the future).
 * 
 * @param elements - Orbital elements from TLE
 * @param propagateFn - Propagation function to use
 * @param options - Calculation options
 * @returns Ground track with all points and statistics
 */
export function calculateGroundTrack(
  elements: OrbitalElements,
  propagateFn: (elements: OrbitalElements, tsince: number) => PropagationResult,
  options: GroundTrackOptions = {}
): GroundTrack {
  const {
    stepSeconds = 5,
    numOrbits = 3,
    referenceTsince = 0
  } = options;
  
  // Calculate orbital period from mean motion
  const orbitalPeriod = TWOPI / elements.no; // minutes
  
  // Total duration in minutes
  const totalDuration = orbitalPeriod * numOrbits;
  
  // Start time (half the orbits in the past)
  const startTsince = referenceTsince - (totalDuration / 2);
  
  // End time (half the orbits in the future)
  const endTsince = referenceTsince + (totalDuration / 2);
  
  // Step in minutes
  const stepMinutes = stepSeconds / 60;
  
  const points: GroundTrackPoint[] = [];
  const pastPoints: GroundTrackPoint[] = [];
  const futurePoints: GroundTrackPoint[] = [];
  let currentPosition: GroundTrackPoint | null = null;
  
  // Stats tracking
  let minLat = 90, maxLat = -90;
  let minAlt = Infinity, maxAlt = -Infinity;
  
  // Calculate Julian date for the reference time
  const jdReference = elements.jdsatepoch + referenceTsince / 1440.0;
  
  // Track closest point to reference time for "current" position
  let closestToRef = Infinity;
  
  for (let tsince = startTsince; tsince <= endTsince; tsince += stepMinutes) {
    const result = propagateFn(elements, tsince);
    
    if (result.error) {
      continue; // Skip decayed points
    }
    
    const { x, y, z, xdot, ydot, zdot } = result.state;
    
    // Calculate Julian date for this point
    const jd = elements.jdsatepoch + tsince / 1440.0;
    
    // Calculate GMST
    const gmst = calculateGST(jd);
    
    // Convert to geodetic
    const geo = eciToGeodetic(x, y, z, gmst);
    
    // Calculate speed
    const speed = Math.sqrt(xdot * xdot + ydot * ydot + zdot * zdot);
    
    // Time offset from reference in seconds
    const timeOffset = (tsince - referenceTsince) * 60;
    
    const point: GroundTrackPoint = {
      tsince,
      timeOffset,
      latitude: geo.latitude,
      longitude: geo.longitude,
      altitude: geo.altitude,
      position: { x, y, z },
      velocity: { x: xdot, y: ydot, z: zdot },
      speed,
      isPast: tsince < referenceTsince
    };
    
    points.push(point);
    
    // Categorize as past or future
    if (tsince < referenceTsince) {
      pastPoints.push(point);
    } else {
      futurePoints.push(point);
    }
    
    // Track current position (closest to reference time)
    const distToRef = Math.abs(tsince - referenceTsince);
    if (distToRef < closestToRef) {
      closestToRef = distToRef;
      currentPosition = point;
    }
    
    // Update stats
    minLat = Math.min(minLat, geo.latitude);
    maxLat = Math.max(maxLat, geo.latitude);
    minAlt = Math.min(minAlt, geo.altitude);
    maxAlt = Math.max(maxAlt, geo.altitude);
  }
  
  return {
    satnum: elements.satnum,
    referenceTsince,
    points,
    pastPoints,
    futurePoints,
    currentPosition,
    parameters: {
      stepSeconds,
      numOrbits,
      orbitalPeriod,
      totalDuration
    },
    stats: {
      totalPoints: points.length,
      minLatitude: minLat,
      maxLatitude: maxLat,
      minAltitude: minAlt,
      maxAltitude: maxAlt
    }
  };
}

/**
 * Convert ground track to GeoJSON LineString for mapping
 */
export function groundTrackToGeoJSON(
  track: GroundTrack,
  splitAtDateLine: boolean = true
): object {
  if (!splitAtDateLine) {
    // Simple case: one continuous line
    const coordinates = track.points.map(p => [p.longitude, p.latitude, p.altitude]);
    
    return {
      type: "Feature",
      properties: {
        satnum: track.satnum,
        orbitalPeriod: track.parameters.orbitalPeriod,
        numOrbits: track.parameters.numOrbits
      },
      geometry: {
        type: "LineString",
        coordinates
      }
    };
  }
  
  // Split at the International Date Line (±180°)
  const segments: Array<Array<[number, number, number]>> = [];
  let currentSegment: Array<[number, number, number]> = [];
  
  for (let i = 0; i < track.points.length; i++) {
    const p = track.points[i];
    
    if (i > 0) {
      const prev = track.points[i - 1];
      // Check for date line crossing (longitude jump > 180°)
      if (Math.abs(p.longitude - prev.longitude) > 180) {
        // End current segment and start new one
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
      }
    }
    
    currentSegment.push([p.longitude, p.latitude, p.altitude]);
  }
  
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }
  
  if (segments.length === 1) {
    return {
      type: "Feature",
      properties: {
        satnum: track.satnum,
        orbitalPeriod: track.parameters.orbitalPeriod,
        numOrbits: track.parameters.numOrbits
      },
      geometry: {
        type: "LineString",
        coordinates: segments[0]
      }
    };
  }
  
  // Multiple segments - use MultiLineString
  return {
    type: "Feature",
    properties: {
      satnum: track.satnum,
      orbitalPeriod: track.parameters.orbitalPeriod,
      numOrbits: track.parameters.numOrbits,
      segments: segments.length
    },
    geometry: {
      type: "MultiLineString",
      coordinates: segments
    }
  };
}

/**
 * Get ground track points as a simple array of [lat, lon] pairs
 * Useful for simple plotting or mapping libraries
 */
export function getTrackCoordinates(
  track: GroundTrack
): Array<{ lat: number; lon: number; alt: number; time: number }> {
  return track.points.map(p => ({
    lat: p.latitude,
    lon: p.longitude,
    alt: p.altitude,
    time: p.timeOffset
  }));
}

/**
 * Format ground track as human-readable string
 */
export function formatGroundTrack(track: GroundTrack): string {
  const lines: string[] = [];
  
  lines.push(`=== Ground Track for Satellite ${track.satnum} ===`);
  lines.push(``);
  lines.push(`Parameters:`);
  lines.push(`  Reference time:   T+${track.referenceTsince.toFixed(1)} min`);
  lines.push(`  Orbital period:   ${track.parameters.orbitalPeriod.toFixed(2)} min`);
  lines.push(`  Number of orbits: ${track.parameters.numOrbits}`);
  lines.push(`  Total duration:   ${track.parameters.totalDuration.toFixed(1)} min`);
  lines.push(`  Time step:        ${track.parameters.stepSeconds} sec`);
  lines.push(``);
  lines.push(`Statistics:`);
  lines.push(`  Total points:     ${track.stats.totalPoints}`);
  lines.push(`  Past points:      ${track.pastPoints.length}`);
  lines.push(`  Future points:    ${track.futurePoints.length}`);
  lines.push(`  Latitude range:   ${track.stats.minLatitude.toFixed(2)}° to ${track.stats.maxLatitude.toFixed(2)}°`);
  lines.push(`  Altitude range:   ${track.stats.minAltitude.toFixed(1)} to ${track.stats.maxAltitude.toFixed(1)} km`);
  
  if (track.currentPosition) {
    lines.push(``);
    lines.push(`Current Position:`);
    lines.push(`  Latitude:  ${track.currentPosition.latitude.toFixed(4)}°`);
    lines.push(`  Longitude: ${track.currentPosition.longitude.toFixed(4)}°`);
    lines.push(`  Altitude:  ${track.currentPosition.altitude.toFixed(1)} km`);
    lines.push(`  Speed:     ${track.currentPosition.speed.toFixed(3)} km/s`);
  }
  
  return lines.join('\n');
}

/**
 * Sample ground track at a lower resolution
 * Useful for reducing data when plotting
 */
export function sampleGroundTrack(
  track: GroundTrack,
  numPoints: number
): GroundTrackPoint[] {
  if (track.points.length <= numPoints) {
    return track.points;
  }
  
  const result: GroundTrackPoint[] = [];
  const step = (track.points.length - 1) / (numPoints - 1);
  
  for (let i = 0; i < numPoints; i++) {
    const index = Math.round(i * step);
    result.push(track.points[Math.min(index, track.points.length - 1)]);
  }
  
  return result;
}

