import { createHash } from 'node:crypto';
import type { QlooConfig } from '../../config/qloo.env';
import { decideBudget, parseRemainingHeader } from './qlooBudget';
import { CircuitBreaker } from './qlooBreaker';
import { Pacer } from './qlooPacer';
import { parseInsights, parseSearch, parseTags } from './qlooParsers';
import {
   QlooUsageError,
   toQlooType,
   type BartcashEntityType,
   type CacheStore,
   type QlooFailureReason,
   type QlooInsightEntity,
   type QlooLogEntry,
   type QlooPurpose,
   type QlooResult,
   type QlooSearchEntity,
   type QlooTagResult,
   type UsageStore,
} from './qlooTypes';

// ============================================================================
// Qloo client — Phase 3 v3.0, Section 10.4.
//
// Call order for every request:
//   disabled? -> cache -> budget guard -> circuit breaker -> pacer -> HTTP
// Cached reads therefore work even when the budget is exhausted or the
// circuit is open. Expected failures are returned, never thrown, so callers
// take their fallback. Only programmer errors (bad arguments) throw.
// ============================================================================

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 300;
const MAX_WAIT_MS: Record<QlooPurpose, number> = { interactive: 2_000, background: 30_000 };

const MAX_QUERY_LENGTH = 200;
const MAX_SIGNALS = 25;
const MAX_CANDIDATES = 50;
const DEFAULT_TAKE = 20;
const ENTITY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type QlooClientConfig = Pick<
   QlooConfig,
   'enabled' | 'baseUrl' | 'timeoutMs' | 'rps' | 'budgetSoftStop' | 'budgetHardStop' | 'apiKey'
>;

export interface QlooClientDeps {
   config: QlooClientConfig;
   cache: CacheStore;
   usage: UsageStore;
   fetchImpl?: typeof fetch;
   now?: () => number;
   sleep?: (ms: number) => Promise<void>;
   log?: (entry: QlooLogEntry) => void;
}

export interface CallOptions {
   /** Defaults to 'background' (the stricter budget rule). */
   purpose?: QlooPurpose;
}

export interface InsightsArgs extends CallOptions {
   filterType: BartcashEntityType;
   /** Entity ids the taste is built from (1 to 25). */
   signals: readonly string[];
   /** Restrict results to these entity ids (up to 50); results then carry affinity. */
   candidates?: readonly string[];
   take?: number;
   explain?: boolean;
}

type Endpoint = 'search' | 'insights' | 'tags';

interface Spec<T> {
   endpoint: Endpoint;
   path: string;
   params: Record<string, string>;
   ttlMs: number;
   purpose: QlooPurpose;
   parse: (body: unknown) => T | null;
}

type Attempt<T> =
   | { kind: 'ok'; data: T; status: number }
   | {
        kind: 'fail';
        reason: QlooFailureReason;
        status?: number;
        retryable: boolean;
        countsAsFailure: boolean;
     };

function defaultLog(e: QlooLogEntry): void {
   const line = JSON.stringify(e);
   if (e.level === 'error') console.error(line);
   else if (e.level === 'warn') console.warn(line);
   else console.log(line);
}

