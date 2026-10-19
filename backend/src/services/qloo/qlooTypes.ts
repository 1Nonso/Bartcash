// ============================================================================
// Shared types for the Qloo client (Phase 3 v3.0, Section 10.4).
// ============================================================================

/** Raised for programmer errors (bad arguments). Expected failures never throw. */
export class QlooUsageError extends Error {
   constructor(message: string) {
      super(message);
      this.name = 'QlooUsageError';
   }
}

/** Bartcash entity type -> Qloo type. `videogame`, NOT `video_game` (400). */
export const ENTITY_TYPE_MAP = {
   brand: 'urn:entity:brand',
   artist: 'urn:entity:artist',
   movie: 'urn:entity:movie',
   tv_show: 'urn:entity:tv_show',
   videogame: 'urn:entity:videogame',
   book: 'urn:entity:book',
   podcast: 'urn:entity:podcast',
} as const;

export type BartcashEntityType = keyof typeof ENTITY_TYPE_MAP;

export function toQlooType(type: string): string {
   if (!Object.prototype.hasOwnProperty.call(ENTITY_TYPE_MAP, type)) {
      throw new QlooUsageError(`Unknown entity type "${type}"`);
   }
   return ENTITY_TYPE_MAP[type as BartcashEntityType];
}

/**
 * interactive: a user is waiting (live taste search). Blocked only by the
 *              hard budget stop; waits at most 2 s for a throttle slot.
 * background:  jobs. Blocked from the soft budget stop; waits up to 30 s.
 */
export type QlooPurpose = 'interactive' | 'background';

export type QlooFailureReason =
   | 'disabled'
   | 'budget_soft'
   | 'budget_hard'
   | 'circuit_open'
   | 'throttled'
   | 'timeout'
   | 'http_error'
   | 'invalid_response';

export type QlooResult<T> =
   | { ok: true; data: T; cached: boolean }
   | { ok: false; reason: QlooFailureReason; status?: number };

/** Stored on item_tastes / user_taste_entities as { tag_id, name }. */
export interface QlooTag {
   tag_id: string;
   name: string;
}

export interface QlooSearchEntity {
   entity_id: string;
   name: string;
   types: string[];
   tags: QlooTag[];
   /** Best-effort; null when the response carries no usable image. */
   image_url: string | null;
}

export interface QlooInsightEntity {
   entity_id: string;
   name: string;
   tags: QlooTag[];
   /** query.affinity; present when filter.results.entities was sent. */
   affinity: number | null;
   popularity: number | null;
   /** Raw explainability payload when requested; shape not yet verified. */
   explain: unknown;
}

export interface QlooTagResult {
   tag_id: string;
   name: string;
   type: string | null;
   popularity: number | null;
}

// ---------------------------------------------------------------------------
// Injected dependencies (Prisma-backed in production, fakes in tests)
// ---------------------------------------------------------------------------
export interface CacheStore {
   /** Returns the stored value if present and not expired, else undefined. */
   get(key: string, nowMs: number): Promise<unknown | undefined>;
   set(key: string, endpoint: string, value: unknown, expiresAtMs: number): Promise<void>;
}

export interface UsageReading {
   remaining: number | null;
   limit: number | null;
   /** When the reading was last written. null if never. */
   updatedAtMs: number | null;
}

export interface UsageStore {
   read(): Promise<UsageReading>;
   /** Count one HTTP request and store the headers when present. */
   record(headers: { remaining: number | null; limit: number | null }): Promise<void>;
}

export interface QlooLogEntry {
   event: 'qloo_call';
   level: 'info' | 'warn' | 'error';
   endpoint: 'search' | 'insights' | 'tags';
   outcome: string;
   cacheHit: boolean;
   durationMs: number;
   status?: number;
   attempts?: number;
   /** Why the first attempt failed when a retry was made (timeout, http_error_503). */
   firstFailure?: string;
}
