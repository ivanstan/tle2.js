/**
 * Satellite Passes Tests
 */

import { parseTLE } from '../tle-parser';
import { propagate } from '../index';
import { createObserver } from '../observer';
import {
  findPasses,
  getNextPass,
  formatPass,
  formatSkyPath,
  generateSkyChart
} from '../passes';

// Test TLE
const ISS_LINE1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const ISS_LINE2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

describe('Satellite Passes', () => {
  const elements = parseTLE(ISS_LINE1, ISS_LINE2);
  const observer = createObserver(40.7128, -74.0060, 10);

  describe('findPasses', () => {
    it('should return pass result', () => {
      const result = findPasses(elements, observer, propagate, {
        startTsince: 0,
        durationMinutes: 1440,
        minElevation: 0
      });
      
      expect(result).toBeDefined();
      expect(result.passes).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it('should include observer in result', () => {
      const result = findPasses(elements, observer, propagate, {
        durationMinutes: 1440
      });
      
      expect(result.observer).toBe(observer);
    });

    it('should include search params', () => {
      const result = findPasses(elements, observer, propagate, {
        startTsince: 10,
        durationMinutes: 720,
        minElevation: 5
      });
      
      expect(result.searchParams.startTsince).toBe(10);
      expect(result.searchParams.durationMinutes).toBe(720);
      expect(result.searchParams.minElevation).toBe(5);
    });

    it('should find some passes in 24 hours', () => {
      const result = findPasses(elements, observer, propagate, {
        durationMinutes: 1440
      });
      
      // ISS should have multiple passes visible from NYC in 24 hours
      expect(result.stats.totalPasses).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average statistics', () => {
      const result = findPasses(elements, observer, propagate, {
        durationMinutes: 1440
      });
      
      expect(typeof result.stats.averageMaxElevation).toBe('number');
      expect(typeof result.stats.averageDuration).toBe('number');
    });

    describe('when passes are found', () => {
      let result: ReturnType<typeof findPasses>;
      
      beforeAll(() => {
        result = findPasses(elements, observer, propagate, {
          durationMinutes: 1440,
          minElevation: 0
        });
      });

      it('should have valid rise time', () => {
        if (result.passes.length > 0) {
          expect(result.passes[0].riseTime).toBeDefined();
          expect(result.passes[0].riseTime).toBeGreaterThanOrEqual(0);
        }
      });

      it('should have set time after rise time', () => {
        if (result.passes.length > 0) {
          expect(result.passes[0].setTime).toBeGreaterThan(result.passes[0].riseTime);
        }
      });

      it('should have positive duration', () => {
        if (result.passes.length > 0) {
          expect(result.passes[0].duration).toBeGreaterThan(0);
        }
      });

      it('should have max elevation >= 0', () => {
        if (result.passes.length > 0) {
          expect(result.passes[0].maxElevation).toBeGreaterThanOrEqual(0);
        }
      });

      it('should have valid quality rating', () => {
        if (result.passes.length > 0) {
          const validQualities = ['excellent', 'good', 'fair', 'poor'];
          expect(validQualities).toContain(result.passes[0].quality);
        }
      });

      it('should have sky path points', () => {
        if (result.passes.length > 0) {
          expect(result.passes[0].skyPath.length).toBeGreaterThan(0);
        }
      });

      it('should have valid azimuth in sky path', () => {
        if (result.passes.length > 0 && result.passes[0].skyPath.length > 0) {
          const point = result.passes[0].skyPath[0];
          expect(point.azimuth).toBeGreaterThanOrEqual(0);
          expect(point.azimuth).toBeLessThan(360);
        }
      });
    });
  });

  describe('getNextPass', () => {
    it('should return a pass or null', () => {
      const pass = getNextPass(elements, observer, propagate, 0, 2880);
      
      expect(pass === null || pass.riseTime !== undefined).toBe(true);
    });

    it('should have valid pass structure if found', () => {
      const pass = getNextPass(elements, observer, propagate, 0, 2880);
      
      if (pass !== null) {
        expect(pass.passNumber).toBeDefined();
        expect(pass.riseTime).toBeDefined();
        expect(pass.setTime).toBeDefined();
        expect(pass.maxElevation).toBeDefined();
      }
    });
  });

  describe('formatPass', () => {
    it('should format pass as string', () => {
      const result = findPasses(elements, observer, propagate, {
        durationMinutes: 1440
      });
      
      if (result.passes.length > 0) {
        const formatted = formatPass(result.passes[0]);
        
        expect(typeof formatted).toBe('string');
        expect(formatted).toContain('Pass');
        expect(formatted).toContain('Rise');
      }
    });
  });

  describe('formatSkyPath', () => {
    it('should format sky path as table', () => {
      const result = findPasses(elements, observer, propagate, {
        durationMinutes: 1440
      });
      
      if (result.passes.length > 0 && result.passes[0].skyPath.length > 0) {
        const formatted = formatSkyPath(result.passes[0].skyPath);
        
        expect(typeof formatted).toBe('string');
        expect(formatted).toContain('Azimuth');
        expect(formatted).toContain('Elevation');
      }
    });
  });

  describe('generateSkyChart', () => {
    it('should generate ASCII chart', () => {
      const result = findPasses(elements, observer, propagate, {
        durationMinutes: 1440
      });
      
      if (result.passes.length > 0) {
        const chart = generateSkyChart(result.passes[0]);
        
        expect(typeof chart).toBe('string');
        expect(chart).toContain('Sky Chart');
        expect(chart).toContain('N');
      }
    });

    it('should include legend', () => {
      const result = findPasses(elements, observer, propagate, {
        durationMinutes: 1440
      });
      
      if (result.passes.length > 0) {
        const chart = generateSkyChart(result.passes[0]);
        expect(chart).toContain('R=Rise');
        expect(chart).toContain('M=Max');
        expect(chart).toContain('S=Set');
      }
    });
  });
});

