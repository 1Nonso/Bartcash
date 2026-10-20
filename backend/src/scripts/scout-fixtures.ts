// ============================================================================
// Scout draft-offer tests (Phase 5). Pure, no database:
//
//   npx tsx src/scripts/scout-fixtures.ts
// ============================================================================
import assert from 'node:assert/strict';
import {
   computeTopUp,
   draftBodySchema,
   MESSAGE_MAX,
   messagePrompt,
   midValue,
   templateMessage,
   validateMessage,
} from '../services/scoutDraft.service';

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

test('Body: two uuids required', () => {
   assert.ok(draftBodySchema.safeParse({ source_item_id: A, target_item_id: B }).success);
   for (const bad of [{}, { source_item_id: A }, { source_item_id: 'abc', target_item_id: B }]) {
      assert.equal(draftBodySchema.safeParse(bad).success, false, JSON.stringify(bad));
   }
});

test('midValue: completed only, Decimal-like strings ok', () => {
   assert.equal(midValue({ status: 'completed', valueMin: '100.00', valueMax: '200.00' }), 150);
   assert.equal(midValue({ status: 'pending', valueMin: '100', valueMax: '200' }), null);
   assert.equal(midValue({ status: 'failed', valueMin: null, valueMax: null }), null);
   assert.equal(midValue(null), null);
});

test('Top-up: gap rounded up to next 5, never negative', () => {
   assert.deepEqual(computeTopUp(100, 141), {
      topUp: 45,
      note: 'Their item is valued about $41 more, so Scout added a $45 top-up.',
   });
   assert.equal(computeTopUp(100, 145).topUp, 45);
   assert.equal(computeTopUp(100, 100.5).topUp, 5);
   assert.deepEqual(computeTopUp(100, 100), { topUp: 0, note: 'The two items are close in value.' });
   // Yours worth > 10% more: suggest asking them instead.
   assert.deepEqual(computeTopUp(250, 200), {
      topUp: 0,
      note: 'Yours is valued about $50 more. You could ask them for a top-up instead.',
   });
   assert.equal(computeTopUp(205, 200).note, 'The two items are close in value.');
});

test('Top-up: missing valuation -> 0 with a note', () => {
   assert.deepEqual(computeTopUp(null, 300), {
      topUp: 0,
      note: "A valuation is missing, so Scout didn't suggest a top-up.",
   });
   assert.equal(computeTopUp(300, null).topUp, 0);
});

test('Template message (spec text, top-up sentence when > 0, capped)', () => {
   assert.equal(
      templateMessage('Ada', 'PS5', 'Galaxy A52', 0),
      'Hi Ada, I would like to swap my PS5 for your Galaxy A52. Would you be open to it?',
   );
   assert.ok(templateMessage('Ada', 'PS5', 'Galaxy A52', 45).endsWith(' I can add $45 to balance the values.'));
   assert.ok(templateMessage('Ada', 'x'.repeat(400), 'y'.repeat(400), 0).length <= MESSAGE_MAX);
});

test('validateMessage: 20-500 chars, no links, whitespace tidied', () => {
   assert.equal(validateMessage({ message: '  Hi Ada,  would you swap your phone for my PS5?  ' }), 'Hi Ada, would you swap your phone for my PS5?');
   for (const bad of [null, {}, { message: 12 }, { message: 'Too short' }, { message: 'x'.repeat(501) }, { message: 'Hi Ada, see https://example.com for details please' }]) {
      assert.equal(validateMessage(bad), null, JSON.stringify(bad)?.slice(0, 40));
   }
});

test('Prompt carries the facts and the format', () => {
   const p = messagePrompt({ name: 'Ada', offered: 'PS5', target: 'Galaxy A52', topUp: 45, theyWant: 'Electronics' });
   for (const part of ['"PS5"', '"Galaxy A52"', '"Ada"', '$45 in cash', 'would take items in "Electronics"', '{"message": string}']) {
      assert.ok(p.includes(part), part);
   }
   const plain = messagePrompt({ name: 'Ada', offered: 'a', target: 'b', topUp: 0, theyWant: null });
   assert.ok(!plain.includes('in cash to balance') && !plain.includes('would take items'));
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
