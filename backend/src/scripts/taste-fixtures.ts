// ============================================================================
// Taste profile tests (Phase 4, taste profile step). Pure, no database:
//
//   npx tsx src/scripts/taste-fixtures.ts
// ============================================================================
import assert from 'node:assert/strict';
import { fromQlooTypes } from '../services/qloo';
import {
   diffProfile,
   finishSections,
   isTradableBrand,
   keepTags,
   MAX_ENTITIES,
   MAX_TAGS,
   profileBodySchema,
   relatedToEntities,
   searchQuerySchema,
   suggestionsQuerySchema,
   toSearchEntities,
} from '../services/tasteProfile.service';

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

const ent = (id: string, type = 'brand') => ({ qloo_entity_id: id, name: `N${id}`, entity_type: type });

test('Search query: q 2-60, type optional and known, limit 1-20 default 10', () => {
   const ok = searchQuerySchema.safeParse({ q: ' Nike ' });
   assert.ok(ok.success);
   assert.deepEqual(ok.data, { q: 'Nike', limit: 10 });
   assert.equal(searchQuerySchema.safeParse({ q: 'Burna', type: 'artist', limit: '5' }).data?.limit, 5);
   for (const bad of [{ q: 'a' }, { q: 'x'.repeat(61) }, { q: 'ok', type: 'video_game' }, { q: 'ok', limit: 0 }, { q: 'ok', limit: 21 }, {}]) {
      assert.equal(searchQuerySchema.safeParse(bad).success, false, JSON.stringify(bad));
   }
});

test('Profile body: 0-25 entities, no duplicates, known types', () => {
   assert.ok(profileBodySchema.safeParse({ entities: [] }).success);
   assert.ok(profileBodySchema.safeParse({ entities: [ent('a'), ent('b', 'videogame')] }).success);
   const many = Array.from({ length: MAX_ENTITIES + 1 }, (_, i) => ent(`e${i}`));
   assert.equal(profileBodySchema.safeParse({ entities: many }).success, false);
   assert.equal(profileBodySchema.safeParse({ entities: [ent('a'), ent('a')] }).success, false);
   assert.equal(profileBodySchema.safeParse({ entities: [ent('a', 'video_game')] }).success, false);
   assert.equal(profileBodySchema.safeParse({ entities: [{ qloo_entity_id: 'a', entity_type: 'brand' }] }).success, false);
   assert.equal(profileBodySchema.safeParse({}).success, false);
});

test('diffProfile: removes missing, adds new, keeps unchanged', () => {
   const d = diffProfile(['a', 'b', 'c'], [ent('b'), ent('c'), ent('d')] as never);
   assert.deepEqual(d.remove, ['a']);
   assert.deepEqual(d.add.map((e) => e.qloo_entity_id), ['d']);
   assert.deepEqual(diffProfile(['a'], []).remove, ['a']);
});

test('fromQlooTypes maps urns; unknown -> null', () => {
   assert.equal(fromQlooTypes(['urn:entity:artist']), 'artist');
   assert.equal(fromQlooTypes(['urn:entity:place', 'urn:entity:videogame']), 'videogame');
   assert.equal(fromQlooTypes(['urn:entity:place']), null);
});

test('toSearchEntities: shape, already_added, drops unknown types, honours limit', () => {
   const r = (id: string, type: string) => ({ entity_id: id, name: id, types: [type], tags: [], image_url: null });
   const out = toSearchEntities(
      [r('x', 'urn:entity:artist'), r('p', 'urn:entity:place'), r('y', 'urn:entity:movie'), r('z', 'urn:entity:brand')],
      new Set(['y']),
      2,
   );
   assert.deepEqual(out.map((e) => [e.qloo_entity_id, e.entity_type, e.already_added]), [
      ['x', 'artist', false],
      ['y', 'movie', true],
   ]);
});

