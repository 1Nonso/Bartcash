// ============================================================================
// Item-taste job tests (Phase 3 step 2). Fixtures only, no live Qloo or Groq:
// brands, tags and affinities come from docs/qloo-spike-2-results.json.
//
//   npx tsx src/scripts/item-taste-fixtures.ts
// ============================================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
   GroqRetryableError,
   RELATED_TAKE,
   QlooFatalError,
   QlooRetryableError,
   resolveTaste,
   validateExtraction,
   validateMappings,
   type TasteCategory,
   type TasteContext,
   type TasteDeps,
   type TasteItem,
   type TasteOutcome,
} from '../services/itemTasteJob.service';
import { createGroqJson, DEFAULT_MAX_TOKENS, isGroqTransient, type GroqFailReason, type GroqJsonFn } from '../services/groqJson';
import type { GroqLimiter } from '../services/groqLimiter';

/** No pacing or waiting in tests. */
const FREE: GroqLimiter = { acquire: async () => true, sleep: async () => {} };
import { mapTagsToCategory } from '../services/qloo/categoryMapper.service';
import { shouldGiveUp } from '../queue/itemTaste.worker';
import type {
   QlooInsightEntity,
   QlooResult,
   QlooSearchEntity,
} from '../services/qloo/qlooTypes';

// -- fixtures ----------------------------------------------------------------
const spike = JSON.parse(
   readFileSync(new URL('../../../docs/qloo-spike-2-results.json', import.meta.url), 'utf8'),
) as {
   taxonomy: { query: string; resolvedAs: string | null; roots: string[]; deepest: string[] }[];
   affinity: Record<string, { rows: { name: string; affinity: number }[] }>;
};

const idOf = (name: string) => {
   let h = 0;
   for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
   return `00000000-0000-4000-8000-${h.toString(16).padStart(12, '0')}`;
};

interface Brand {
   entity_id: string;
   name: string;
   tagIds: string[];
}
const BRANDS = new Map<string, Brand>(); // key: lower-case query
for (const t of spike.taxonomy) {
   if (!t.resolvedAs) continue;
   const tagIds = [...new Set([...t.deepest, ...t.roots.map((r) => `urn:tag:genre:brand:${r}`)])];
   BRANDS.set(t.query.toLowerCase(), { entity_id: idOf(t.resolvedAs), name: t.resolvedAs, tagIds });
}
// Spike 1: IKEA's related brands include "Next" (retail only).
BRANDS.set('next', { entity_id: idOf('Next'), name: 'Next', tagIds: ['urn:tag:genre:brand:retail'] });

const AFFINITY = new Map<string, number>();
for (const set of Object.values(spike.affinity))
   for (const r of set.rows) if (!AFFINITY.has(r.name)) AFFINITY.set(r.name, r.affinity);

const brand = (q: string): Brand => {
   const b = BRANDS.get(q.toLowerCase());
   if (!b) throw new Error(`no fixture brand ${q}`);
   return b;
};

const CATEGORIES: TasteCategory[] = [
   ['electronics', 'Electronics, Phones & Appliances'],
   ['fashion-apparel', 'Fashion & Beauty'],
   ['home-furniture', 'Home & Furniture'],
   ['vehicles-parts', 'Vehicles, Parts & Tools'],
   ['sports-fitness', 'Sports & Fitness'],
   ['books-stationery', 'Books & Stationery'],
   ['kids-baby', 'Kids & Baby'],
   ['services', 'Services'],
   ['other', 'Other'],
].map(([slug, name]) => ({ id: `cat-${slug}`, slug: slug!, name: name! }));
const CTX: TasteContext = {
   categories: CATEGORIES,
   fallbackOrder: ['other', 'electronics', 'fashion-apparel', 'home-furniture', 'books-stationery', 'kids-baby', 'services', 'sports-fitness', 'vehicles-parts'].map((s) => `cat-${s}`),
};
const cat = (slug: string) => `cat-${slug}`;

