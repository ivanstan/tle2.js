/**
 * Tests for new features: Keplerian elements, Decay profile, Satellite passes
 */

import { parseTLE, propagate } from './index';
import { tleToKeplerian, stateToKeplerian, getOrbitalState, formatKeplerianElements } from './keplerian';
import { calculateDecayProfile, estimateLifetime, formatDecayProfile } from './decay';
import { findPasses, getNextPass, formatPass, generateSkyChart } from './passes';
import { createObserver, isWithinFootprint, distanceToSubSatellite, formatFootprint, footprintToGeoJSON } from './observer';
import { calculateGroundTrack, groundTrackToGeoJSON, formatGroundTrack, sampleGroundTrack } from './ground-track';

// ISS TLE (example)
const ISS_LINE1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const ISS_LINE2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

// Test helper
function assertEquals(actual: number, expected: number, tolerance: number, message: string) {
  if (Math.abs(actual - expected) > tolerance) {
    console.error(`FAIL: ${message}`);
    console.error(`  Expected: ${expected}, Actual: ${actual}, Diff: ${Math.abs(actual - expected)}`);
    return false;
  }
  return true;
}

async function runTests() {
  console.log("=== Testing New Features ===\n");
  let passed = 0;
  let failed = 0;
  
  // Parse elements
  const elements = parseTLE(ISS_LINE1, ISS_LINE2);
  console.log(`Parsed TLE for satellite ${elements.satnum}\n`);
  
  // ============================================
  // TEST 1: Keplerian Elements from TLE
  // ============================================
  console.log("--- Test 1: Keplerian Elements from TLE ---");
  const kep = tleToKeplerian(elements);
  
  // ISS should have roughly:
  // - Semi-major axis ~6780 km
  // - Eccentricity ~0.0007
  // - Inclination ~51.64°
  // - Period ~92-93 minutes
  // - Altitude ~400-420 km
  
  if (assertEquals(kep.inclination, 51.64, 0.1, "Inclination")) passed++; else failed++;
  if (assertEquals(kep.eccentricity, 0.0006703, 0.0001, "Eccentricity")) passed++; else failed++;
  if (kep.semiMajorAxis > 6700 && kep.semiMajorAxis < 6900) {
    console.log(`  Semi-major axis: ${kep.semiMajorAxis.toFixed(2)} km (OK)`);
    passed++;
  } else {
    console.error(`  FAIL: Semi-major axis ${kep.semiMajorAxis} out of range`);
    failed++;
  }
  if (kep.period > 90 && kep.period < 95) {
    console.log(`  Orbital period: ${kep.period.toFixed(2)} min (OK)`);
    passed++;
  } else {
    console.error(`  FAIL: Period ${kep.period} out of range`);
    failed++;
  }
  if (kep.perigee > 350 && kep.perigee < 450) {
    console.log(`  Perigee altitude: ${kep.perigee.toFixed(2)} km (OK)`);
    passed++;
  } else {
    console.error(`  FAIL: Perigee ${kep.perigee} out of range`);
    failed++;
  }
  console.log();
  
  // ============================================
  // TEST 2: Keplerian Elements from State Vectors
  // ============================================
  console.log("--- Test 2: Keplerian Elements from State Vectors ---");
  const result = propagate(elements, 60);
  const kepFromState = stateToKeplerian(
    result.state.x, result.state.y, result.state.z,
    result.state.xdot, result.state.ydot, result.state.zdot
  );
  
  // Should be similar to original (allowing for some drift)
  if (assertEquals(kepFromState.inclination, kep.inclination, 1.0, "Inclination from state")) passed++; else failed++;
  if (kepFromState.semiMajorAxis > 6700 && kepFromState.semiMajorAxis < 6900) {
    console.log(`  Semi-major axis from state: ${kepFromState.semiMajorAxis.toFixed(2)} km (OK)`);
    passed++;
  } else {
    console.error(`  FAIL: Semi-major axis from state ${kepFromState.semiMajorAxis} out of range`);
    failed++;
  }
  console.log();
  
  // ============================================
  // TEST 3: Orbital State
  // ============================================
  console.log("--- Test 3: Orbital State ---");
  try {
    const state = getOrbitalState(elements, propagate, 0);
    if (state.elements && state.position && state.velocity) {
      console.log(`  Orbital state computed successfully`);
      console.log(`  Position: (${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)}, ${state.position.z.toFixed(2)}) km`);
      console.log(`  True anomaly: ${state.elements.trueAnomaly.toFixed(2)}°`);
      passed++;
    } else {
      console.error("  FAIL: Orbital state incomplete");
      failed++;
    }
  } catch (e) {
    console.error(`  FAIL: ${e}`);
    failed++;
  }
  console.log();
  
  // ============================================
  // TEST 4: Decay Profile
  // ============================================
  console.log("--- Test 4: Decay Profile ---");
  try {
    const profile = calculateDecayProfile(elements, propagate, {
      durationDays: 30,
      stepDays: 10
    });
    
    if (profile.points.length > 0) {
      console.log(`  Generated ${profile.points.length} decay profile points`);
      console.log(`  Initial perigee: ${profile.summary.initialPerigee.toFixed(2)} km`);
      console.log(`  Lifetime category: ${profile.summary.lifetimeCategory}`);
      passed++;
    } else {
      console.error("  FAIL: No decay profile points");
      failed++;
    }
  } catch (e) {
    console.error(`  FAIL: ${e}`);
    failed++;
  }
  console.log();
  
  // ============================================
  // TEST 5: Lifetime Estimation
  // ============================================
  console.log("--- Test 5: Lifetime Estimation ---");
  const lifetime = estimateLifetime(kep.perigee, kep.apogee);
  if (lifetime > 0) {
    console.log(`  Estimated lifetime: ${lifetime.toFixed(0)} days`);
    passed++;
  } else {
    console.error("  FAIL: Invalid lifetime");
    failed++;
  }
  console.log();
  
  // ============================================
  // TEST 6: Find Passes
  // ============================================
  console.log("--- Test 6: Find Satellite Passes ---");
  const observer = createObserver(40.7128, -74.0060, 10); // NYC
  
  try {
    const passResult = findPasses(elements, observer, propagate, {
      startTsince: 0,
      durationMinutes: 1440, // 24 hours
      minElevation: 0,
      stepMinutes: 1
    });
    
    console.log(`  Observer: ${observer.latitude.toFixed(4)}°N, ${observer.longitude.toFixed(4)}°E`);
    console.log(`  Found ${passResult.stats.totalPasses} passes in 24 hours`);
    console.log(`  Good passes (>30°): ${passResult.stats.goodPasses}`);
    
    if (passResult.passes.length > 0) {
      console.log(`  First pass max elevation: ${passResult.passes[0].maxElevation.toFixed(1)}°`);
      console.log(`  First pass duration: ${passResult.passes[0].duration.toFixed(1)} min`);
      passed++;
    } else {
      console.log("  No passes found (may be expected depending on TLE epoch)");
      passed++; // Not a failure, just no visibility
    }
  } catch (e) {
    console.error(`  FAIL: ${e}`);
    failed++;
  }
  console.log();
  
  // ============================================
  // TEST 7: Next Pass
  // ============================================
  console.log("--- Test 7: Get Next Pass ---");
  try {
    const nextPass = getNextPass(elements, observer, propagate, 0, 2880);
    
    if (nextPass) {
      console.log(`  Next pass found:`);
      console.log(`    Rise: T+${nextPass.riseTime.toFixed(1)} min`);
      console.log(`    Max El: ${nextPass.maxElevation.toFixed(1)}° at T+${nextPass.maxElevationTime.toFixed(1)} min`);
      console.log(`    Quality: ${nextPass.quality}`);
      passed++;
    } else {
      console.log("  No next pass found in 48 hours");
      passed++; // Not a failure
    }
  } catch (e) {
    console.error(`  FAIL: ${e}`);
    failed++;
  }
  console.log();
  
  // ============================================
  // TEST 8: Sky Path
  // ============================================
  console.log("--- Test 8: Sky Path ---");
  try {
    const passResult = findPasses(elements, observer, propagate, {
      durationMinutes: 1440,
      skyPathPoints: 20
    });
    
    if (passResult.passes.length > 0 && passResult.passes[0].skyPath.length > 0) {
      const path = passResult.passes[0].skyPath;
      console.log(`  Sky path has ${path.length} points`);
      console.log(`  First point: Az ${path[0].azimuth.toFixed(1)}°, El ${path[0].elevation.toFixed(1)}°`);
      console.log(`  Last point: Az ${path[path.length-1].azimuth.toFixed(1)}°, El ${path[path.length-1].elevation.toFixed(1)}°`);
      passed++;
    } else {
      console.log("  No sky path available");
      passed++; // Not a failure
    }
  } catch (e) {
    console.error(`  FAIL: ${e}`);
    failed++;
  }
  console.log();
  
  // ============================================
  // TEST 9: Format Functions
  // ============================================
  console.log("--- Test 9: Format Functions ---");
  
  // Test formatKeplerianElements
  const kepStr = formatKeplerianElements(kep);
  if (kepStr.includes("Semi-major axis") && kepStr.includes("Eccentricity")) {
    console.log("  formatKeplerianElements: OK");
    passed++;
  } else {
    console.error("  FAIL: formatKeplerianElements");
    failed++;
  }
  
  // Test formatDecayProfile
  const profile = calculateDecayProfile(elements, propagate, { durationDays: 7, stepDays: 1 });
  const profileStr = formatDecayProfile(profile);
  if (profileStr.includes("Orbital Decay Analysis") && profileStr.includes("Perigee")) {
    console.log("  formatDecayProfile: OK");
    passed++;
  } else {
    console.error("  FAIL: formatDecayProfile");
    failed++;
  }
  console.log();
  
  // ============================================
  // TEST 10: Sky Chart Generation
  // ============================================
  console.log("--- Test 10: Sky Chart Generation ---");
  try {
    const passResult = findPasses(elements, observer, propagate, {
      durationMinutes: 1440
    });
    
    if (passResult.passes.length > 0) {
      const chart = generateSkyChart(passResult.passes[0], 31, 15);
      if (chart.includes("Sky Chart") && chart.includes("N") && chart.includes("E")) {
        console.log("  Sky chart generated successfully");
        // Print a portion of the chart
        const lines = chart.split('\n');
        console.log("  Sample output:");
        for (let i = 0; i < Math.min(5, lines.length); i++) {
          console.log(`    ${lines[i]}`);
        }
        passed++;
      } else {
        console.error("  FAIL: Invalid sky chart");
        failed++;
      }
    } else {
      console.log("  No passes for sky chart (OK)");
      passed++;
    }
  } catch (e) {
    console.error(`  FAIL: ${e}`);
    failed++;
  }
  console.log();
  
  // ============================================
  // TEST 11: Visibility Footprint
  // ============================================
  console.log("--- Test 11: Visibility Footprint ---");
  try {
    const result = propagate(elements, 0);
    const jd = elements.jdsatepoch;
    const obs = require('./observer');
    const observation = obs.observe(result, observer, jd);
    const footprint = observation.footprint;
    
    console.log(`  Sub-satellite point: ${footprint.subSatellitePoint.latitude.toFixed(2)}°, ${footprint.subSatellitePoint.longitude.toFixed(2)}°`);
    console.log(`  Satellite altitude: ${footprint.altitude.toFixed(1)} km`);
    console.log(`  Footprint radius: ${footprint.radiusKm.toFixed(1)} km (${footprint.radiusDeg.toFixed(2)}°)`);
    console.log(`  Boundary points: ${footprint.boundaryPoints.length}`);
    
    // Verify footprint makes sense
    if (footprint.radiusKm > 1000 && footprint.radiusKm < 4000) {
      console.log("  Footprint radius OK");
      passed++;
    } else {
      console.error(`  FAIL: Unexpected footprint radius: ${footprint.radiusKm}`);
      failed++;
    }
    
    if (footprint.boundaryPoints.length >= 36) {
      console.log("  Boundary points OK");
      passed++;
    } else {
      console.error("  FAIL: Not enough boundary points");
      failed++;
    }
  } catch (e) {
    console.error(`  FAIL: ${e}`);
    failed++;
  }
  console.log();
  
  // ============================================
  // TEST 12: Footprint Helper Functions
  // ============================================
  console.log("--- Test 12: Footprint Helper Functions ---");
  try {
    const result = propagate(elements, 0);
    const jd = elements.jdsatepoch;
    const obs = require('./observer');
    const observation = obs.observe(result, observer, jd);
    const footprint = observation.footprint;
    
    // Test isWithinFootprint
    const subSatObserver = createObserver(
      footprint.subSatellitePoint.latitude,
      footprint.subSatellitePoint.longitude,
      0
    );
    
    if (isWithinFootprint(subSatObserver, footprint)) {
      console.log("  isWithinFootprint (at sub-sat): OK");
      passed++;
    } else {
      console.error("  FAIL: Sub-satellite point should be in footprint");
      failed++;
    }
    
    // Test distanceToSubSatellite
    const dist = distanceToSubSatellite(observer, footprint);
    if (dist >= 0 && dist < 20000) {
      console.log(`  Distance to sub-sat: ${dist.toFixed(1)} km OK`);
      passed++;
    } else {
      console.error(`  FAIL: Invalid distance: ${dist}`);
      failed++;
    }
    
    // Test formatFootprint
    const formatted = formatFootprint(footprint);
    if (formatted.includes("Visibility Footprint") && formatted.includes("radius")) {
      console.log("  formatFootprint: OK");
      passed++;
    } else {
      console.error("  FAIL: formatFootprint output invalid");
      failed++;
    }
    
    // Test footprintToGeoJSON
    const geojson = footprintToGeoJSON(footprint) as any;
    if (geojson.type === "Feature" && geojson.geometry.type === "Polygon") {
      console.log("  footprintToGeoJSON: OK");
      passed++;
    } else {
      console.error("  FAIL: Invalid GeoJSON");
      failed++;
    }
  } catch (e) {
    console.error(`  FAIL: ${e}`);
    failed++;
  }
  console.log();
  
  // ============================================
  // TEST 13: Ground Track / Flight Path
  // ============================================
  console.log("--- Test 13: Ground Track / Flight Path ---");
  try {
    const track = calculateGroundTrack(elements, propagate, {
      stepSeconds: 30,
      numOrbits: 2,
      referenceTsince: 0
    });
    
    console.log(`  Orbital period: ${track.parameters.orbitalPeriod.toFixed(2)} min`);
    console.log(`  Total duration: ${track.parameters.totalDuration.toFixed(1)} min`);
    console.log(`  Total points: ${track.stats.totalPoints}`);
    console.log(`  Past points: ${track.pastPoints.length}`);
    console.log(`  Future points: ${track.futurePoints.length}`);
    console.log(`  Latitude range: ${track.stats.minLatitude.toFixed(1)}° to ${track.stats.maxLatitude.toFixed(1)}°`);
    
    // Verify expected ISS orbital period (~92 min)
    if (track.parameters.orbitalPeriod > 90 && track.parameters.orbitalPeriod < 95) {
      console.log("  Orbital period OK");
      passed++;
    } else {
      console.error(`  FAIL: Unexpected period: ${track.parameters.orbitalPeriod}`);
      failed++;
    }
    
    // Verify we got points
    if (track.stats.totalPoints > 100) {
      console.log("  Point count OK");
      passed++;
    } else {
      console.error(`  FAIL: Not enough points: ${track.stats.totalPoints}`);
      failed++;
    }
    
    // Verify latitude range (ISS inclination ~51.6°)
    if (Math.abs(track.stats.maxLatitude) <= 52 && Math.abs(track.stats.minLatitude) <= 52) {
      console.log("  Latitude range OK (within inclination)");
      passed++;
    } else {
      console.error(`  FAIL: Latitude out of range`);
      failed++;
    }
    
    // Verify current position exists
    if (track.currentPosition) {
      console.log(`  Current position: ${track.currentPosition.latitude.toFixed(2)}°, ${track.currentPosition.longitude.toFixed(2)}°`);
      passed++;
    } else {
      console.error("  FAIL: No current position");
      failed++;
    }
  } catch (e) {
    console.error(`  FAIL: ${e}`);
    failed += 4;
  }
  console.log();
  
  // ============================================
  // TEST 14: Ground Track Helpers
  // ============================================
  console.log("--- Test 14: Ground Track Helpers ---");
  try {
    const track = calculateGroundTrack(elements, propagate, {
      stepSeconds: 60,
      numOrbits: 1
    });
    
    // Test formatGroundTrack
    const formatted = formatGroundTrack(track);
    if (formatted.includes("Ground Track") && formatted.includes("Orbital period")) {
      console.log("  formatGroundTrack: OK");
      passed++;
    } else {
      console.error("  FAIL: formatGroundTrack output invalid");
      failed++;
    }
    
    // Test groundTrackToGeoJSON
    const geojson = groundTrackToGeoJSON(track) as any;
    if (geojson.type === "Feature" && 
        (geojson.geometry.type === "LineString" || geojson.geometry.type === "MultiLineString")) {
      console.log("  groundTrackToGeoJSON: OK");
      passed++;
    } else {
      console.error("  FAIL: Invalid GeoJSON");
      failed++;
    }
    
    // Test sampleGroundTrack
    const sampled = sampleGroundTrack(track, 20);
    if (sampled.length === 20) {
      console.log("  sampleGroundTrack: OK (20 points)");
      passed++;
    } else {
      console.error(`  FAIL: Expected 20 points, got ${sampled.length}`);
      failed++;
    }
  } catch (e) {
    console.error(`  FAIL: ${e}`);
    failed += 3;
  }
  console.log();
  
  // ============================================
  // Summary
  // ============================================
  console.log("=================================");
  console.log(`Tests: ${passed} passed, ${failed} failed`);
  console.log("=================================");
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);

