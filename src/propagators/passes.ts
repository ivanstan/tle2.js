/**
 * Satellite Pass Module
 * 
 * Calculate satellite passes over an observer, including:
 * - Rise/set times
 * - Maximum elevation
 * - Sky path (azimuth/elevation trace)
 * - Visibility conditions
 */

import { Observer, observe, ObservationResult, dateToJD } from './observer';
import { OrbitalElements, PropagationResult } from './types';

/** Point along the satellite's path across the sky */
export interface SkyPoint {
  /** Time since epoch (minutes) */
  tsince: number;
  /** Azimuth (degrees from North) */
  azimuth: number;
  /** Elevation (degrees above horizon) */
  elevation: number;
  /** Range to satellite (km) */
  range: number;
  /** Range rate (km/s, positive = receding) */
  rangeRate: number;
  /** Is satellite illuminated by sun (simplified) */
  illuminated: boolean;
}

/** A complete satellite pass over an observer */
export interface SatellitePass {
  /** Pass number in sequence */
  passNumber: number;
  /** Rise time (tsince in minutes) */
  riseTime: number;
  /** Rise azimuth (degrees) */
  riseAzimuth: number;
  /** Maximum elevation time (tsince in minutes) */
  maxElevationTime: number;
  /** Maximum elevation (degrees) */
  maxElevation: number;
  /** Azimuth at maximum elevation (degrees) */
  maxElevationAzimuth: number;
  /** Set time (tsince in minutes) */
  setTime: number;
  /** Set azimuth (degrees) */
  setAzimuth: number;
  /** Duration of pass (minutes) */
  duration: number;
  /** Complete sky path with detailed points */
  skyPath: SkyPoint[];
  /** Is this a good visible pass (max elevation > 30°) */
  isGoodPass: boolean;
  /** Pass quality category */
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

/** Result of pass search */
export interface PassSearchResult {
  /** Observer location */
  observer: Observer;
  /** All found passes */
  passes: SatellitePass[];
  /** Search parameters */
  searchParams: {
    startTsince: number;
    durationMinutes: number;
    minElevation: number;
  };
  /** Statistics */
  stats: {
    totalPasses: number;
    goodPasses: number;
    averageMaxElevation: number;
    averageDuration: number;
  };
}

/** Options for pass search */
export interface PassSearchOptions {
  /** Start time (tsince in minutes from epoch, default: 0) */
  startTsince?: number;
  /** Duration to search (minutes, default: 1440 = 24 hours) */
  durationMinutes?: number;
  /** Minimum elevation to consider as a pass (degrees, default: 0) */
  minElevation?: number;
  /** Step size for initial search (minutes, default: 1) */
  stepMinutes?: number;
  /** Number of points in sky path (default: 60) */
  skyPathPoints?: number;
}

/**
 * Find all satellite passes over an observer within a time range
 */
export function findPasses(
  elements: OrbitalElements,
  observer: Observer,
  propagateFn: (elements: OrbitalElements, tsince: number) => PropagationResult,
  options: PassSearchOptions = {}
): PassSearchResult {
  const {
    startTsince = 0,
    durationMinutes = 1440,
    minElevation = 0,
    stepMinutes = 1,
    skyPathPoints = 60
  } = options;
  
  const passes: SatellitePass[] = [];
  let passNumber = 0;
  
  // State for tracking passes
  let inPass = false;
  let currentPass: {
    riseTime: number;
    riseAzimuth: number;
    maxEl: number;
    maxElTime: number;
    maxElAzimuth: number;
    skyPath: SkyPoint[];
  } | null = null;
  
  // Scan through the time range
  for (let t = startTsince; t <= startTsince + durationMinutes; t += stepMinutes) {
    const result = propagateFn(elements, t);
    if (result.error) continue;
    
    const jd = elements.jdsatepoch + t / 1440.0;
    const obs = observe(result, observer, jd);
    const elevation = obs.lookAngles.elevation;
    const azimuth = obs.lookAngles.azimuth;
    
    if (elevation >= minElevation && !inPass) {
      // Start of pass - refine rise time with bisection
      const riseTime = refineTime(
        elements, observer, propagateFn, 
        t - stepMinutes, t, minElevation, 'rise'
      );
      
      inPass = true;
      currentPass = {
        riseTime,
        riseAzimuth: azimuth,
        maxEl: elevation,
        maxElTime: t,
        maxElAzimuth: azimuth,
        skyPath: []
      };
    }
    
    if (inPass && currentPass) {
      // Track maximum elevation
      if (elevation > currentPass.maxEl) {
        currentPass.maxEl = elevation;
        currentPass.maxElTime = t;
        currentPass.maxElAzimuth = azimuth;
      }
      
      // Add to sky path
      currentPass.skyPath.push({
        tsince: t,
        azimuth,
        elevation,
        range: obs.lookAngles.range,
        rangeRate: obs.lookAngles.rangeRate,
        illuminated: estimateIllumination(obs, jd)
      });
    }
    
    if (elevation < minElevation && inPass && currentPass) {
      // End of pass - refine set time with bisection
      const setTime = refineTime(
        elements, observer, propagateFn,
        t - stepMinutes, t, minElevation, 'set'
      );
      
      // Get set azimuth
      const setResult = propagateFn(elements, setTime);
      const setJd = elements.jdsatepoch + setTime / 1440.0;
      const setObs = observe(setResult, observer, setJd);
      
      // Build complete pass
      const duration = setTime - currentPass.riseTime;
      const quality = getPassQuality(currentPass.maxEl);
      
      passNumber++;
      passes.push({
        passNumber,
        riseTime: currentPass.riseTime,
        riseAzimuth: currentPass.riseAzimuth,
        maxElevationTime: currentPass.maxElTime,
        maxElevation: currentPass.maxEl,
        maxElevationAzimuth: currentPass.maxElAzimuth,
        setTime,
        setAzimuth: setObs.lookAngles.azimuth,
        duration,
        skyPath: resampleSkyPath(currentPass.skyPath, skyPathPoints),
        isGoodPass: currentPass.maxEl >= 30,
        quality
      });
      
      inPass = false;
      currentPass = null;
    }
  }
  
  // Calculate statistics
  const totalPasses = passes.length;
  const goodPasses = passes.filter(p => p.isGoodPass).length;
  const averageMaxElevation = totalPasses > 0 
    ? passes.reduce((sum, p) => sum + p.maxElevation, 0) / totalPasses 
    : 0;
  const averageDuration = totalPasses > 0 
    ? passes.reduce((sum, p) => sum + p.duration, 0) / totalPasses 
    : 0;
  
  return {
    observer,
    passes,
    searchParams: {
      startTsince,
      durationMinutes,
      minElevation
    },
    stats: {
      totalPasses,
      goodPasses,
      averageMaxElevation,
      averageDuration
    }
  };
}

/**
 * Refine the exact rise or set time using bisection
 */
function refineTime(
  elements: OrbitalElements,
  observer: Observer,
  propagateFn: (elements: OrbitalElements, tsince: number) => PropagationResult,
  tLow: number,
  tHigh: number,
  threshold: number,
  type: 'rise' | 'set'
): number {
  const tolerance = 0.01; // 0.6 seconds
  
  for (let i = 0; i < 20 && (tHigh - tLow) > tolerance; i++) {
    const tMid = (tLow + tHigh) / 2;
    const result = propagateFn(elements, tMid);
    if (result.error) break;
    
    const jd = elements.jdsatepoch + tMid / 1440.0;
    const obs = observe(result, observer, jd);
    const elevation = obs.lookAngles.elevation;
    
    if (type === 'rise') {
      if (elevation < threshold) {
        tLow = tMid;
      } else {
        tHigh = tMid;
      }
    } else {
      if (elevation >= threshold) {
        tLow = tMid;
      } else {
        tHigh = tMid;
      }
    }
  }
  
  return type === 'rise' ? tHigh : tLow;
}

/**
 * Determine pass quality based on maximum elevation
 */
function getPassQuality(maxElevation: number): SatellitePass['quality'] {
  if (maxElevation >= 60) return 'excellent';
  if (maxElevation >= 30) return 'good';
  if (maxElevation >= 15) return 'fair';
  return 'poor';
}

/**
 * Resample sky path to a specific number of points
 */
function resampleSkyPath(path: SkyPoint[], numPoints: number): SkyPoint[] {
  if (path.length <= numPoints) return path;
  
  const result: SkyPoint[] = [];
  const step = (path.length - 1) / (numPoints - 1);
  
  for (let i = 0; i < numPoints; i++) {
    const index = Math.round(i * step);
    result.push(path[Math.min(index, path.length - 1)]);
  }
  
  return result;
}

/**
 * Simple estimation of whether satellite is illuminated
 * (This is a rough approximation)
 */
function estimateIllumination(obs: ObservationResult, jd: number): boolean {
  // Satellite is typically illuminated when:
  // 1. It's at sufficient altitude to see the sun
  // 2. The observer is in darkness (for visibility)
  
  // Simple check: if satellite altitude > 200km and it's night locally,
  // the satellite is likely illuminated
  return obs.geodetic.altitude > 200;
}

/**
 * Get the next pass over an observer
 */
export function getNextPass(
  elements: OrbitalElements,
  observer: Observer,
  propagateFn: (elements: OrbitalElements, tsince: number) => PropagationResult,
  startTsince: number = 0,
  maxSearchMinutes: number = 2880 // 2 days
): SatellitePass | null {
  const result = findPasses(elements, observer, propagateFn, {
    startTsince,
    durationMinutes: maxSearchMinutes,
    minElevation: 0,
    stepMinutes: 0.5
  });
  
  return result.passes.length > 0 ? result.passes[0] : null;
}

/**
 * Format a satellite pass as a human-readable string
 */
export function formatPass(pass: SatellitePass): string {
  const lines: string[] = [];
  
  lines.push(`Pass #${pass.passNumber} (${pass.quality.toUpperCase()})`);
  lines.push(`  Rise:      T+${pass.riseTime.toFixed(1)} min, Az ${pass.riseAzimuth.toFixed(1)}° (${getCompassDirection(pass.riseAzimuth)})`);
  lines.push(`  Max El:    T+${pass.maxElevationTime.toFixed(1)} min, El ${pass.maxElevation.toFixed(1)}°, Az ${pass.maxElevationAzimuth.toFixed(1)}° (${getCompassDirection(pass.maxElevationAzimuth)})`);
  lines.push(`  Set:       T+${pass.setTime.toFixed(1)} min, Az ${pass.setAzimuth.toFixed(1)}° (${getCompassDirection(pass.setAzimuth)})`);
  lines.push(`  Duration:  ${pass.duration.toFixed(1)} min`);
  
  return lines.join('\n');
}

/**
 * Format sky path as a table
 */
export function formatSkyPath(skyPath: SkyPoint[], interval: number = 5): string {
  const lines: string[] = [];
  
  lines.push('Time (min) | Azimuth | Elevation | Range (km)');
  lines.push('-----------|---------|-----------|----------');
  
  for (let i = 0; i < skyPath.length; i += interval) {
    const p = skyPath[i];
    lines.push(
      `${p.tsince.toFixed(1).padStart(10)} | ` +
      `${p.azimuth.toFixed(1).padStart(7)}° | ` +
      `${p.elevation.toFixed(1).padStart(9)}° | ` +
      `${p.range.toFixed(0).padStart(10)}`
    );
  }
  
  return lines.join('\n');
}

/**
 * Get compass direction from azimuth
 */
function getCompassDirection(azimuth: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(azimuth / 22.5) % 16;
  return directions[index];
}

/**
 * Generate ASCII sky chart for a pass
 */
export function generateSkyChart(pass: SatellitePass, width: number = 41, height: number = 21): string {
  const lines: string[] = [];
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const radius = Math.min(centerX, centerY) - 1;
  
  // Create empty grid
  const grid: string[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      grid[y][x] = ' ';
    }
  }
  
