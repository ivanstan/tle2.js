/**
 * SDP4 (Simplified Deep-Space Perturbations 4) Model
 * Based on SPACETRACK REPORT NO. 3, Section 7
 * 
 * Extension of SGP4 for deep-space satellites (period >= 225 min).
 * Includes lunar/solar gravitational perturbations and Earth resonance effects.
 */

import {
  CK2, CK4, XKE, XKMPER, TWOPI, TOTHRD, AE, E6A, A3OVK2
} from './constants';
import { OrbitalElements, PropagationResult } from './types';
import { dsinit, dssec, dsper, DeepSpaceCommon } from './deep-space';

/** SDP4 initialization state */
export interface Sdp4InitState {
  aodp: number;
  xnodp: number;
  xmdot: number;
  omgdot: number;
  xnodot: number;
  xnodcf: number;
  t2cof: number;
  xlcof: number;
  aycof: number;
  x3thm1: number;
  x1mth2: number;
  x7thm1: number;
  cosio: number;
  sinio: number;
  betao: number;
  betao2: number;
  ds: DeepSpaceCommon;
}

/**
 * Initialize SDP4 propagator
 */
export function sdp4init(elements: OrbitalElements): Sdp4InitState {
  const {
    bstar, inclo, nodeo, ecco, argpo, mo, no, jdsatepoch
  } = elements;

  // Recover original mean motion and semi-major axis
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

  // Secular rate terms
  const sinio = Math.sin(inclo);
  const x1mth2 = 1.0 - theta2;
  const x7thm1 = 7.0 * theta2 - 1.0;
  const theta4 = theta2 * theta2;
  const pinvsq = 1.0 / (aodp * aodp * betao2 * betao2);
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

  // For deep-space, simplified drag coefficients
  const a3ovk2 = -1.0 * A3OVK2;
  const xlcof = 0.125 * a3ovk2 * sinio * (3.0 + 5.0 * cosio) / (1.0 + cosio);
  const aycof = 0.25 * a3ovk2 * sinio;
  const xnodcf = 3.5 * betao2 * xhdot1 * (bstar / (1.0 + delo));
  const t2cof = 1.5 * (bstar / (1.0 + delo));

  // Initialize deep-space perturbations
  const ds = dsinit(
    jdsatepoch,
    xnodp,
    ecco,
    inclo,
    nodeo,
    argpo,
    mo
  );

  return {
    aodp,
    xnodp,
    xmdot,
    omgdot,
    xnodot,
    xnodcf,
    t2cof,
    xlcof,
    aycof,
    x3thm1,
    x1mth2,
    x7thm1,
    cosio,
    sinio,
    betao,
    betao2,
    ds
  };
}

/**
 * SDP4 Propagator
 * 
 * @param elements - Orbital elements from TLE
 * @param tsince - Time since epoch in minutes
 * @param initState - Optional pre-computed initialization state
 * @returns Propagation result with position and velocity
 */
export function sdp4(elements: OrbitalElements, tsince: number, initState?: Sdp4InitState): PropagationResult {
  const state = initState || sdp4init(elements);

  const {
    aodp, xnodp, xmdot, omgdot, xnodot, xnodcf, t2cof,
    xlcof, aycof, x3thm1, x1mth2, x7thm1, cosio, sinio, betao, betao2, ds
  } = state;

  const { ecco, argpo, nodeo, mo } = elements;

  // Update for secular gravity effects
  const t = tsince;
  const xmdf = mo + xmdot * t;
  const omgadf = argpo + omgdot * t;
  const xnoddf = nodeo + xnodot * t;
  const tsq = t * t;
  const xnode = xnoddf + xnodcf * tsq;
  const tempa = 1.0 - t2cof * t;
  const templ = t2cof * tsq;

  // Apply deep-space secular effects
  const secular = dssec(ds, t, ecco, state.aodp > 0 ? Math.acos(cosio) : 0, xnode, omgadf, xmdf);
  
  let em = secular.e;
  let xinc = secular.xinc;
  let omega = secular.omgadf;
  let xn = secular.xnode;
  let xmam = secular.xmam;

  // Apply deep-space periodics
  const periodic = dsper(ds, t, em, xinc, omega, xn, xmam);
  em = periodic.em;
  xinc = periodic.xinc;
  omega = periodic.omgadf;
  xn = periodic.xnode;
  xmam = periodic.xmam;

  // Check for decay
  if (em >= 1.0 || em < -0.001) {
    return {
      state: { x: 0, y: 0, z: 0, xdot: 0, ydot: 0, zdot: 0 },
      tsince,
      algorithm: 'SDP4',
      error: true,
      errorMessage: 'Satellite has decayed'
    };
  }

  // Clamp eccentricity
  em = Math.max(em, 1e-6);

  // Update semi-major axis
  const a = aodp * tempa * tempa;
  const beta = Math.sqrt(1.0 - em * em);
  const xnn = XKE / Math.pow(a, 1.5);
  const xl = xmam + omega + xn + xnodp * templ;

  // Long period periodics
  const sinInc = Math.sin(xinc);
  const cosInc = Math.cos(xinc);
  const axn = em * Math.cos(omega);
  const temp = 1.0 / (a * beta * beta);
  const xlpNew = temp * xlcof * axn;
  const aynl = temp * aycof;
  const xlt = xl + xlpNew;
  const ayn = em * Math.sin(omega) + aynl;

  // Solve Kepler's equation (Newton-Raphson iteration)
  const capu = (xlt - xn) % TWOPI;
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
      algorithm: 'SDP4',
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
  const xnodek = xn + 1.5 * temp9 * cosInc * sin2u;
  const xinck = xinc + 1.5 * temp9 * cosInc * sinInc * cos2u;
  const rdotk = rdot - xnn * temp8 * x1mth2 * sin2u;
  const rfdotk = rfdot + xnn * temp8 * (x1mth2 * cos2u + 1.5 * x3thm1);

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
    algorithm: 'SDP4',
    error: false
  };
}

