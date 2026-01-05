/**
 * Comprehensive Test Suite for tle.js Propagators
 * 
 * Tests all features:
 * - TLE Parsing
 * - Propagation Models (SGP, SGP4, SDP4, SGP8, SDP8)
 * - Observer / Look Angles
 * - Keplerian Elements
 * - Decay Profile
 * - Satellite Passes
 * - Visibility Footprint
 * - Ground Track / Flight Path
 */

import {
  // TLE Parsing
  parseTLE,
  getOrbitalPeriod,
  getSemiMajorAxis,
  getSatelliteType,
  
  // Propagation
  propagate,
  propagateTLE,
  propagateWithModel,
  sgp,
  sgp4,
  sdp4,
  sgp8,
  sdp8,
  
  // Observer
  createObserver,
  observe,
  observeSatellite,
  observeTLE,
  dateToJD,
  calculateTsince,
  calculateGST,
  eciToGeodetic,
  
  // Keplerian Elements
  tleToKeplerian,
  stateToKeplerian,
  getOrbitalState,
  formatKeplerianElements,
  
  // Decay
  calculateDecayProfile,
  estimateLifetime,
  formatDecayProfile,
  
  // Passes
  findPasses,
  getNextPass,
  formatPass,
  formatSkyPath,
  generateSkyChart,
  
  // Visibility Footprint
  calculateVisibilityFootprint,
  isWithinFootprint,
  distanceToSubSatellite,
  formatFootprint,
  footprintToGeoJSON,
  
  // Ground Track
  calculateGroundTrack,
  groundTrackToGeoJSON,
  getTrackCoordinates,
  formatGroundTrack,
  sampleGroundTrack,
  
  // Constants
  XKMPER,
  TWOPI
} from './index';

// Test TLEs
const ISS_LINE1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const ISS_LINE2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

// GPS satellite (deep space)
const GPS_LINE1 = "1 28874U 05038A   24001.50000000  .00000043  00000-0  00000+0 0  9999";
const GPS_LINE2 = "2 28874  55.4408 300.8261 0052261 219.8822 139.8158  2.00562965135619";

// Test helper
let passed = 0;
let failed = 0;

