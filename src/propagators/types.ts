/**
 * Types for SPACETRACK propagation models
 */

/** Parsed orbital elements from a TLE */
export interface OrbitalElements {
  /** Satellite catalog number */
  satnum: number;
  /** Epoch year (full year, e.g., 1980) */
  epochYear: number;
  /** Day of year + fractional day */
  epochDay: number;
  /** Julian date of epoch */
  jdsatepoch: number;
  /** First derivative of mean motion (rev/day^2) / 2 */
  ndot: number;
  /** Second derivative of mean motion (rev/day^3) / 6 */
  nddot: number;
  /** B* drag term (1/earth-radii) */
  bstar: number;
  /** Inclination (radians) */
  inclo: number;
  /** Right ascension of ascending node (radians) */
  nodeo: number;
  /** Eccentricity */
  ecco: number;
  /** Argument of perigee (radians) */
  argpo: number;
  /** Mean anomaly (radians) */
  mo: number;
  /** Mean motion (radians/minute) */
  no: number;
  /** Revolution number at epoch */
  revnum: number;
}

/** Position and velocity vectors in km and km/s */
export interface StateVector {
  /** Position X component (km) */
  x: number;
  /** Position Y component (km) */
  y: number;
  /** Position Z component (km) */
  z: number;
  /** Velocity X component (km/s) */
  xdot: number;
  /** Velocity Y component (km/s) */
  ydot: number;
  /** Velocity Z component (km/s) */
  zdot: number;
}

/** Result from propagation */
export interface PropagationResult {
  /** State vector at requested time */
  state: StateVector;
  /** Time since epoch (minutes) */
  tsince: number;
  /** Algorithm used */
  algorithm: 'SGP' | 'SGP4' | 'SDP4' | 'SGP8' | 'SDP8';
  /** True if satellite has decayed */
  error: boolean;
  /** Error message if any */
  errorMessage?: string;
}

/** Satellite type based on orbital period */
export type SatelliteType = 'near-earth' | 'deep-space';

/** Internal state for SGP4/SDP4 initialization */
export interface Sgp4InitState {
  method: 'd' | 'n'; // deep-space or near-earth
  isimp: number;
  aycof: number;
  con41: number;
  cc1: number;
  cc4: number;
  cc5: number;
  d2: number;
  d3: number;
  d4: number;
  delmo: number;
  eta: number;
  argpdot: number;
  omgcof: number;
  sinmao: number;
  t: number;
  t2cof: number;
  t3cof: number;
  t4cof: number;
  t5cof: number;
  x1mth2: number;
  x7thm1: number;
  mdot: number;
  nodedot: number;
  xlcof: number;
  xmcof: number;
  nodecf: number;
  irez: number;
  d2201: number;
  d2211: number;
  d3210: number;
  d3222: number;
  d4410: number;
  d4422: number;
  d5220: number;
  d5232: number;
  d5421: number;
  d5433: number;
  dedt: number;
  del1: number;
  del2: number;
  del3: number;
  didt: number;
  dmdt: number;
  dnodt: number;
  domdt: number;
  e3: number;
  ee2: number;
  peo: number;
  pgho: number;
  pho: number;
  pinco: number;
  plo: number;
  se2: number;
  se3: number;
  sgh2: number;
  sgh3: number;
  sgh4: number;
  sh2: number;
  sh3: number;
  si2: number;
  si3: number;
  sl2: number;
  sl3: number;
  sl4: number;
  gsto: number;
  xfact: number;
  xgh2: number;
  xgh3: number;
  xgh4: number;
  xh2: number;
  xh3: number;
  xi2: number;
  xi3: number;
  xl2: number;
  xl3: number;
  xl4: number;
  xlamo: number;
  zmol: number;
  zmos: number;
  atime: number;
  xli: number;
  xni: number;
  // Common elements
  a: number;
  altp: number;
  alta: number;
  epochdays: number;
  jdsatepoch: number;
  nddot: number;
  ndot: number;
  bstar: number;
  rcse: number;
  inclo: number;
  nodeo: number;
  ecco: number;
  argpo: number;
  mo: number;
  no: number;
  // Initialized flag
  init: boolean;
}

