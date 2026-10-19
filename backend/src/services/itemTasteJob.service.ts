import { db } from '../config/db.config';
import { Prisma } from '../generated/prisma/client';
import { mapTagsToCategory } from './qloo/categoryMapper.service';
import type {
   QlooInsightEntity,
   QlooResult,
   QlooSearchEntity,
   QlooTag,
} from './qloo/qlooTypes';
import {
   groqJson as defaultGroqJson,
   isGroqTransient,
   type GroqFailReason,
   type GroqJsonFn,
} from './groqJson';
import {
   fillToFive,
   getFallbackOrder,
   type WantSuggestion,
} from './wantFallback.service';

// ============================================================================
// Listing enrichment, the item-taste job (Phase 3 v3.0, Section 10.6;
// Phase 4c, Section 10.10). Decisions agreed Oct 16:
//   - The 0.60 gate uses Groq's brand-extraction confidence (Qloo /search
//     returns no score).
//   - Related-brand weight is (affinity ?? 1) x (RELATED_TAKE - i) / RELATED_TAKE
//     (tuned Oct 17-19).
//   - An entity is accepted when its name, with punctuation and spaces
//     removed, contains the extracted brand.
// resolveTaste() does the work with no database access, so it can be tested
// with fakes; runItemTaste() loads and writes.
// ============================================================================

export const CONFIDENCE_GATE = 0.6;
export const RELATED_TAKE = 30;
/** Related brands a category needs before it counts as Qloo-backed. */
export const MIN_SUPPORT = 2;
/** ...and its score must be at least this share of the top category's. */
export const MIN_SHARE = 0.2;
const REASON_MAX = 140;
/** Mapping answers about 6 output tokens per brand (RELATED_TAKE at most). */
const MAPPING_MAX_TOKENS = 400;
const PROMPT_TEXT_MAX = 1000;
/** Never suggested from Qloo evidence (Section 10.5). */
const NO_QLOO_SLUGS = new Set(['services', 'other']);

// -- dependencies -------------------------------------------------------------
export interface TasteQloo {
   search(args: { query: string; type: 'brand' }): Promise<QlooResult<QlooSearchEntity[]>>;
   insights(args: {
      filterType: 'brand';
      signals: readonly string[];
      take: number;
   }): Promise<QlooResult<QlooInsightEntity[]>>;
}

export interface TasteDeps {
   qloo: TasteQloo;
   groq: GroqJsonFn;
}

// -- errors -------------------------------------------------------------------
/** Qloo is down, throttled or out of budget: pg-boss should retry. */
export class QlooRetryableError extends Error {
   constructor(readonly reason: string) {
      super(`qloo_${reason}`);
      this.name = 'QlooRetryableError';
   }
}

/** Groq is busy or unreachable during brand extraction: pg-boss should retry. */
export class GroqRetryableError extends Error {
   constructor(readonly reason: GroqFailReason) {
      super(`groq_${reason}`);
      this.name = 'GroqRetryableError';
   }
}

/** The same request would fail again (4xx, unusable response): no retry. */
export class QlooFatalError extends Error {
   constructor(readonly reason: string) {
      super(`qloo_${reason}`);
      this.name = 'QlooFatalError';
   }
}

function unwrap<T>(r: QlooResult<T>): T {
   if (r.ok) return r.data;
   const retryable =
      r.reason === 'timeout' ||
      r.reason === 'circuit_open' ||
      r.reason === 'budget_soft' ||
      r.reason === 'budget_hard' ||
      r.reason === 'throttled' ||
      (r.reason === 'http_error' &&
         (r.status === undefined || r.status >= 500 || r.status === 429));
   const reason = r.status !== undefined ? `${r.reason}_${r.status}` : r.reason;
   throw retryable ? new QlooRetryableError(reason) : new QlooFatalError(reason);
}

// -- types --------------------------------------------------------------------
export interface TasteItem {
   title: string;
   description: string;
   isService: boolean;
   /** The listing's own category: always suggested first (Qloo path). */
   categoryId: string;
}

export interface TasteCategory {
   id: string;
   slug: string;
   name: string;
}

export interface TasteContext {
   /** Active categories. */
   categories: readonly TasteCategory[];
   /** Active category ids in fallback order (wantFallback.service). */
   fallbackOrder: readonly string[];
}

export interface RelatedEntity {
   entity_id: string;
   name: string;
   affinity: number | null;
   tag_ids: string[];
}

export interface TasteOutcome {
   status: 'resolved' | 'unresolved';
   entity: { id: string; name: string; type: 'brand' } | null;
   resolutionSource: 'brand_extracted' | 'none';
   confidence: number | null;
   tags: QlooTag[] | null;
   related: RelatedEntity[] | null;
   suggestions: WantSuggestion[];
   suggestionSource: 'qloo' | 'fallback';
   /** A Groq call that failed but was not worth retrying (for the log). */
   groqNote?: string;
}