// -- fakes -------------------------------------------------------------------
interface Scenario {
   /** What Groq's brand extraction returns (raw, before validation). null = invalid JSON. */
   extraction: unknown;
   /** Brand extraction call fails with this reason instead. */
   groqFail?: GroqFailReason;
   /** Related brands (fixture queries) for the resolved entity. */
   related?: string[];
   /** Drop affinity so positional weights are used. */
   noAffinity?: boolean;
   /** Groq answer for the mapping batch: entity name -> slug. */
   groqMap?: Record<string, string | null>;
   qlooFail?: QlooResult<never>;
}

function makeDeps(s: Scenario) {
   const calls = { search: [] as string[], insights: 0, take: [] as (number | undefined)[], groqBrand: 0, groqMapBatches: [] as string[][] };

   const qloo: TasteDeps['qloo'] = {
      async search({ query }) {
         calls.search.push(query);
         if (s.qlooFail) return s.qlooFail;
         const b = BRANDS.get(query.toLowerCase());
         const data: QlooSearchEntity[] = b
            ? [{ entity_id: b.entity_id, name: b.name, types: ['urn:entity:brand'], tags: b.tagIds.map((tag_id) => ({ tag_id, name: tag_id })), image_url: null }]
            : [];
         return { ok: true, data, cached: false };
      },
      async insights({ take }) {
         calls.insights++;
         calls.take.push(take);
         if (s.qlooFail) return s.qlooFail;
         const data: QlooInsightEntity[] = (s.related ?? []).map((q) => {
            const b = brand(q);
            return {
               entity_id: b.entity_id,
               name: b.name,
               tags: b.tagIds.map((tag_id) => ({ tag_id, name: tag_id })),
               affinity: s.noAffinity ? null : (AFFINITY.get(b.name) ?? null),
               popularity: null,
               explain: null,
            };
         });
         return { ok: true, data, cached: false };
      },
   };

   const groq: GroqJsonFn = async (prompt, validate) => {
      if (prompt.includes('extract the brand')) {
         calls.groqBrand++;
         if (s.groqFail) return { ok: false, reason: s.groqFail };
         const v = s.extraction === null ? null : validate(s.extraction);
         return v === null ? { ok: false, reason: 'invalid_json' } : { ok: true, value: v };
      }
      const sent = JSON.parse(prompt.match(/Brands: (\[.*?\])\./)![1]!) as { n: number; name: string }[];
      calls.groqMapBatches.push(sent.map((b) => b.name));
      if (!s.groqMap) return { ok: false, reason: 'http_503' }; // Groq down
      const mappings: Record<string, string> = {};
      for (const b of sent) if (s.groqMap[b.name]) mappings[String(b.n)] = s.groqMap[b.name]!;
      const v = validate({ mappings });
      return v === null ? { ok: false, reason: 'invalid_json' } : { ok: true, value: v };
   };

   return { deps: { qloo, groq }, calls };
}

// Own category defaults to Other, which is never pinned first.
const ITEM = (title: string, isService = false, own = 'other'): TasteItem => ({
   title,
   description: `${title}, used, works fine.`,
   isService,
   categoryId: `cat-${own}`,
});

function checkShape(o: TasteOutcome) {
   assert.equal(o.suggestions.length, 5, 'exactly five suggestions');
   assert.deepEqual(o.suggestions.map((s) => s.rank), [1, 2, 3, 4, 5]);
   assert.equal(new Set(o.suggestions.map((s) => s.category_id)).size, 5, 'no duplicates');
   for (const s of o.suggestions) assert.ok(s.reason === null || s.reason.length <= 140);
}
const ids = (o: TasteOutcome) => o.suggestions.map((s) => s.category_id);
const qlooIds = (o: TasteOutcome) => o.suggestions.filter((s) => s.reason !== null).map((s) => s.category_id);

// -- tests -------------------------------------------------------------------
const tests: [string, () => Promise<void>][] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);

