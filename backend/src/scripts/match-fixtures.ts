// ============================================================================
// Match scoring tests (Phase 4 step 1). Pure, no database:
//
//   npx tsx src/scripts/match-fixtures.ts
// ============================================================================
import assert from 'node:assert/strict';
import { DEFAULT_MATCH_WEIGHTS, parseMatchWeights } from '../config/match.config';
import {
   combine,
   keywords,
   ladderLevel,
   MAX_MATCHES,
   rankMatches,
   reciprocalFit,
   scoreLabel,
   templateReason,
   wantsFit,
   type CandidateInput,
   type SourceInput,
} from '../services/matchScoring';
import { decodeRankCursor, encodeRankCursor } from '../services/matches.service';
import { READ_REFRESH_INTERVAL_MS, takeReadRefreshSlot } from '../services/matchRefresh.service';

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

const ELEC = 'elec';
const FASH = 'fash';
const BOOK = 'book';
const HOME = 'home';
const SPORT = 'sport';

const source = (over: Partial<SourceInput> = {}): SourceInput => ({
   categoryId: ELEC,
   wantRanks: new Map([
      [FASH, 1],
      [BOOK, 2],
      [HOME, 3],
   ]),
   unpickedSuggested: new Set([SPORT]),
   note: null,
   categoryNames: new Map([
      [ELEC, 'Electronics'],
      [FASH, 'Fashion'],
      [BOOK, 'Books'],
      [HOME, 'Home'],
      [SPORT, 'Sports'],
   ]),
   ...over,
});

let n = 0;
const cand = (categoryId: string, over: Partial<CandidateInput> = {}): CandidateInput => ({
   id: `c${++n}`,
   userId: `u${n}`,
   categoryId,
   title: 'Something',
   createdAt: new Date(Date.UTC(2026, 9, 1, 0, n)),
   tier: 1,
   ...over,
});

const W = DEFAULT_MATCH_WEIGHTS;

test('W by want rank, unpicked suggestion and other', () => {
   const s = source();
   assert.equal(wantsFit(s, cand(FASH)), 1);
   assert.equal(wantsFit(s, cand(BOOK)), 0.85);
   assert.equal(wantsFit(s, cand(HOME)), 0.7);
   assert.equal(wantsFit(s, cand(SPORT)), 0.4);
   assert.equal(wantsFit(s, cand(ELEC)), 0.2);
});

test('W note bonus +0.10 once, capped at 1; stop words ignored', () => {
   const s = source({ note: 'Looking for Nike sneakers or a desk' });
   assert.equal(wantsFit(s, cand(BOOK, { title: 'Nike Air sneakers' })), 0.95);
   assert.equal(wantsFit(s, cand(FASH, { title: 'Nike Air' })), 1);
   assert.equal(wantsFit(s, cand(ELEC, { title: 'Office desk' })), 0.3);
   const d = source({ note: 'Anything of similar value' });
   assert.equal(keywords(d.note).size, 0);
   assert.equal(wantsFit(d, cand(ELEC, { title: 'Similar value item' })), 0.2);
});

test('R: wanted rank, other 0.20, null with no wants', () => {
   assert.equal(reciprocalFit(ELEC, new Map([[ELEC, 2]])), 0.85);
   assert.equal(reciprocalFit(ELEC, new Map([[FASH, 1]])), 0.2);
   assert.equal(reciprocalFit(ELEC, new Map()), null);
   assert.equal(reciprocalFit(ELEC, undefined), null);
});

test('combine renormalises over non-null components', () => {
   // T and O null: W 0.40 / R 0.20 -> 2/3 and 1/3.
   assert.equal(combine({ wants: 1, taste: null, reciprocal: 0.2, owner: null }, W), 0.733);
   // R null too: W alone.
   assert.equal(combine({ wants: 0.85, taste: null, reciprocal: null, owner: null }, W), 0.85);
   // All four present.
   assert.equal(combine({ wants: 1, taste: 0.5, reciprocal: 0.2, owner: 0 }, W), 0.59);
   assert.equal(combine({ wants: null, taste: null, reciprocal: null, owner: null }, W), 0);
});

test('Labels: strong >= 0.70, good >= 0.50, tier 3 none', () => {
   assert.equal(scoreLabel(0.7, 1), 'strong');
   assert.equal(scoreLabel(0.699, 1), 'good');
   assert.equal(scoreLabel(0.5, 2), 'good');
   assert.equal(scoreLabel(0.49, 2), 'possible');
   assert.equal(scoreLabel(0.9, 3), null);
});