// -- Groq: brand extraction ----------------------------------------------------
interface Extracted {
   brand: string | null;
   product: string | null;
   confidence: number;
}

function optText(v: unknown): string | null | undefined {
   if (v === null || v === undefined) return null;
   if (typeof v !== 'string') return undefined;
   const t = v.trim().slice(0, 100);
   return t.length > 0 ? t : null;
}

export function validateExtraction(v: unknown): Extracted | null {
   const o = v as Record<string, unknown>;
   const brand = optText(o.brand);
   const product = optText(o.product);
   if (brand === undefined || product === undefined) return null;
   // No brand: confidence is 0 whatever Groq sends (it may say it is
   // "sure there is no brand"), so unresolved rows never show a high score.
   if (brand === null) return { brand, product, confidence: 0 };
   if (typeof o.confidence !== 'number' || !Number.isFinite(o.confidence)) return null;
   // Accept 0-100 as well as 0-1.
   let c = o.confidence > 1 && o.confidence <= 100 ? o.confidence / 100 : o.confidence;
   c = Math.min(Math.max(c, 0), 1);
   return { brand, product, confidence: c };
}

function brandPrompt(item: TasteItem): string {
   const title = item.title.slice(0, 255);
   const description = item.description.slice(0, PROMPT_TEXT_MAX);
   return [
      'You extract the brand of a second-hand item listed on a barter marketplace.',
      `Title: ${JSON.stringify(title)}.`,
      `Description: ${JSON.stringify(description)}.`,
      'Return the manufacturer or brand name (for example "Samsung", "Nike", "IKEA") and the product name.',
      'If no brand is clearly stated, brand must be null. Do not guess a brand for generic items.',
      'confidence is a number from 0 to 1: how sure you are the brand is correct.',
      'Respond ONLY with a JSON object in this exact format:',
      '{"brand": string or null, "product": string or null, "confidence": number}',
      'Do not include any other text, explanation, or markdown.',
   ].join(' ');
}

// -- Groq: map brands with no strong tag ----------------------------------------
// Brands are numbered so the answer stays short (Groq counts output tokens
// per minute); validateMappings turns the numbers back into entity ids.
function mappingPrompt(
   brands: readonly { entity_id: string; name: string }[],
   allowed: readonly TasteCategory[],
): string {
   const numbered = brands.map((b, i) => ({ n: i + 1, name: b.name }));
   return [
      'Assign each brand to the marketplace category its products are most often sold in.',
      `Categories (slug: name): ${allowed.map((c) => `${c.slug}: ${c.name}`).join('; ')}.`,
      `Brands: ${JSON.stringify(numbered)}.`,
      'A sports team, club or league maps to sports-fitness (jerseys and gear).',
      'An app, website, bank, media, telecom, food or drink brand maps to null.',
      'Use only the slugs listed. Leave a brand out when no category fits or you do not know it.',
      'Respond ONLY with a JSON object mapping brand numbers to slugs, in this exact format:',
      '{"mappings": {"1": "electronics", "4": "fashion-apparel"}}',
      'Do not include any other text, explanation, or markdown.',
   ].join(' ');
}

/** { "1": slug } keyed by the brand's number in `sent` -> entity id to slug. */
export function validateMappings(
   v: unknown,
   sent: readonly { entity_id: string }[],
   allowedSlugs: ReadonlySet<string>,
): Map<string, string> | null {
   const m = (v as Record<string, unknown>).mappings;
   if (typeof m !== 'object' || m === null || Array.isArray(m)) return null;
   const out = new Map<string, string>();
   for (const [n, category] of Object.entries(m)) {
      const brand = /^\d+$/.test(n) ? sent[Number(n) - 1] : undefined;
      if (!brand || typeof category !== 'string' || !allowedSlugs.has(category)) continue;
      out.set(brand.entity_id, category);
   }
   return out;
}

// -- helpers -------------------------------------------------------------------
const squash = (s: string) =>
   s
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

export function nameMatches(brand: string, entityName: string): boolean {
   const b = squash(brand);
   return b.length > 0 && squash(entityName).includes(b);
}

function fallbackOutcome(ctx: TasteContext): TasteOutcome {
   return {
      status: 'unresolved',
      entity: null,
      resolutionSource: 'none',
      confidence: null,
      tags: null,
      related: null,
      suggestions: fillToFive([], ctx.fallbackOrder),
      suggestionSource: 'fallback',
   };
}

