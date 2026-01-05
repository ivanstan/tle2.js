# tle.js

A TypeScript library for working with Two-Line Element (TLE) sets:
- **TLE API Client** — Fetch TLEs and satellite positions from [tle.ivanstanojevic.me](https://tle.ivanstanojevic.me/)
- **SPACETRACK Propagators** — SGP, SGP4, SDP4, SGP8, SDP8 orbit propagation models based on [SPACETRACK Report No. 3](https://celestrak.org/NORAD/documentation/spacetrk.pdf)

## Installation

```bash
npm install tle.js
```

## Quick Start

```typescript
import TleClient from "tle.js";

const client = new TleClient();

// Search for the ISS
const results = await client.collection({ search: "ISS" });
console.log(`Found ${results.totalItems} satellites`);

// Get TLE for a specific satellite
const iss = await client.record(25544);
console.log(iss.line1);
console.log(iss.line2);

// Get current position
const position = await client.propagate(25544);
console.log(`ISS is at ${position.geodetic.latitude}°, ${position.geodetic.longitude}°`);
```

## API Reference

### `new TleClient(options?)`

Create a new client instance.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | `string` | `https://tle.ivanstanojevic.me` | API base URL |
| `cacheTtl` | `number` | `43200000` (12h) | Cache TTL in milliseconds |
| `disableCache` | `boolean` | `false` | Disable caching entirely |

---

### `client.collection(params?)`

Fetch a paginated collection of TLE records.

```typescript
const results = await client.collection({
  search: "starlink",
  sort: "inclination",
  sortDir: "desc",
  page: 1,
  pageSize: 50,
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | `string` | Search by satellite name |
| `sort` | `SortField` | Sort by: `id`, `name`, `popularity`, `inclination`, `eccentricity`, `period` |
| `sortDir` | `SortDirection` | Sort direction: `asc`, `desc` |
| `page` | `number` | Page number (starts at 1) |
| `pageSize` | `number` | Results per page (1-100) |
| `eccentricityGte` | `number` | Eccentricity ≥ value |
| `eccentricityLte` | `number` | Eccentricity ≤ value |
| `inclinationLt` | `number` | Inclination < value (posigrade orbits: < 90°) |
| `inclinationGt` | `number` | Inclination > value (retrograde orbits: > 90°) |
| `periodLt` | `number` | Orbital period < value (minutes) |
| `periodGt` | `number` | Orbital period > value (minutes) |

#### Returns `Promise<TleCollection>`

```typescript
interface TleCollection {
  totalItems: number;
  member: TleModel[];
  view?: Pagination;
}
```

---

### `client.record(id)`

Fetch a single TLE by NORAD catalog ID.

```typescript
const iss = await client.record(25544);
console.log(iss.name);       // "ISS (ZARYA)"
console.log(iss.satelliteId); // 25544
console.log(iss.line1);
console.log(iss.line2);
```

#### Returns `Promise<TleModel>`

```typescript
interface TleModel {
  satelliteId: number;
  name: string;
  date: string;
  line1: string;
  line2: string;
}
```

---

### `client.propagate(id, params?)`

Calculate satellite position using SGP4/SDP4 algorithms.

```typescript
// Current position
const now = await client.propagate(25544);

// Position at specific time
const future = await client.propagate(25544, {
  date: "2026-06-15T12:00:00Z"
});

// Using Date object
const custom = await client.propagate(25544, {
  date: new Date("2026-06-15T12:00:00Z")
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | `string \| Date` | Target date/time (defaults to now) |

#### Returns `Promise<Propagation>`

```typescript
interface Propagation {
  tle: TleModel;
  algorithm: "SGP4" | "SDP4";
  vector: {
    reference_frame: string;
    position: { x: number; y: number; z: number; r: number; unit: string };
    velocity: { x: number; y: number; z: number; r: number; unit: string };
  };
  geodetic: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
}
```

---

## Caching

Responses are cached in memory for **12 hours** by default to reduce API calls.

```typescript
// Custom cache TTL (6 hours)
const client = new TleClient({
  cacheTtl: 6 * 60 * 60 * 1000
});

// Disable caching
const client = new TleClient({ disableCache: true });

// Cache management
client.cacheSize;    // Number of cached entries
client.clearCache(); // Clear all entries
client.pruneCache(); // Remove expired entries
```

---

## Error Handling

The client throws `TleApiError` for HTTP errors:

```typescript
import { TleClient, TleApiError } from "tle.js";

try {
  await client.record(999999999);
} catch (error) {
  if (error instanceof TleApiError) {
    console.log(error.status);   // 404
    console.log(error.message);  // "Resource not found"
  }
}
```

---

## Examples

### Find all geostationary satellites

```typescript
// Geostationary orbit: ~1436 minute period, ~0 inclination
const geo = await client.collection({
  periodGt: 1430,
  periodLt: 1450,
  inclinationLt: 5,
  pageSize: 100,
});
```

### Track ISS position over time

```typescript
const id = 25544;
const now = new Date();

for (let i = 0; i < 10; i++) {
  const time = new Date(now.getTime() + i * 60000); // Every minute
  const pos = await client.propagate(id, { date: time });
  console.log(`${time.toISOString()}: ${pos.geodetic.latitude.toFixed(2)}°, ${pos.geodetic.longitude.toFixed(2)}°`);
}
```

### Find highly eccentric orbits

```typescript
const eccentric = await client.collection({
  eccentricityGte: 0.5,
  sort: "eccentricity",
  sortDir: "desc",
});
```

---

## Local Propagation (SPACETRACK Report No. 3)

This library includes TypeScript implementations of all five satellite orbit propagation models from SPACETRACK Report No. 3:

| Model | Type | Period | Description |
|-------|------|--------|-------------|
| **SGP** | Near-Earth | < 225 min | Simplified General Perturbations (Kozai gravitational model) |
| **SGP4** | Near-Earth | < 225 min | Primary model used by NORAD for near-Earth satellites |
| **SDP4** | Deep-Space | ≥ 225 min | SGP4 extended with lunar/solar perturbations |
| **SGP8** | Near-Earth | < 225 min | Alternative integration method |
| **SDP8** | Deep-Space | ≥ 225 min | SGP8 extended with deep-space effects |

### Usage

```typescript
import { parseTLE, propagate, propagateTLE, sgp4, sdp4 } from "tle.js/propagators";

// Parse a TLE
const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";
const elements = parseTLE(line1, line2);

// Propagate using auto-selection (SGP4 for near-Earth, SDP4 for deep-space)
const result = propagate(elements, 60); // 60 minutes since epoch
console.log(result.state.x, result.state.y, result.state.z); // Position in km
console.log(result.state.xdot, result.state.ydot, result.state.zdot); // Velocity in km/s

// Or use the convenience function
const result2 = propagateTLE(line1, line2, 120);

// Or use a specific model
import { sgp4, sdp4, sgp, sgp8, sdp8 } from "tle.js/propagators";
const sgp4Result = sgp4(elements, 60);
```

### Propagation Result

```typescript
interface PropagationResult {
  state: {
    x: number;     // Position X (km)
    y: number;     // Position Y (km)
    z: number;     // Position Z (km)
    xdot: number;  // Velocity X (km/s)
    ydot: number;  // Velocity Y (km/s)
    zdot: number;  // Velocity Z (km/s)
  };
  tsince: number;         // Time since epoch (minutes)
  algorithm: string;      // Model used
  error: boolean;         // True if satellite decayed
  errorMessage?: string;
}
```

### Propagation Examples

#### Basic Position Calculation

```typescript
import { parseTLE, propagate } from "tle.js/propagators";

// ISS TLE (example)
const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);

// Get position at epoch (tsince = 0)
const atEpoch = propagate(elements, 0);
console.log("Position at epoch:");
console.log(`  X: ${atEpoch.state.x.toFixed(2)} km`);
console.log(`  Y: ${atEpoch.state.y.toFixed(2)} km`);
console.log(`  Z: ${atEpoch.state.z.toFixed(2)} km`);

// Get position 90 minutes later (about one ISS orbit)
const oneOrbit = propagate(elements, 90);
console.log("\nPosition after one orbit:");
console.log(`  X: ${oneOrbit.state.x.toFixed(2)} km`);
console.log(`  Y: ${oneOrbit.state.y.toFixed(2)} km`);
console.log(`  Z: ${oneOrbit.state.z.toFixed(2)} km`);
```

#### Calculate Orbital Radius and Altitude

```typescript
import { parseTLE, propagate, XKMPER } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const result = propagate(elements, 0);

// Calculate distance from Earth center
const { x, y, z } = result.state;
const radius = Math.sqrt(x * x + y * y + z * z);

// Earth radius is XKMPER = 6378.135 km
const altitude = radius - XKMPER;

console.log(`Orbital radius: ${radius.toFixed(2)} km`);
console.log(`Altitude: ${altitude.toFixed(2)} km`);
```

#### Calculate Velocity Magnitude

```typescript
import { parseTLE, propagate } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const result = propagate(elements, 0);

const { xdot, ydot, zdot } = result.state;
const velocity = Math.sqrt(xdot * xdot + ydot * ydot + zdot * zdot);

console.log(`Velocity: ${velocity.toFixed(4)} km/s`);
console.log(`Velocity: ${(velocity * 3600).toFixed(2)} km/h`);
```

#### Track Satellite Ground Track

```typescript
import { parseTLE, propagate, XKMPER } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);

// Calculate ground track for one orbit (every 5 minutes)
console.log("Time (min) | Latitude | Longitude | Altitude");
console.log("-----------|----------|-----------|----------");

for (let t = 0; t <= 90; t += 5) {
  const result = propagate(elements, t);
  const { x, y, z } = result.state;
  
  // Calculate geodetic coordinates (simplified)
  const r = Math.sqrt(x * x + y * y + z * z);
  const latitude = Math.asin(z / r) * (180 / Math.PI);
  const longitude = Math.atan2(y, x) * (180 / Math.PI);
  const altitude = r - XKMPER;
  
  console.log(
    `${t.toString().padStart(10)} | ` +
    `${latitude.toFixed(2).padStart(8)}° | ` +
    `${longitude.toFixed(2).padStart(9)}° | ` +
    `${altitude.toFixed(1).padStart(8)} km`
  );
}
```

#### Compare Different Propagation Models

```typescript
import { parseTLE, sgp, sgp4, sgp8 } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const t = 60; // 60 minutes since epoch

const sgpResult = sgp(elements, t);
const sgp4Result = sgp4(elements, t);
const sgp8Result = sgp8(elements, t);

console.log("Model Comparison at t=60 min:");
console.log(`  SGP  position: (${sgpResult.state.x.toFixed(2)}, ${sgpResult.state.y.toFixed(2)}, ${sgpResult.state.z.toFixed(2)}) km`);
console.log(`  SGP4 position: (${sgp4Result.state.x.toFixed(2)}, ${sgp4Result.state.y.toFixed(2)}, ${sgp4Result.state.z.toFixed(2)}) km`);
console.log(`  SGP8 position: (${sgp8Result.state.x.toFixed(2)}, ${sgp8Result.state.y.toFixed(2)}, ${sgp8Result.state.z.toFixed(2)}) km`);
```

#### Get Orbital Period from TLE

```typescript
import { parseTLE, getOrbitalPeriod, getSemiMajorAxis, XKMPER } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);

const period = getOrbitalPeriod(elements.no); // minutes
const semiMajorAxis = getSemiMajorAxis(elements.no); // Earth radii

console.log(`Orbital period: ${period.toFixed(2)} minutes`);
console.log(`Semi-major axis: ${semiMajorAxis.toFixed(4)} Earth radii`);
console.log(`Semi-major axis: ${(semiMajorAxis * XKMPER).toFixed(2)} km`);
console.log(`Eccentricity: ${elements.ecco.toFixed(6)}`);
console.log(`Inclination: ${(elements.inclo * 180 / Math.PI).toFixed(2)}°`);
```

#### Detect Satellite Type (Near-Earth vs Deep-Space)

```typescript
import { parseTLE, getSatelliteType, getOrbitalPeriod } from "tle.js/propagators";

// ISS (near-Earth, ~90 min period)
const issLine1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const issLine2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

// GPS satellite (deep-space, ~720 min period)
const gpsLine1 = "1 28874U 05038A   24001.50000000  .00000043  00000-0  00000+0 0  9999";
const gpsLine2 = "2 28874  55.4408 300.8261 0052261 219.8822 139.8158  2.00562965135619";

const issElements = parseTLE(issLine1, issLine2);
const gpsElements = parseTLE(gpsLine1, gpsLine2);

console.log(`ISS: ${getSatelliteType(issElements.no)} (period: ${getOrbitalPeriod(issElements.no).toFixed(1)} min)`);
console.log(`GPS: ${getSatelliteType(gpsElements.no)} (period: ${getOrbitalPeriod(gpsElements.no).toFixed(1)} min)`);
```

#### Handle Decayed Satellites

```typescript
import { parseTLE, propagate } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);

// Try to propagate far into the future (may cause decay)
const result = propagate(elements, 100000); // ~70 days

if (result.error) {
  console.log(`Error: ${result.errorMessage}`);
} else {
  console.log(`Position: (${result.state.x}, ${result.state.y}, ${result.state.z})`);
}
```

---

## Observer Module

Calculate satellite position relative to a ground observer, including look angles (azimuth/elevation), range, and visibility.

### Observer Examples

#### Basic Observation - Get Look Angles

```typescript
import { parseTLE, createObserver, observeSatellite } from "tle.js/propagators";

// ISS TLE
const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);

// Create observer at New York City
const observer = createObserver(40.7128, -74.0060, 10); // lat, lon, altitude (m)

// Observe satellite at current time
const observation = observeSatellite(elements, observer, new Date());

console.log(`Azimuth: ${observation.lookAngles.azimuth.toFixed(1)}°`);
console.log(`Elevation: ${observation.lookAngles.elevation.toFixed(1)}°`);
console.log(`Range: ${observation.lookAngles.range.toFixed(1)} km`);
console.log(`Range rate: ${observation.lookAngles.rangeRate.toFixed(3)} km/s`);
console.log(`Visible: ${observation.visible ? 'Yes' : 'No (below horizon)'}`);
```

#### Track Satellite Pass

```typescript
import { parseTLE, createObserver, observeSatellite, calculateTsince } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const observer = createObserver(51.5074, -0.1278, 11); // London

// Track for 30 minutes, every minute
const startTime = new Date();
console.log("Time        | Azimuth | Elevation | Range (km) | Visible");
console.log("------------|---------|-----------|------------|--------");

for (let i = 0; i < 30; i++) {
  const time = new Date(startTime.getTime() + i * 60000);
  const obs = observeSatellite(elements, observer, time);
  
  console.log(
    `${time.toISOString().slice(11, 19)} | ` +
    `${obs.lookAngles.azimuth.toFixed(1).padStart(7)}° | ` +
    `${obs.lookAngles.elevation.toFixed(1).padStart(9)}° | ` +
    `${obs.lookAngles.range.toFixed(0).padStart(10)} | ` +
    `${obs.visible ? '  Yes' : '  No'}`
  );
}
```

#### Get Satellite Geodetic Position

```typescript
import { parseTLE, propagate, observe, dateToJD, calculateGST, eciToGeodetic } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const result = propagate(elements, 0);

// Get geodetic coordinates
const jd = dateToJD(new Date());
const gmst = calculateGST(jd);
const geodetic = eciToGeodetic(result.state.x, result.state.y, result.state.z, gmst);

console.log(`Satellite position:`);
console.log(`  Latitude: ${geodetic.latitude.toFixed(4)}°`);
console.log(`  Longitude: ${geodetic.longitude.toFixed(4)}°`);
console.log(`  Altitude: ${geodetic.altitude.toFixed(1)} km`);
```

#### One-Step TLE Observation

```typescript
import { observeTLE, createObserver } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

// Create observer at Tokyo
const observer = createObserver(35.6762, 139.6503, 40);

// One-step: parse TLE and observe
const obs = observeTLE(line1, line2, observer, new Date());

if (obs.visible) {
  console.log(`ISS is visible from Tokyo!`);
  console.log(`Point your telescope at:`);
  console.log(`  Azimuth: ${obs.lookAngles.azimuth.toFixed(1)}° from North`);
  console.log(`  Elevation: ${obs.lookAngles.elevation.toFixed(1)}° above horizon`);
} else {
  console.log(`ISS is below the horizon (elevation: ${obs.lookAngles.elevation.toFixed(1)}°)`);
}
```

#### Check Multiple Observers

```typescript
import { parseTLE, observeSatellite, createObserver } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);

const observers = [
  { name: "New York", observer: createObserver(40.7128, -74.0060, 10) },
  { name: "London", observer: createObserver(51.5074, -0.1278, 11) },
  { name: "Tokyo", observer: createObserver(35.6762, 139.6503, 40) },
  { name: "Sydney", observer: createObserver(-33.8688, 151.2093, 58) },
  { name: "São Paulo", observer: createObserver(-23.5505, -46.6333, 760) },
];

const now = new Date();

console.log("ISS visibility check:");
console.log("-".repeat(50));

for (const { name, observer } of observers) {
  const obs = observeSatellite(elements, observer, now);
  const status = obs.visible 
    ? `✓ Visible (El: ${obs.lookAngles.elevation.toFixed(1)}°, Az: ${obs.lookAngles.azimuth.toFixed(1)}°)`
    : `✗ Below horizon (El: ${obs.lookAngles.elevation.toFixed(1)}°)`;
  console.log(`${name.padEnd(12)}: ${status}`);
}
```

#### Calculate When Satellite is Approaching/Receding

```typescript
import { observeTLE, createObserver } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const observer = createObserver(40.7128, -74.0060, 10);
const obs = observeTLE(line1, line2, observer, new Date());

const rangeRate = obs.lookAngles.rangeRate;
if (rangeRate > 0) {
  console.log(`Satellite is moving AWAY at ${rangeRate.toFixed(3)} km/s`);
} else {
  console.log(`Satellite is APPROACHING at ${Math.abs(rangeRate).toFixed(3)} km/s`);
}
```

### Observer Types Reference

```typescript
interface Observer {
  latitude: number;   // Degrees (+ North, - South)
  longitude: number;  // Degrees (+ East, - West)
  altitude: number;   // Meters above sea level
}

interface LookAngles {
  azimuth: number;    // Degrees (0=N, 90=E, 180=S, 270=W)
  elevation: number;  // Degrees (0=horizon, 90=zenith)
  range: number;      // Distance in km
  rangeRate: number;  // km/s (+moving away, -approaching)
}

interface GeodeticCoordinates {
  latitude: number;   // Degrees
  longitude: number;  // Degrees
  altitude: number;   // km above sea level
}

interface ObservationResult {
  lookAngles: LookAngles;
  geodetic: GeodeticCoordinates;
  topocentric: TopocentricCoordinates;
  visible: boolean;   // True if elevation > 0
  tsince: number;     // Minutes since TLE epoch
}
```

---

## Keplerian Elements

Calculate classical orbital elements from TLE or state vectors.

### Get Keplerian Elements from TLE

```typescript
import { parseTLE, tleToKeplerian, formatKeplerianElements } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const keplerian = tleToKeplerian(elements);

console.log(`Semi-major axis: ${keplerian.semiMajorAxis.toFixed(2)} km`);
console.log(`Eccentricity: ${keplerian.eccentricity.toFixed(6)}`);
console.log(`Inclination: ${keplerian.inclination.toFixed(2)}°`);
console.log(`RAAN: ${keplerian.raan.toFixed(2)}°`);
console.log(`Arg of Perigee: ${keplerian.argumentOfPerigee.toFixed(2)}°`);
console.log(`True Anomaly: ${keplerian.trueAnomaly.toFixed(2)}°`);
console.log(`Period: ${keplerian.period.toFixed(2)} min`);
console.log(`Apogee: ${keplerian.apogee.toFixed(2)} km`);
console.log(`Perigee: ${keplerian.perigee.toFixed(2)} km`);

// Or print formatted output
console.log(formatKeplerianElements(keplerian));
```

### Get Elements from State Vectors

```typescript
import { propagate, parseTLE, stateToKeplerian } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const result = propagate(elements, 60); // 60 minutes later

// Calculate Keplerian elements from position/velocity
const { x, y, z, xdot, ydot, zdot } = result.state;
const keplerian = stateToKeplerian(x, y, z, xdot, ydot, zdot);

console.log(`Current true anomaly: ${keplerian.trueAnomaly.toFixed(2)}°`);
console.log(`Current altitude: ${keplerian.perigee.toFixed(2)} - ${keplerian.apogee.toFixed(2)} km`);
```

### Track Orbital State Over Time

```typescript
import { parseTLE, getOrbitalState, propagate } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);

console.log("Time | True Anomaly | Altitude Range");
console.log("-----|--------------|----------------");

for (let t = 0; t <= 90; t += 15) {
  const state = getOrbitalState(elements, propagate, t);
  console.log(
    `${t.toString().padStart(4)} | ` +
    `${state.elements.trueAnomaly.toFixed(1).padStart(12)}° | ` +
    `${state.elements.perigee.toFixed(0)}-${state.elements.apogee.toFixed(0)} km`
  );
}
```

---

## Orbital Decay Analysis

Predict satellite orbital decay and estimate lifetime.

### Calculate Decay Profile

```typescript
import { parseTLE, propagate, calculateDecayProfile, formatDecayProfile } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);

// Analyze decay over 1 year
const profile = calculateDecayProfile(elements, propagate, {
  durationDays: 365,
  stepDays: 7
});

console.log(formatDecayProfile(profile));
```

### Quick Lifetime Estimation

```typescript
import { parseTLE, tleToKeplerian, estimateLifetime } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const kep = tleToKeplerian(elements);

const lifetime = estimateLifetime(kep.perigee, kep.apogee);
console.log(`Estimated lifetime: ${lifetime.toFixed(0)} days`);

if (lifetime < 30) {
  console.log("Warning: Satellite may decay within a month!");
} else if (lifetime < 365) {
  console.log("Satellite will likely decay within a year");
} else {
  console.log("Orbit is relatively stable");
}
```

### Monitor Orbital Evolution

```typescript
import { parseTLE, propagate, calculateDecayProfile } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const profile = calculateDecayProfile(elements, propagate, {
  durationDays: 180,
  stepDays: 30
});

console.log("Orbital Evolution:");
console.log("Day  | Perigee (km) | Apogee (km) | Period (min)");
console.log("-----|--------------|-------------|-------------");

for (const point of profile.points) {
  console.log(
    `${point.days.toString().padStart(4)} | ` +
    `${point.perigee.toFixed(1).padStart(12)} | ` +
    `${point.apogee.toFixed(1).padStart(11)} | ` +
    `${point.period.toFixed(2).padStart(12)}`
  );
}

console.log(`\nDecay status: ${profile.summary.isDecaying ? 'Decaying' : 'Stable'}`);
console.log(`Lifetime category: ${profile.summary.lifetimeCategory}`);
```

---

## Satellite Passes & Sky Path

Find and track satellite passes over your location.

### Find All Passes in 24 Hours

```typescript
import { parseTLE, propagate, createObserver, findPasses, formatPass } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const observer = createObserver(40.7128, -74.0060, 10); // NYC

const result = findPasses(elements, observer, propagate, {
  startTsince: 0,
  durationMinutes: 1440, // 24 hours
  minElevation: 10 // Only passes above 10°
});

console.log(`Found ${result.stats.totalPasses} passes (${result.stats.goodPasses} good)`);
console.log(`Average max elevation: ${result.stats.averageMaxElevation.toFixed(1)}°`);
console.log(`Average duration: ${result.stats.averageDuration.toFixed(1)} min\n`);

for (const pass of result.passes) {
  console.log(formatPass(pass));
  console.log();
}
```

### Get Next Pass

```typescript
import { parseTLE, propagate, createObserver, getNextPass, formatPass } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const observer = createObserver(51.5074, -0.1278, 11); // London

const nextPass = getNextPass(elements, observer, propagate);

if (nextPass) {
  console.log("Next visible pass:");
  console.log(formatPass(nextPass));
} else {
  console.log("No passes found in the next 48 hours");
}
```

### Track Sky Path During a Pass

```typescript
import { parseTLE, propagate, createObserver, findPasses, formatSkyPath } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const observer = createObserver(35.6762, 139.6503, 40); // Tokyo

const result = findPasses(elements, observer, propagate, {
  durationMinutes: 1440,
  skyPathPoints: 30
});

if (result.passes.length > 0) {
  const pass = result.passes[0];
  console.log(`Pass #1 Sky Path:`);
  console.log(formatSkyPath(pass.skyPath, 3)); // Every 3rd point
}
```

### Generate ASCII Sky Chart

```typescript
import { parseTLE, propagate, createObserver, findPasses, generateSkyChart } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const observer = createObserver(40.7128, -74.0060, 10);

const result = findPasses(elements, observer, propagate);

if (result.passes.length > 0) {
  console.log(generateSkyChart(result.passes[0]));
}
```

Output example:
```
Sky Chart - Pass #1
R=Rise, M=Max, S=Set
─────────────────────────────────────────
                    N                    
                    .                    
              .           .              
          .                   .          
        .         R   *         .        
      .         *       *         .      
     .        *           *        .     
    .        *     M       *        .    
   .        *               *        .   
  .        *                 *        .  
 W.       *                   *       .E 
  .      *                     *      .  
   .    *                       S    .   
    .                               .    
     .                             .     
      .                           .      
        .                       .        
          .                   .          
              .           .              
                    .                    
                    S                    
─────────────────────────────────────────
```

### Filter Passes by Quality

```typescript
import { parseTLE, propagate, createObserver, findPasses } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const observer = createObserver(40.7128, -74.0060, 10);

const result = findPasses(elements, observer, propagate, {
  durationMinutes: 4320 // 3 days
});

// Filter for excellent passes only (max elevation > 60°)
const excellentPasses = result.passes.filter(p => p.quality === 'excellent');
const goodPasses = result.passes.filter(p => p.quality === 'good');

console.log(`Passes in next 3 days:`);
console.log(`  Excellent (>60°): ${excellentPasses.length}`);
console.log(`  Good (>30°): ${goodPasses.length}`);
console.log(`  Fair (>15°): ${result.passes.filter(p => p.quality === 'fair').length}`);
console.log(`  Poor (<15°): ${result.passes.filter(p => p.quality === 'poor').length}`);
```

---

## Visibility Footprint

Calculate the geographic area from which a satellite can be seen.

### Get Visibility Footprint

```typescript
import { parseTLE, propagate, dateToJD, observe, createObserver, formatFootprint } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const result = propagate(elements, 0);
const jd = elements.jdsatepoch;
const observer = createObserver(40.7128, -74.0060, 10);

const observation = observe(result, observer, jd);

console.log(formatFootprint(observation.footprint));
// Output:
// Visibility Footprint:
//   Sub-satellite point: 41.2345°, -73.5678°
//   Satellite altitude:  420.5 km
//   Footprint radius:    2234.5 km (20.12°)
//   Max slant range:     2876.3 km
//   Min elevation:       0.0°
//   Boundary points:     72
```

### Check if Observer is in Footprint

```typescript
import { 
  parseTLE, propagate, observe, createObserver,
  isWithinFootprint, distanceToSubSatellite 
} from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const result = propagate(elements, 0);
const jd = elements.jdsatepoch;
const observer = createObserver(40.7128, -74.0060, 10);

const observation = observe(result, observer, jd);
const footprint = observation.footprint;

// Check if observer can see the satellite
const canSee = isWithinFootprint(observer, footprint);
console.log(`Observer can see satellite: ${canSee}`);

// Get ground distance to sub-satellite point
const distance = distanceToSubSatellite(observer, footprint);
console.log(`Distance to sub-satellite point: ${distance.toFixed(1)} km`);
```

### Get Footprint with Minimum Elevation

```typescript
import { parseTLE, propagate, observe, createObserver } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const result = propagate(elements, 0);
const jd = elements.jdsatepoch;
const observer = createObserver(40.7128, -74.0060, 10);

// Get footprint for 10° minimum elevation (visible above 10° on horizon)
const observation = observe(result, observer, jd, 10);

console.log(`Footprint radius (0° el):  ${observation.footprint.radiusKm.toFixed(0)} km`);

// Get a smaller footprint for 30° minimum
const obs30 = observe(result, observer, jd, 30);
console.log(`Footprint radius (30° el): ${obs30.footprint.radiusKm.toFixed(0)} km`);
```

### Export Footprint as GeoJSON

```typescript
import { 
  parseTLE, propagate, observe, createObserver, footprintToGeoJSON 
} from "tle.js/propagators";
import * as fs from 'fs';

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const result = propagate(elements, 0);
const jd = elements.jdsatepoch;
const observer = createObserver(0, 0, 0);

const observation = observe(result, observer, jd);

// Export as GeoJSON for mapping tools (Leaflet, MapboxGL, etc.)
const geojson = footprintToGeoJSON(observation.footprint);
fs.writeFileSync('footprint.geojson', JSON.stringify(geojson, null, 2));

console.log('Footprint exported to footprint.geojson');
```

### Get Footprint Boundary Points

```typescript
import { parseTLE, propagate, observe, createObserver } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);
const result = propagate(elements, 0);
const jd = elements.jdsatepoch;
const observer = createObserver(0, 0, 0);

const observation = observe(result, observer, jd);

// Access boundary points for custom visualization
console.log("Footprint boundary (first 8 points):");
for (let i = 0; i < 8 && i < observation.footprint.boundaryPoints.length; i++) {
  const p = observation.footprint.boundaryPoints[i];
  console.log(`  ${(i * 5)}°: ${p.latitude.toFixed(4)}°N, ${p.longitude.toFixed(4)}°E`);
}
```

---

## Ground Track / Flight Path

Calculate the satellite's path over Earth for multiple orbits, centered around a reference time.

### Calculate Ground Track

```typescript
import { parseTLE, propagate, calculateGroundTrack, formatGroundTrack } from "tle.js/propagators";

const line1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9025";
const line2 = "2 25544  51.6400 208.9163 0006703  35.7921  87.5274 15.50377579484420";

const elements = parseTLE(line1, line2);

// Calculate 3 orbits (1.5 past, 1.5 future) with 5-second steps
const track = calculateGroundTrack(elements, propagate, {
  stepSeconds: 5,      // Time step (default: 5 seconds)
  numOrbits: 3,        // Number of orbits (default: 3)
  referenceTsince: 0   // Reference time in minutes from epoch
});

console.log(formatGroundTrack(track));
```

Output:
```
=== Ground Track for Satellite 25544 ===

Parameters:
  Reference time:   T+0.0 min
  Orbital period:   92.88 min
  Number of orbits: 3
  Total duration:   278.6 min
  Time step:        5 sec

Statistics:
  Total points:     3344
  Past points:      1672
  Future points:    1672
  Latitude range:   -51.80° to 51.80°
  Altitude range:   411.2 to 428.5 km

Current Position:
  Latitude:  41.0732°
  Longitude: 64.9678°
  Altitude:  420.5 km
  Speed:     7.661 km/s
```

### Export as GeoJSON for Mapping

```typescript
import { parseTLE, propagate, calculateGroundTrack, groundTrackToGeoJSON } from "tle.js/propagators";
import * as fs from 'fs';

const elements = parseTLE(line1, line2);
const track = calculateGroundTrack(elements, propagate);

// Export as GeoJSON (handles date line crossing automatically)
const geojson = groundTrackToGeoJSON(track, true);
fs.writeFileSync('ground-track.geojson', JSON.stringify(geojson, null, 2));
```

### Access Track Points

```typescript
import { parseTLE, propagate, calculateGroundTrack, getTrackCoordinates } from "tle.js/propagators";

const elements = parseTLE(line1, line2);
const track = calculateGroundTrack(elements, propagate, {
  stepSeconds: 60,
  numOrbits: 1
});

// Get simple coordinate array
const coords = getTrackCoordinates(track);
for (const c of coords.slice(0, 5)) {
  console.log(`T+${c.time.toFixed(0)}s: ${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}°, ${c.alt.toFixed(0)} km`);
}

// Access detailed points
console.log(`\nPast track: ${track.pastPoints.length} points`);
console.log(`Future track: ${track.futurePoints.length} points`);

// Current position
if (track.currentPosition) {
  console.log(`\nNow: ${track.currentPosition.latitude.toFixed(4)}°N`);
  console.log(`Speed: ${track.currentPosition.speed.toFixed(3)} km/s`);
}
```

### Reduce Track Resolution

```typescript
import { parseTLE, propagate, calculateGroundTrack, sampleGroundTrack } from "tle.js/propagators";

const elements = parseTLE(line1, line2);

// High resolution track
const track = calculateGroundTrack(elements, propagate, {
  stepSeconds: 1,
  numOrbits: 2
});

console.log(`Full track: ${track.points.length} points`);

// Reduce to 100 points for faster rendering
const sampled = sampleGroundTrack(track, 100);
console.log(`Sampled: ${sampled.length} points`);
```

### Visualize Past vs Future

```typescript
import { parseTLE, propagate, calculateGroundTrack } from "tle.js/propagators";

const elements = parseTLE(line1, line2);
const track = calculateGroundTrack(elements, propagate, {
  numOrbits: 2,
  referenceTsince: 60  // 60 minutes after epoch
});

// Past track (before reference time) - could be rendered in different color
console.log("Past track (dashed line):");
for (const p of track.pastPoints.slice(-5)) {
  console.log(`  T${p.timeOffset.toFixed(0)}s: ${p.latitude.toFixed(2)}°, ${p.longitude.toFixed(2)}°`);
}

// Future track (after reference time)
console.log("\nFuture track (solid line):");
for (const p of track.futurePoints.slice(0, 5)) {
  console.log(`  T+${p.timeOffset.toFixed(0)}s: ${p.latitude.toFixed(2)}°, ${p.longitude.toFixed(2)}°`);
}
```

### Ground Track Types

```typescript
interface GroundTrackPoint {
  tsince: number;        // Time since epoch (minutes)
  timeOffset: number;    // Offset from reference (seconds)
  latitude: number;      // Degrees
  longitude: number;     // Degrees
  altitude: number;      // km above surface
  position: { x, y, z }; // ECI position (km)
  velocity: { x, y, z }; // ECI velocity (km/s)
  speed: number;         // Velocity magnitude (km/s)
  isPast: boolean;       // Before reference time?
}

interface GroundTrack {
  satnum: number;
  referenceTsince: number;
  points: GroundTrackPoint[];
  pastPoints: GroundTrackPoint[];
  futurePoints: GroundTrackPoint[];
  currentPosition: GroundTrackPoint | null;
  parameters: {
    stepSeconds: number;
    numOrbits: number;
    orbitalPeriod: number;    // minutes
    totalDuration: number;    // minutes
  };
  stats: {
    totalPoints: number;
    minLatitude: number;
    maxLatitude: number;
    minAltitude: number;
    maxAltitude: number;
  };
}
```

---

### Footprint Interface

```typescript
interface VisibilityFootprint {
  subSatellitePoint: {      // Point directly below satellite
    latitude: number;
    longitude: number;
  };
  altitude: number;         // Satellite altitude (km)
  radiusKm: number;         // Footprint radius on surface (km)
  radiusDeg: number;        // Footprint angular radius (degrees)
  maxRange: number;         // Max slant range to edge (km)
  minElevation: number;     // Minimum elevation for visibility (degrees)
  boundaryPoints: Array<{   // Circle boundary points (72 by default)
    latitude: number;
    longitude: number;
  }>;
}
```

---

### Types Reference

```typescript
interface KeplerianElements {
  semiMajorAxis: number;      // km
  eccentricity: number;       // 0-1 for elliptical
  inclination: number;        // degrees
  raan: number;               // Right Ascension of Ascending Node (degrees)
  argumentOfPerigee: number;  // degrees
  trueAnomaly: number;        // degrees
  meanAnomaly: number;        // degrees
  eccentricAnomaly: number;   // degrees
  period: number;             // minutes
  meanMotion: number;         // rev/day
  apogee: number;             // km above surface
  perigee: number;            // km above surface
  energy: number;             // km²/s² (specific orbital energy)
  angularMomentum: number;    // km²/s
}

interface SatellitePass {
  passNumber: number;
  riseTime: number;           // tsince (minutes)
  riseAzimuth: number;        // degrees
  maxElevationTime: number;
  maxElevation: number;       // degrees
  maxElevationAzimuth: number;
  setTime: number;
  setAzimuth: number;
  duration: number;           // minutes
  skyPath: SkyPoint[];        // Detailed path
  isGoodPass: boolean;        // maxEl >= 30°
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

interface DecayProfile {
  satnum: number;
  points: DecayPoint[];
  estimatedDecayDays: number | null;
  initialElements: KeplerianElements;
  finalElements: KeplerianElements | null;
  summary: {
    initialPerigee: number;
    finalPerigee: number;
    perigeeChangeRate: number;    // km/day
    isDecaying: boolean;
    lifetimeCategory: 'days' | 'weeks' | 'months' | 'years' | 'decades' | 'stable';
  };
}
```

---

### Reference

The propagation models are based on:
- **SPACETRACK REPORT NO. 3**: *Models for Propagation of NORAD Element Sets*, Felix R. Hoots & Ronald L. Roehrich, December 1980
- Available at: [celestrak.org](https://celestrak.org/NORAD/documentation/spacetrk.pdf)

---

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with verbose output
npm run test:verbose
```

### Coverage Report

The test suite provides coverage reports in multiple formats:
- **Terminal**: Summary displayed after running tests
- **HTML**: Open `coverage/lcov-report/index.html` for detailed interactive report
- **LCOV**: `coverage/lcov.info` for CI integration

Current coverage targets:
- Statements: 80%+
- Branches: 40%+
- Functions: 40%+
- Lines: 80%+

### Building

```bash
# Compile TypeScript to JavaScript
npm run build
```

---

## License

MIT

