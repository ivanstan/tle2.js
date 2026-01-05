// TLE API Client
// API Version: 1.4.0

// ============================================================================
// Types
// ============================================================================

export interface TleModel {
  "@context"?: string;
  "@id"?: string;
  "@type"?: string;
  satelliteId: number;
  name: string;
  date: string;
  line1: string;
  line2: string;
}

export interface Pagination {
  "@id"?: string;
  "@type"?: string;
  first?: string;
  previous?: string;
  next?: string;
  last?: string;
}

export interface TleCollection {
  "@context"?: string;
  "@id"?: string;
  "@type"?: string;
  totalItems: number;
  member: TleModel[];
  parameters?: Record<string, unknown>;
  view?: Pagination;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
  r: number;
  unit: string;
}

export interface Geodetic {
  latitude: number;
  longitude: number;
  altitude: number;
}

export interface PropagationVector {
  reference_frame: string;
  position: Vector3D;
  velocity: Vector3D;
}

export interface Propagation {
  "@context"?: string;
  "@id"?: string;
  "@type"?: string;
  tle: TleModel;
  algorithm: "SGP4" | "SDP4";
  vector: PropagationVector;
  geodetic: Geodetic;
  parameters: {
    date: string;
    satelliteId: string;
  };
}

export interface ApiException {
  response: {
    message: string;
  };
}

export type SortField =
  | "id"
  | "name"
  | "popularity"
  | "inclination"
  | "eccentricity"
  | "period";

export type SortDirection = "asc" | "desc";

export interface CollectionParams {
  search?: string;
  sort?: SortField;
  sortDir?: SortDirection;
  page?: number;
  pageSize?: number;
  eccentricityGte?: number;
  eccentricityLte?: number;
  inclinationLt?: number;
  inclinationGt?: number;
  periodLt?: number;
  periodGt?: number;
}

export interface PropagateParams {
  date?: string | Date;
}

// ============================================================================
// Cache
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class Cache {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Remove all expired entries */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// ============================================================================
// API Error
// ============================================================================

export class TleApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response?: ApiException
  ) {
    super(message);
    this.name = "TleApiError";
  }
}

// ============================================================================
// Client
// ============================================================================

export interface TleClientOptions {
  /** Base URL for the API (default: https://tle.ivanstanojevic.me) */
  baseUrl?: string;
  /** Cache TTL in milliseconds (default: 12 hours) */
  cacheTtl?: number;
  /** Disable caching entirely */
  disableCache?: boolean;
}

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const DEFAULT_BASE_URL = "https://tle.ivanstanojevic.me";

export class TleClient {
  private readonly baseUrl: string;
  private readonly cache: Cache | null;

  constructor(options: TleClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.cache = options.disableCache
      ? null
      : new Cache(options.cacheTtl ?? TWELVE_HOURS_MS);
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async request<T>(path: string, cacheKey?: string): Promise<T> {
    // Check cache first
    if (cacheKey && this.cache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url);

    if (!response.ok) {
      let apiError: ApiException | undefined;
      try {
        apiError = await response.json();
      } catch {
        // Response body might not be JSON
      }
      throw new TleApiError(
        apiError?.response?.message ?? `HTTP ${response.status}`,
        response.status,
        apiError
      );
    }

    const data: T = await response.json();

    // Store in cache
    if (cacheKey && this.cache) {
      this.cache.set(cacheKey, data);
    }

    return data;
  }

  private buildCollectionQuery(params: CollectionParams): string {
    const query = new URLSearchParams();

    if (params.search !== undefined) {
      query.set("search", params.search);
    }
    if (params.sort !== undefined) {
      query.set("sort", params.sort);
    }
    if (params.sortDir !== undefined) {
      query.set("sort-dir", params.sortDir);
    }
    if (params.page !== undefined) {
      query.set("page", String(params.page));
    }
    if (params.pageSize !== undefined) {
      query.set("page-size", String(params.pageSize));
    }
    if (params.eccentricityGte !== undefined) {
      query.set("eccentricity[gte]", String(params.eccentricityGte));
    }
    if (params.eccentricityLte !== undefined) {
      query.set("eccentricity[lte]", String(params.eccentricityLte));
    }
    if (params.inclinationLt !== undefined) {
      query.set("inclination[lt]", String(params.inclinationLt));
    }
    if (params.inclinationGt !== undefined) {
      query.set("inclination[gt]", String(params.inclinationGt));
    }
    if (params.periodLt !== undefined) {
      query.set("period[lt]", String(params.periodLt));
    }
    if (params.periodGt !== undefined) {
      query.set("period[gt]", String(params.periodGt));
    }

    const queryString = query.toString();
    return queryString ? `?${queryString}` : "";
  }

  // --------------------------------------------------------------------------
  // Public API methods
  // --------------------------------------------------------------------------

  /**
   * Fetch a collection of TLE records with optional filtering, sorting, and pagination.
   *
   * @example
   * ```ts
   * // Search for ISS
   * const results = await client.collection({ search: "ISS" });
   *
   * // Filter by eccentricity and sort by inclination
   * const results = await client.collection({
   *   eccentricityLte: 0.1,
   *   sort: "inclination",
   *   sortDir: "desc"
   * });
   * ```
   */
  async collection(params: CollectionParams = {}): Promise<TleCollection> {
    const query = this.buildCollectionQuery(params);
    const path = `/api/tle${query}`;
    return this.request<TleCollection>(path, `collection:${query}`);
  }

  /**
   * Fetch a single TLE record by satellite ID.
   *
   * @param id - The satellite NORAD catalog ID
   *
   * @example
   * ```ts
   * const iss = await client.record(25544);
   * console.log(iss.name); // "ISS (ZARYA)"
   * ```
   */
  async record(id: number): Promise<TleModel> {
    const path = `/api/tle/${id}`;
    return this.request<TleModel>(path, `record:${id}`);
  }

  /**
   * Propagate satellite position using SGP4/SDP4 algorithms.
   *
   * @param id - The satellite NORAD catalog ID
   * @param params - Optional parameters including target date
   *
   * @example
   * ```ts
   * // Get current position
   * const pos = await client.propagate(25544);
   *
   * // Get position at a specific time
   * const pos = await client.propagate(25544, {
   *   date: "2024-01-15T12:00:00Z"
   * });
   * ```
   */
  async propagate(id: number, params: PropagateParams = {}): Promise<Propagation> {
    const query = new URLSearchParams();

    if (params.date !== undefined) {
      const dateStr =
        params.date instanceof Date ? params.date.toISOString() : params.date;
      query.set("date", dateStr);
    }

    const queryString = query.toString();
    const path = `/api/tle/${id}/propagate${queryString ? `?${queryString}` : ""}`;

    // Use date in cache key for accurate caching
    const cacheKey = `propagate:${id}:${params.date ?? "now"}`;
    return this.request<Propagation>(path, cacheKey);
  }

  // --------------------------------------------------------------------------
  // Cache management
  // --------------------------------------------------------------------------

  /**
   * Clear all cached entries.
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Remove expired entries from the cache.
   */
  pruneCache(): void {
    this.cache?.prune();
  }

  /**
   * Get the current number of cached entries.
   */
  get cacheSize(): number {
    return this.cache?.size ?? 0;
  }
}

// ============================================================================
// Default export
// ============================================================================

export default TleClient;