test('Samsung -> electronics first, reasons templated', async () => {
   const { deps, calls } = makeDeps({
      extraction: { brand: 'Samsung', product: 'Galaxy S21', confidence: 0.95 },
      related: ['Apple', 'Sony', 'LG', 'HP', 'Dell', 'JBL', 'Nike', 'Zara'],
   });
   const o = await resolveTaste(ITEM('Samsung Galaxy S21'), CTX, deps);
   checkShape(o);
   assert.equal(o.status, 'resolved');
   assert.equal(o.suggestionSource, 'qloo');
   assert.equal(o.entity?.name, 'Samsung');
   assert.equal(o.resolutionSource, 'brand_extracted');
   assert.equal(ids(o)[0], cat('electronics'));
   assert.match(o.suggestions[0]!.reason!, /^Fans of Samsung also like /);
   assert.deepEqual(calls.search, ['Samsung'], 'brand hit: product not searched');
   assert.equal(calls.insights, 1);
   assert.deepEqual(calls.take, [RELATED_TAKE]);
   assert.equal(o.related?.length, 8);
   assert.ok(o.tags && o.tags.length > 0, 'entity tags kept from search');
});

test('Nike -> fashion-apparel first', async () => {
   const { deps } = makeDeps({
      extraction: { brand: 'Nike', product: 'Air Max 90', confidence: 0.9 },
      related: ['Adidas', 'Puma', 'Zara', 'Under Armour', 'Gucci', 'Casio', 'PlayStation'],
   });
   const o = await resolveTaste(ITEM('Nike Air Max 90'), CTX, deps);
   checkShape(o);
   assert.equal(ids(o)[0], cat('fashion-apparel'));
   assert.ok(!qlooIds(o).includes(cat('electronics')), 'PlayStation alone is below MIN_SUPPORT');
});

test('Nintendo tags (video_game_developer only) -> electronics, no Groq', async () => {
   assert.deepEqual(mapTagsToCategory(brand('Nintendo').tagIds), { status: 'mapped', slug: 'electronics' });
   const { deps, calls } = makeDeps({
      extraction: { brand: 'PlayStation', product: 'PS5', confidence: 0.9 },
      related: ['Nintendo', 'Xbox'],
   });
   const o = await resolveTaste(ITEM('PS5 console'), CTX, deps);
   checkShape(o);
   assert.deepEqual(qlooIds(o), [cat('electronics')]);
   assert.equal(calls.groqMapBatches.length, 0);
});

test('Sony (mixed tags) -> electronics', async () => {
   assert.deepEqual(mapTagsToCategory(brand('Sony').tagIds), { status: 'mapped', slug: 'electronics' });
   const { deps } = makeDeps({
      extraction: { brand: 'Sony', product: 'WH-1000XM4', confidence: 0.9 },
      related: ['Samsung', 'Sony', 'Canon', 'Nike'],
   });
   const o = await resolveTaste(ITEM('Sony WH-1000XM4 headphones'), CTX, deps);
   assert.equal(ids(o)[0], cat('electronics'));
});

test('Penguin Random House -> books-stationery', async () => {
   assert.deepEqual(mapTagsToCategory(brand('Penguin Random House').tagIds), { status: 'mapped', slug: 'books-stationery' });
   const { deps } = makeDeps({
      extraction: { brand: 'Penguin Random House', product: null, confidence: 0.8 },
      related: ['Penguin Random House', 'Casio'],
   });
   // One book brand is below MIN_SUPPORT; the own category is still first.
   const o = await resolveTaste(ITEM('Penguin Classics box set', false, 'books-stationery'), CTX, deps);
   checkShape(o);
   assert.equal(ids(o)[0], cat('books-stationery'));
   assert.equal(o.suggestions[0]!.reason, null);
});

test('Wilson (fashion:athletic) -> sports-fitness', async () => {
   assert.deepEqual(mapTagsToCategory(brand('Wilson').tagIds), { status: 'mapped', slug: 'sports-fitness' });
   const { deps } = makeDeps({
      extraction: { brand: 'Wilson', product: 'tennis racket', confidence: 0.9 },
      related: ['Decathlon', 'Wilson', 'Nike'],
   });
   const o = await resolveTaste(ITEM('Wilson tennis racket'), CTX, deps);
   assert.equal(ids(o)[0], cat('sports-fitness'));
});

