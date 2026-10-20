// ============================================================================
// Valuation failure codes and messages. Pure, no database:
//
//   npx tsx src/scripts/valuation-failure-fixtures.ts
// ============================================================================
import assert from 'node:assert/strict';
import { valuationFailureCode, valuationFailureMessage } from '../utils/valuationFailure';

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

const GROQ_429 =
   'Groq API request failed: {"error":{"message":"Rate limit reached for model `x` in organization `org_ABC123` service tier `on_demand` on tokens per minute (TPM): Limit 6000. Upgrade to Dev Tier today at https://console.groq.com/settings/billing","type":"tokens","code":"rate_limit_exceeded"}}';

test('Raw errors map to codes', () => {
   const cases: [string, string][] = [
      [GROQ_429, 'rate_limited'],
      ['Groq rate limit reached (long Retry-After).', 'rate_limited'],
      ['Groq request paced out (rate limit queue full).', 'rate_limited'],
      ['Failed to fetch image for valuation: https://pub-x.r2.dev/a.jpg', 'image_unavailable'],
      ['No images available for valuation.', 'no_image'],
      ['Groq returned an empty response.', 'invalid_response'],
      ['Groq returned an unexpected format: blah', 'invalid_response'],
      ['Groq API request failed: <html>502 Bad Gateway</html>', 'ai_unavailable'],
      ['fetch failed', 'ai_unavailable'],
      ['queue_unavailable', 'ai_unavailable'],
      ['something odd', 'unknown'],
   ];
   for (const [raw, code] of cases) assert.equal(valuationFailureCode(raw), code, raw);
});

test('Stored codes pass through', () => {
   for (const c of ['rate_limited', 'ai_unavailable', 'image_unavailable', 'no_image', 'invalid_response', 'unknown']) {
      assert.equal(valuationFailureCode(c), c);
   }
});

test('Messages never carry raw text', () => {
   const m = valuationFailureMessage(GROQ_429)!;
   assert.equal(m, 'Our AI valuer was busy. Try again in a minute.');
   assert.ok(!/org_|groq|http/i.test(m));
   assert.equal(valuationFailureMessage(null), null);
   assert.equal(valuationFailureMessage(''), null);
});

let failed = 0;
for (const [name, fn] of tests) {
   try {
      fn();
      console.log(`PASS  ${name}`);
   } catch (err) {
      failed++;
      console.log(`FAIL  ${name}\n      ${(err as Error).message}`);
   }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed > 0 ? 1 : 0);