export function createQlooClient(deps: QlooClientDeps) {
   const cfg = deps.config;
   const now = deps.now ?? Date.now;
   const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
   const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
   const log = deps.log ?? defaultLog;
   const pacer = new Pacer(cfg.rps, now, sleep);
   const breaker = new CircuitBreaker();
   let lastProbeAt: number | null = null;

   // -- safe wrappers: a cache or usage-table outage must never break a call --
   async function cacheGet(key: string): Promise<unknown | undefined> {
      try {
         return await deps.cache.get(key, now());
      } catch {
         return undefined;
      }
   }
   async function cacheSet(key: string, endpoint: string, value: unknown, ttlMs: number) {
      try {
         await deps.cache.set(key, endpoint, value, now() + ttlMs);
      } catch {
         /* best effort */
      }
   }
   async function usageRead() {
      try {
         return await deps.usage.read();
      } catch {
         return { remaining: null, limit: null, updatedAtMs: null };
      }
   }
   async function usageRecord(res: Response) {
      try {
         await deps.usage.record({
            remaining: parseRemainingHeader(res.headers.get('x-month-ratelimit-remaining')),
            limit: parseRemainingHeader(res.headers.get('x-month-ratelimit-limit')),
         });
      } catch {
         /* best effort */
      }
   }

   function cacheKeyOf(endpoint: Endpoint, params: Record<string, string>): string {
      const canonical = Object.keys(params)
         .sort()
         .map((k) => `${k}=${params[k]}`)
         .join('&');
      return createHash('sha256').update(`${endpoint}|${canonical}`).digest('hex');
   }

   async function attempt<T>(spec: Spec<T>): Promise<Attempt<T>> {
      const url = `${cfg.baseUrl}${spec.path}?${new URLSearchParams(spec.params).toString()}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
      try {
         const res = await fetchImpl(url, {
            method: 'GET',
            headers: { 'X-Api-Key': cfg.apiKey ?? '', Accept: 'application/json' },
            signal: ctrl.signal,
         });
         await usageRecord(res);

         const status = res.status;
         if (status >= 500) {
            return { kind: 'fail', reason: 'http_error', status, retryable: true, countsAsFailure: true };
         }
         if (status === 429) {
            return { kind: 'fail', reason: 'http_error', status, retryable: false, countsAsFailure: true };
         }
         if (status < 200 || status >= 300) {
            // Other 4xx: our request was wrong (or the key is). Not a Qloo outage.
            return { kind: 'fail', reason: 'http_error', status, retryable: false, countsAsFailure: false };
         }

         let body: unknown;
         try {
            body = await res.json();
         } catch {
            // The timeout also covers reading the body. A slow download that gets
            // aborted is a timeout (retryable), not a malformed response.
            if (ctrl.signal.aborted) {
               return { kind: 'fail', reason: 'timeout', status, retryable: true, countsAsFailure: true };
            }
            return { kind: 'fail', reason: 'invalid_response', status, retryable: false, countsAsFailure: true };
         }
         const data = spec.parse(body);
         if (data === null) {
            return { kind: 'fail', reason: 'invalid_response', status, retryable: false, countsAsFailure: true };
         }
         return { kind: 'ok', data, status };
      } catch {
         const timedOut = ctrl.signal.aborted;
         return {
            kind: 'fail',
            reason: timedOut ? 'timeout' : 'http_error',
            retryable: true,
            countsAsFailure: true,
         };
      } finally {
         clearTimeout(timer);
      }
   }

   async function execute<T>(spec: Spec<T>): Promise<QlooResult<T>> {
      if (!cfg.enabled || !cfg.apiKey) return { ok: false, reason: 'disabled' };

      const started = now();
      let cacheHit = false;
      let status: number | undefined;
      let attempts: number | undefined;
      let firstFailure: string | undefined;

      const done = <R extends QlooResult<T>>(result: R, outcome: string): R => {
         const level: QlooLogEntry['level'] =
            status === 401 || status === 403 ? 'error' : result.ok || cacheHit ? 'info' : 'warn';
         const entry: QlooLogEntry = {
            event: 'qloo_call',
            level,
            endpoint: spec.endpoint,
            outcome,
            cacheHit,
            durationMs: now() - started,
         };
         if (status !== undefined) entry.status = status;
         if (attempts !== undefined) entry.attempts = attempts;
         if (firstFailure !== undefined) entry.firstFailure = firstFailure;
         log(entry);
         return result;
      };
      const fail = (reason: QlooFailureReason): QlooResult<T> =>
         done({ ok: false, reason, ...(status !== undefined ? { status } : {}) }, reason);

      // 1. cache
      const key = cacheKeyOf(spec.endpoint, spec.params);
      const hit = await cacheGet(key);
      if (Array.isArray(hit)) {
         cacheHit = true;
         return done({ ok: true, data: hit as T, cached: true }, 'cache_hit');
      }

      // 2. budget guard
      const usage = await usageRead();
      const verdict = decideBudget({
         remaining: usage.remaining,
         readingUpdatedAtMs: usage.updatedAtMs,
         nowMs: now(),
         purpose: spec.purpose,
         softStop: cfg.budgetSoftStop,
         hardStop: cfg.budgetHardStop,
         lastProbeAtMs: lastProbeAt,
      });
      if (!verdict.allowed) return fail(verdict.reason);

      // 3. breaker (peek) so we do not queue behind the pacer for nothing
      if (breaker.wouldRefuse(now())) return fail('circuit_open');

      // 4. pacer
      const maxWait = MAX_WAIT_MS[spec.purpose];
      if (!(await pacer.acquire(maxWait))) return fail('throttled');

      // 5. breaker (take the probe slot if half-open)
      if (!breaker.allow(now())) return fail('circuit_open');
      if (verdict.probe) lastProbeAt = now();

      // 6. HTTP, with one retry on timeout / network error / 5xx
      let result = await attempt(spec);
      attempts = 1;
      status = result.status;
      if (result.kind === 'fail' && result.retryable) {
         firstFailure =
            result.status !== undefined ? `${result.reason}_${result.status}` : result.reason;
         await sleep(RETRY_DELAY_MS);
         if (await pacer.acquire(maxWait)) {
            result = await attempt(spec);
            attempts = 2;
            status = result.status;
         }
      }

      if (result.kind === 'ok') {
         breaker.onSuccess();
         await cacheSet(key, spec.endpoint, result.data, spec.ttlMs);
         return done({ ok: true, data: result.data, cached: false }, 'ok');
      }
      if (result.countsAsFailure) breaker.onFailure(now());
      else breaker.onSuccess(); // a 4xx still means Qloo answered
      return fail(result.reason);
   }

   // --------------------------------------------------------------------------
   // Public API
   // --------------------------------------------------------------------------
   function cleanQuery(query: string): string {
      const q = query.trim().replace(/\s+/g, ' ');
      if (q.length === 0 || q.length > MAX_QUERY_LENGTH) {
         throw new QlooUsageError(`query must be 1 to ${MAX_QUERY_LENGTH} characters`);
      }
      return q;
   }

   function cleanIds(label: string, ids: readonly string[], max: number): string[] {
      const unique = [...new Set(ids)];
      if (unique.length > max) throw new QlooUsageError(`${label}: at most ${max} entity ids`);
      for (const id of unique) {
         if (!ENTITY_ID.test(id)) throw new QlooUsageError(`${label}: "${id}" is not an entity id`);
      }
      return unique;
   }

   return {
      /** GET /search — resolve text to entities of one type. */
      search(
         args: {
            query: string;
            /** One type, or several in one call (verified Oct 20: Qloo mixes them). */
            type: BartcashEntityType | readonly BartcashEntityType[];
            /** Results to return; Qloo's default when omitted. */
            take?: number;
         } & CallOptions,
      ): Promise<QlooResult<QlooSearchEntity[]>> {
         const types = (Array.isArray(args.type) ? args.type : [args.type]) as BartcashEntityType[];
         if (types.length === 0) throw new QlooUsageError('search needs at least one type');
         if (args.take !== undefined && (!Number.isInteger(args.take) || args.take < 1 || args.take > MAX_CANDIDATES)) {
            throw new QlooUsageError(`take must be an integer from 1 to ${MAX_CANDIDATES}`);
         }
         return execute({
            endpoint: 'search',
            path: '/search',
            params: {
               query: cleanQuery(args.query),
               types: types.map(toQlooType).join(','),
               ...(args.take !== undefined ? { take: String(args.take) } : {}),
            },
            ttlMs: WEEK_MS,
            purpose: args.purpose ?? 'background',
            parse: parseSearch,
         });
      },

      /** GET /v2/insights — related entities for a set of signal entities. */
      /**
       * GET /v2/insights with a type and no signals: that type's most popular
       * entities. Qloo answers 400 without some filter, so a location is
       * sent (verified Oct 20: Lagos works; the results are global anyway).
       * Cached a day like other insights.
       */
      popular(
         args: { filterType: BartcashEntityType; take?: number; location?: string } & CallOptions,
      ): Promise<QlooResult<QlooInsightEntity[]>> {
         const take = args.take ?? DEFAULT_TAKE;
         if (!Number.isInteger(take) || take < 1 || take > MAX_CANDIDATES) {
            throw new QlooUsageError(`take must be an integer from 1 to ${MAX_CANDIDATES}`);
         }
         return execute({
            endpoint: 'insights',
            path: '/v2/insights',
            params: {
               take: String(take),
               'filter.type': toQlooType(args.filterType),
               'filter.location.query': args.location ?? 'Lagos',
            },
            ttlMs: DAY_MS,
            purpose: args.purpose ?? 'background',
            parse: parseInsights,
         });
      },

      insights(args: InsightsArgs): Promise<QlooResult<QlooInsightEntity[]>> {
         const signals = cleanIds('signals', args.signals, MAX_SIGNALS);
         if (signals.length === 0) throw new QlooUsageError('insights needs at least one signal');
         const candidates = cleanIds('candidates', args.candidates ?? [], MAX_CANDIDATES);

         const defaultTake = candidates.length > 0 ? candidates.length : DEFAULT_TAKE;
         const take = args.take ?? defaultTake;
         if (!Number.isInteger(take) || take < 1 || take > MAX_CANDIDATES) {
            throw new QlooUsageError(`take must be an integer from 1 to ${MAX_CANDIDATES}`);
         }

         const params: Record<string, string> = {
            take: String(take),
            'filter.type': toQlooType(args.filterType),
            'signal.interests.entities': signals.join(','),
         };
         if (candidates.length > 0) params['filter.results.entities'] = candidates.join(',');
         if (args.explain) params['feature.explainability'] = 'true';

         return execute({
            endpoint: 'insights',
            path: '/v2/insights',
            params,
            ttlMs: DAY_MS,
            purpose: args.purpose ?? 'background',
            parse: parseInsights,
         });
      },

      /** GET /v2/tags — find tags by text. */
      tags(args: { query: string } & CallOptions): Promise<QlooResult<QlooTagResult[]>> {
         return execute({
            endpoint: 'tags',
            path: '/v2/tags',
            params: { 'filter.query': cleanQuery(args.query) },
            ttlMs: WEEK_MS,
            purpose: args.purpose ?? 'background',
            parse: parseTags,
         });
      },
   };
}

export type QlooClient = ReturnType<typeof createQlooClient>;