test('IKEA: retail-only brands confirmed by one Groq batch -> home-furniture', async () => {
   assert.deepEqual(mapTagsToCategory(brand('IKEA').tagIds), { status: 'weak', slug: 'home-furniture' });
   const { deps, calls } = makeDeps({
      extraction: { brand: 'IKEA', product: 'Malm bed frame', confidence: 0.9 },
      related: ['Next', 'Ashley Furniture', 'Zara'],
      groqMap: { Next: 'fashion-apparel', 'Ashley Furniture Homestores': 'home-furniture' },
   });
   const o = await resolveTaste(ITEM('IKEA Malm bed frame'), CTX, deps);
   checkShape(o);
   assert.deepEqual(calls.groqMapBatches, [['Next', 'Ashley Furniture Homestores']]);
   // Next (Groq) + Zara (tags) back fashion; Ashley alone does not back home.
   assert.deepEqual(qlooIds(o), [cat('fashion-apparel')]);
});

test('IKEA with Groq down: weak-only brands dropped, tags only', async () => {
   const { deps } = makeDeps({
      extraction: { brand: 'IKEA', product: null, confidence: 0.9 },
      related: ['Next', 'Ashley Furniture', 'Zara'],
   });
   // Groq busy on mapping: retry (throw) on a normal attempt...
   const e = await resolveTaste(ITEM('IKEA shelf'), CTX, deps).catch((x) => x);
   assert.ok(e instanceof GroqRetryableError);
   assert.equal(e.message, 'groq_http_503');
   // ...tags only on the last one.
   const o = await resolveTaste(ITEM('IKEA shelf'), CTX, deps, { lastAttempt: true });
   checkShape(o);
   // Only Zara maps by tags: below MIN_SUPPORT, so nothing is Qloo-backed.
   assert.equal(o.status, 'resolved');
   assert.deepEqual(qlooIds(o), []);
   assert.equal(o.suggestionSource, 'fallback');
   assert.equal(o.groqNote, 'groq_http_503');
});

test('No tags (Infinix, LEGO, Herman Miller) -> one Groq batch; services/other discarded', async () => {
   const { deps, calls } = makeDeps({
      extraction: { brand: 'Tecno', product: 'Camon 20', confidence: 0.9 },
      related: ['Infinix', 'LEGO', 'Herman Miller', 'Samsung'],
      groqMap: { 'Infinix Mobile': 'electronics', 'The Lego Group': 'kids-baby', 'Herman Miller': 'services' },
   });
   const o = await resolveTaste(ITEM('Tecno Camon 20'), CTX, deps);
   checkShape(o);
   assert.equal(calls.groqMapBatches.length, 1);
   assert.deepEqual(calls.groqMapBatches[0], ['Infinix Mobile', 'The Lego Group', 'Herman Miller']);
   // Infinix + Samsung back electronics; LEGO alone is below MIN_SUPPORT.
   assert.deepEqual(qlooIds(o), [cat('electronics')]);
   assert.ok(!qlooIds(o).includes(cat('services')));
});

test('Oxford University Press -> wrong entity rejected, unresolved', async () => {
   const { deps, calls } = makeDeps({
      extraction: { brand: 'Oxford University Press', product: null, confidence: 0.9 },
   });
   const o = await resolveTaste(ITEM('Oxford dictionary'), CTX, deps);
   checkShape(o);
   assert.equal(o.status, 'unresolved');
   assert.equal(o.suggestionSource, 'fallback');
   assert.deepEqual(ids(o), CTX.fallbackOrder.slice(0, 5));
   assert.equal(calls.insights, 0);
});

test('Brand search misses, product search hits (name still contains brand)', async () => {
   const { deps, calls } = makeDeps({
      extraction: { brand: 'Levi', product: "Levi's", confidence: 0.9 },
      related: ['Zara'],
   });
   const o = await resolveTaste(ITEM("Levi's 501 jeans"), CTX, deps);
   assert.equal(o.status, 'resolved');
   assert.equal(o.entity?.name, 'Levi Strauss & Co.');
   assert.deepEqual(calls.search, ['Levi', "Levi's"]);
});

