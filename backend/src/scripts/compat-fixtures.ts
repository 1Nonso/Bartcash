// ============================================================================
// Taste compatibility tests (Phase 5). Pure, no database:
//
//   npx tsx src/scripts/compat-fixtures.ts
// ============================================================================
import assert from 'node:assert/strict';
import { DEFAULT_MATCH_WEIGHTS } from '../config/match.config';
import { scoreAll, type CandidateInput, type OwnerFits, type SourceInput } from '../services/matchScoring';
import { messagePrompt } from '../services/scoutDraft.service';
import {
   compareProfiles,
   compatLabel,
   formatCompatibility,
   ownerScore,
   pairIds,
   rankPreviews,
   readRelated,
   readShared,
   readTags,
   type ProfileEntity,
} from '../services/tasteCompat';

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

const GENRE = 'urn:tag:genre:brand:';
const LIFE = 'urn:tag:lifestyle:';
const ent = (id: string, tags: string[] = []): ProfileEntity => ({
   qloo_entity_id: id,
   name: `Name ${id}`,
   entity_type: 'brand',
   image_url: null,
   tags: tags.map((t) => ({ tag_id: t, name: t.split(':').pop()! })),
});

test('Inactive profile (fewer than 3) -> null', () => {
   const three = [ent('a'), ent('b'), ent('c')];
   assert.equal(compareProfiles([ent('a'), ent('b')], three), null);
   assert.equal(compareProfiles(three, [ent('a')]), null);
   assert.notEqual(compareProfiles(three, three), null);
});

test('Entity overlap alone when either side has no tags', () => {
   const a = [ent('a'), ent('b'), ent('c'), ent('d')];
   const b = [ent('a'), ent('x'), ent('y')]; // 1 shared / smaller (3)
   const r = compareProfiles(a, b)!;
   assert.equal(r.score, 0.333);
   assert.deepEqual(
      r.shared_entities.map((e) => e.qloo_entity_id),
      ['a'],
   );
   assert.ok(!('tags' in r.shared_entities[0]!));
});

test('0.6 x E + 0.4 x tag overlap (tags pooled per profile)', () => {
   const a = [ent('a', [`${GENRE}x`, `${LIFE}y`]), ent('b', [`${GENRE}x`]), ent('c')];
   const b = [ent('a', [`${LIFE}y`]), ent('p', [`${GENRE}z`]), ent('q'), ent('r')];
   // E = 1/3; tags a {x,y}, b {y,z}: shared 1 / 2 -> 0.6*0.333 + 0.4*0.5 = 0.4
   const r = compareProfiles(a, b)!;
   assert.equal(r.score, 0.4);
   assert.deepEqual(
      r.shared_tags.map((t) => t.tag_id),
      [`${LIFE}y`],
   );
});

test('Shared tags: genre before lifestyle', () => {
   const a = [ent('a', [`${LIFE}l`, `${GENRE}g`]), ent('b'), ent('c')];
   const r = compareProfiles(a, a)!;
   assert.deepEqual(
      r.shared_tags.map((t) => t.tag_id),
      [`${GENRE}g`, `${LIFE}l`],
   );
   assert.equal(r.score, 1);
});

test('Labels and stored threshold', () => {
   assert.equal(compatLabel(0.45), 'high');
   assert.equal(compatLabel(0.449), 'medium');
   assert.equal(compatLabel(0.25), 'medium');
   assert.equal(compatLabel(0.1), 'low');
   assert.equal(compatLabel(0.099), null);
});

test('O = score / 0.45, capped at 1', () => {
   assert.equal(ownerScore(0.45), 1);
   assert.equal(ownerScore(0.9), 1);
   assert.equal(ownerScore(0.225), 0.5);
   assert.equal(ownerScore(0), 0);
});

test('Pair ids: lower id first', () => {
   assert.deepEqual(pairIds('b', 'a'), { userAId: 'a', userBId: 'b' });
   assert.deepEqual(pairIds('a', 'b'), { userAId: 'a', userBId: 'b' });
});

test('Compatibility object: at most 6 shown, full count, tags only when asked', () => {
   const shared = Array.from({ length: 8 }, (_, i) => ({
      qloo_entity_id: `e${i}`,
      name: `E${i}`,
      entity_type: 'brand',
      image_url: null,
   }));
   const c = formatCompatibility({ score: 0.3, shared_entities: shared, shared_tags: [] });
   assert.equal(c.score_label, 'medium');
   assert.equal(c.shared_entities.length, 6);
   assert.equal(c.shared_count, 8);
   assert.ok(!('shared_tags' in c));
   assert.deepEqual(formatCompatibility({ score: 0.3, shared_entities: [], shared_tags: [] }, { withTags: true }).shared_tags, []);
});

