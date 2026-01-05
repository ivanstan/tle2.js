/**
 * Observer Module
 * Calculate satellite position relative to a ground observer
 * 
 * Provides:
 * - Look angles (azimuth, elevation)
 * - Range (distance to satellite)
 * - Range rate (velocity towards/away from observer)
 * - Geodetic coordinates (latitude, longitude, altitude)
 */

import { XKMPER, TWOPI, PI, DEG2RAD } from './constants';
import { StateVector, PropagationResult } from './types';

/** Observer location on Earth's surface */
export interface Observer {
  /** Latitude in degrees (positive = North, negative = South) */
  latitude: number;
  /** Longitude in degrees (positive = East, negative = West) */
  longitude: number;
  /** Altitude above sea level in meters */
  altitude: number;
}

/** Look angles from observer to satellite */
export interface LookAngles {
  /** Azimuth in degrees (0 = North, 90 = East, 180 = South, 270 = West) */
  azimuth: number;
  /** Elevation in degrees (0 = horizon, 90 = zenith, negative = below horizon) */
  elevation: number;
  /** Range (distance) to satellite in km */
  range: number;
  /** Range rate in km/s (positive = moving away, negative = approaching) */
  rangeRate: number;
}

/** Geodetic coordinates of satellite */
export interface GeodeticCoordinates {
  /** Latitude in degrees */
  latitude: number;
  /** Longitude in degrees */
  longitude: number;
  /** Altitude above sea level in km */
  altitude: number;
}

/** Topocentric coordinates (observer-centered) */
export interface TopocentricCoordinates {
  /** South direction component (km) */
  south: number;
  /** East direction component (km) */
  east: number;
  /** Up (zenith) direction component (km) */
  up: number;
  /** South velocity component (km/s) */
  southRate: number;
  /** East velocity component (km/s) */
  eastRate: number;
  /** Up velocity component (km/s) */
  upRate: number;
}

/** Visibility footprint - the circle from which the satellite can be seen */
export interface VisibilityFootprint {
  /** Sub-satellite point (directly below the satellite) */
  subSatellitePoint: {
    latitude: number;
    longitude: number;
  };
  /** Satellite altitude above Earth surface (km) */
  altitude: number;
  /** Radius of visibility circle on Earth's surface (km) */
  radiusKm: number;
  /** Angular radius of visibility circle (degrees) */
  radiusDeg: number;
  /** Maximum range from satellite to edge of visibility circle (km) */
  maxRange: number;
  /** Minimum elevation angle for visibility (degrees, typically 0) */
  minElevation: number;
  /** Boundary points of the visibility circle (array of lat/lon pairs) */
  boundaryPoints: Array<{ latitude: number; longitude: number }>;
}

/** Complete observation result */
export interface ObservationResult {
  /** Look angles from observer */
  lookAngles: LookAngles;
  /** Satellite geodetic coordinates */
  geodetic: GeodeticCoordinates;
  /** Topocentric coordinates */
  topocentric: TopocentricCoordinates;
  /** Visibility footprint - area from which satellite can be seen */
  footprint: VisibilityFootprint;
  /** True if satellite is visible (elevation > 0) */
  visible: boolean;
  /** Time since epoch (minutes) */
  tsince: number;
}

// Earth flattening factor (WGS72)
const EARTH_FLATTENING = 1.0 / 298.26;
const EARTH_ECCENTRICITY_SQ = EARTH_FLATTENING * (2.0 - EARTH_FLATTENING);

/**
 * Calculate the visibility footprint of a satellite
 * This is the circular area on Earth's surface from which the satellite can be seen
 * 
 * @param geodetic - Satellite geodetic coordinates
 * @param minElevation - Minimum elevation angle for visibility (degrees, default 0)
 * @param numPoints - Number of points to generate for boundary circle (default 72)
 * @returns Visibility footprint with radius and boundary points
 */
