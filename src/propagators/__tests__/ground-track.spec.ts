/**
 * Ground Track Tests
 */

import { parseTLE } from '../tle-parser';
import { propagate } from '../index';
import {
  calculateGroundTrack,
  groundTrackToGeoJSON,
  getTrackCoordinates,
  formatGroundTrack,
  sampleGroundTrack
} from '../ground-track';

// Test TLE
const ISS_LINE1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const ISS_LINE2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

describe('Ground Track', () => {
  const elements = parseTLE(ISS_LINE1, ISS_LINE2);

  describe('calculateGroundTrack', () => {
    it('should return ground track object', () => {
      const track = calculateGroundTrack(elements, propagate, {
        stepSeconds: 60,
        numOrbits: 1
      });
      
      expect(track).toBeDefined();
      expect(track.points).toBeDefined();
    });

    it('should include satellite number', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1
      });
      
      expect(track.satnum).toBe(25544);
    });

    it('should generate multiple points', () => {
      const track = calculateGroundTrack(elements, propagate, {
        stepSeconds: 30,
        numOrbits: 2
      });
      
      expect(track.points.length).toBeGreaterThan(100);
    });

    it('should split into past and future points', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 2,
        referenceTsince: 0
      });
      
      expect(track.pastPoints.length).toBeGreaterThan(0);
      expect(track.futurePoints.length).toBeGreaterThan(0);
    });

    it('should have approximately equal past and future points', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 2,
        referenceTsince: 0
      });
      
      const diff = Math.abs(track.pastPoints.length - track.futurePoints.length);
      expect(diff).toBeLessThan(5);
    });

    it('should include current position', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1
      });
      
      expect(track.currentPosition).not.toBeNull();
    });

    it('should calculate orbital period correctly', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1
      });
      
      expect(track.parameters.orbitalPeriod).toBeGreaterThan(90);
      expect(track.parameters.orbitalPeriod).toBeLessThan(95);
    });

    it('should have correct total duration', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 2
      });
      
      const expected = 2 * track.parameters.orbitalPeriod;
      expect(track.parameters.totalDuration).toBeCloseTo(expected, 0);
    });

    it('should respect step seconds parameter', () => {
      const track = calculateGroundTrack(elements, propagate, {
        stepSeconds: 60,
        numOrbits: 1
      });
      
      expect(track.parameters.stepSeconds).toBe(60);
    });

    it('should respect reference time parameter', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1,
        referenceTsince: 100
      });
      
      expect(track.referenceTsince).toBe(100);
    });

    it('should have latitude within inclination bounds', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 2
      });
      
      // ISS inclination is ~51.64°
      expect(track.stats.maxLatitude).toBeLessThanOrEqual(52);
      expect(track.stats.minLatitude).toBeGreaterThanOrEqual(-52);
    });

    it('should have valid altitude range', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1
      });
      
      expect(track.stats.minAltitude).toBeGreaterThan(350);
      expect(track.stats.maxAltitude).toBeLessThan(500);
    });

    describe('track points', () => {
      let track: ReturnType<typeof calculateGroundTrack>;
      
      beforeAll(() => {
        track = calculateGroundTrack(elements, propagate, {
          stepSeconds: 60,
          numOrbits: 1
        });
      });

      it('should have valid latitude', () => {
        for (const point of track.points.slice(0, 10)) {
          expect(point.latitude).toBeGreaterThanOrEqual(-90);
          expect(point.latitude).toBeLessThanOrEqual(90);
        }
      });

      it('should have valid longitude', () => {
        for (const point of track.points.slice(0, 10)) {
          expect(point.longitude).toBeGreaterThanOrEqual(-180);
          expect(point.longitude).toBeLessThanOrEqual(180);
        }
      });

      it('should have valid altitude', () => {
        for (const point of track.points.slice(0, 10)) {
          expect(point.altitude).toBeGreaterThan(0);
        }
      });

      it('should have position vectors', () => {
        const point = track.points[0];
        expect(point.position.x).toBeDefined();
        expect(point.position.y).toBeDefined();
        expect(point.position.z).toBeDefined();
      });

      it('should have velocity vectors', () => {
        const point = track.points[0];
        expect(point.velocity.x).toBeDefined();
        expect(point.velocity.y).toBeDefined();
        expect(point.velocity.z).toBeDefined();
      });

      it('should have valid speed', () => {
        for (const point of track.points.slice(0, 10)) {
          expect(point.speed).toBeGreaterThan(7);
          expect(point.speed).toBeLessThan(8);
        }
      });

      it('should have isPast flag', () => {
        expect(track.pastPoints.every(p => p.isPast === true)).toBe(true);
        expect(track.futurePoints.every(p => p.isPast === false)).toBe(true);
      });
    });
  });

  describe('groundTrackToGeoJSON', () => {
    it('should return GeoJSON Feature', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1
      });
      
      const geojson = groundTrackToGeoJSON(track) as any;
      
      expect(geojson.type).toBe('Feature');
    });

    it('should have LineString or MultiLineString geometry', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1
      });
      
      const geojson = groundTrackToGeoJSON(track) as any;
      
      expect(['LineString', 'MultiLineString']).toContain(geojson.geometry.type);
    });

    it('should include satellite number in properties', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1
      });
      
      const geojson = groundTrackToGeoJSON(track) as any;
      
      expect(geojson.properties.satnum).toBe(25544);
    });

    it('should split at date line when requested', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 3 // More orbits to likely cross date line
      });
      
      const geojson = groundTrackToGeoJSON(track, true) as any;
      
      expect(geojson.type).toBe('Feature');
    });
  });

  describe('getTrackCoordinates', () => {
    it('should return coordinate array', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1
      });
      
      const coords = getTrackCoordinates(track);
      
      expect(Array.isArray(coords)).toBe(true);
      expect(coords.length).toBe(track.points.length);
    });

    it('should have lat, lon, alt, time properties', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1
      });
      
      const coords = getTrackCoordinates(track);
      const coord = coords[0];
      
      expect(coord.lat).toBeDefined();
      expect(coord.lon).toBeDefined();
      expect(coord.alt).toBeDefined();
      expect(coord.time).toBeDefined();
    });
  });

  describe('formatGroundTrack', () => {
    it('should format as string', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1
      });
      
      const formatted = formatGroundTrack(track);
      
      expect(typeof formatted).toBe('string');
    });

    it('should include key information', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1
      });
      
      const formatted = formatGroundTrack(track);
      
      expect(formatted).toContain('Ground Track');
      expect(formatted).toContain('Orbital period');
      expect(formatted).toContain('Total points');
    });
  });

  describe('sampleGroundTrack', () => {
    it('should reduce number of points', () => {
      const track = calculateGroundTrack(elements, propagate, {
        stepSeconds: 5,
        numOrbits: 1
      });
      
      const sampled = sampleGroundTrack(track, 50);
      
      expect(sampled.length).toBe(50);
    });

    it('should preserve data structure', () => {
      const track = calculateGroundTrack(elements, propagate, {
        numOrbits: 1
      });
      
      const sampled = sampleGroundTrack(track, 20);
      
      expect(sampled[0].latitude).toBeDefined();
      expect(sampled[0].longitude).toBeDefined();
    });

    it('should return all points if fewer than requested', () => {
      const track = calculateGroundTrack(elements, propagate, {
        stepSeconds: 60,
        numOrbits: 0.1
      });
      
      const sampled = sampleGroundTrack(track, 1000);
      
      expect(sampled.length).toBe(track.points.length);
    });
  });
});