test('Stored JSON read back safely', () => {
   assert.deepEqual(readShared(null), []);
   assert.deepEqual(readShared([{ qloo_entity_id: 'a', name: 'A', entity_type: 'brand' }, { bad: 1 }]), [
      { qloo_entity_id: 'a', name: 'A', entity_type: 'brand', image_url: null },
   ]);
   assert.deepEqual(readTags([{ tag_id: 't', name: 'T' }, 'x']), [{ tag_id: 't', name: 'T' }]);
});

const source: SourceInput = {
   categoryId: 'elec',
   wantRanks: new Map([['fash', 1]]),
   unpickedSuggested: new Set(),
   note: null,
   categoryNames: new Map([['fash', 'Fashion']]),
};
const cand = (id: string, userId: string): CandidateInput => ({
   id,
   userId,
   categoryId: 'fash',
   title: 'Jacket',
   createdAt: new Date(Date.UTC(2026, 9, 1)),
   tier: 1,
});

test('Match scoring: O counts at weight 0.1; null owner is dropped', () => {
   const owners: OwnerFits = new Map([
      ['u1', { o: 1, shared: [{ name: 'Nike' }] }],
      ['u2', { o: 0, shared: [] }],
      ['u3', { o: null, shared: [] }],
   ]);
   const rows = scoreAll(source, [cand('c1', 'u1'), cand('c2', 'u2'), cand('c3', 'u3')], new Map(), DEFAULT_MATCH_WEIGHTS, null, owners);
   const by = new Map(rows.map((r) => [r.candidateItemId, r]));
   // W 1, R 0.5 (unknown), no T: (0.4 + 0.1 + 0.1·O) / 0.7 when O is set.
   assert.equal(by.get('c1')!.score, 0.857);
   assert.equal(by.get('c2')!.score, 0.714);
   assert.equal(by.get('c3')!.score, 0.833);
   assert.equal(by.get('c1')!.ownerCompatibility, 1);
   assert.equal(by.get('c3')!.ownerCompatibility, null);
   const ex = by.get('c1')!.explanation;
   assert.equal(ex.checked.find((c) => c.key === 'shared_interests')!.result, 'strong');
   assert.deepEqual(ex.shared_interests, [{ name: 'Nike' }]);
   assert.equal(by.get('c3')!.explanation.checked.find((c) => c.key === 'shared_interests')!.result, 'unknown');
});

test('Match scoring without owners is unchanged (O dropped)', () => {
   const [r] = scoreAll(source, [cand('c9', 'u9')], new Map(), DEFAULT_MATCH_WEIGHTS);
   assert.equal(r!.score, 0.833);
   assert.equal(r!.ownerCompatibility, null);
});

test('Draft prompt mentions a shared interest only when given', () => {
   const base = { name: 'Ada', offered: 'PS5', target: 'Galaxy A52', topUp: 0, theyWant: null };
   assert.ok(messagePrompt({ ...base, shared: 'Nike' }).includes('Both people list "Nike"'));
   assert.ok(!messagePrompt(base).includes('Both people'));
});

test('Previews: own brand, then related, then tags, then newest', () => {
   const d = (n: number) => new Date(Date.UTC(2026, 9, n));
   const viewer = { entityIds: new Set(['nike', 'sony']), tagIds: new Set(['t1', 't2']) };
   const base = { tags: [], related: [], entityId: null };
   const items = [
      { ...base, id: 'newest', createdAt: d(20) },
      { ...base, id: 'tags2', createdAt: d(1), tags: [{ tag_id: 't1', name: 'a' }, { tag_id: 't2', name: 'b' }] },
      { ...base, id: 'tags1', createdAt: d(2), tags: [{ tag_id: 't1', name: 'a' }] },
      { ...base, id: 'relWeak', createdAt: d(3), entityId: 'puma', related: [{ entity_id: 'nike', affinity: 0.4 }] },
      { ...base, id: 'relStrong', createdAt: d(4), entityId: 'reebok', related: [{ entity_id: 'sony', affinity: 0.9 }] },
      { ...base, id: 'own', createdAt: d(5), entityId: 'nike' },
      { ...base, id: 'older', createdAt: d(10) },
   ];
   assert.deepEqual(
      rankPreviews(items, viewer).map((i) => i.id),
      ['own', 'relStrong', 'relWeak', 'tags2', 'tags1', 'newest', 'older'],
   );
   assert.deepEqual(readRelated([{ entity_id: 'x', affinity: 0.5 }, { entity_id: 'y' }, 3]), [
      { entity_id: 'x', affinity: 0.5 },
      { entity_id: 'y', affinity: null },
   ]);
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