test('Unbranded title -> unresolved, zero Qloo calls', async () => {
   const { deps, calls } = makeDeps({ extraction: { brand: null, product: 'dining table', confidence: 0.9 } });
   const o = await resolveTaste(ITEM('Wooden dining table'), CTX, deps);
   checkShape(o);
   assert.equal(o.status, 'unresolved');
   assert.equal(calls.search.length + calls.insights, 0);
});

test('Low Groq confidence or invalid JSON -> unresolved, zero Qloo calls', async () => {
   for (const extraction of [{ brand: 'Nike', product: null, confidence: 0.4 }, null]) {
      const { deps, calls } = makeDeps({ extraction });
      const o = await resolveTaste(ITEM('Nike shoes'), CTX, deps);
      assert.equal(o.status, 'unresolved');
      assert.equal(calls.search.length, 0);
   }
   const { deps } = makeDeps({ extraction: null });
   const o = await resolveTaste(ITEM('Nike shoes'), CTX, deps);
   assert.equal(o.confidence, null);
   assert.equal(o.groqNote, 'groq_invalid_json');
});

test('Groq 429 / 5xx / timeout / network on brand extraction -> retryable; final attempt gives up', async () => {
   for (const groqFail of ['http_429', 'http_503', 'timeout', 'network'] as GroqFailReason[]) {
      const { deps, calls } = makeDeps({ extraction: null, groqFail });
      const e = await resolveTaste(ITEM('Samsung TV'), CTX, deps).catch((x) => x);
      assert.ok(e instanceof GroqRetryableError, `${groqFail} retryable`);
      assert.equal(e.message, `groq_${groqFail}`);
      assert.equal(calls.search.length, 0);
      assert.equal(shouldGiveUp(e, 1, 3), false);
      assert.equal(shouldGiveUp(e, 3, 3), true);
   }
});

test('Groq 401 or not configured on brand extraction -> fallback with a note, no retry', async () => {
   for (const groqFail of ['http_401', 'not_configured'] as GroqFailReason[]) {
      const o = await resolveTaste(ITEM('Samsung TV'), CTX, makeDeps({ extraction: null, groqFail }).deps);
      checkShape(o);
      assert.equal(o.status, 'unresolved');
      assert.equal(o.suggestionSource, 'fallback');
      assert.equal(o.groqNote, `groq_${groqFail}`);
   }
});

test('Unbranded -> confidence 0 whether Groq sends null or 1', async () => {
   for (const confidence of [null, 1]) {
      const { deps } = makeDeps({ extraction: { brand: null, product: 'plastic bucket', confidence } });
      const o = await resolveTaste(ITEM('Plastic bucket'), CTX, deps);
      assert.equal(o.status, 'unresolved');
      assert.equal(o.confidence, 0);
   }
});

test('Qloo failing -> retryable error; give up only on the final attempt; 4xx is fatal', async () => {
   const { deps } = makeDeps({
      extraction: { brand: 'Samsung', product: null, confidence: 0.9 },
      qlooFail: { ok: false, reason: 'timeout' },
   });
   const err = await resolveTaste(ITEM('Samsung TV'), CTX, deps).catch((e) => e);
   assert.ok(err instanceof QlooRetryableError);
   assert.equal(err.message, 'qloo_timeout');
   assert.equal(shouldGiveUp(err, 0, 3), false);
   assert.equal(shouldGiveUp(err, 2, 3), false);
   assert.equal(shouldGiveUp(err, 3, 3), true);

   for (const fail of [
      { ok: false, reason: 'circuit_open' },
      { ok: false, reason: 'budget_soft' },
      { ok: false, reason: 'http_error', status: 503 },
   ] as QlooResult<never>[]) {
      const e = await resolveTaste(ITEM('Samsung TV'), CTX, makeDeps({ extraction: { brand: 'Samsung', product: null, confidence: 0.9 }, qlooFail: fail }).deps).catch((x) => x);
      assert.ok(e instanceof QlooRetryableError, `${JSON.stringify(fail)} retryable`);
   }
   const fatal = await resolveTaste(ITEM('Samsung TV'), CTX, makeDeps({ extraction: { brand: 'Samsung', product: null, confidence: 0.9 }, qlooFail: { ok: false, reason: 'http_error', status: 400 } }).deps).catch((x) => x);
   assert.ok(fatal instanceof QlooFatalError);
   assert.equal(shouldGiveUp(fatal, 0, 3), true);
});

