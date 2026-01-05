/**
 * Keplerian Elements Tests
 */

import { parseTLE } from '../tle-parser';
import { propagate } from '../index';
import {
  tleToKeplerian,
  stateToKeplerian,
  getOrbitalState,
  formatKeplerianElements
} from '../keplerian';

// Test TLE
const ISS_LINE1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const ISS_LINE2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

describe('Keplerian Elements', () => {
  const elements = parseTLE(ISS_LINE1, ISS_LINE2);

  describe('tleToKeplerian', () => {
    it('should calculate semi-major axis correctly', () => {
      const kep = tleToKeplerian(elements);
      
      // ISS should be around 6780 km
      expect(kep.semiMajorAxis).toBeGreaterThan(6700);
      expect(kep.semiMajorAxis).toBeLessThan(6900);
    });

    it('should match TLE eccentricity', () => {
      const kep = tleToKeplerian(elements);
      expect(kep.eccentricity).toBeCloseTo(0.0006703, 6);
    });

    it('should match TLE inclination', () => {
      const kep = tleToKeplerian(elements);
      expect(kep.inclination).toBeCloseTo(51.64, 2);
    });

    it('should calculate orbital period ~92 minutes', () => {
      const kep = tleToKeplerian(elements);
      expect(kep.period).toBeGreaterThan(90);
      expect(kep.period).toBeLessThan(95);
    });

    it('should calculate mean motion > 15 rev/day', () => {
      const kep = tleToKeplerian(elements);
      expect(kep.meanMotion).toBeGreaterThan(15);
    });

    it('should calculate perigee altitude ~400 km', () => {
      const kep = tleToKeplerian(elements);
      expect(kep.perigee).toBeGreaterThan(350);
      expect(kep.perigee).toBeLessThan(450);
    });

    it('should calculate apogee altitude ~420 km', () => {
      const kep = tleToKeplerian(elements);
      expect(kep.apogee).toBeGreaterThan(400);
      expect(kep.apogee).toBeLessThan(450);
    });

    it('should have negative orbital energy (bound orbit)', () => {
      const kep = tleToKeplerian(elements);
      expect(kep.energy).toBeLessThan(0);
    });

    it('should have positive angular momentum', () => {
      const kep = tleToKeplerian(elements);
      expect(kep.angularMomentum).toBeGreaterThan(0);
    });

    it('should have all anomalies in valid range', () => {
      const kep = tleToKeplerian(elements);
      
      expect(kep.trueAnomaly).toBeGreaterThanOrEqual(0);
      expect(kep.trueAnomaly).toBeLessThan(360);
      
      expect(kep.meanAnomaly).toBeGreaterThanOrEqual(0);
      expect(kep.meanAnomaly).toBeLessThan(360);
      
      expect(kep.eccentricAnomaly).toBeGreaterThanOrEqual(0);
      expect(kep.eccentricAnomaly).toBeLessThan(360);
    });
  });

  describe('stateToKeplerian', () => {
    it('should calculate elements from state vectors', () => {
      const result = propagate(elements, 0);
      const kep = stateToKeplerian(
        result.state.x, result.state.y, result.state.z,
        result.state.xdot, result.state.ydot, result.state.zdot
      );
      
      expect(kep.semiMajorAxis).toBeGreaterThan(6700);
      expect(kep.semiMajorAxis).toBeLessThan(6900);
    });

    it('should produce similar inclination to TLE', () => {
      const result = propagate(elements, 0);
      const kep = stateToKeplerian(
        result.state.x, result.state.y, result.state.z,
        result.state.xdot, result.state.ydot, result.state.zdot
      );
      
      expect(kep.inclination).toBeCloseTo(51.64, 0);
    });

    it('should have valid eccentricity', () => {
      const result = propagate(elements, 0);
      const kep = stateToKeplerian(
        result.state.x, result.state.y, result.state.z,
        result.state.xdot, result.state.ydot, result.state.zdot
      );
      
      expect(kep.eccentricity).toBeGreaterThanOrEqual(0);
      expect(kep.eccentricity).toBeLessThan(1);
    });
  });

  describe('getOrbitalState', () => {
    it('should return complete orbital state', () => {
      const state = getOrbitalState(elements, propagate, 0);
      
      expect(state.elements).toBeDefined();
      expect(state.position).toBeDefined();
      expect(state.velocity).toBeDefined();
      expect(state.tsince).toBe(0);
    });

    it('should have valid position components', () => {
      const state = getOrbitalState(elements, propagate, 30);
      
      expect(state.position.x).toBeDefined();
      expect(state.position.y).toBeDefined();
      expect(state.position.z).toBeDefined();
    });

    it('should track true anomaly changes over time', () => {
      const state0 = getOrbitalState(elements, propagate, 0);
      const state30 = getOrbitalState(elements, propagate, 30);
      
      // True anomaly should change significantly in 30 minutes
      const diff = Math.abs(state30.elements.trueAnomaly - state0.elements.trueAnomaly);
      expect(diff).toBeGreaterThan(10);
    });
  });

  describe('formatKeplerianElements', () => {
    it('should format all elements', () => {
      const kep = tleToKeplerian(elements);
      const formatted = formatKeplerianElements(kep);
      
      expect(formatted).toContain('Semi-major axis');
      expect(formatted).toContain('Eccentricity');
      expect(formatted).toContain('Inclination');
      expect(formatted).toContain('RAAN');
      expect(formatted).toContain('Arg of Perigee');
      expect(formatted).toContain('Period');
      expect(formatted).toContain('Apogee');
      expect(formatted).toContain('Perigee');
    });
  });
});

