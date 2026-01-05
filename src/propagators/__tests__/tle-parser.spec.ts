/**
 * TLE Parser Tests
 */

import { parseTLE, getOrbitalPeriod, getSemiMajorAxis } from '../tle-parser';
import { getSatelliteType } from '../index';

// Test TLEs
const ISS_LINE1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const ISS_LINE2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const GPS_LINE1 = "1 28874U 05038A   24001.50000000  .00000043  00000-0  00000+0 0  9999";
const GPS_LINE2 = "2 28874  55.4408 300.8261 0052261 219.8822 139.8158  2.00562965135619";

describe('TLE Parser', () => {
  describe('parseTLE', () => {
    it('should parse ISS TLE correctly', () => {
      const elements = parseTLE(ISS_LINE1, ISS_LINE2);
      
      expect(elements.satnum).toBe(25544);
      expect(elements.ecco).toBeCloseTo(0.0006703, 6);
      expect(elements.inclo).toBeCloseTo(51.64 * Math.PI / 180, 4);
    });

    it('should parse GPS TLE correctly', () => {
      const elements = parseTLE(GPS_LINE1, GPS_LINE2);
      
      expect(elements.satnum).toBe(28874);
      expect(elements.ecco).toBeCloseTo(0.0052261, 6);
      expect(elements.inclo).toBeCloseTo(55.4408 * Math.PI / 180, 4);
    });

    it('should parse BSTAR drag term', () => {
      const elements = parseTLE(ISS_LINE1, ISS_LINE2);
      expect(elements.bstar).toBeGreaterThan(0);
    });

    it('should parse epoch correctly', () => {
      const elements = parseTLE(ISS_LINE1, ISS_LINE2);
      expect(elements.jdsatepoch).toBeGreaterThan(2460000);
    });
  });

  describe('getOrbitalPeriod', () => {
    it('should calculate ISS period ~92 minutes', () => {
      const elements = parseTLE(ISS_LINE1, ISS_LINE2);
      const period = getOrbitalPeriod(elements.no);
      
      expect(period).toBeGreaterThan(90);
      expect(period).toBeLessThan(95);
    });

    it('should calculate GPS period ~720 minutes', () => {
      const elements = parseTLE(GPS_LINE1, GPS_LINE2);
      const period = getOrbitalPeriod(elements.no);
      
      expect(period).toBeGreaterThan(700);
      expect(period).toBeLessThan(740);
    });
  });

  describe('getSemiMajorAxis', () => {
    it('should calculate ISS semi-major axis ~1.06 Earth radii', () => {
      const elements = parseTLE(ISS_LINE1, ISS_LINE2);
      const sma = getSemiMajorAxis(elements.no);
      
      expect(sma).toBeGreaterThan(1.05);
      expect(sma).toBeLessThan(1.08);
    });
  });

  describe('getSatelliteType', () => {
    it('should identify ISS as near-Earth', () => {
      const elements = parseTLE(ISS_LINE1, ISS_LINE2);
      expect(getSatelliteType(elements.no)).toBe('near-earth');
    });

    it('should identify GPS as deep-space', () => {
      const elements = parseTLE(GPS_LINE1, GPS_LINE2);
      expect(getSatelliteType(elements.no)).toBe('deep-space');
    });
  });
});