test('Service -> skipped: fallback, no Groq or Qloo calls', async () => {
   const { deps, calls } = makeDeps({ extraction: { brand: 'Nike', product: null, confidence: 0.9 } });
   const o = await resolveTaste(ITEM('Phone repair', true), CTX, deps);
   checkShape(o);
   assert.equal(o.status, 'unresolved');
   assert.equal(calls.groqBrand + calls.search.length + calls.insights, 0);
});

test('No affinity on related brands -> positional weights', async () => {
   const { deps } = makeDeps({
      extraction: { brand: 'Samsung', product: null, confidence: 0.9 },
      related: ['Nike', 'Apple', 'Sony'], // fashion first, then 2 electronics
      noAffinity: true,
   });
   const o = await resolveTaste(ITEM('Samsung phone'), CTX, deps);
   // electronics (29/30 + 28/30); fashion has one brand only
   assert.deepEqual(qlooIds(o), [cat('electronics')]);
   assert.equal(o.related?.[0]?.affinity, null);
});

test('Own category pinned first with its reason (Apple-like: another category scores higher)', async () => {
   const { deps } = makeDeps({
      extraction: { brand: 'Samsung', product: null, confidence: 0.9 },
      related: ['Nike', 'Adidas', 'Zara', 'Gucci', 'H&M', 'Apple', 'Sony'],
   });
   const o = await resolveTaste(ITEM('Samsung phone', false, 'electronics'), CTX, deps);
   checkShape(o);
   assert.equal(ids(o)[0], cat('electronics'));
   assert.match(o.suggestions[0]!.reason!, /^Fans of Samsung also like (Apple Inc|Sony)$/);
   assert.equal(ids(o)[1], cat('fashion-apparel'));
   assert.equal(o.suggestionSource, 'qloo');
});

test('Own category pinned with no reason when Qloo does not back it (TECNO-like)', async () => {
   const { deps } = makeDeps({
      extraction: { brand: 'Samsung', product: null, confidence: 0.9 },
      related: ['Zara', 'Herman Miller'],
      groqMap: { 'Herman Miller': null },
   });
   const o = await resolveTaste(ITEM('Samsung phone', false, 'electronics'), CTX, deps);
   checkShape(o);
   assert.equal(o.status, 'resolved');
   assert.equal(ids(o)[0], cat('electronics'));
   assert.equal(o.suggestions[0]!.reason, null);
   assert.deepEqual(qlooIds(o), [], 'Zara alone does not back fashion');
   assert.equal(o.suggestionSource, 'fallback');
});

test('Share rule: a 2-brand category far below the top one is dropped', async () => {
   // 6 electronics brands vs 2 fashion brands at the tail.
   const { deps } = makeDeps({
      extraction: { brand: 'Samsung', product: null, confidence: 0.9 },
      related: ['Apple', 'Sony', 'LG', 'HP', 'Dell', 'JBL', 'Canon', 'PlayStation', 'Xbox', 'Zara', 'Gucci'],
      noAffinity: true,
   });
   const o = await resolveTaste(ITEM('Samsung phone'), CTX, deps);
   // electronics = (30+...+22)/30 = 7.8; fashion = (21+20)/30 = 1.37, 18% < 20%
   assert.deepEqual(qlooIds(o), [cat('electronics')]);
   // Same two fashion brands near the top clear the share.
   const { deps: d2 } = makeDeps({
      extraction: { brand: 'Samsung', product: null, confidence: 0.9 },
      related: ['Zara', 'Gucci', 'Apple', 'Sony', 'LG', 'HP'],
      noAffinity: true,
   });
   const o2 = await resolveTaste(ITEM('Samsung phone'), CTX, d2);
   assert.deepEqual(qlooIds(o2), [cat('electronics'), cat('fashion-apparel')]);
   // Between 20% and 30% (Nike / Canon fashion on real data) is kept.
   const { deps: d3 } = makeDeps({
      extraction: { brand: 'Samsung', product: null, confidence: 0.9 },
      related: ['Apple', 'Sony', 'LG', 'HP', 'Dell', 'JBL', 'Canon', 'Zara', 'Gucci'],
      noAffinity: true,
   });
   // electronics = (30+...+24)/30 = 6.3; fashion = (23+22)/30 = 1.5, 24%
   const o3 = await resolveTaste(ITEM('Samsung phone'), CTX, d3);
   assert.deepEqual(qlooIds(o3), [cat('electronics'), cat('fashion-apparel')]);
});

