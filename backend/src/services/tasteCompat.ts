// Pure person-to-person taste compatibility (DB §10.8). No database or
// network here: the taste-compat job and the compatibility endpoints load
// the profiles and call compareProfiles. Fixtures: src/scripts/compat-fixtures.ts.

import { MIN_ACTIVE_ENTITIES } from './tasteSummary';
import { SHOWN_TAG_PREFIXES, type TagRef } from './matchScoring';

/** Pairs below this are not stored. */
export const COMPAT_MIN = 0.1;
export const COMPAT_MEDIUM_AT = 0.25;
export const COMPAT_HIGH_AT = 0.45;
/** O in match scoring: score ÷ this, capped at 1, so a "high" pair counts
 *  in full (raw scores sit mostly between 0.1 and 0.4). */
export const OWNER_FULL_AT = COMPAT_HIGH_AT;
export const ENTITY_WEIGHT = 0.6;
export const TAG_WEIGHT = 0.4;
/** Shared interests / tags shown at most (API §16.3 Compatibility). */
export const SHOWN_MAX = 6;
export const COMPAT_METHOD = 'local_overlap';

export type CompatLabel = 'high' | 'medium' | 'low';

/** A saved taste entity as the comparison needs it. */
export interface ProfileEntity {
   qloo_entity_id: string;
   name: string;
   entity_type: string;
   image_url: string | null;
   tags: TagRef[];
}

/** TasteEntity (API §16.3), stored on taste_compatibilities.shared_entities. */
export type SharedEntity = Omit<ProfileEntity, 'tags'>;