test('keepTags: kept types only, genre first, capped', () => {
   const t = (id: string) => ({ tag_id: id, name: id });
   const out = keepTags([
      t('urn:tag:keyword:qloo:x'),
      t('urn:tag:lifestyle:qloo:a'),
      t('urn:tag:genre:music:afrobeats'),
      t('urn:tag:business_model:qloo:b2c'),
      t('urn:tag:aesthetic_property:qloo:bold'),
   ]);
   assert.deepEqual(out.map((x) => x.tag_id), [
      'urn:tag:genre:music:afrobeats',
      'urn:tag:aesthetic_property:qloo:bold',
      'urn:tag:lifestyle:qloo:a',
   ]);
   const many = Array.from({ length: 80 }, (_, i) => t(`urn:tag:genre:brand:g${i}`));
   assert.equal(keepTags(many).length, MAX_TAGS);
});

test('Suggestions: related brands mapped, dedupe across sections, flags, cap, empty dropped', () => {
   const related = relatedToEntities([
      { entity_id: 'a', name: 'Apple', tag_ids: ['urn:tag:genre:brand:electronics', 'urn:tag:keyword:x'] },
      { entity_id: 'b', name: 'Bose', tag_ids: ['urn:tag:genre:brand:electronics:audio'] },
      { entity_id: 'v', name: 'VSCO', tag_ids: ['urn:tag:genre:brand:mobile_app', 'urn:tag:genre:brand:software'] },
      { entity_id: 'n', name: 'No tags' },
      { bad: true },
   ]);
   assert.deepEqual(related.map((e) => [e.qloo_entity_id, e.entity_type, e.image_url, e.tags.length]), [
      ['a', 'brand', null, 1],
      ['b', 'brand', null, 1],
   ]);
   assert.deepEqual(relatedToEntities(null), []);
   const mk = (id: string) => ({ ...related[0]!, qloo_entity_id: id });
   const out = finishSections(
      [
         { key: 'listed', title: 'Because you listed Sony', entities: [mk('a'), mk('b'), mk('c')] },
         { key: 'for_you', title: 'Picked for your taste', entities: [mk('b'), mk('d')] },
         { key: 'popular', title: 'Popular picks', entities: [mk('a')] },
      ],
      new Set(['c']),
      2,
   );
   assert.deepEqual(out.map((s) => [s.key, s.entities.map((e) => [e.qloo_entity_id, e.already_added])]), [
      ['listed', [['a', false], ['b', false]]],
      ['for_you', [['d', false]]],
   ]);
   // c was cut by the cap before being seen; 'popular' had only a duplicate -> dropped.
   assert.equal(suggestionsQuerySchema.safeParse({ type: 'video_game' }).success, false);
   assert.ok(suggestionsQuerySchema.safeParse({}).success);
});

test('isTradableBrand: tradable categories and clubs in; apps, media, leagues out', () => {
   const b = (...g: string[]) => g.map((x) => ({ tag_id: `urn:tag:genre:brand:${x}` }));
   // From the cached Qloo popular-brands list (Oct 20).
   const cases: [string, ReturnType<typeof b>, boolean][] = [
      ['CNN', b('mobile_app', 'website'), false],
      ['Nike', b('fashion', 'fashion:footwear:sneaker:running'), true],
      ['Instagram', b('mobile_app', 'software'), false],
      ['Netflix', b('mobile_app:streaming_service', 'entertainment'), false],
      ['The New York Times', b('mobile_app:news', 'entertainment:media:art'), false],
      ['Christian Dior', b('fashion:formalwear', 'fashion:home_accessories'), true],
      ['Playstation', b('electronics:gaming', 'electronics'), true],
      ['FC Barcelona', b('sports_organization', 'sports_organization:soccer:spain'), true],
      ['Premier League', b('mobile_app:sports', 'sports_organization'), false],
      ['Unknown', b('website'), false],
      ['Hp', b('software', 'electronics:computers_and_laptops'), true],
   ];
   for (const [name, tags, want] of cases) assert.equal(isTradableBrand(tags), want, name);
   assert.equal(isTradableBrand(null), false);
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
