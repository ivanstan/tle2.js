/**
 * TLE Parser - Extracts orbital elements from Two-Line Element sets
 * Based on SPACETRACK REPORT NO. 3
 */

import { DEG2RAD, TWOPI, MINUTES_PER_DAY, XKE, TOTHRD } from './constants';
import { OrbitalElements } from './types';

/**
 * Parse exponential notation used in TLE format (e.g., "66816-4" = 0.66816e-4)
 */
function parseExpNotation(str: string): number {
  const trimmed = str.trim();
  if (!trimmed) return 0;
  
  // Handle format like "12345-4" or "+12345-4" or "-12345-4"
  // or "12345+4" for positive exponent
  let sign = 1;
  let mantissa = trimmed;
  
  if (mantissa.startsWith('-')) {
    sign = -1;
    mantissa = mantissa.substring(1);
  } else if (mantissa.startsWith('+')) {
    mantissa = mantissa.substring(1);
  }
  
  // Find the exponent part (look for - or + that's not at position 0)
  let expSign = 1;
  let expIndex = -1;
  
  for (let i = 1; i < mantissa.length; i++) {
    if (mantissa[i] === '-') {
      expSign = -1;
      expIndex = i;
      break;
    } else if (mantissa[i] === '+') {
      expSign = 1;
      expIndex = i;
      break;
    }
  }
  
  if (expIndex === -1) {
    // No exponent found, treat as regular number with implied decimal
    return sign * parseFloat('0.' + mantissa);
  }
  
  const mantissaPart = mantissa.substring(0, expIndex);
  const expPart = mantissa.substring(expIndex + 1);
  
  const value = sign * parseFloat('0.' + mantissaPart) * Math.pow(10, expSign * parseInt(expPart));
  return value;
}

/**
 * Calculate Julian Date from year and day of year
 */
function jday(year: number, mon: number, day: number, hr: number, minute: number, sec: number): number {
  return (
    367.0 * year -
    Math.floor(7.0 * (year + Math.floor((mon + 9.0) / 12.0)) / 4.0) +
    Math.floor(275.0 * mon / 9.0) +
    day +
    1721013.5 +
    ((sec / 60.0 + minute) / 60.0 + hr) / 24.0
  );
}

/**
 * Convert epoch year and day to Julian Date
 */
function epochToJD(epochYear: number, epochDay: number): number {
  // Determine full year
  let year: number;
  if (epochYear < 57) {
    year = epochYear + 2000;
  } else {
    year = epochYear + 1900;
  }
  
  // Calculate month, day, hour, minute, second from day of year
  const dayOfYear = Math.floor(epochDay);
  const fractionOfDay = epochDay - dayOfYear;
  
  // Determine if leap year
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  
  const daysInMonth = [
    31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31
  ];
  
  let mon = 1;
  let day = dayOfYear;
  
  for (let i = 0; i < 12; i++) {
    if (day <= daysInMonth[i]) {
      mon = i + 1;
      break;
    }
    day -= daysInMonth[i];
  }
  
  const hr = Math.floor(fractionOfDay * 24.0);
  const minute = Math.floor((fractionOfDay * 24.0 - hr) * 60.0);
  const sec = ((fractionOfDay * 24.0 - hr) * 60.0 - minute) * 60.0;
  
  return jday(year, mon, day, hr, minute, sec);
}

/**
 * Parse a Two-Line Element set and extract orbital elements
 * 
 * @param line1 - First line of TLE
 * @param line2 - Second line of TLE
 * @returns Parsed orbital elements
 */
export function parseTLE(line1: string, line2: string): OrbitalElements {
  // Ensure lines are at least 69 characters
  const l1 = line1.padEnd(69);
  const l2 = line2.padEnd(69);
  
  // Line 1 parsing
  // Columns are 1-indexed in TLE documentation
  const satnum = parseInt(l1.substring(2, 7).trim());
  
  // Epoch year (columns 19-20)
  const epochYearStr = l1.substring(18, 20).trim();
  const epochYear = parseInt(epochYearStr);
  
  // Epoch day (columns 21-32)
  const epochDay = parseFloat(l1.substring(20, 32).trim());
  
  // First derivative of mean motion / 2 (columns 34-43)
  const ndot = parseFloat(l1.substring(33, 43).trim());
  
  // Second derivative of mean motion / 6 (columns 45-52, in exponential notation)
  const nddotStr = l1.substring(44, 52).trim();
  const nddot = parseExpNotation(nddotStr);
  
  // B* drag term (columns 54-61, in exponential notation)
  const bstarStr = l1.substring(53, 61).trim();
  const bstar = parseExpNotation(bstarStr);
  
  // Line 2 parsing
  // Inclination (columns 9-16)
  const inclo = parseFloat(l2.substring(8, 16).trim()) * DEG2RAD;
  
  // Right ascension of ascending node (columns 18-25)
  const nodeo = parseFloat(l2.substring(17, 25).trim()) * DEG2RAD;
  
  // Eccentricity (columns 27-33, with implied leading "0.")
  const ecco = parseFloat('0.' + l2.substring(26, 33).trim());
  
  // Argument of perigee (columns 35-42)
  const argpo = parseFloat(l2.substring(34, 42).trim()) * DEG2RAD;
  
  // Mean anomaly (columns 44-51)
  const mo = parseFloat(l2.substring(43, 51).trim()) * DEG2RAD;
  
  // Mean motion (revolutions per day, columns 53-63)
  const noRaw = parseFloat(l2.substring(52, 63).trim());
  
  // Revolution number at epoch (columns 64-68)
  const revnum = parseInt(l2.substring(63, 68).trim()) || 0;
  
  // Convert mean motion from rev/day to rad/min
  const no = noRaw * TWOPI / MINUTES_PER_DAY;
  
  // Calculate Julian date
  const jdsatepoch = epochToJD(epochYear, epochDay);
  
  // Calculate full epoch year
  let fullYear: number;
  if (epochYear < 57) {
    fullYear = epochYear + 2000;
  } else {
    fullYear = epochYear + 1900;
  }
  
  return {
    satnum,
    epochYear: fullYear,
    epochDay,
    jdsatepoch,
    ndot: ndot / (MINUTES_PER_DAY * MINUTES_PER_DAY) * TWOPI, // Convert to rad/min^2
    nddot: nddot / (MINUTES_PER_DAY * MINUTES_PER_DAY * MINUTES_PER_DAY) * TWOPI, // Convert to rad/min^3
    bstar,
    inclo,
    nodeo,
    ecco,
    argpo,
    mo,
    no,
    revnum
  };
}

/**
 * Get the orbital period in minutes
 */
export function getOrbitalPeriod(no: number): number {
  return TWOPI / no;
}

/**
 * Get the semi-major axis in Earth radii
 */
export function getSemiMajorAxis(no: number): number {
  return Math.pow(XKE / no, TOTHRD);
}

