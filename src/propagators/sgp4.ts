/**
 * SGP4 (Simplified General Perturbations 4) Model
 * Based on SPACETRACK REPORT NO. 3, Section 6
 * 
 * This is the primary model used for near-Earth satellites (period < 225 min).
 * Uses Brouwer's gravitational theory with a power-law atmospheric model.
 */

import {
  CK2, CK4, XKE, XKMPER, TWOPI, TOTHRD, AE, E6A, A3OVK2, PI
} from './constants';
import { OrbitalElements, StateVector, PropagationResult, Sgp4InitState } from './types';

/**
 * Initialize SGP4 propagator state
 */
export function sgp4init(elements: OrbitalElements): Sgp4InitState {
  const {
    bstar, inclo, nodeo, ecco, argpo, mo, no
  } = elements;

  // Recover original mean motion (n0) and semi-major axis (a0)
  const a1 = Math.pow(XKE / no, TOTHRD);
  const cosio = Math.cos(inclo);
  const theta2 = cosio * cosio;
  const x3thm1 = 3.0 * theta2 - 1.0;
  const eosq = ecco * ecco;
  const betao2 = 1.0 - eosq;
  const betao = Math.sqrt(betao2);
  const del1 = (1.5 * CK2 * x3thm1) / (a1 * a1 * betao * betao2);
  const ao = a1 * (1.0 - del1 * (0.5 * TOTHRD + del1 * (1.0 + (134.0 / 81.0) * del1)));
  const delo = (1.5 * CK2 * x3thm1) / (ao * ao * betao * betao2);
  const xnodp = no / (1.0 + delo);
  const aodp = ao / (1.0 - delo);

  // For very low eccentricity, use simplified mode
  const isimp = (aodp * (1.0 - ecco) / AE) < (220.0 / XKMPER + AE) ? 1 : 0;

  // Initialization for atmospheric drag and gravitational terms
  const s4 = 78.0 / XKMPER + AE;
  const qoms24 = Math.pow((120.0 - 78.0) / XKMPER, 4);
  const perige = (aodp * (1.0 - ecco) - AE) * XKMPER;

  let s = s4;
  let qoms2t = qoms24;
  if (perige < 156.0) {
    s = perige - 78.0;
    if (perige <= 98.0) {
      s = 20.0;
    }
    qoms2t = Math.pow((120.0 - s) / XKMPER, 4);
    s = s / XKMPER + AE;
  }

  const pinvsq = 1.0 / (aodp * aodp * betao2 * betao2);
  const tsi = 1.0 / (aodp - s);
  const eta = aodp * ecco * tsi;
  const etasq = eta * eta;
  const eeta = ecco * eta;
  const psisq = Math.abs(1.0 - etasq);
  const coef = qoms2t * Math.pow(tsi, 4);
  const coef1 = coef / Math.pow(psisq, 3.5);
  const c2 = coef1 * xnodp * (aodp * (1.0 + 1.5 * etasq + eeta * (4.0 + etasq)) +
    (0.75 * CK2 * tsi / psisq) * x3thm1 * (8.0 + 3.0 * etasq * (8.0 + etasq)));
  const c1 = bstar * c2;
  const sinio = Math.sin(inclo);
  const c3 = coef * tsi * A3OVK2 * aodp * AE * sinio / ecco;
  const x1mth2 = 1.0 - theta2;
  const c4 = 2.0 * xnodp * coef1 * aodp * betao2 *
    (eta * (2.0 + 0.5 * etasq) + ecco * (0.5 + 2.0 * etasq) -
      (2.0 * CK2 * tsi / (aodp * psisq)) *
      (-3.0 * x3thm1 * (1.0 - 2.0 * eeta + etasq * (1.5 - 0.5 * eeta)) +
        0.75 * x1mth2 * (2.0 * etasq - eeta * (1.0 + etasq)) * Math.cos(2.0 * argpo)));
  const c5 = 2.0 * coef1 * aodp * betao2 * (1.0 + 2.75 * (etasq + eeta) + eeta * etasq);

  const theta4 = theta2 * theta2;
  const temp1 = 3.0 * CK2 * pinvsq * xnodp;
  const temp2 = temp1 * CK2 * pinvsq;
  const temp3 = 1.25 * CK4 * pinvsq * pinvsq * xnodp;
  const xmdot = xnodp + 0.5 * temp1 * betao * x3thm1 +
    0.0625 * temp2 * betao * (13.0 - 78.0 * theta2 + 137.0 * theta4);
  const x1m5th = 1.0 - 5.0 * theta2;
  const omgdot = -0.5 * temp1 * x1m5th + 0.0625 * temp2 * (7.0 - 114.0 * theta2 + 395.0 * theta4) +
    temp3 * (3.0 - 36.0 * theta2 + 49.0 * theta4);
  const xhdot1 = -temp1 * cosio;
  const xnodot = xhdot1 + (0.5 * temp2 * (4.0 - 19.0 * theta2) +
    2.0 * temp3 * (3.0 - 7.0 * theta2)) * cosio;
  const omgcof = bstar * c3 * Math.cos(argpo);
  const xmcof = ecco > 1.0e-4 ? -TOTHRD * coef * bstar * AE / eeta : 0.0;
  const xnodcf = 3.5 * betao2 * xhdot1 * c1;
  const t2cof = 1.5 * c1;
  const xlcof = 0.125 * A3OVK2 * sinio * (3.0 + 5.0 * cosio) / (1.0 + cosio);
  const aycof = 0.25 * A3OVK2 * sinio;
  const delmo = Math.pow(1.0 + eta * Math.cos(mo), 3);
  const sinmo = Math.sin(mo);
  const x7thm1 = 7.0 * theta2 - 1.0;

  // Set higher order coefficients for non-simplified mode
  let d2 = 0.0;
  let d3 = 0.0;
  let d4 = 0.0;
  let t3cof = 0.0;
  let t4cof = 0.0;
  let t5cof = 0.0;

  if (isimp === 0) {
    const c1sq = c1 * c1;
    d2 = 4.0 * aodp * tsi * c1sq;
    const temp = d2 * tsi * c1 / 3.0;
    d3 = (17.0 * aodp + s) * temp;
    d4 = 0.5 * temp * aodp * tsi * (221.0 * aodp + 31.0 * s) * c1;
    t3cof = d2 + 2.0 * c1sq;
    t4cof = 0.25 * (3.0 * d3 + c1 * (12.0 * d2 + 10.0 * c1sq));
    t5cof = 0.2 * (3.0 * d4 + 12.0 * c1 * d3 + 6.0 * d2 * d2 + 15.0 * c1sq * (2.0 * d2 + c1sq));
  }

  return {
    method: 'n', // near-earth
    isimp,
    aycof,
    con41: x3thm1, // Use x3thm1 for con41
    cc1: c1,
    cc4: c4,
    cc5: c5,
    d2,
    d3,
    d4,
    delmo,
    eta,
    argpdot: omgdot,
    omgcof,
    sinmao: sinmo,
    t: 0.0,
    t2cof,
    t3cof,
    t4cof,
    t5cof,
    x1mth2,
    x7thm1,
    mdot: xmdot,
    nodedot: xnodot,
    xlcof,
    xmcof,
    nodecf: xnodcf,
    // Deep space - not used in SGP4
    irez: 0,
    d2201: 0, d2211: 0, d3210: 0, d3222: 0, d4410: 0, d4422: 0,
    d5220: 0, d5232: 0, d5421: 0, d5433: 0,
    dedt: 0, del1: 0, del2: 0, del3: 0,
    didt: 0, dmdt: 0, dnodt: 0, domdt: 0,
    e3: 0, ee2: 0,
    peo: 0, pgho: 0, pho: 0, pinco: 0, plo: 0,
    se2: 0, se3: 0, sgh2: 0, sgh3: 0, sgh4: 0, sh2: 0, sh3: 0, si2: 0, si3: 0,
    sl2: 0, sl3: 0, sl4: 0,
    gsto: 0, xfact: 0,
    xgh2: 0, xgh3: 0, xgh4: 0, xh2: 0, xh3: 0, xi2: 0, xi3: 0, xl2: 0, xl3: 0, xl4: 0,
    xlamo: 0, zmol: 0, zmos: 0,
    atime: 0, xli: 0, xni: 0,
    // Common elements
    a: aodp,
    altp: (aodp * (1.0 - ecco) - AE) * XKMPER,
    alta: (aodp * (1.0 + ecco) - AE) * XKMPER,
    epochdays: elements.epochDay,
    jdsatepoch: elements.jdsatepoch,
    nddot: elements.nddot,
    ndot: elements.ndot,
    bstar: bstar,
    rcse: 0,
    inclo,
    nodeo,
    ecco,
    argpo,
    mo,
    no: xnodp,
    init: true
  };
}

