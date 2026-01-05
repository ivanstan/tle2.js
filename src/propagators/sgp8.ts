/**
 * SGP8 (Simplified General Perturbations 8) Model
 * Based on SPACETRACK REPORT NO. 3, Section 8
 * 
 * Alternative near-Earth model using different integration approach.
 * Uses same gravitational and atmospheric models as SGP4 but with
 * different differential equation integration method.
 * 
 * NOTE: This is a simplified reference implementation. For production use,
 * consider using a well-validated library like satellite.js.
 */

import {
  CK2, CK4, XKE, XKMPER, TWOPI, TOTHRD, AE, E6A, A3OVK2
} from './constants';
import { OrbitalElements, PropagationResult } from './types';

/** SGP8 initialization state */
export interface Sgp8InitState {
  aodp: number;
  xnodp: number;
  c1: number;
  c4: number;
  c5: number;
  d2: number;
  d3: number;
  d4: number;
  xmdot: number;
  omgdot: number;
  xnodot: number;
  t2cof: number;
  t3cof: number;
  t4cof: number;
  t5cof: number;
  xlcof: number;
  aycof: number;
  x3thm1: number;
  x1mth2: number;
  x7thm1: number;
  cosio: number;
  sinio: number;
  eta: number;
  sinmo: number;
  delmo: number;
  xmcof: number;
  omgcof: number;
  xnodcf: number;
  isimp: number;
}

/**
 * Initialize SGP8 propagator
 * Uses similar structure to SGP4 for stability
 */
export function sgp8init(elements: OrbitalElements): Sgp8InitState {
  const {
    bstar, inclo, nodeo, ecco, argpo, mo, no
  } = elements;

  // Recover original mean motion and semi-major axis (same as SGP4)
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

  // Simplified mode check
  const isimp = (aodp * (1.0 - ecco) / AE) < (220.0 / XKMPER + AE) ? 1 : 0;

  // Atmospheric drag
  const sinio = Math.sin(inclo);
  const x1mth2 = 1.0 - theta2;
  const x7thm1 = 7.0 * theta2 - 1.0;
  const theta4 = theta2 * theta2;
  const pinvsq = 1.0 / (aodp * aodp * betao2 * betao2);

  // Secular rate terms (same as SGP4)
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

  // Drag coefficients (similar to SGP4)
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
  const a3ovk2 = -1.0 * A3OVK2;
  const c3 = coef * tsi * a3ovk2 * xnodp * AE * sinio / ecco;
  const c4 = 2.0 * xnodp * coef1 * aodp * betao2 *
    (eta * (2.0 + 0.5 * etasq) + ecco * (0.5 + 2.0 * etasq) -
      (2.0 * CK2 * tsi / (aodp * psisq)) *
      (-3.0 * x3thm1 * (1.0 - 2.0 * eeta + etasq * (1.5 - 0.5 * eeta)) +
        0.75 * x1mth2 * (2.0 * etasq - eeta * (1.0 + etasq)) * Math.cos(2.0 * argpo)));
  const c5 = 2.0 * coef1 * aodp * betao2 * (1.0 + 2.75 * (etasq + eeta) + eeta * etasq);

  const omgcof = bstar * c3 * Math.cos(argpo);
  const xmcof = ecco > 1.0e-4 ? -TOTHRD * coef * bstar * AE / eeta : 0.0;
  const xnodcf = 3.5 * betao2 * xhdot1 * c1;
  const t2cof = 1.5 * c1;
  const xlcof = 0.125 * a3ovk2 * sinio * (3.0 + 5.0 * cosio) / (1.0 + cosio);
  const aycof = 0.25 * a3ovk2 * sinio;
  const delmo = Math.pow(1.0 + eta * Math.cos(mo), 3);
  const sinmo = Math.sin(mo);

  // Higher order coefficients
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
    aodp,
    xnodp,
    c1,
    c4,
    c5,
    d2,
    d3,
    d4,
    xmdot,
    omgdot,
    xnodot,
    t2cof,
    t3cof,
    t4cof,
    t5cof,
    xlcof,
    aycof,
    x3thm1,
    x1mth2,
    x7thm1,
    cosio,
    sinio,
    eta,
    sinmo,
    delmo,
    xmcof,
    omgcof,
    xnodcf,
    isimp
  };
}

/**
 * SGP8 Propagator
 */
export function sgp8(elements: OrbitalElements, tsince: number, initState?: Sgp8InitState): PropagationResult {
  const state = initState || sgp8init(elements);

  const {
    aodp, xnodp, c1, c4, c5, d2, d3, d4,
    xmdot, omgdot, xnodot, t2cof, t3cof, t4cof, t5cof,
    xlcof, aycof, x3thm1, x1mth2, x7thm1, cosio, sinio,
    eta, sinmo, delmo, xmcof, omgcof, xnodcf, isimp
  } = state;

  const { ecco, argpo, nodeo, mo, bstar } = elements;

  // Update for secular gravity and atmospheric drag (same structure as SGP4)
  const t = tsince;
  const xmdf = mo + xmdot * t;
  const omgadf = argpo + omgdot * t;
  const xnoddf = nodeo + xnodot * t;
  let omega = omgadf;
  let xmp = xmdf;
  const tsq = t * t;
  const xnode = xnoddf + xnodcf * tsq;
  let tempa = 1.0 - c1 * t;
  let tempe = bstar * c4 * t;
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
    tempe = tempe + bstar * c5 * (Math.sin(xmp) - sinmo);
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
      algorithm: 'SGP8',
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
    let tem5 = 1.0 - coseo1 * axn - sineo1 * ayn;
    tem5 = (capu - ayn * coseo1 + axn * sineo1 - eo1) / tem5;
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
      algorithm: 'SGP8',
      error: true,
      errorMessage: 'Semi-latus rectum is negative'
    };
  }

  const r = a * (1.0 - ecose);
  const invr = 1.0 / r;
  const rdot = XKE * Math.sqrt(a) * esine * invr;
  const rfdot = XKE * Math.sqrt(pl) * invr;
  const betal = Math.sqrt(1.0 - elsq);
  const temp6 = betal / (1.0 + betal);
  const cosu = invr * (cosepw - axn + ayn * esine * temp6);
  const sinu = invr * (sinepw - ayn - axn * esine * temp6);
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
  const xinck = Math.acos(cosio) + 1.5 * temp9 * cosio * sinio * cos2u;
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
    algorithm: 'SGP8',
    error: false
  };
}