export function calculateVisibilityFootprint(
  geodetic: GeodeticCoordinates,
  minElevation: number = 0,
  numPoints: number = 72
): VisibilityFootprint {
  const { latitude, longitude, altitude } = geodetic;
  
  // Earth radius at the sub-satellite point (simplified, assuming spherical Earth)
  const Re = XKMPER;
  
  // Satellite distance from Earth center
  const Rs = Re + altitude;
  
  // Convert minimum elevation to radians
  const elRad = minElevation * DEG2RAD;
  
  // Calculate the Earth central angle (angular radius of visibility circle)
  // Using geometry: cos(rho) = Re / Rs for elevation = 0
  // For non-zero elevation: rho = acos(Re * cos(el) / Rs) - el
  let rho: number;
  if (minElevation === 0) {
    // Simple case: horizon visibility
    rho = Math.acos(Re / Rs);
  } else {
    // Account for minimum elevation angle
    // The angle from satellite to the horizon with elevation el
    const cosRho = Re * Math.cos(elRad) / Rs;
    if (cosRho >= 1) {
      rho = 0; // Satellite too low for this elevation
    } else if (cosRho <= -1) {
      rho = PI; // Entire hemisphere visible
    } else {
      rho = Math.acos(cosRho) - elRad;
    }
  }
  
  // Ground distance (arc length on Earth's surface)
  const radiusKm = Re * rho;
  
  // Angular radius in degrees
  const radiusDeg = rho / DEG2RAD;
  
  // Maximum slant range (distance from satellite to edge of footprint)
  // Using law of cosines: d² = Re² + Rs² - 2*Re*Rs*cos(rho)
  const maxRange = Math.sqrt(
    Re * Re + Rs * Rs - 2 * Re * Rs * Math.cos(rho)
  );
  
  // Generate boundary points using spherical geometry
  const boundaryPoints: Array<{ latitude: number; longitude: number }> = [];
  const latRad = latitude * DEG2RAD;
  const lonRad = longitude * DEG2RAD;
  
  for (let i = 0; i < numPoints; i++) {
    const bearing = (i / numPoints) * TWOPI; // Bearing from 0 to 2π
    
    // Calculate point at distance rho (angular) from sub-satellite point
    // Using spherical law of cosines
    const pointLat = Math.asin(
      Math.sin(latRad) * Math.cos(rho) +
      Math.cos(latRad) * Math.sin(rho) * Math.cos(bearing)
    );
    
    const pointLon = lonRad + Math.atan2(
      Math.sin(bearing) * Math.sin(rho) * Math.cos(latRad),
      Math.cos(rho) - Math.sin(latRad) * Math.sin(pointLat)
    );
    
    // Normalize longitude to -180 to 180
    let pointLonDeg = pointLon / DEG2RAD;
    while (pointLonDeg > 180) pointLonDeg -= 360;
    while (pointLonDeg < -180) pointLonDeg += 360;
    
    boundaryPoints.push({
      latitude: pointLat / DEG2RAD,
      longitude: pointLonDeg
    });
  }
  
  return {
    subSatellitePoint: {
      latitude,
      longitude
    },
    altitude,
    radiusKm,
    radiusDeg,
    maxRange,
    minElevation,
    boundaryPoints
  };
}

/**
 * Convert observer geodetic position to Earth-Centered Earth-Fixed (ECEF) coordinates
 */
export function geodeticToECEF(observer: Observer): { x: number; y: number; z: number } {
  const latRad = observer.latitude * DEG2RAD;
  const lonRad = observer.longitude * DEG2RAD;
  const altKm = observer.altitude / 1000.0; // Convert meters to km

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  // Radius of curvature in the prime vertical
  const N = XKMPER / Math.sqrt(1.0 - EARTH_ECCENTRICITY_SQ * sinLat * sinLat);

  const x = (N + altKm) * cosLat * cosLon;
  const y = (N + altKm) * cosLat * sinLon;
  const z = (N * (1.0 - EARTH_ECCENTRICITY_SQ) + altKm) * sinLat;

  return { x, y, z };
}

/**
 * Calculate Greenwich Sidereal Time for a given Julian Date
 */
export function calculateGST(jd: number): number {
  const tut1 = (jd - 2451545.0) / 36525.0;
  let gst = -6.2e-6 * tut1 * tut1 * tut1 +
    0.093104 * tut1 * tut1 +
    (876600.0 * 3600 + 8640184.812866) * tut1 +
    67310.54841;

  gst = ((gst * DEG2RAD) / 240.0) % TWOPI;
  if (gst < 0.0) gst += TWOPI;

  return gst;
}