test('Affinity is decayed by position', async () => {
   // Equal affinity: the earlier pair outweighs the later pair.
   const { deps } = makeDeps({
      extraction: { brand: 'Samsung', product: null, confidence: 0.9 },
      related: ['Zara', 'Gucci', 'Apple', 'Sony'],
      noAffinity: true,
   });
   const o = await resolveTaste(ITEM('Samsung phone'), CTX, deps);
   assert.deepEqual(qlooIds(o), [cat('fashion-apparel'), cat('electronics')]);
});

test('Own category Other or Services is never pinned', async () => {
   const { deps } = makeDeps({
      extraction: { brand: 'Samsung', product: null, confidence: 0.9 },
      related: ['Apple', 'Sony'],
   });
   for (const own of ['other', 'services']) {
      const o = await resolveTaste(ITEM('Samsung phone', false, own), CTX, deps);
      assert.equal(ids(o)[0], cat('electronics'));
      assert.ok(!qlooIds(o).includes(cat(own)));
   }
});

test('Mapping prompt hints sports teams and app/bank brands', async () => {
   const { deps, calls } = makeDeps({
      extraction: { brand: 'Samsung', product: null, confidence: 0.9 },
      related: ['Herman Miller'],
      groqMap: {},
   });
   let prompt = '';
   const spy: GroqJsonFn = async (p, v) => {
      if (!p.includes('extract the brand')) prompt = p;
      return deps.groq(p, v);
   };
   await resolveTaste(ITEM('Samsung phone'), CTX, { ...deps, groq: spy });
   assert.equal(calls.groqMapBatches.length, 1);
   assert.match(prompt, /sports team, club or league maps to sports-fitness/);
   assert.match(prompt, /bank, media, telecom, food or drink brand maps to null/);
});

test('validateExtraction: 0-100 confidence, bad shapes', async () => {
   assert.deepEqual(validateExtraction({ brand: ' Nike ', product: '', confidence: 85 }), { brand: 'Nike', product: null, confidence: 0.85 });
   assert.equal(validateExtraction({ brand: 3, product: null, confidence: 0.5 }), null);
   assert.equal(validateExtraction({ brand: 'Nike', product: null }), null);
   assert.deepEqual(validateExtraction({ brand: null, product: null }), { brand: null, product: null, confidence: 0 });
   assert.deepEqual(validateExtraction({ brand: null, product: 'bucket', confidence: 1 }), { brand: null, product: 'bucket', confidence: 0 });
});

test('validateMappings: numbers back to entity ids; bad entries dropped', async () => {
   const sent = [{ entity_id: 'a' }, { entity_id: 'b' }, { entity_id: 'c' }];
   const slugs = new Set(['electronics', 'fashion-apparel']);
   const m = validateMappings({ mappings: { '1': 'electronics', '3': 'fashion-apparel', '2': null, '4': 'electronics', x: 'electronics', '0': 'electronics' } }, sent, slugs);
   assert.deepEqual([...m!], [['a', 'electronics'], ['c', 'fashion-apparel']]);
   assert.deepEqual([...validateMappings({ mappings: { '1': 'kids-baby' } }, sent, slugs)!], []);
   assert.equal(validateMappings({ mappings: [] }, sent, slugs), null);
   assert.equal(validateMappings({}, sent, slugs), null);
});

