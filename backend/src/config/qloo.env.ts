// ============================================================================
// Qloo + matching settings — Phase 3 v3.0, Section 10.11.
// Pure parser: takes a plain object so it can be tested without process.env.
// The live config is built in qloo.config.ts.
// ============================================================================

export interface MatchWeights {
   wants: number;
   taste: number;
   reciprocal: number;
   owner: number;
}

export interface QlooConfig {
   enabled: boolean;
   /** True when a key is configured. Safe to log. */
   hasApiKey: boolean;
   baseUrl: string;
   timeoutMs: number;
   /** Requests per second for THIS process (worker 3, API 1 in production). */
   rps: number;
   budgetSoftStop: number;
   budgetHardStop: number;
   matchWeights: MatchWeights;
   matchStaleHours: number;
   /**
    * The API key. Non-enumerable on purpose, so console.log / JSON.stringify
    * of the config never includes it. Read it only when building the request.
    */
   readonly apiKey: string | undefined;
}

type Env = Record<
   string,
   string | undefined
>;

const DEFAULT_BASE_URL =
   'https://hackathon.api.qloo.com';
const DEFAULT_WEIGHTS =
   'wants=0.40,taste=0.30,reciprocal=0.20,owner=0.10';
const WEIGHT_KEYS: (keyof MatchWeights)[] =
   [
      'wants',
      'taste',
      'reciprocal',
      'owner',
   ];

function blank(
   v: string | undefined,
): boolean {
   return (
      v === undefined || v.trim() === ''
   );
}

export function parseQlooEnv(
   env: Env,
): QlooConfig {
   const problems: string[] = [];

   const bool = (
      name: string,
      fallback: boolean,
   ): boolean => {
      const raw = env[name];
      if (blank(raw)) return fallback;
      const v = raw!
         .trim()
         .toLowerCase();
      if (v === 'true') return true;
      if (v === 'false') return false;
      problems.push(
         `${name} must be "true" or "false"`,
      );
      return fallback;
   };

   const int = (
      name: string,
      fallback: number,
      min: number,
   ): number => {
      const raw = env[name];
      if (blank(raw)) return fallback;
      const n = Number(raw!.trim());
      if (
         !Number.isInteger(n) ||
         n < min
      ) {
         problems.push(
            `${name} must be an integer >= ${min}`,
         );
         return fallback;
      }
      return n;
   };

   const enabled = bool(
      'QLOO_ENABLED',
      false,
   );

   const apiKey = blank(
      env.QLOO_API_KEY,
   )
      ? undefined
      : env.QLOO_API_KEY!.trim();
   if (
      enabled &&
      apiKey === undefined
   ) {
      problems.push(
         'QLOO_API_KEY is required when QLOO_ENABLED=true',
      );
   }

   let baseUrl = DEFAULT_BASE_URL;
   if (!blank(env.QLOO_BASE_URL)) {
      const raw =
         env.QLOO_BASE_URL!.trim();
      try {
         const u = new URL(raw);
         if (
            u.protocol !== 'https:' &&
            u.protocol !== 'http:'
         )
            throw new Error();
         baseUrl = raw.replace(
            /\/+$/,
            '',
         );
      } catch {
         problems.push(
            'QLOO_BASE_URL must be a valid http(s) URL',
         );
      }
   }

   const timeoutMs = int(
      'QLOO_TIMEOUT_MS',
      4000,
      1,
   );
   const rps = int('QLOO_RPS', 4, 1);
   const budgetSoftStop = int(
      'QLOO_BUDGET_SOFT_STOP',
      1000,
      0,
   );
   const budgetHardStop = int(
      'QLOO_BUDGET_HARD_STOP',
      200,
      0,
   );
   if (
      budgetHardStop >= budgetSoftStop
   ) {
      problems.push(
         'QLOO_BUDGET_HARD_STOP must be lower than QLOO_BUDGET_SOFT_STOP',
      );
   }

   const matchStaleHours = int(
      'MATCH_STALE_HOURS',
      24,
      1,
   );
   const matchWeights = parseWeights(
      blank(env.MATCH_WEIGHTS)
         ? DEFAULT_WEIGHTS
         : env.MATCH_WEIGHTS!,
      problems,
   );

   if (problems.length > 0) {
      throw new Error(
         `Invalid Qloo configuration:\n - ${problems.join('\n - ')}`,
      );
   }

   const config = {
      enabled,
      hasApiKey: apiKey !== undefined,
      baseUrl,
      timeoutMs,
      rps,
      budgetSoftStop,
      budgetHardStop,
      matchWeights,
      matchStaleHours,
   } as QlooConfig;

   Object.defineProperty(
      config,
      'apiKey',
      {
         value: apiKey,
         enumerable: false,
         writable: false,
      },
   );

   return config;
}

function parseWeights(
   raw: string,
   problems: string[],
): MatchWeights {
   const out: Partial<MatchWeights> =
      {};
   const seen = new Set<string>();

   for (const part of raw.split(',')) {
      const [k, v, ...extra] = part
         .split('=')
         .map((s) => s.trim());
      if (
         !k ||
         v === undefined ||
         v === '' ||
         extra.length > 0
      ) {
         problems.push(
            `MATCH_WEIGHTS entry "${part.trim()}" must look like key=number`,
         );
         continue;
      }
      if (
         !(
            WEIGHT_KEYS as string[]
         ).includes(k)
      ) {
         problems.push(
            `MATCH_WEIGHTS has unknown key "${k}"`,
         );
         continue;
      }
      if (seen.has(k)) {
         problems.push(
            `MATCH_WEIGHTS repeats key "${k}"`,
         );
         continue;
      }
      seen.add(k);
      const n = Number(v);
      if (
         !Number.isFinite(n) ||
         n < 0
      ) {
         problems.push(
            `MATCH_WEIGHTS "${k}" must be a number >= 0`,
         );
         continue;
      }
      out[k as keyof MatchWeights] = n;
   }

   for (const k of WEIGHT_KEYS) {
      if (!seen.has(k))
         problems.push(
            `MATCH_WEIGHTS is missing "${k}"`,
         );
   }

   const total = WEIGHT_KEYS.reduce(
      (s, k) => s + (out[k] ?? 0),
      0,
   );
   if (
      seen.size ===
         WEIGHT_KEYS.length &&
      total <= 0
   ) {
      problems.push(
         'MATCH_WEIGHTS must have at least one weight above 0',
      );
   }

   return {
      wants: out.wants ?? 0,
      taste: out.taste ?? 0,
      reciprocal: out.reciprocal ?? 0,
      owner: out.owner ?? 0,
   };
}