/**
 * Convert satellite ECI (Earth-Centered Inertial) position to geodetic coordinates
 */
export function eciToGeodetic(
  x: number, 
  y: number, 
  z: number, 
  gmst: number
): GeodeticCoordinates {
  // Calculate longitude
  let longitude = Math.atan2(y, x) - gmst;
  
  // Normalize longitude to -180 to 180
  while (longitude < -PI) longitude += TWOPI;
  while (longitude > PI) longitude -= TWOPI;
  
  // Calculate latitude using iterative method
  const r = Math.sqrt(x * x + y * y);
  let latitude = Math.atan2(z, r);
  
  // Iterate to find geodetic latitude
  const tolerance = 1e-12;
  let prevLat = 0;
  let C = 0;
  
  for (let i = 0; i < 10 && Math.abs(latitude - prevLat) > tolerance; i++) {
    prevLat = latitude;
    const sinLat = Math.sin(latitude);
    C = 1.0 / Math.sqrt(1.0 - EARTH_ECCENTRICITY_SQ * sinLat * sinLat);
    latitude = Math.atan2(z + XKMPER * C * EARTH_ECCENTRICITY_SQ * sinLat, r);
  }
  
  // Calculate altitude
  const sinLat = Math.sin(latitude);
  const cosLat = Math.cos(latitude);
  C = 1.0 / Math.sqrt(1.0 - EARTH_ECCENTRICITY_SQ * sinLat * sinLat);
  
  let altitude: number;
  if (Math.abs(cosLat) > 1e-10) {
    altitude = r / cosLat - XKMPER * C;
  } else {
    altitude = Math.abs(z) / Math.abs(sinLat) - XKMPER * C * (1.0 - EARTH_ECCENTRICITY_SQ);
  }
  
  return {
    latitude: latitude / DEG2RAD,
    longitude: longitude / DEG2RAD,
    altitude
  };
}

/**
 * Calculate topocentric coordinates (observer-centered South-East-Up frame)
 */
export function calculateTopocentric(
  observer: Observer,
  satX: number, satY: number, satZ: number,
  satVx: number, satVy: number, satVz: number,
  gmst: number
): TopocentricCoordinates {
  const latRad = observer.latitude * DEG2RAD;
  const lonRad = observer.longitude * DEG2RAD;
  
  // Observer position in ECEF
  const obsECEF = geodeticToECEF(observer);
  
  // Convert observer to ECI (rotate by GMST)
  const theta = gmst + lonRad;
  const obsX = obsECEF.x * Math.cos(gmst) - obsECEF.y * Math.sin(gmst);
  const obsY = obsECEF.x * Math.sin(gmst) + obsECEF.y * Math.cos(gmst);
  const obsZ = obsECEF.z;
  
  // Observer velocity due to Earth rotation (km/s)
  const earthRotRate = 7.2921158553e-5; // rad/s
  const obsVx = -earthRotRate * obsY;
  const obsVy = earthRotRate * obsX;
  const obsVz = 0;
  
  // Range vector (satellite position relative to observer)
  const rangeX = satX - obsX;
  const rangeY = satY - obsY;
  const rangeZ = satZ - obsZ;
  
  // Range rate vector
  const rangeVx = satVx - obsVx;
  const rangeVy = satVy - obsVy;
  const rangeVz = satVz - obsVz;
  
  // Rotation matrix from ECI to topocentric (South-East-Up)
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  
  // South-East-Up components
  const south = sinLat * cosTheta * rangeX + sinLat * sinTheta * rangeY - cosLat * rangeZ;
  const east = -sinTheta * rangeX + cosTheta * rangeY;
  const up = cosLat * cosTheta * rangeX + cosLat * sinTheta * rangeY + sinLat * rangeZ;
  
  // Velocity components
  const southRate = sinLat * cosTheta * rangeVx + sinLat * sinTheta * rangeVy - cosLat * rangeVz;
  const eastRate = -sinTheta * rangeVx + cosTheta * rangeVy;
  const upRate = cosLat * cosTheta * rangeVx + cosLat * sinTheta * rangeVy + sinLat * rangeVz;
  
  return { south, east, up, southRate, eastRate, upRate };
}

/**
 * Calculate look angles from observer to satellite
 */
