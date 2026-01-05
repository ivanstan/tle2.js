/**
 * Observer Module Tests
 */

import { parseTLE } from '../tle-parser';
import { propagate, observeSatellite, observeTLE } from '../index';
import {
  createObserver,
  observe,
  dateToJD,
  calculateTsince,
  calculateGST,
  eciToGeodetic,
  geodeticToECEF,
  calculateVisibilityFootprint,
  isWithinFootprint,
  distanceToSubSatellite,
  formatFootprint,
  footprintToGeoJSON
} from '../observer';
import { TWOPI } from '../constants';

// Test TLE
const ISS_LINE1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const ISS_LINE2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

describe('Observer Module', () => {
  const elements = parseTLE(ISS_LINE1, ISS_LINE2);

  describe('createObserver', () => {
    it('should create observer with all properties', () => {
      const observer = createObserver(40.7128, -74.0060, 10);
      
      expect(observer.latitude).toBe(40.7128);
      expect(observer.longitude).toBe(-74.0060);
      expect(observer.altitude).toBe(10);
    });

    it('should default altitude to 0', () => {
      const observer = createObserver(0, 0);
      expect(observer.altitude).toBe(0);
    });
  });

  describe('dateToJD', () => {
    it('should convert date to Julian Date', () => {
      const jd = dateToJD(new Date('2000-01-01T12:00:00Z'));
      expect(jd).toBeCloseTo(2451545.0, 3);
    });

    it('should handle different dates', () => {
      const jd = dateToJD(new Date('2024-01-01T00:00:00Z'));
      expect(jd).toBeGreaterThan(2460000);
    });
  });

  describe('calculateGST', () => {
    it('should return value in valid range', () => {
      const jd = dateToJD(new Date());
      const gst = calculateGST(jd);
      
      expect(gst).toBeGreaterThanOrEqual(0);
      expect(gst).toBeLessThan(TWOPI);
    });
  });

  describe('geodeticToECEF', () => {
    it('should convert equator point correctly', () => {
      const observer = createObserver(0, 0, 0);
      const ecef = geodeticToECEF(observer);
      
      expect(ecef.x).toBeCloseTo(6378.135, 0);
      expect(ecef.y).toBeCloseTo(0, 1);
      expect(ecef.z).toBeCloseTo(0, 1);
    });

    it('should convert north pole correctly', () => {
      const observer = createObserver(90, 0, 0);
      const ecef = geodeticToECEF(observer);
      
      expect(ecef.x).toBeCloseTo(0, 1);
      expect(ecef.y).toBeCloseTo(0, 1);
      expect(ecef.z).toBeGreaterThan(6300);
    });
  });

  describe('eciToGeodetic', () => {
    it('should return valid latitude', () => {
      const result = propagate(elements, 0);
      const gmst = calculateGST(elements.jdsatepoch);
      const geo = eciToGeodetic(
        result.state.x, result.state.y, result.state.z, gmst
      );
      
      expect(geo.latitude).toBeGreaterThanOrEqual(-90);
      expect(geo.latitude).toBeLessThanOrEqual(90);
    });

    it('should return valid longitude', () => {
      const result = propagate(elements, 0);
      const gmst = calculateGST(elements.jdsatepoch);
      const geo = eciToGeodetic(
        result.state.x, result.state.y, result.state.z, gmst
      );
      
      expect(geo.longitude).toBeGreaterThanOrEqual(-180);
      expect(geo.longitude).toBeLessThanOrEqual(180);
    });

    it('should return valid altitude for ISS', () => {
      const result = propagate(elements, 0);
      const gmst = calculateGST(elements.jdsatepoch);
      const geo = eciToGeodetic(
        result.state.x, result.state.y, result.state.z, gmst
      );
      
      expect(geo.altitude).toBeGreaterThan(350);
      expect(geo.altitude).toBeLessThan(500);
    });
  });

  describe('observe', () => {
    it('should return complete observation result', () => {
      const observer = createObserver(40.7128, -74.0060, 10);
      const result = propagate(elements, 0);
      const obs = observe(result, observer, elements.jdsatepoch);
      
      expect(obs.lookAngles).toBeDefined();
      expect(obs.geodetic).toBeDefined();
      expect(obs.topocentric).toBeDefined();
      expect(obs.footprint).toBeDefined();
      expect(typeof obs.visible).toBe('boolean');
    });

    it('should return valid azimuth', () => {
      const observer = createObserver(40.7128, -74.0060, 10);
      const result = propagate(elements, 0);
      const obs = observe(result, observer, elements.jdsatepoch);
      
      expect(obs.lookAngles.azimuth).toBeGreaterThanOrEqual(0);
      expect(obs.lookAngles.azimuth).toBeLessThan(360);
    });

    it('should return valid elevation', () => {
      const observer = createObserver(40.7128, -74.0060, 10);
      const result = propagate(elements, 0);
      const obs = observe(result, observer, elements.jdsatepoch);
      
      expect(obs.lookAngles.elevation).toBeGreaterThanOrEqual(-90);
      expect(obs.lookAngles.elevation).toBeLessThanOrEqual(90);
    });

    it('should return positive range', () => {
      const observer = createObserver(40.7128, -74.0060, 10);
      const result = propagate(elements, 0);
      const obs = observe(result, observer, elements.jdsatepoch);
      
      expect(obs.lookAngles.range).toBeGreaterThan(0);
    });

    it('should set visible based on elevation', () => {
      const observer = createObserver(40.7128, -74.0060, 10);
      const result = propagate(elements, 0);
      const obs = observe(result, observer, elements.jdsatepoch);
      
      expect(obs.visible).toBe(obs.lookAngles.elevation > 0);
    });
  });

  describe('observeSatellite', () => {
    it('should work with Date object', () => {
      const observer = createObserver(40.7128, -74.0060, 10);
      const obs = observeSatellite(elements, observer, new Date());
      
      expect(obs.lookAngles).toBeDefined();
    });
  });

  describe('observeTLE', () => {
    it('should parse and observe in one step', () => {
      const observer = createObserver(40.7128, -74.0060, 10);
      const obs = observeTLE(ISS_LINE1, ISS_LINE2, observer, new Date());
      
      expect(obs.lookAngles).toBeDefined();
      expect(obs.geodetic).toBeDefined();
    });
  });

  describe('calculateTsince', () => {
    it('should calculate time difference correctly', () => {
      // One day after epoch
      const epochDate = new Date('2024-01-01T12:00:00Z');
      const jdEpoch = dateToJD(epochDate);
      
      const nextDay = new Date('2024-01-02T12:00:00Z');
      const tsince = calculateTsince(nextDay, jdEpoch);
      
      expect(tsince).toBeCloseTo(1440, 1); // 1440 minutes = 1 day
    });
  });

  describe('Visibility Footprint', () => {
    it('should include footprint in observation', () => {
      const observer = createObserver(0, 0, 0);
      const result = propagate(elements, 0);
      const obs = observe(result, observer, elements.jdsatepoch);
      
      expect(obs.footprint).toBeDefined();
      expect(obs.footprint.radiusKm).toBeGreaterThan(0);
    });

    it('should calculate reasonable footprint radius for ISS', () => {
      const observer = createObserver(0, 0, 0);
      const result = propagate(elements, 0);
      const obs = observe(result, observer, elements.jdsatepoch);
      
      // ISS at ~420 km should have ~2200 km footprint radius
      expect(obs.footprint.radiusKm).toBeGreaterThan(2000);
      expect(obs.footprint.radiusKm).toBeLessThan(3000);
    });

    it('should have 72 boundary points by default', () => {
      const observer = createObserver(0, 0, 0);
      const result = propagate(elements, 0);
      const obs = observe(result, observer, elements.jdsatepoch);
      
      expect(obs.footprint.boundaryPoints.length).toBe(72);
    });

    it('should correctly identify sub-satellite point in footprint', () => {
      const observer = createObserver(0, 0, 0);
      const result = propagate(elements, 0);
      const obs = observe(result, observer, elements.jdsatepoch);
      
      const subSatObserver = createObserver(
        obs.footprint.subSatellitePoint.latitude,
        obs.footprint.subSatellitePoint.longitude,
        0
      );
      
      expect(isWithinFootprint(subSatObserver, obs.footprint)).toBe(true);
    });

    it('should calculate distance to sub-satellite point', () => {
      const observer = createObserver(40.7128, -74.0060, 10);
      const result = propagate(elements, 0);
      const obs = observe(result, observer, elements.jdsatepoch);
      
      const dist = distanceToSubSatellite(observer, obs.footprint);
      expect(dist).toBeGreaterThanOrEqual(0);
    });

    it('should format footprint correctly', () => {
      const observer = createObserver(0, 0, 0);
      const result = propagate(elements, 0);
      const obs = observe(result, observer, elements.jdsatepoch);
      
      const formatted = formatFootprint(obs.footprint);
      expect(formatted).toContain('Visibility Footprint');
      expect(formatted).toContain('radius');
    });

    it('should export footprint as GeoJSON', () => {
      const observer = createObserver(0, 0, 0);
      const result = propagate(elements, 0);
      const obs = observe(result, observer, elements.jdsatepoch);
      
      const geojson = footprintToGeoJSON(obs.footprint) as any;
      expect(geojson.type).toBe('Feature');
      expect(geojson.geometry.type).toBe('Polygon');
      expect(geojson.geometry.coordinates[0].length).toBe(73); // 72 + closing point
    });
  });
});

