/**
 * Decay Profile Tests
 */

import { parseTLE } from '../tle-parser';
import { propagate } from '../index';
import { tleToKeplerian } from '../keplerian';
import {
  calculateDecayProfile,
  estimateLifetime,
  formatDecayProfile
} from '../decay';

// Test TLE
const ISS_LINE1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const ISS_LINE2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

describe('Decay Profile', () => {
  const elements = parseTLE(ISS_LINE1, ISS_LINE2);

  describe('calculateDecayProfile', () => {
    it('should generate decay profile points', () => {
      const profile = calculateDecayProfile(elements, propagate, {
        durationDays: 30,
        stepDays: 10
      });
      
      expect(profile.points.length).toBeGreaterThan(0);
    });

    it('should include initial elements', () => {
      const profile = calculateDecayProfile(elements, propagate, {
        durationDays: 7,
        stepDays: 1
      });
      
      expect(profile.initialElements).toBeDefined();
      expect(profile.initialElements.semiMajorAxis).toBeGreaterThan(6000);
    });

    it('should include final elements', () => {
      const profile = calculateDecayProfile(elements, propagate, {
        durationDays: 7,
        stepDays: 1
      });
      
      expect(profile.finalElements).toBeDefined();
    });

    it('should include summary', () => {
      const profile = calculateDecayProfile(elements, propagate, {
        durationDays: 30,
        stepDays: 10
      });
      
      expect(profile.summary).toBeDefined();
      expect(profile.summary.initialPerigee).toBeGreaterThan(0);
      expect(profile.summary.lifetimeCategory).toBeDefined();
    });

    it('should have valid lifetime category', () => {
      const profile = calculateDecayProfile(elements, propagate, {
        durationDays: 30,
        stepDays: 10
      });
      
      const validCategories = ['days', 'weeks', 'months', 'years', 'decades', 'stable'];
      expect(validCategories).toContain(profile.summary.lifetimeCategory);
    });

    it('should track satellite number', () => {
      const profile = calculateDecayProfile(elements, propagate, {
        durationDays: 7,
        stepDays: 1
      });
      
      expect(profile.satnum).toBe(25544);
    });

    it('should have sequential day points', () => {
      const profile = calculateDecayProfile(elements, propagate, {
        durationDays: 10,
        stepDays: 2
      });
      
      for (let i = 1; i < profile.points.length; i++) {
        expect(profile.points[i].days).toBeGreaterThan(profile.points[i-1].days);
      }
    });

    it('should include perigee and apogee in points', () => {
      const profile = calculateDecayProfile(elements, propagate, {
        durationDays: 7,
        stepDays: 1
      });
      
      for (const point of profile.points) {
        expect(point.perigee).toBeDefined();
        expect(point.apogee).toBeDefined();
        expect(point.perigee).toBeLessThan(point.apogee);
      }
    });
  });

  describe('estimateLifetime', () => {
    it('should return positive lifetime', () => {
      const kep = tleToKeplerian(elements);
      const lifetime = estimateLifetime(kep.perigee, kep.apogee);
      
      expect(lifetime).toBeGreaterThan(0);
    });

    it('should return longer lifetime for higher orbits', () => {
      const lowOrbit = estimateLifetime(200, 250);
      const highOrbit = estimateLifetime(800, 850);
      
      expect(highOrbit).toBeGreaterThan(lowOrbit);
    });

    it('should return very long lifetime for high altitude', () => {
      const lifetime = estimateLifetime(1500, 1600);
      expect(lifetime).toBeGreaterThan(10000);
    });

    it('should return short lifetime for very low orbit', () => {
      const lifetime = estimateLifetime(120, 150);
      expect(lifetime).toBeLessThan(50);
    });
  });

  describe('formatDecayProfile', () => {
    it('should format profile as string', () => {
      const profile = calculateDecayProfile(elements, propagate, {
        durationDays: 7,
        stepDays: 1
      });
      
      const formatted = formatDecayProfile(profile);
      
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should include key information', () => {
      const profile = calculateDecayProfile(elements, propagate, {
        durationDays: 7,
        stepDays: 1
      });
      
      const formatted = formatDecayProfile(profile);
      
      expect(formatted).toContain('Orbital Decay');
      expect(formatted).toContain('Perigee');
      expect(formatted).toContain('Apogee');
    });
  });
});

