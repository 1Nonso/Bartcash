// ============================================================================
// GET /items/{id}/want-suggestions response tests (Phase 3 step 3). Pure,
// no database:
//
//   npx tsx src/scripts/want-suggestions-fixtures.ts
// ============================================================================
import assert from 'node:assert/strict';
import {
   buildSuggestions,
   PENDING_WINDOW_MS,
   type CategoryRef,
   type TasteRow,
} from '../services/wantSuggestions.service';

const SLUGS = ['electronics', 'fashion-apparel', 'home-furniture', 'books-stationery', 'sports-fitness', 'kids-baby', 'vehicles-parts', 'services', 'other'];
const CATS: CategoryRef[] = SLUGS.map((slug) => ({ id: `cat-${slug}`, name: slug, slug, icon: null }));
const NOW = Date.parse('2026-10-17T12:00:00Z');
const ctx = (over: Partial<Parameters<typeof buildSuggestions>[1]> = {}) => ({
   categories: CATS,
   fallbackOrder: CATS.map((c) => c.id),
   pickedCategoryIds: [],
   nowMs: NOW,
   ...over,
});
const row = (over: Partial<TasteRow>): TasteRow => ({
   status: 'resolved',
   wantSuggestions: null,
   suggestionSource: 'qloo',
   updatedAt: new Date(NOW - 60_000),
   ...over,
});
const stored = (ids: string[], reasons: (string | null)[] = []) =>
   ids.map((id, i) => ({ category_id: `cat-${id}`, rank: i + 1, reason: reasons[i] ?? null }));
const ids = (d: ReturnType<typeof buildSuggestions>) => d.suggestions.map((s) => s.category.slug);

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

test('No row -> pending, empty, retry 2000', () => {
   const d = buildSuggestions(null, ctx({ pickedCategoryIds: ['cat-electronics'] }));
   assert.equal(d.status, 'pending');
   assert.equal(d.source, null);
   assert.deepEqual(d.suggestions, []);
   assert.equal(d.retry_after_ms, 2000);
   assert.equal(d.max_picks, 3);
   assert.deepEqual(d.picked_category_ids, ['cat-electronics']);
});

test('Pending under 20 s -> pending; at 20 s -> fallback', () => {
   const young = buildSuggestions(row({ status: 'pending', updatedAt: new Date(NOW - PENDING_WINDOW_MS + 1) }), ctx());
   assert.equal(young.status, 'pending');
   const old = buildSuggestions(row({ status: 'pending', updatedAt: new Date(NOW - PENDING_WINDOW_MS) }), ctx());
   assert.equal(old.status, 'fallback');
   assert.equal(old.source, 'fallback');
   assert.equal(old.suggestions.length, 5);
   assert.equal(old.retry_after_ms, null);
});

test('Resolved -> ready, stored order and reasons, joined to CategoryRef', () => {
   const d = buildSuggestions(
      row({ wantSuggestions: stored(['sports-fitness', 'fashion-apparel', 'electronics', 'books-stationery', 'home-furniture'], ['Fans of Nike also like Real Madrid CF', 'Fans of Nike also like Air Jordan']) }),
      ctx(),
   );
   assert.equal(d.status, 'ready');
   assert.equal(d.source, 'qloo');
   assert.deepEqual(ids(d), ['sports-fitness', 'fashion-apparel', 'electronics', 'books-stationery', 'home-furniture']);
   assert.deepEqual(d.suggestions.map((s) => s.rank), [1, 2, 3, 4, 5]);
   assert.equal(d.suggestions[0]!.reason, 'Fans of Nike also like Real Madrid CF');
   assert.equal(d.suggestions[2]!.reason, null);
   assert.deepEqual(d.suggestions[0]!.category, { id: 'cat-sports-fitness', name: 'sports-fitness', slug: 'sports-fitness', icon: null });
});

test('Resolved with source fallback (nothing mapped) -> ready, source fallback', () => {
   const d = buildSuggestions(row({ suggestionSource: 'fallback', wantSuggestions: stored(SLUGS.slice(0, 5)) }), ctx());
   assert.equal(d.status, 'ready');
   assert.equal(d.source, 'fallback');
});

test('Stored category now inactive -> dropped and refilled to five, ranks renumbered', () => {
   const activeCats = CATS.filter((c) => c.slug !== 'fashion-apparel');
   const d = buildSuggestions(
      row({ wantSuggestions: stored(['sports-fitness', 'fashion-apparel', 'electronics', 'books-stationery', 'home-furniture'], ['r1', 'r2']) }),
      ctx({ categories: activeCats, fallbackOrder: activeCats.map((c) => c.id) }),
   );
   assert.deepEqual(ids(d), ['sports-fitness', 'electronics', 'books-stationery', 'home-furniture', 'kids-baby']);
   assert.deepEqual(d.suggestions.map((s) => s.rank), [1, 2, 3, 4, 5]);
   assert.equal(d.suggestions[4]!.reason, null);
});

test('Unresolved or failed -> fresh fallback in fallback order, reasons null', () => {
   for (const status of ['unresolved', 'failed']) {
      const d = buildSuggestions(
         row({ status, suggestionSource: 'fallback', wantSuggestions: stored(['vehicles-parts']) }),
         ctx({ fallbackOrder: ['cat-books-stationery', 'cat-electronics', 'cat-other', 'cat-kids-baby', 'cat-services', 'cat-home-furniture'] }),
      );
      assert.equal(d.status, 'fallback');
      assert.deepEqual(ids(d), ['books-stationery', 'electronics', 'other', 'kids-baby', 'services']);
      assert.ok(d.suggestions.every((s) => s.reason === null));
   }
});

test('Malformed stored JSON -> ready, filled from fallback', () => {
   const d = buildSuggestions(row({ wantSuggestions: [{ nope: 1 }, 'x', { category_id: 'cat-electronics', rank: 1, reason: 7 }] }), ctx());
   assert.equal(d.suggestions.length, 5);
   assert.equal(d.suggestions[0]!.category.slug, 'electronics');
   assert.equal(d.suggestions[0]!.reason, null);
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