export interface PairResult {
   score: number;
   shared_entities: SharedEntity[];
   shared_tags: TagRef[];
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function isActiveProfile(entities: unknown[]): boolean {
   return entities.length >= MIN_ACTIVE_ENTITIES;
}

/** Tags saved on an entity row (JSON), keeping well-formed ones only. */
export function readTags(raw: unknown): TagRef[] {
   return Array.isArray(raw)
      ? (raw as TagRef[]).filter((t) => t && typeof t.tag_id === 'string' && typeof t.name === 'string')
      : [];
}

function tagOrder(tagId: string): number {
   const i = SHOWN_TAG_PREFIXES.findIndex((p) => tagId.startsWith(p));
   return i < 0 ? SHOWN_TAG_PREFIXES.length : i;
}

/**
 * Entity overlap E = shared ÷ smaller profile; tag overlap = shared tag ids
 * ÷ smaller tag set (each profile's tags pooled over its entities). Score =
 * 0.6 × E + 0.4 × tags, or E alone when either side has no tags. Null when
 * either profile is inactive. Shared entities keep `a`'s order.
 */
export function compareProfiles(a: ProfileEntity[], b: ProfileEntity[]): PairResult | null {
   if (!isActiveProfile(a) || !isActiveProfile(b)) return null;

   const bIds = new Set(b.map((e) => e.qloo_entity_id));
   const shared = a.filter((e) => bIds.has(e.qloo_entity_id));
   const e = shared.length / Math.min(a.length, b.length);

   const pool = (p: ProfileEntity[]) => {
      const m = new Map<string, TagRef>();
      for (const ent of p) for (const t of ent.tags) if (!m.has(t.tag_id)) m.set(t.tag_id, t);
      return m;
   };
   const aTags = pool(a);
   const bTags = pool(b);
   const sharedTags = [...aTags.values()].filter((t) => bTags.has(t.tag_id));
   const hasTags = aTags.size > 0 && bTags.size > 0;
   const tov = hasTags ? sharedTags.length / Math.min(aTags.size, bTags.size) : 0;

   return {
      score: round3(hasTags ? ENTITY_WEIGHT * e + TAG_WEIGHT * tov : e),
      shared_entities: shared.map(({ tags: _t, ...rest }) => rest),
      // Genre first, then aesthetic, lifestyle, core value.
      shared_tags: sharedTags
         .map((t, i) => ({ t, i, o: tagOrder(t.tag_id) }))
         .sort((x, y) => x.o - y.o || x.i - y.i)
         .map(({ t }) => t),
   };
}

/** high ≥ 0.45, medium ≥ 0.25, low ≥ 0.10, else null (not stored). */
export function compatLabel(score: number): CompatLabel | null {
   if (score >= COMPAT_HIGH_AT) return 'high';
   if (score >= COMPAT_MEDIUM_AT) return 'medium';
   if (score >= COMPAT_MIN) return 'low';
   return null;
}

/** Component O for match scoring (0 to 1). */
export function ownerScore(score: number): number {
   return round3(Math.min(1, Math.max(0, score) / OWNER_FULL_AT));
}

/** One row per pair, lower id first (string comparison, DB §3.22). */
export function pairIds(x: string, y: string): { userAId: string; userBId: string } {
   return x < y ? { userAId: x, userBId: y } : { userAId: y, userBId: x };
}

/** The Compatibility object (API §16.3); shared tags only where asked. */
export function formatCompatibility(
   row: { score: number; shared_entities: SharedEntity[]; shared_tags?: TagRef[] | null },
   { withTags = false } = {},
) {
   return {
      score_label: compatLabel(row.score),
      shared_entities: row.shared_entities.slice(0, SHOWN_MAX),
      shared_count: row.shared_entities.length,
      ...(withTags ? { shared_tags: (row.shared_tags ?? []).slice(0, SHOWN_MAX) } : {}),
   };
}

/** Shared entities stored as JSON, keeping well-formed ones only. */
export function readShared(raw: unknown): SharedEntity[] {
   return Array.isArray(raw)
      ? (raw as SharedEntity[])
           .filter((e) => e && typeof e.qloo_entity_id === 'string' && typeof e.name === 'string')
           .map((e) => ({
              qloo_entity_id: e.qloo_entity_id,
              name: e.name,
              entity_type: e.entity_type,
              image_url: e.image_url ?? null,
           }))
      : [];
}

// ── Listing previews ─────────────────────────────────────────────────────────

/** A person's listing with its stored brand data (item_tastes). */
export interface PreviewCandidate {
   id: string;
   createdAt: Date;
   entityId: string | null;
   tags: TagRef[];
   /** The listing brand's related brands: [{ entity_id, affinity }]. */
   related: { entity_id: string; affinity: number | null }[];
}

/** The viewer's interests as preview ranking needs them. */
export interface ViewerTaste {
   entityIds: Set<string>;
   tagIds: Set<string>;
}

/** related_entities JSON read back safely. */
export function readRelated(raw: unknown): PreviewCandidate['related'] {
   return Array.isArray(raw)
      ? (raw as { entity_id?: unknown; affinity?: unknown }[])
           .filter((r) => r && typeof r.entity_id === 'string')
           .map((r) => ({
              entity_id: r.entity_id as string,
              affinity: typeof r.affinity === 'number' ? r.affinity : null,
           }))
      : [];
}

/**
 * Order a person's listings by fit with the viewer's taste: (1) the brand
 * is one of the viewer's interests, (2) one of the viewer's interests is a
 * related brand of the listing's brand (stronger first), (3) more tags in
 * common, (4) newest. Stored data only; no Qloo call.
 */
export function rankPreviews<T extends PreviewCandidate>(items: T[], viewer: ViewerTaste): T[] {
   const key = (c: T) => {
      const own = c.entityId !== null && viewer.entityIds.has(c.entityId) ? 1 : 0;
      let related = -1;
      for (const r of c.related) {
         if (viewer.entityIds.has(r.entity_id)) related = Math.max(related, r.affinity ?? 0);
      }
      const tags = c.tags.filter((t) => viewer.tagIds.has(t.tag_id)).length;
      return { own, related, tags };
   };
   return items
      .map((c) => ({ c, k: key(c) }))
      .sort(
         (a, b) =>
            b.k.own - a.k.own ||
            b.k.related - a.k.related ||
            b.k.tags - a.k.tags ||
            b.c.createdAt.getTime() - a.c.createdAt.getTime() ||
            (a.c.id < b.c.id ? 1 : -1),
      )
      .map(({ c }) => c);
}