export function calculateLookAngles(topocentric: TopocentricCoordinates): LookAngles {
  const { south, east, up, southRate, eastRate, upRate } = topocentric;
  
  // Range (distance to satellite)
  const range = Math.sqrt(south * south + east * east + up * up);
  
  // Elevation (angle above horizon)
  const elevation = Math.asin(up / range) / DEG2RAD;
  
  // Azimuth (angle from north, clockwise)
  let azimuth = Math.atan2(east, -south) / DEG2RAD;
  if (azimuth < 0) azimuth += 360;
  
  // Range rate (positive = moving away)
  const rangeRate = (south * southRate + east * eastRate + up * upRate) / range;
  
  return { azimuth, elevation, range, rangeRate };
}

/**
 * Calculate satellite observation from a ground observer
 * 
 * @param result - Propagation result from any SGP model
 * @param observer - Ground observer location
 * @param jd - Julian date of observation
 * @returns Complete observation with look angles, geodetic coordinates, visibility
 */
export function observe(
  result: PropagationResult,
  observer: Observer,
  jd: number,
  footprintMinElevation: number = 0
): ObservationResult {
  if (result.error) {
    const emptyFootprint: VisibilityFootprint = {
      subSatellitePoint: { latitude: 0, longitude: 0 },
      altitude: 0,
      radiusKm: 0,
      radiusDeg: 0,
      maxRange: 0,
      minElevation: 0,
      boundaryPoints: []
    };
    return {
      lookAngles: { azimuth: 0, elevation: -90, range: 0, rangeRate: 0 },
      geodetic: { latitude: 0, longitude: 0, altitude: 0 },
      topocentric: { south: 0, east: 0, up: 0, southRate: 0, eastRate: 0, upRate: 0 },
      footprint: emptyFootprint,
      visible: false,
      tsince: result.tsince
    };
  }
  
  const { x, y, z, xdot, ydot, zdot } = result.state;
  
  // Calculate GMST for the observation time
  const gmst = calculateGST(jd);
  
  // Convert satellite ECI to geodetic
  const geodetic = eciToGeodetic(x, y, z, gmst);
  
  // Calculate topocentric coordinates
  const topocentric = calculateTopocentric(
    observer,
    x, y, z,
    xdot, ydot, zdot,
    gmst
  );
  
  // Calculate look angles
  const lookAngles = calculateLookAngles(topocentric);
  
  // Calculate visibility footprint
  const footprint = calculateVisibilityFootprint(geodetic, footprintMinElevation);
  
  // Satellite is visible if elevation > 0
  const visible = lookAngles.elevation > 0;
  
  return {
    lookAngles,
    geodetic,
    topocentric,
    footprint,
    visible,
    tsince: result.tsince
  };
}

/**
 * Calculate when satellite will next be visible (rise time)
 * Uses simple step search followed by bisection refinement
 * 
 * @param elements - Orbital elements
 * @param observer - Ground observer
 * @param propagateFn - Propagation function to use
 * @param jdStart - Julian date to start searching from
 * @param maxMinutes - Maximum time to search (default 24 hours)
 * @param stepMinutes - Initial step size (default 1 minute)
 * @returns Time in minutes since epoch when satellite rises, or null if not found
 */
export function findNextPass(
  elements: any,
  observer: Observer,
  propagateFn: (elements: any, tsince: number) => PropagationResult,
  jdStart: number,
  tsinceStart: number,
  maxMinutes: number = 1440,
  stepMinutes: number = 1
): { rise: number; set: number; maxElevation: number; maxElevationTime: number } | null {
  let wasVisible = false;
  let riseTime: number | null = null;
  let setTime: number | null = null;
  let maxEl = -90;
  let maxElTime = 0;
  
  for (let t = tsinceStart; t < tsinceStart + maxMinutes; t += stepMinutes) {
    const result = propagateFn(elements, t);
    const jd = jdStart + (t - tsinceStart) / 1440.0;
    const obs = observe(result, observer, jd);
    
    if (obs.visible && !wasVisible) {
      // Satellite just rose
      riseTime = t;
      maxEl = obs.lookAngles.elevation;
      maxElTime = t;
    }
    
    if (obs.visible) {
      if (obs.lookAngles.elevation > maxEl) {
        maxEl = obs.lookAngles.elevation;
        maxElTime = t;
      }
    }
    
    if (!obs.visible && wasVisible && riseTime !== null) {
      // Satellite just set
      setTime = t;
      return {
        rise: riseTime,
        set: setTime,
        maxElevation: maxEl,
        maxElevationTime: maxElTime
      };
    }
    
    wasVisible = obs.visible;
  }
  
  return null;
}

