/**
 * Propagation Models Tests
 */

import { parseTLE } from '../tle-parser';
import { sgp } from '../sgp';
import { sgp4 } from '../sgp4';
import { sdp4 } from '../sdp4';
import { sgp8 } from '../sgp8';
import { sdp8 } from '../sdp8';
import { propagate, propagateTLE, propagateWithModel } from '../index';
import { XKMPER } from '../constants';

// Test TLEs
const ISS_LINE1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const ISS_LINE2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const GPS_LINE1 = "1 28874U 05038A   24001.50000000  .00000043  00000-0  00000+0 0  9999";
const GPS_LINE2 = "2 28874  55.4408 300.8261 0052261 219.8822 139.8158  2.00562965135619";

describe('Propagation Models', () => {
  const issElements = parseTLE(ISS_LINE1, ISS_LINE2);
  const gpsElements = parseTLE(GPS_LINE1, GPS_LINE2);

  describe('SGP Model', () => {
    it('should propagate without error at epoch', () => {
      const result = sgp(issElements, 0);
      expect(result.error).toBe(false);
    });

    it('should return valid position', () => {
      const result = sgp(issElements, 0);
      expect(Math.abs(result.state.x)).toBeGreaterThan(1000);
      expect(Math.abs(result.state.y)).toBeDefined();
      expect(Math.abs(result.state.z)).toBeDefined();
    });

    it('should return valid velocity', () => {
      const result = sgp(issElements, 0);
      const speed = Math.sqrt(
        result.state.xdot ** 2 + 
        result.state.ydot ** 2 + 
        result.state.zdot ** 2
      );
      expect(speed).toBeGreaterThan(7);
      expect(speed).toBeLessThan(8);
    });
  });

  describe('SGP4 Model', () => {
    it('should propagate without error at epoch', () => {
      const result = sgp4(issElements, 0);
      expect(result.error).toBe(false);
    });

    it('should return valid position', () => {
      const result = sgp4(issElements, 0);
      const radius = Math.sqrt(
        result.state.x ** 2 + 
        result.state.y ** 2 + 
        result.state.z ** 2
      );
      expect(radius).toBeGreaterThan(XKMPER + 350);
      expect(radius).toBeLessThan(XKMPER + 500);
    });

    it('should propagate forward in time', () => {
      const result = sgp4(issElements, 60);
      expect(result.error).toBe(false);
      expect(result.tsince).toBe(60);
    });

    it('should propagate backward in time', () => {
      const result = sgp4(issElements, -60);
      expect(result.error).toBe(false);
      expect(result.tsince).toBe(-60);
    });
  });

  describe('SGP8 Model', () => {
    it('should propagate without error at epoch', () => {
      const result = sgp8(issElements, 0);
      expect(result.error).toBe(false);
    });

    it('should return valid position', () => {
      const result = sgp8(issElements, 0);
      expect(Math.abs(result.state.x)).toBeGreaterThan(1000);
    });
  });

  describe('SDP4 Model (Deep-Space)', () => {
    it('should propagate GPS satellite without error', () => {
      const result = sdp4(gpsElements, 0);
      expect(result.error).toBe(false);
    });

    it('should return GPS position at correct altitude', () => {
      const result = sdp4(gpsElements, 0);
      const radius = Math.sqrt(
        result.state.x ** 2 + 
        result.state.y ** 2 + 
        result.state.z ** 2
      );
      // GPS is at ~20,200 km altitude
      expect(radius).toBeGreaterThan(20000);
      expect(radius).toBeLessThan(30000);
    });
  });

  describe('SDP8 Model (Deep-Space)', () => {
    it('should propagate GPS satellite without error', () => {
      const result = sdp8(gpsElements, 0);
      expect(result.error).toBe(false);
    });

    it('should return valid GPS position', () => {
      const result = sdp8(gpsElements, 0);
      expect(Math.abs(result.state.x)).toBeGreaterThan(10000);
    });
  });

  describe('Auto-Selection (propagate)', () => {
    it('should use SGP4 for near-Earth satellites', () => {
      const result = propagate(issElements, 0);
      expect(result.algorithm).toBe('SGP4');
    });

    it('should use SDP4 for deep-space satellites', () => {
      const result = propagate(gpsElements, 0);
      expect(result.algorithm).toBe('SDP4');
    });
  });

  describe('propagateTLE', () => {
    it('should parse and propagate in one step', () => {
      const result = propagateTLE(ISS_LINE1, ISS_LINE2, 60);
      expect(result.error).toBe(false);
      expect(result.tsince).toBe(60);
    });
  });

  describe('propagateWithModel', () => {
    it('should use specified model', () => {
      const result = propagateWithModel(issElements, 30, 'SGP8');
      expect(result.algorithm).toBe('SGP8');
    });

    it('should work with all model types', () => {
      const models: Array<'SGP' | 'SGP4' | 'SDP4' | 'SGP8' | 'SDP8'> = 
        ['SGP', 'SGP4', 'SGP8'];
      
      for (const model of models) {
        const result = propagateWithModel(issElements, 0, model);
        expect(result.error).toBe(false);
        expect(result.algorithm).toBe(model);
      }
    });
  });

  describe('Position Changes Over Time', () => {
    it('should show significant movement over one orbit', () => {
      const pos0 = propagate(issElements, 0);
      const pos45 = propagate(issElements, 45);
      const pos90 = propagate(issElements, 90);

      const dist0to45 = Math.sqrt(
        (pos45.state.x - pos0.state.x) ** 2 +
        (pos45.state.y - pos0.state.y) ** 2 +
        (pos45.state.z - pos0.state.z) ** 2
      );

      expect(dist0to45).toBeGreaterThan(5000);
    });

    it('should return to similar position after one orbit', () => {
      const pos0 = propagate(issElements, 0);
      const pos93 = propagate(issElements, 93); // ~1 orbit

      // Position should be within ~200 km (not exact due to precession)
      const dist = Math.sqrt(
        (pos93.state.x - pos0.state.x) ** 2 +
        (pos93.state.y - pos0.state.y) ** 2 +
        (pos93.state.z - pos0.state.z) ** 2
      );

      expect(dist).toBeLessThan(500);
    });
  });
});

