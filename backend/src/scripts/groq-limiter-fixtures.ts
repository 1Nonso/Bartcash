// ============================================================================
// Groq pacing tests (shared Groq limiter). Pure, fake clock:
//
//   npx tsx src/scripts/groq-limiter-fixtures.ts
// ============================================================================
import assert from 'node:assert/strict';
import {
   createGroqLimiter,
   GROQ_MAX_WAIT_MS,
   handle429,
   limitCode,
   RETRY_AFTER_CAP_MS,
   RETRY_AFTER_DEFAULT_MS,
   retryAfterMs,
} from '../services/groqLimiter';

const tests: [string, () => Promise<void> | void][] = [];
const test = (name: string, fn: () => Promise<void> | void) => tests.push([name, fn]);

/** Fake clock: sleeping moves time forward. */
function clock() {
   let t = 1_000_000;
   const waits: number[] = [];
   return {
      now: () => t,
      sleep: async (ms: number) => {
         waits.push(ms);
         t += ms;
      },
      waits,
   };
}

test('20 per minute -> one slot every 3 s, in order', async () => {
   const c = clock();
   const limiter = createGroqLimiter(20, c.now, c.sleep);
   for (let i = 0; i < 4; i++) assert.equal(await limiter.acquire(), true);
   assert.deepEqual(c.waits, [3000, 3000, 3000]);
});

test('Concurrent callers queue; the one past the max wait is paced out', async () => {
   const c = clock();
   // 1 per minute: the 2nd caller waits 60 s (allowed), the 3rd 120 s (refused).
   const limiter = createGroqLimiter(1, () => 1_000_000, c.sleep);
   const results = await Promise.all([limiter.acquire(), limiter.acquire(), limiter.acquire()]);
   assert.deepEqual(results, [true, true, false]);
   assert.deepEqual(c.waits, [GROQ_MAX_WAIT_MS]);
});

test('retryAfterMs: seconds, HTTP date, missing, junk', () => {
   assert.equal(retryAfterMs('7'), 7000);
   assert.equal(retryAfterMs('0'), 0);
   assert.equal(retryAfterMs(null), RETRY_AFTER_DEFAULT_MS);
   assert.equal(retryAfterMs('soon'), RETRY_AFTER_DEFAULT_MS);
   assert.equal(retryAfterMs('120'), 120_000);
   const now = Date.parse('2026-10-17T12:00:00Z');
   assert.equal(retryAfterMs('Sat, 17 Oct 2026 12:00:12 GMT', now), 12_000);
   assert.equal(retryAfterMs('Sat, 17 Oct 2026 11:59:00 GMT', now), 0);
});

test('limitCode reads the limit from Groq\'s message', () => {
   assert.equal(limitCode('Rate limit reached for model `m` in organization `org_x` on tokens per day (TPD): Limit 500000'), 'TPD');
   assert.equal(limitCode('... on requests per minute (RPM): Limit 30'), 'RPM');
   assert.equal(limitCode('... service tier `on_demand` on output tokens per minute (OTPM): Limit 1000'), 'OTPM');
   assert.equal(limitCode('Model is over capacity, try again'), 'capacity');
   assert.equal(limitCode('something else'), 'unknown');
});

test('handle429: short Retry-After -> wait; long (daily) -> null; logs no message', async () => {
   const logs: string[] = [];
   const warn = console.warn;
   console.warn = (m: string) => void logs.push(m);
   try {
      const res = (retry: string) =>
         new Response(JSON.stringify({ error: { message: 'Rate limit in organization `org_secret` on tokens per day (TPD)', type: 'tokens', code: 'rate limit org_secret' } }), {
            status: 429,
            headers: { 'retry-after': retry, 'x-ratelimit-remaining-requests': '0' },
         });
      assert.equal(await handle429(res('7'), 'json'), 7000);
      assert.equal(await handle429(res(String(RETRY_AFTER_CAP_MS / 1000 + 1)), 'json'), null);
   } finally {
      console.warn = warn;
   }
   assert.match(logs[0]!, /groq: 429 \(json\) limit=TPD type=tokens code=- retry-after=7 remaining-requests=0 remaining-tokens=-/);
   assert.ok(logs.every((l) => !l.includes('org_secret')), 'organisation never logged');
});

let failed = 0;
for (const [name, fn] of tests) {
   try {
      await fn();
      console.log(`PASS  ${name}`);
   } catch (err) {
      failed++;
      console.log(`FAIL  ${name}\n      ${(err as Error).message}`);
   }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed > 0 ? 1 : 0);