test('Reasons by tier and want rank', () => {
   const s = source();
   assert.equal(templateReason(s, cand(FASH)), 'Matches your top want: Fashion');
   assert.equal(templateReason(s, cand(BOOK)), 'Matches your want: Books');
   assert.equal(templateReason(s, cand(SPORT, { tier: 2 })), 'Scout suggests Sports');
   assert.equal(templateReason(s, cand(ELEC, { tier: 3 })), 'Recently listed');
});

test('rankMatches: score desc, then newest; unknown R is neutral 0.5', () => {
   const s = source();
   const a = cand(BOOK, { userId: 'ua' }); // W .85, R 1 -> .9
   const b = cand(FASH, { userId: 'ub' }); // W 1, R .2 -> .733
   const c = cand(FASH, { userId: 'uc' }); // W 1, R null (0.5) -> .833
   const d = cand(BOOK, { userId: 'ud' }); // W .85, R null (0.5) -> .733 (newer than b)
   const owners = new Map([
      ['ua', new Map([[ELEC, 1]])],
      ['ub', new Map([[SPORT, 1]])],
   ]);
   const r = rankMatches(s, [a, b, c, d], owners, W);
   assert.deepEqual(
      r.map((m) => [m.candidateItemId, m.score]),
      [
         [a.id, 0.9],
         [c.id, 0.833],
         [d.id, 0.733],
         [b.id, 0.733],
      ],
   );
   assert.deepEqual(r.map((m) => m.rank), [1, 2, 3, 4]);
   assert.ok(r.every((m) => m.source === 'fallback' && m.tasteAffinity === null));
   // Stored R stays null for unknown owners.
   assert.equal(r.find((m) => m.candidateItemId === c.id)!.reciprocalFit, null);
});

test('rankMatches: equal scores order newest first', () => {
   const old = cand(FASH, { createdAt: new Date('2026-10-01') });
   const fresh = cand(FASH, { createdAt: new Date('2026-10-10') });
   const r = rankMatches(source(), [old, fresh], new Map(), W);
   assert.deepEqual(r.map((m) => m.candidateItemId), [fresh.id, old.id]);
});

test('rankMatches keeps the top 50', () => {
   const many = Array.from({ length: 70 }, () => cand(FASH));
   const r = rankMatches(source(), many, new Map(), W);
   assert.equal(r.length, MAX_MATCHES);
   assert.equal(r.at(-1)!.rank, 50);
});

test('Level 3 (no wants): recency only, no W/R, score 0', () => {
   const s = source({ wantRanks: new Map(), unpickedSuggested: new Set() });
   const old = cand(FASH, { tier: 3, createdAt: new Date('2026-10-01') });
   const fresh = cand(BOOK, { tier: 3, createdAt: new Date('2026-10-05') });
   const r = rankMatches(s, [old, fresh], new Map([[old.userId, new Map([[ELEC, 1]])]]), W);
   assert.deepEqual(r.map((m) => m.candidateItemId), [fresh.id, old.id]);
   assert.ok(r.every((m) => m.score === 0 && m.wantsFit === null && m.reciprocalFit === null));
   assert.equal(ladderLevel(s, 2), 3);
   assert.equal(ladderLevel(source(), 2), 2);
   assert.equal(ladderLevel(source(), 0), 4);
});

test('MATCH_WEIGHTS parsing', () => {
   assert.deepEqual(parseMatchWeights(undefined), DEFAULT_MATCH_WEIGHTS);
   assert.deepEqual(parseMatchWeights('wants=0.5,reciprocal=0.5'), {
      ...DEFAULT_MATCH_WEIGHTS,
      wants: 0.5,
      reciprocal: 0.5,
   });
   for (const bad of ['wants=x', 'foo=1', 'wants=-1', 'wants=0,taste=0,reciprocal=0,owner=0', 'wants']) {
      assert.equal(parseMatchWeights(bad), null, bad);
   }
});

test('Rank cursor round trip; junk rejected', () => {
   assert.equal(decodeRankCursor(encodeRankCursor(10)), 10);
   assert.equal(decodeRankCursor('abc'), null);
   assert.equal(decodeRankCursor(Buffer.from('2026|id').toString('base64url')), null);
});

test('Read-triggered refresh at most once an hour per item', () => {
   const seen = new Map<string, number>();
   assert.equal(takeReadRefreshSlot('i1', 0, seen), true);
   assert.equal(takeReadRefreshSlot('i1', READ_REFRESH_INTERVAL_MS - 1, seen), false);
   assert.equal(takeReadRefreshSlot('i2', 1, seen), true);
   assert.equal(takeReadRefreshSlot('i1', READ_REFRESH_INTERVAL_MS, seen), true);
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