test('groqJson sends max_tokens (default and override)', async () => {
   process.env.GROQ_MODEL ??= 'test';
   process.env.GROQ_BASE_URL ??= 'http://groq.test';
   process.env.GROQ_API_KEY ??= 'test';
   const sent: number[] = [];
   const f = (async (_u: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)).max_tokens);
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"a":1}' } }] }), { status: 200 });
   }) as unknown as typeof fetch;
   const g = createGroqJson(f, FREE);
   await g('p', (v) => v);
   await g('p', (v) => v, { maxTokens: 400 });
   assert.deepEqual(sent, [DEFAULT_MAX_TOKENS, 400]);
});

test('groqJson: invalid JSON retried once, then invalid_json; transport reasons', async () => {
   process.env.GROQ_MODEL ??= 'test';
   process.env.GROQ_BASE_URL ??= 'http://groq.test';
   process.env.GROQ_API_KEY ??= 'test';
   const fakeFetch = (answers: string[]) => {
      let i = 0;
      return (async () =>
         new Response(JSON.stringify({ choices: [{ message: { content: answers[i++] } }] }), { status: 200 })) as unknown as typeof fetch;
   };
   const ok = await createGroqJson(fakeFetch(['not json', '```json\n{"a":1}\n```']), FREE)('p', (v) => v as { a: number });
   assert.deepEqual(ok, { ok: true, value: { a: 1 } });
   const bad = await createGroqJson(fakeFetch(['nope', '[1]', '{"a":1}']), FREE)('p', (v) => v);
   assert.deepEqual(bad, { ok: false, reason: 'invalid_json' });

   let n = 0;
   const status = (code: number) =>
      (async () => {
         n++;
         return new Response('{}', { status: code });
      }) as unknown as typeof fetch;
   assert.deepEqual(await createGroqJson(status(503), FREE)('p', (v) => v), { ok: false, reason: 'http_503' });
   assert.equal(n, 1); // no retry on a transport failure
   const down = (async () => {
      throw new TypeError('fetch failed');
   }) as unknown as typeof fetch;
   assert.deepEqual(await createGroqJson(down, FREE)('p', (v) => v), { ok: false, reason: 'network' });
});

test('groqJson: 429 waits for Retry-After and retries once; paced out', async () => {
   const slept: number[] = [];
   const limiter = { acquire: async () => true, sleep: async (ms: number) => void slept.push(ms) };
   const seq = (...answers: Response[]) => {
      let i = 0;
      return (async () => answers[i++]) as unknown as typeof fetch;
   };
   const okBody = () => new Response(JSON.stringify({ choices: [{ message: { content: '{"a":1}' } }] }), { status: 200 });
   const busy = (h?: string) => new Response('{}', { status: 429, headers: h ? { 'retry-after': h } : {} });

   assert.deepEqual(await createGroqJson(seq(busy('7'), okBody()), limiter)('p', (v) => v), { ok: true, value: { a: 1 } });
   assert.deepEqual(slept, [7000]);
   assert.deepEqual(await createGroqJson(seq(busy(), busy()), limiter)('p', (v) => v), { ok: false, reason: 'http_429' });
   assert.deepEqual(slept, [7000, 20000]); // one wait only, default 20 s
   const full = { acquire: async () => false, sleep: async () => {} };
   assert.deepEqual(await createGroqJson(seq(okBody()), full)('p', (v) => v), { ok: false, reason: 'paced_out' });
   assert.equal(isGroqTransient('paced_out'), true);
});

test('Brand extraction busy still throws on the last attempt (worker marks failed)', async () => {
   const { deps } = makeDeps({ extraction: null, groqFail: 'http_429' });
   const e = await resolveTaste(ITEM('Samsung TV'), CTX, deps, { lastAttempt: true }).catch((x) => x);
   assert.ok(e instanceof GroqRetryableError);
});

// -- run ---------------------------------------------------------------------
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