// -- the algorithm ---------------------------------------------------------------
export async function resolveTaste(
   item: TasteItem,
   ctx: TasteContext,
   deps: TasteDeps,
   { lastAttempt = false }: { lastAttempt?: boolean } = {},
): Promise<TasteOutcome> {
   // 1. Services never use Qloo.
   if (item.isService) return fallbackOutcome(ctx);

   // 2. Brand extraction. Without a confident brand nothing can pass the
   //    gate, so no Qloo call is spent.
   //    Groq busy or unreachable -> retry; invalid JSON or config -> fallback.
   const ext = await deps.groq(brandPrompt(item), validateExtraction);
   if (!ext.ok) {
      if (isGroqTransient(ext.reason)) throw new GroqRetryableError(ext.reason);
      return { ...fallbackOutcome(ctx), groqNote: `groq_${ext.reason}` };
   }
   const extracted = ext.value;
   if (!extracted.brand || extracted.confidence < CONFIDENCE_GATE) {
      return { ...fallbackOutcome(ctx), confidence: extracted.confidence };
   }
   const brand = extracted.brand;

   // 3. Resolution: brand, then product. Top result only.
   const queries = [brand];
   if (extracted.product && squash(extracted.product) !== squash(brand)) {
      queries.push(extracted.product);
   }
   let entity: QlooSearchEntity | null = null;
   for (const query of queries) {
      const results = unwrap(
         await deps.qloo.search({ query: query.slice(0, 200), type: 'brand' }),
      );
      const top = results[0];
      if (top && nameMatches(brand, top.name)) {
         entity = top;
         break;
      }
   }
   if (!entity) {
      return { ...fallbackOutcome(ctx), confidence: extracted.confidence };
   }

   // 4. Related brands.
   const insights = unwrap(
      await deps.qloo.insights({
         filterType: 'brand',
         signals: [entity.entity_id],
         take: RELATED_TAKE,
      }),
   );
   const related: RelatedEntity[] = insights.slice(0, RELATED_TAKE).map((e) => ({
      entity_id: e.entity_id,
      name: e.name,
      affinity: e.affinity,
      tag_ids: e.tags.map((t) => t.tag_id),
   }));

   // 5. Mapping: tags first, then one Groq batch for the rest.
   const allowed = ctx.categories.filter((c) => !NO_QLOO_SLUGS.has(c.slug));
   const allowedSlugs = new Set(allowed.map((c) => c.slug));
   const slugOf = new Map<string, string>();
   const toGroq: { entity_id: string; name: string }[] = [];
   for (const r of related) {
      const m = mapTagsToCategory(r.tag_ids);
      if (m.status === 'mapped' && allowedSlugs.has(m.slug)) slugOf.set(r.entity_id, m.slug);
      else if (m.status !== 'mapped') toGroq.push({ entity_id: r.entity_id, name: r.name });
   }
   let groqNote: string | undefined;
   if (toGroq.length > 0) {
      const mapped = await deps.groq(
         mappingPrompt(toGroq, allowed),
         (v) => validateMappings(v, toGroq, allowedSlugs),
         { maxTokens: MAPPING_MAX_TOKENS },
      );
      // Groq busy -> retry (Qloo answers are cached, so the re-run is free),
      // except on the last attempt. Other failures keep the tag-only result.
      if (mapped.ok) for (const [id, slug] of mapped.value) slugOf.set(id, slug);
      else if (isGroqTransient(mapped.reason) && !lastAttempt) {
         throw new GroqRetryableError(mapped.reason);
      } else groqNote = `groq_${mapped.reason}`;
   }

   // 6. Scoring: sum of weights per category; top contributor gives the reason.
   //    Weight = affinity x position decay, so the generic popular brands deep
   //    in the list (car makes appear for almost any brand) count less. A
   //    category needs MIN_SUPPORT brands and MIN_SHARE of the top score.
   const bySlug = new Map<
      string,
      { total: number; count: number; topName: string; topWeight: number }
   >();
   related.forEach((r, i) => {
      const slug = slugOf.get(r.entity_id);
      if (!slug) return;
      const weight = Math.max(r.affinity ?? 1, 0) * ((RELATED_TAKE - i) / RELATED_TAKE);
      const s = bySlug.get(slug);
      if (!s) bySlug.set(slug, { total: weight, count: 1, topName: r.name, topWeight: weight });
      else {
         s.total += weight;
         s.count++;
         if (weight > s.topWeight) {
            s.topWeight = weight;
            s.topName = r.name;
         }
      }
   });
   const catBySlug = new Map(ctx.categories.map((c) => [c.slug, c]));
   const supported = [...bySlug.entries()]
      .filter(([, s]) => s.count >= MIN_SUPPORT)
      .map(([slug, s]) => ({ cat: catBySlug.get(slug)!, ...s }))
      .sort((a, b) => b.total - a.total || a.cat.name.localeCompare(b.cat.name));
   const topTotal = supported[0]?.total ?? 0;
   const backed = supported
      .filter((p) => p.total >= topTotal * MIN_SHARE)
      .map((p) => ({
         category_id: p.cat.id,
         // 7. Templated reason.
         reason: `Fans of ${entity.name} also like ${p.topName}`.slice(0, REASON_MAX),
      }));
   // The listing's own category always comes first (phone-for-phone swaps
   // are normal), keeping its reason when Qloo backs it. Services and Other
   // are never suggested this way.
   const own = ctx.categories.find((c) => c.id === item.categoryId);
   const picked =
      own && !NO_QLOO_SLUGS.has(own.slug)
         ? [
              backed.find((b) => b.category_id === own.id) ?? { category_id: own.id, reason: null },
              ...backed.filter((b) => b.category_id !== own.id),
           ]
         : backed;

   return {
      status: 'resolved',
      entity: { id: entity.entity_id, name: entity.name, type: 'brand' },
      resolutionSource: 'brand_extracted',
      confidence: extracted.confidence,
      tags: entity.tags,
      related,
      suggestions: fillToFive(picked, ctx.fallbackOrder),
      suggestionSource: backed.length > 0 ? 'qloo' : 'fallback',
      ...(groqNote ? { groqNote } : {}),
   };
}

