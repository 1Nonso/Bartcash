// ============================================================================
// PUT /items/{id}/wants tests (Phase 3 step 4). Pure, no database:
//
//   npx tsx src/scripts/wants-fixtures.ts
// ============================================================================
import assert from 'node:assert/strict';
import { buildWantRows, NOTE_MAX, wantsBodySchema } from '../services/wants.service';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const D = '44444444-4444-4444-8444-444444444444';

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);
const ok = (body: unknown) => wantsBodySchema.safeParse(body);
const fieldErrors = (body: unknown) => {
   const r = ok(body);
   assert.equal(r.success, false);
   return [...new Set(r.error!.issues.map((i) => String(i.path[0])))];
};

test('1 to 3 distinct UUIDs accepted; order kept', () => {
   const r = ok({ category_ids: [C, A, B] });
   assert.ok(r.success);
   assert.deepEqual(r.data.category_ids, [C, A, B]);
   assert.equal(r.data.note, undefined);
});

test('Empty, 4 ids, duplicates or a non-UUID -> category_ids error', () => {
   for (const category_ids of [[], [A, B, C, D], [A, A], ['abc'], undefined]) {
      assert.deepEqual(fieldErrors({ category_ids }), ['category_ids'], JSON.stringify(category_ids));
   }
});

test('Missing or non-array category_ids -> friendly message', () => {
   for (const body of [{}, { category_ids: 'abc' }]) {
      const r = ok(body);
      assert.equal(r.success, false);
      assert.equal(r.error!.issues[0]!.message, 'Choose at least one category.');
   }
});

test('note: omitted = unchanged, null = clear, trimmed, max 500', () => {
   assert.equal(ok({ category_ids: [A] }).data?.note, undefined);
   assert.equal(ok({ category_ids: [A], note: null }).data?.note, null);
   assert.equal(ok({ category_ids: [A], note: '  PS5 or cash  ' }).data?.note, 'PS5 or cash');
   assert.ok(ok({ category_ids: [A], note: 'x'.repeat(NOTE_MAX) }).success);
   assert.deepEqual(fieldErrors({ category_ids: [A], note: 'x'.repeat(NOTE_MAX + 1) }), ['note']);
   assert.deepEqual(fieldErrors({ category_ids: [A], note: 5 }), ['note']);
});

test('buildWantRows: rank by position, was_suggested from the shown five', () => {
   assert.deepEqual(buildWantRows([C, A], [A, B, D]), [
      { categoryId: C, rank: 1, wasSuggested: false },
      { categoryId: A, rank: 2, wasSuggested: true },
   ]);
   // Pending (nothing shown yet) -> none suggested.
   assert.ok(buildWantRows([A, B], []).every((r) => !r.wasSuggested));
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