/**
 * Create an observer from latitude, longitude, and altitude
 */
export function createObserver(
  latitude: number,
  longitude: number,
  altitude: number = 0
): Observer {
  return { latitude, longitude, altitude };
}

/**
 * Calculate Julian Date from a JavaScript Date object
 */
export function dateToJD(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds() + date.getUTCMilliseconds() / 1000;
  
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  
  let jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4);
  jd = jd - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  jd = jd + (hour - 12) / 24 + minute / 1440 + second / 86400;
  
  return jd;
}

/**
 * Calculate time since epoch in minutes from a Date and TLE epoch
 */
export function calculateTsince(date: Date, jdEpoch: number): number {
  const jdNow = dateToJD(date);
  return (jdNow - jdEpoch) * 1440.0; // Convert days to minutes
}

/**
 * Check if an observer is within the satellite's visibility footprint
 */
export function isWithinFootprint(
  observer: Observer,
  footprint: VisibilityFootprint
): boolean {
  // Calculate great-circle distance between observer and sub-satellite point
  const lat1 = observer.latitude * DEG2RAD;
  const lon1 = observer.longitude * DEG2RAD;
  const lat2 = footprint.subSatellitePoint.latitude * DEG2RAD;
  const lon2 = footprint.subSatellitePoint.longitude * DEG2RAD;
  
  const dLon = lon2 - lon1;
  
  // Haversine formula for angular distance
  const a = Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Angular distance in degrees
  const angularDistDeg = c / DEG2RAD;
  
  return angularDistDeg <= footprint.radiusDeg;
}

/**
 * Calculate the ground distance from observer to sub-satellite point
 */
export function distanceToSubSatellite(
  observer: Observer,
  footprint: VisibilityFootprint
): number {
  const lat1 = observer.latitude * DEG2RAD;
  const lon1 = observer.longitude * DEG2RAD;
  const lat2 = footprint.subSatellitePoint.latitude * DEG2RAD;
  const lon2 = footprint.subSatellitePoint.longitude * DEG2RAD;
  
  const dLon = lon2 - lon1;
  
  // Haversine formula
  const a = Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Distance in km
  return XKMPER * c;
}

/**
 * Format visibility footprint as human-readable string
 */
export function formatFootprint(footprint: VisibilityFootprint): string {
  const lines: string[] = [];
  
  lines.push(`Visibility Footprint:`);
  lines.push(`  Sub-satellite point: ${footprint.subSatellitePoint.latitude.toFixed(4)}°, ${footprint.subSatellitePoint.longitude.toFixed(4)}°`);
  lines.push(`  Satellite altitude:  ${footprint.altitude.toFixed(1)} km`);
  lines.push(`  Footprint radius:    ${footprint.radiusKm.toFixed(1)} km (${footprint.radiusDeg.toFixed(2)}°)`);
  lines.push(`  Max slant range:     ${footprint.maxRange.toFixed(1)} km`);
  lines.push(`  Min elevation:       ${footprint.minElevation.toFixed(1)}°`);
  lines.push(`  Boundary points:     ${footprint.boundaryPoints.length}`);
  
  return lines.join('\n');
}

/**
 * Generate GeoJSON polygon for visibility footprint (for mapping)
 */
export function footprintToGeoJSON(footprint: VisibilityFootprint): object {
  // Close the polygon by adding the first point at the end
  const coordinates = [
    ...footprint.boundaryPoints.map(p => [p.longitude, p.latitude]),
    [footprint.boundaryPoints[0].longitude, footprint.boundaryPoints[0].latitude]
  ];
  
  return {
    type: "Feature",
    properties: {
      altitude: footprint.altitude,
      radiusKm: footprint.radiusKm,
      minElevation: footprint.minElevation,
      subSatellitePoint: footprint.subSatellitePoint
    },
    geometry: {
      type: "Polygon",
      coordinates: [coordinates]
    }
  };
}