/**
 * SGP4 Propagator
 * 
 * @param elements - Orbital elements from TLE
 * @param tsince - Time since epoch in minutes
 * @param initState - Optional pre-computed initialization state
 * @returns Propagation result with position and velocity
 */
export function sgp4(elements: OrbitalElements, tsince: number, initState?: Sgp4InitState): PropagationResult {
  // Initialize if not provided
  const state = initState || sgp4init(elements);

  const {
    isimp, aycof, cc1, cc4, cc5, d2, d3, d4, delmo, eta, argpdot,
    omgcof, sinmao, t2cof, t3cof, t4cof, t5cof, x1mth2, x7thm1,
    mdot, nodedot, xlcof, xmcof, nodecf,
    a: aodp, bstar, inclo, nodeo, ecco, argpo, mo, no: xnodp
  } = state;

  const x3thm1 = state.con41;
  const cosio = Math.cos(inclo);
  const sinio = Math.sin(inclo);
  const betao2 = 1.0 - ecco * ecco;
  const betao = Math.sqrt(betao2);

  // Update for secular gravity and atmospheric drag
  const t = tsince;
  const xmdf = mo + mdot * t;
  const omgadf = argpo + argpdot * t;
  const xnoddf = nodeo + nodedot * t;
  let omega = omgadf;
  let xmp = xmdf;
  const tsq = t * t;
  const xnode = xnoddf + nodecf * tsq;
  let tempa = 1.0 - cc1 * t;
  let tempe = bstar * cc4 * t;
  let templ = t2cof * tsq;

  if (isimp === 0) {
    const delomg = omgcof * t;
    const delm = xmcof > 0 ? xmcof * (Math.pow(1.0 + eta * Math.cos(xmdf), 3) - delmo) : 0.0;
    const temp = delomg + delm;
    xmp = xmdf + temp;
    omega = omgadf - temp;
    const tcube = tsq * t;
    const tfour = t * tcube;
    tempa = tempa - d2 * tsq - d3 * tcube - d4 * tfour;
    tempe = tempe + bstar * cc5 * (Math.sin(xmp) - sinmao);
    templ = templ + t3cof * tcube + tfour * (t4cof + t * t5cof);
  }

  const a = aodp * tempa * tempa;
  const e = ecco - tempe;
  const xl = xmp + omega + xnode + xnodp * templ;

  // Check for decay
  if (a < 0.95 || e >= 1.0 || e < -0.001) {
    return {
      state: { x: 0, y: 0, z: 0, xdot: 0, ydot: 0, zdot: 0 },
      tsince,
      algorithm: 'SGP4',
      error: true,
      errorMessage: 'Satellite has decayed'
    };
  }

  // Clamp eccentricity
  const em = Math.max(e, 1e-6);

  const beta = Math.sqrt(1.0 - em * em);
  const xn = XKE / Math.pow(a, 1.5);

  // Long period periodics
  const axn = em * Math.cos(omega);
  const temp = 1.0 / (a * beta * beta);
  const xlp = temp * xlcof * axn;
  const aynl = temp * aycof;
  const xlt = xl + xlp;
  const ayn = em * Math.sin(omega) + aynl;

  // Solve Kepler's equation (Newton-Raphson iteration)
  const capu = (xlt - xnode) % TWOPI;
  let eo1 = capu;

  for (let i = 0; i < 10; i++) {
    const sineo1 = Math.sin(eo1);
    const coseo1 = Math.cos(eo1);
    // Derivative: 1 - axn*cos(eo1) - ayn*sin(eo1)
    let tem5 = 1.0 - coseo1 * axn - sineo1 * ayn;
    // Newton step: (capu - ayn*cos(eo1) + axn*sin(eo1) - eo1) / derivative
    tem5 = (capu - ayn * coseo1 + axn * sineo1 - eo1) / tem5;
    // Clamp step size for stability
    if (Math.abs(tem5) >= 0.95) {
      tem5 = tem5 > 0 ? 0.95 : -0.95;
    }
    eo1 += tem5;
    if (Math.abs(tem5) < 1e-12) break;
  }
  
  const epw = eo1;

  // Short period preliminary quantities
  const sinepw = Math.sin(epw);
  const cosepw = Math.cos(epw);
  const ecose = axn * cosepw + ayn * sinepw;
  const esine = axn * sinepw - ayn * cosepw;
  const elsq = axn * axn + ayn * ayn;
  const pl = a * (1.0 - elsq);

  if (pl < 0.0) {
    return {
      state: { x: 0, y: 0, z: 0, xdot: 0, ydot: 0, zdot: 0 },
      tsince,
      algorithm: 'SGP4',
      error: true,
      errorMessage: 'Semi-latus rectum is negative'
    };
  }

  const r = a * (1.0 - ecose);
  const rdot = XKE * Math.sqrt(a) * esine / r;
  const rfdot = XKE * Math.sqrt(pl) / r;
  const betal = Math.sqrt(1.0 - elsq);
  // temp = esine / (1 + betal) per satellite.js/Vallado
  const temp6 = esine / (1.0 + betal);
  // Use a/r = 1/(1-ecose) not 1/r per satellite.js
  const aOverR = a / r;  // = 1 / (1 - ecose)
  const cosu = aOverR * (cosepw - axn + ayn * temp6);
  const sinu = aOverR * (sinepw - ayn - axn * temp6);
  const u = Math.atan2(sinu, cosu);
  const sin2u = 2.0 * sinu * cosu;
  const cos2u = 2.0 * cosu * cosu - 1.0;
  const temp7 = 1.0 / pl;
  const temp8 = CK2 * temp7;
  const temp9 = temp8 * temp7;

  // Short period periodics
  const rk = r * (1.0 - 1.5 * temp9 * betal * x3thm1) + 0.5 * temp8 * x1mth2 * cos2u;
  const uk = u - 0.25 * temp9 * x7thm1 * sin2u;
  const xnodek = xnode + 1.5 * temp9 * cosio * sin2u;
  const xinck = inclo + 1.5 * temp9 * cosio * sinio * cos2u;
  const rdotk = rdot - xn * temp8 * x1mth2 * sin2u;
  const rfdotk = rfdot + xn * temp8 * (x1mth2 * cos2u + 1.5 * x3thm1);

  // Orientation vectors
  const sinuk = Math.sin(uk);
  const cosuk = Math.cos(uk);
  const sinik = Math.sin(xinck);
  const cosik = Math.cos(xinck);
  const sinnok = Math.sin(xnodek);
  const cosnok = Math.cos(xnodek);
  const xmx = -sinnok * cosik;
  const xmy = cosnok * cosik;
  const ux = xmx * sinuk + cosnok * cosuk;
  const uy = xmy * sinuk + sinnok * cosuk;
  const uz = sinik * sinuk;
  const vx = xmx * cosuk - cosnok * sinuk;
  const vy = xmy * cosuk - sinnok * sinuk;
  const vz = sinik * cosuk;

  // Position and velocity in km and km/s
  const x = rk * ux * XKMPER;
  const y = rk * uy * XKMPER;
  const z = rk * uz * XKMPER;
  const xdot = (rdotk * ux + rfdotk * vx) * XKMPER / 60.0;
  const ydot = (rdotk * uy + rfdotk * vy) * XKMPER / 60.0;
  const zdot = (rdotk * uz + rfdotk * vz) * XKMPER / 60.0;

  return {
    state: { x, y, z, xdot, ydot, zdot },
    tsince,
    algorithm: 'SGP4',
    error: false
  };
}