  // Draw horizon circle
  for (let angle = 0; angle < 360; angle += 5) {
    const rad = angle * Math.PI / 180;
    const x = Math.round(centerX + radius * Math.sin(rad));
    const y = Math.round(centerY - radius * Math.cos(rad));
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = '.';
    }
  }
  
  // Draw cardinal directions
  grid[0][centerX] = 'N';
  grid[height - 1][centerX] = 'S';
  grid[centerY][0] = 'W';
  grid[centerY][width - 1] = 'E';
  grid[centerY][centerX] = '+'; // Zenith
  
  // Draw satellite path
  for (let i = 0; i < pass.skyPath.length; i++) {
    const p = pass.skyPath[i];
    // Convert azimuth/elevation to x/y
    // Elevation 0 = edge, 90 = center
    const r = radius * (90 - p.elevation) / 90;
    const rad = p.azimuth * Math.PI / 180;
    const x = Math.round(centerX + r * Math.sin(rad));
    const y = Math.round(centerY - r * Math.cos(rad));
    
    if (x >= 0 && x < width && y >= 0 && y < height) {
      if (i === 0) {
        grid[y][x] = 'R'; // Rise
      } else if (i === pass.skyPath.length - 1) {
        grid[y][x] = 'S'; // Set
      } else if (Math.abs(p.elevation - pass.maxElevation) < 1) {
        grid[y][x] = 'M'; // Max elevation
      } else {
        grid[y][x] = '*';
      }
    }
  }
  
  // Build output
  lines.push(`Sky Chart - Pass #${pass.passNumber}`);
  lines.push('R=Rise, M=Max, S=Set');
  lines.push('─'.repeat(width));
  for (let y = 0; y < height; y++) {
    lines.push(grid[y].join(''));
  }
  lines.push('─'.repeat(width));
  
  return lines.join('\n');
}