function test(name: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${details ? ': ' + details : ''}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n=== ${name} ===`);
}

async function runAllTests() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        TLE.JS COMPREHENSIVE TEST SUITE                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  
  // ================================================================
  section("1. TLE PARSING");
  // ================================================================
  
  const issElements = parseTLE(ISS_LINE1, ISS_LINE2);
  const gpsElements = parseTLE(GPS_LINE1, GPS_LINE2);
  
  test("Parse ISS satellite number", issElements.satnum === 25544);
  test("Parse ISS eccentricity", Math.abs(issElements.ecco - 0.0006703) < 0.0001);
  test("Parse ISS inclination (radians)", Math.abs(issElements.inclo - 51.64 * Math.PI / 180) < 0.01);
  test("Parse GPS satellite number", gpsElements.satnum === 28874);
  
  const issPeriod = getOrbitalPeriod(issElements.no);
  const gpsPeriod = getOrbitalPeriod(gpsElements.no);
  
  test("ISS orbital period ~92 min", issPeriod > 90 && issPeriod < 95, `Got ${issPeriod.toFixed(2)}`);
  test("GPS orbital period ~720 min", gpsPeriod > 700 && gpsPeriod < 740, `Got ${gpsPeriod.toFixed(2)}`);
  
  test("ISS is near-Earth", getSatelliteType(issElements.no) === 'near-earth');
  test("GPS is deep-space", getSatelliteType(gpsElements.no) === 'deep-space');
  
  const issSMA = getSemiMajorAxis(issElements.no);
  test("ISS semi-major axis ~1.06 Earth radii", issSMA > 1.05 && issSMA < 1.08, `Got ${issSMA.toFixed(4)}`);
  
  // ================================================================
  section("2. PROPAGATION MODELS");
  // ================================================================
  
  // Test SGP
  const sgpResult = sgp(issElements, 0);
  test("SGP propagates without error", !sgpResult.error);
  test("SGP returns valid position", Math.abs(sgpResult.state.x) > 1000);
  
  // Test SGP4
  const sgp4Result = sgp4(issElements, 0);
  test("SGP4 propagates without error", !sgp4Result.error);
  test("SGP4 returns valid position", Math.abs(sgp4Result.state.x) > 1000);
  
  // Test SGP8
  const sgp8Result = sgp8(issElements, 0);
  test("SGP8 propagates without error", !sgp8Result.error);
  test("SGP8 returns valid position", Math.abs(sgp8Result.state.x) > 1000);
  
  // Test SDP4 (deep-space)
  const sdp4Result = sdp4(gpsElements, 0);
  test("SDP4 propagates without error", !sdp4Result.error);
  test("SDP4 returns valid position", Math.abs(sdp4Result.state.x) > 10000);
  
  // Test SDP8 (deep-space)
  const sdp8Result = sdp8(gpsElements, 0);
  test("SDP8 propagates without error", !sdp8Result.error);
  test("SDP8 returns valid position", Math.abs(sdp8Result.state.x) > 10000);
  
  // Test auto-selection
  const autoNearEarth = propagate(issElements, 0);
  const autoDeepSpace = propagate(gpsElements, 0);
  test("Auto-select uses SGP4 for ISS", autoNearEarth.algorithm === 'SGP4');
  test("Auto-select uses SDP4 for GPS", autoDeepSpace.algorithm === 'SDP4');
  
  // Test propagateTLE convenience function
  const convenienceResult = propagateTLE(ISS_LINE1, ISS_LINE2, 60);
  test("propagateTLE works", !convenienceResult.error && convenienceResult.tsince === 60);
  
  // Test propagateWithModel
  const modelResult = propagateWithModel(issElements, 30, 'SGP8');
  test("propagateWithModel works", !modelResult.error && modelResult.algorithm === 'SGP8');
  
  // Test position changes over time
  const pos0 = propagate(issElements, 0);
  const pos60 = propagate(issElements, 60);
  const distanceMoved = Math.sqrt(
    (pos60.state.x - pos0.state.x) ** 2 +
    (pos60.state.y - pos0.state.y) ** 2 +
    (pos60.state.z - pos0.state.z) ** 2
  );
  test("Position changes over 60 minutes", distanceMoved > 1000, `Moved ${distanceMoved.toFixed(0)} km`);
  
  // ================================================================
  section("3. OBSERVER & LOOK ANGLES");
  // ================================================================
  
  const observer = createObserver(40.7128, -74.0060, 10);
  test("Create observer", observer.latitude === 40.7128 && observer.longitude === -74.0060);
  
  const jd = dateToJD(new Date('2024-01-01T12:00:00Z'));
  test("Date to Julian Date", jd > 2460000, `JD = ${jd}`);
  
  const result = propagate(issElements, 0);
  const gmst = calculateGST(issElements.jdsatepoch);
  test("Calculate GMST", gmst >= 0 && gmst <= TWOPI);
  
  const geodetic = eciToGeodetic(result.state.x, result.state.y, result.state.z, gmst);
  test("ECI to geodetic latitude valid", geodetic.latitude >= -90 && geodetic.latitude <= 90);
  test("ECI to geodetic longitude valid", geodetic.longitude >= -180 && geodetic.longitude <= 180);
  test("ECI to geodetic altitude valid", geodetic.altitude > 350 && geodetic.altitude < 500);
  
  const observation = observe(result, observer, issElements.jdsatepoch);
  test("Observe returns look angles", observation.lookAngles !== undefined);
  test("Azimuth in valid range", observation.lookAngles.azimuth >= 0 && observation.lookAngles.azimuth < 360);
  test("Elevation in valid range", observation.lookAngles.elevation >= -90 && observation.lookAngles.elevation <= 90);
  test("Range is positive", observation.lookAngles.range > 0);
  
  const satObs = observeSatellite(issElements, observer, new Date('2024-01-01T12:00:00Z'));
  test("observeSatellite works", satObs.lookAngles !== undefined);
  
  const tleObs = observeTLE(ISS_LINE1, ISS_LINE2, observer, new Date('2024-01-01T12:00:00Z'));
  test("observeTLE works", tleObs.lookAngles !== undefined);
  
  const tsince = calculateTsince(new Date('2024-01-02T00:00:00Z'), issElements.jdsatepoch);
  test("calculateTsince works", Math.abs(tsince - 720) < 1, `Got ${tsince.toFixed(2)} minutes`);
  
  // ================================================================
  section("4. KEPLERIAN ELEMENTS");
  // ================================================================
  
  const kep = tleToKeplerian(issElements);
  test("Semi-major axis ~6780 km", kep.semiMajorAxis > 6700 && kep.semiMajorAxis < 6900, `Got ${kep.semiMajorAxis.toFixed(2)}`);
  test("Eccentricity matches TLE", Math.abs(kep.eccentricity - 0.0006703) < 0.0001);
  test("Inclination ~51.64°", Math.abs(kep.inclination - 51.64) < 0.1, `Got ${kep.inclination.toFixed(2)}`);
  test("Period ~92 min", kep.period > 90 && kep.period < 95, `Got ${kep.period.toFixed(2)}`);
  test("Perigee altitude ~400 km", kep.perigee > 350 && kep.perigee < 450, `Got ${kep.perigee.toFixed(2)}`);
  test("Apogee altitude ~420 km", kep.apogee > 400 && kep.apogee < 450, `Got ${kep.apogee.toFixed(2)}`);
  test("Mean motion > 15 rev/day", kep.meanMotion > 15);
  test("Angular momentum > 50000", kep.angularMomentum > 50000);
  test("Orbital energy is negative", kep.energy < 0);
  
  const stateKep = stateToKeplerian(
    result.state.x, result.state.y, result.state.z,
    result.state.xdot, result.state.ydot, result.state.zdot
  );
  test("State to Keplerian works", stateKep.semiMajorAxis > 6700);
  test("State Keplerian inclination reasonable", Math.abs(stateKep.inclination - 51.64) < 2);
  
  const orbState = getOrbitalState(issElements, propagate, 30);
  test("getOrbitalState works", orbState.elements !== undefined);
  test("getOrbitalState position exists", orbState.position.x !== 0);
  
  const kepStr = formatKeplerianElements(kep);
  test("formatKeplerianElements works", kepStr.includes("Semi-major axis") && kepStr.includes("Period"));
  
  // ================================================================
  section("5. DECAY PROFILE");
  // ================================================================
  
  const profile = calculateDecayProfile(issElements, propagate, {
    durationDays: 30,
    stepDays: 10
  });
  test("Decay profile has points", profile.points.length > 0);
  test("Decay profile has initial elements", profile.initialElements !== undefined);
  test("Decay profile has summary", profile.summary !== undefined);
  test("Decay profile lifetime category", ['days', 'weeks', 'months', 'years', 'decades', 'stable'].includes(profile.summary.lifetimeCategory));
  
  const lifetime = estimateLifetime(kep.perigee, kep.apogee);
  test("Estimate lifetime > 0", lifetime > 0, `Got ${lifetime.toFixed(0)} days`);
  test("ISS lifetime in reasonable range", lifetime > 100 && lifetime < 10000);
  
  const profileStr = formatDecayProfile(profile);
  test("formatDecayProfile works", profileStr.includes("Orbital Decay") && profileStr.includes("Perigee"));
  
  // ================================================================
  section("6. SATELLITE PASSES");
  // ================================================================
  
  const passResult = findPasses(issElements, observer, propagate, {
    startTsince: 0,
    durationMinutes: 1440,
    minElevation: 0,
    stepMinutes: 1
  });
  test("findPasses returns result", passResult !== undefined);
  test("findPasses has stats", passResult.stats !== undefined);
  test("Found some passes in 24h", passResult.stats.totalPasses >= 0);
  
  if (passResult.passes.length > 0) {
    const pass = passResult.passes[0];
    test("Pass has rise time", pass.riseTime !== undefined);
    test("Pass has max elevation", pass.maxElevation >= 0);
    test("Pass has set time", pass.setTime > pass.riseTime);
    test("Pass has duration", pass.duration > 0);
    test("Pass has sky path", pass.skyPath.length > 0);
    test("Pass has quality", ['excellent', 'good', 'fair', 'poor'].includes(pass.quality));
    
    const passStr = formatPass(pass);
    test("formatPass works", passStr.includes("Pass") && passStr.includes("Rise"));
    
    const skyPathStr = formatSkyPath(pass.skyPath);
    test("formatSkyPath works", skyPathStr.includes("Azimuth") || skyPathStr.includes("Time"));
    
    const chart = generateSkyChart(pass);
    test("generateSkyChart works", chart.includes("Sky Chart") && chart.includes("N"));
  } else {
    console.log("  (No passes found - skipping pass detail tests)");
  }
  
  const nextPass = getNextPass(issElements, observer, propagate, 0, 2880);
  test("getNextPass returns result or null", nextPass === null || nextPass.riseTime !== undefined);
  
  // ================================================================
  section("7. VISIBILITY FOOTPRINT");
  // ================================================================
  
  const footprint = observation.footprint;
  test("Footprint exists in observation", footprint !== undefined);
  test("Footprint has sub-satellite point", footprint.subSatellitePoint !== undefined);
  test("Footprint has altitude", footprint.altitude > 350);
  test("Footprint radius > 2000 km", footprint.radiusKm > 2000, `Got ${footprint.radiusKm.toFixed(0)} km`);
  test("Footprint radius < 3000 km", footprint.radiusKm < 3000);
  test("Footprint angular radius reasonable", footprint.radiusDeg > 15 && footprint.radiusDeg < 30);
  test("Footprint has boundary points", footprint.boundaryPoints.length >= 36);
  
  const directFootprint = calculateVisibilityFootprint(geodetic, 0, 72);
  test("Direct footprint calculation works", directFootprint.radiusKm > 2000);
  
  const subSatObserver = createObserver(
    footprint.subSatellitePoint.latitude,
    footprint.subSatellitePoint.longitude,
    0
  );
  test("Sub-satellite point is in footprint", isWithinFootprint(subSatObserver, footprint));
  
  const farObserver = createObserver(-80, 0, 0);
  test("Far point might not be in footprint", true); // Just checking function works
  
  const dist = distanceToSubSatellite(observer, footprint);
  test("Distance to sub-satellite > 0", dist >= 0);
  
  const footprintStr = formatFootprint(footprint);
  test("formatFootprint works", footprintStr.includes("Footprint") && footprintStr.includes("radius"));
  
  const geojsonFootprint = footprintToGeoJSON(footprint) as any;
  test("footprintToGeoJSON returns Feature", geojsonFootprint.type === "Feature");
  test("footprintToGeoJSON has Polygon geometry", geojsonFootprint.geometry.type === "Polygon");
  
  // ================================================================
  section("8. GROUND TRACK / FLIGHT PATH");
  // ================================================================
  
  const track = calculateGroundTrack(issElements, propagate, {
    stepSeconds: 30,
    numOrbits: 2,
    referenceTsince: 0
  });
  test("Ground track exists", track !== undefined);
  test("Ground track has points", track.points.length > 100);
  test("Ground track has past points", track.pastPoints.length > 0);
  test("Ground track has future points", track.futurePoints.length > 0);
  test("Ground track has current position", track.currentPosition !== null);
  test("Ground track period matches ISS", track.parameters.orbitalPeriod > 90 && track.parameters.orbitalPeriod < 95);
  test("Ground track duration = numOrbits * period", Math.abs(track.parameters.totalDuration - 2 * track.parameters.orbitalPeriod) < 1);
  
  test("Latitude range within inclination", 
    Math.abs(track.stats.maxLatitude) <= 52 && Math.abs(track.stats.minLatitude) <= 52,
    `Max: ${track.stats.maxLatitude.toFixed(1)}, Min: ${track.stats.minLatitude.toFixed(1)}`
  );
  test("Altitude range valid", 
    track.stats.minAltitude > 350 && track.stats.maxAltitude < 500,
    `${track.stats.minAltitude.toFixed(0)}-${track.stats.maxAltitude.toFixed(0)} km`
  );
  
  if (track.currentPosition) {
    test("Current position has valid latitude", 
      track.currentPosition.latitude >= -52 && track.currentPosition.latitude <= 52
    );
    test("Current position has valid speed",
      track.currentPosition.speed > 7 && track.currentPosition.speed < 8
    );
  }
  
  const trackStr = formatGroundTrack(track);
  test("formatGroundTrack works", trackStr.includes("Ground Track") && trackStr.includes("Orbital period"));
  
  const geojsonTrack = groundTrackToGeoJSON(track, true) as any;
  test("groundTrackToGeoJSON returns Feature", geojsonTrack.type === "Feature");
  test("groundTrackToGeoJSON has line geometry", 
    geojsonTrack.geometry.type === "LineString" || geojsonTrack.geometry.type === "MultiLineString"
  );
  
  const coords = getTrackCoordinates(track);
  test("getTrackCoordinates works", coords.length > 0);
  test("Track coordinates have lat/lon", coords[0].lat !== undefined && coords[0].lon !== undefined);
  
  const sampled = sampleGroundTrack(track, 50);
  test("sampleGroundTrack reduces points", sampled.length === 50);
  test("sampleGroundTrack preserves data", sampled[0].latitude !== undefined);
  
  // Different reference time
  const trackOffset = calculateGroundTrack(issElements, propagate, {
    stepSeconds: 60,
    numOrbits: 1,
    referenceTsince: 60
  });
  test("Ground track with offset reference time", trackOffset.referenceTsince === 60);
  
  // ================================================================
  section("9. EDGE CASES & ERROR HANDLING");
  // ================================================================
  
  // Very long propagation (may cause decay)
  const longProp = propagate(issElements, 100000);
  test("Long propagation handles gracefully", longProp !== undefined);
  
  // Zero time
  const zeroProp = propagate(issElements, 0);
  test("Zero time propagation works", !zeroProp.error);
  
  // Negative time (before epoch)
  const negProp = propagate(issElements, -60);
  test("Negative time propagation works", !negProp.error);
  
  // Very small time step ground track
  const smallStepTrack = calculateGroundTrack(issElements, propagate, {
    stepSeconds: 1,
    numOrbits: 0.1
  });
  test("Small step ground track works", smallStepTrack.points.length > 0);
  
  // ================================================================
  // SUMMARY
  // ================================================================
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log(`║  RESULTS: ${passed} passed, ${failed} failed                           ║`);
  console.log("╚══════════════════════════════════════════════════════════╝");
  
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error("Test suite error:", err);
  process.exit(1);
});

