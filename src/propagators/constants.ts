/**
 * SPACETRACK REPORT NO. 3 Constants
 * Physical constants and mathematical values used by all propagation models
 */

// WGS72 Earth constants (as used in original NORAD models)
export const XKE = 0.0743669161; // sqrt(GM) in earth-radii^1.5/min
export const XKMPER = 6378.135; // Earth equatorial radius (km)
export const XJ2 = 1.082616e-3; // Second gravitational zonal harmonic
export const XJ3 = -0.253881e-5; // Third gravitational zonal harmonic
export const XJ4 = -1.65597e-6; // Fourth gravitational zonal harmonic
export const CK2 = 0.5 * XJ2; // J2/2
export const CK4 = -0.375 * XJ4; // -3*J4/8
export const A3OVK2 = -XJ3 / CK2; // -J3/(J2/2)

// Time constants
export const MINUTES_PER_DAY = 1440.0;

// Mathematical constants
export const PI = Math.PI;
export const TWOPI = 2.0 * PI;
export const DEG2RAD = PI / 180.0;
export const RAD2DEG = 180.0 / PI;

// Derived constants
export const AE = 1.0; // Earth radius in Earth radii (unity)
export const QOMS2T = 1.88027916e-9; // ((QOMS2T)^4 where QOMS2T = (120-78.0)/XKMPER)
export const S = 1.01222928; // S parameter for atmospheric density
export const TOTHRD = 2.0 / 3.0;
export const E6A = 1.0e-6;

// Period threshold for deep-space vs near-Earth (225 minutes)
export const DEEP_SPACE_THRESHOLD = 225.0;

// Convergence tolerance
export const CONVERGENCE_TOLERANCE = 1.0e-12;