// -- database layer ------------------------------------------------------------
const json = (v: unknown) =>
   v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue);

interface Snapshot {
   title: string;
   description: string;
   categoryId: string;
}

async function loadItem(itemId: string) {
   return db.item.findUnique({
      where: { id: itemId },
      select: {
         title: true,
         description: true,
         categoryId: true,
         isService: true,
         deletedAt: true,
      },
   });
}

/** True when title, description or category changed after `before`. */
async function changedSince(itemId: string, before: Snapshot): Promise<boolean> {
   const now = await loadItem(itemId);
   return (
      !!now &&
      !now.deletedAt &&
      (now.title !== before.title ||
         now.description !== before.description ||
         now.categoryId !== before.categoryId)
   );
}

export type RunResult =
   | { outcome: 'skipped' }
   | {
        outcome: 'resolved' | 'unresolved' | 'failed';
        source: 'qloo' | 'fallback';
        changedDuringRun: boolean;
        groq?: string;
     };

export async function runItemTaste(
   itemId: string,
   deps: TasteDeps | null = null,
   opts: { lastAttempt?: boolean } = {},
): Promise<RunResult> {
   const item = await loadItem(itemId);
   if (!item || item.deletedAt) return { outcome: 'skipped' };

   const [categories, fallbackOrder] = await Promise.all([
      db.category.findMany({
         where: { isActive: true },
         select: { id: true, slug: true, name: true },
      }),
      getFallbackOrder(item.categoryId),
   ]);

   const r = await resolveTaste(
      item,
      { categories, fallbackOrder },
      deps ?? (await defaultDeps()),
      opts,
   );

   const data = {
      status: r.status,
      qlooEntityId: r.entity?.id ?? null,
      qlooEntityName: r.entity?.name ?? null,
      qlooEntityType: r.entity?.type ?? null,
      resolutionSource: r.resolutionSource,
      confidence: r.confidence === null ? null : Math.round(r.confidence * 100) / 100,
      tags: json(r.tags),
      relatedEntities: json(r.related),
      wantSuggestions: json(r.suggestions),
      suggestionSource: r.suggestionSource,
      failedReason: null,
      ...(r.status === 'resolved' ? { resolvedAt: new Date() } : {}),
   };
   // Never touches item_wants: picked wants survive a re-run.
   await db.itemTaste.upsert({
      where: { itemId },
      create: { itemId, ...data },
      update: data,
   });

   return {
      outcome: r.status,
      source: r.suggestionSource,
      changedDuringRun: await changedSince(itemId, item),
      ...(r.groqNote ? { groq: r.groqNote } : {}),
   };
}

/** Final failure: status failed with the reason, fallback suggestions. */
export async function markItemTasteFailed(
   itemId: string,
   reason: string,
): Promise<RunResult> {
   const item = await loadItem(itemId);
   if (!item || item.deletedAt) return { outcome: 'skipped' };
   const suggestions = fillToFive([], await getFallbackOrder(item.categoryId));
   const data = {
      status: 'failed',
      failedReason: reason.slice(0, 500),
      wantSuggestions: json(suggestions),
      suggestionSource: 'fallback',
   };
   await db.itemTaste.upsert({
      where: { itemId },
      create: { itemId, ...data },
      update: data,
   });
   return { outcome: 'failed', source: 'fallback', changedDuringRun: false };
}

// Loaded lazily so tests of resolveTaste() never build the live client.
async function defaultDeps(): Promise<TasteDeps> {
   const { qlooClient } = await import('./qloo');
   return { qloo: qlooClient, groq: defaultGroqJson };
}
