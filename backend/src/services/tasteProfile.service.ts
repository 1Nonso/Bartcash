// Taste profile (API §16.4, DB §3.21, FLOW §10.3): search Qloo for interests,
// read and replace the caller's profile. Pure parts (validation, diff,
// shaping) are exported for src/scripts/taste-fixtures.ts.

import z from 'zod';
import { db } from '../config/db.config';
import {
   BARTCASH_ENTITY_TYPES,
   fromQlooTypes,
   type BartcashEntityType,
   type QlooResult,
   type QlooSearchEntity,
} from './qloo';
import { MIN_ACTIVE_ENTITIES } from './tasteSummary';
import { queueMatchRefresh } from './matchRefresh.service';

export const MAX_ENTITIES = 25;
export const SEARCH_DEFAULT_LIMIT = 10;
export const SEARCH_MAX_LIMIT = 20;
const SEARCH_TAKE = SEARCH_MAX_LIMIT + 5;
/** Tags kept per entity (Qloo sends 40 to 170+; most are market or business noise). */
export const MAX_TAGS = 30;
/** Tag types worth keeping for compatibility and display, in priority order. */
export const KEPT_TAG_PREFIXES = [
   'urn:tag:genre:',
   'urn:tag:aesthetic_property:',
   'urn:tag:lifestyle:',
   'urn:tag:core_value:',
];

const entityType = z.enum(BARTCASH_ENTITY_TYPES as [BartcashEntityType, ...BartcashEntityType[]]);

// ── Validation ───────────────────────────────────────────────────────────────

export const searchQuerySchema = z.object({
   q: z
      .string({ error: 'Enter something to search for.' })
      .trim()
      .min(2, 'Enter at least 2 characters.')
      .max(60),
   type: entityType.optional(),
   limit: z.coerce.number().int().min(1).max(SEARCH_MAX_LIMIT).default(SEARCH_DEFAULT_LIMIT),
});

const tagSchema = z.object({ tag_id: z.string().min(1).max(200), name: z.string().max(200) });

const entityInput = z.object({
   qloo_entity_id: z.string().trim().min(1).max(100),
   name: z.string().trim().min(1).max(255),
   entity_type: entityType,
   image_url: z.string().max(500).nullish(),
   tags: z.array(tagSchema).max(100).nullish(),
});

export const profileBodySchema = z.object({
   entities: z
      .array(entityInput, { error: 'entities must be a list.' })
      .max(MAX_ENTITIES, `At most ${MAX_ENTITIES} interests.`)
      .refine(
         (list) => new Set(list.map((e) => e.qloo_entity_id)).size === list.length,
         'Each interest can be added once.',
      ),
});

export type EntityInput = z.infer<typeof entityInput>;

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** The kept tag types, in prefix priority then Qloo's order, at most MAX_TAGS. */
export function keepTags(tags: { tag_id: string; name: string }[]): { tag_id: string; name: string }[] {
   const rank = (id: string) => KEPT_TAG_PREFIXES.findIndex((p) => id.startsWith(p));
   return tags
      .map((t, i) => ({ t, i, r: rank(t.tag_id) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .slice(0, MAX_TAGS)
      .map((x) => x.t);
}

/** What a replace does: rows to delete (by entity id) and entities to insert. */
export function diffProfile(
   existingIds: string[],
   wanted: EntityInput[],
): { remove: string[]; add: EntityInput[] } {
   const want = new Set(wanted.map((e) => e.qloo_entity_id));
   const have = new Set(existingIds);
   return {
      remove: existingIds.filter((id) => !want.has(id)),
      add: wanted.filter((e) => !have.has(e.qloo_entity_id)),
   };
}

export interface SearchEntity {
   qloo_entity_id: string;
   name: string;
   entity_type: BartcashEntityType;
   image_url: string | null;
   tags: { tag_id: string; name: string }[];
   already_added: boolean;
}

/** Qloo search results as API entities; unknown types are dropped. */
export function toSearchEntities(
   results: QlooSearchEntity[],
   onProfile: Set<string>,
   limit: number,
): SearchEntity[] {
   const out: SearchEntity[] = [];
   for (const r of results) {
      const type = fromQlooTypes(r.types);
      if (!type) continue;
      out.push({
         qloo_entity_id: r.entity_id,
         name: r.name,
         entity_type: type,
         image_url: r.image_url,
         tags: keepTags(r.tags),
         already_added: onProfile.has(r.entity_id),
      });
      if (out.length >= limit) break;
   }
   return out;
}

// ── Profile ──────────────────────────────────────────────────────────────────

export interface ProfileData {
   entities: {
      id: string;
      qloo_entity_id: string;
      name: string;
      entity_type: string;
      image_url: string | null;
   }[];
   entity_count: number;
   is_active: boolean;
   min_active: number;
   max_entities: number;
   updated_at: Date | null;
}

export async function getProfile(userId: string): Promise<ProfileData> {
   const [rows, user] = await Promise.all([
      db.userTasteEntity.findMany({
         where: { userId },
         orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
         select: { id: true, qlooEntityId: true, name: true, entityType: true, imageUrl: true },
      }),
      db.user.findUnique({ where: { id: userId }, select: { tasteUpdatedAt: true } }),
   ]);
   return {
      entities: rows.map((r) => ({
         id: r.id,
         qloo_entity_id: r.qlooEntityId,
         name: r.name,
         entity_type: r.entityType,
         image_url: r.imageUrl,
      })),
      entity_count: rows.length,
      is_active: rows.length >= MIN_ACTIVE_ENTITIES,
      min_active: MIN_ACTIVE_ENTITIES,
      max_entities: MAX_ENTITIES,
      updated_at: user?.tasteUpdatedAt ?? null,
   };
}

/**
 * Replace the profile in one transaction: delete removed rows, insert new
 * ones, leave unchanged rows (and their saved tags and dates) alone. Then
 * refresh the user's matches, since T uses their recent taste entities.
 * (The taste-compat job would do this; it does not exist yet.)
 */
export async function replaceProfile(userId: string, wanted: EntityInput[]): Promise<ProfileData> {
   await db.$transaction(async (tx) => {
      const existing = await tx.userTasteEntity.findMany({
         where: { userId },
         select: { qlooEntityId: true },
      });
      const { remove, add } = diffProfile(
         existing.map((e) => e.qlooEntityId),
         wanted,
      );
      if (remove.length > 0) {
         await tx.userTasteEntity.deleteMany({ where: { userId, qlooEntityId: { in: remove } } });
      }
      if (add.length > 0) {
         await tx.userTasteEntity.createMany({
            data: add.map((e) => ({
               userId,
               qlooEntityId: e.qloo_entity_id,
               name: e.name,
               entityType: e.entity_type,
               imageUrl: e.image_url ?? null,
               tags: keepTags(e.tags ?? []),
            })),
         });
      }
      await tx.user.update({ where: { id: userId }, data: { tasteUpdatedAt: new Date() } });
   });

   // Only listings with wants can have matches.
   const items = await db.item.findMany({
      where: { userId, status: 'available', deletedAt: null, wants: { some: {} } },
      select: { id: true },
   });
   for (const i of items) await queueMatchRefresh(i.id, 'taste_profile');

   return getProfile(userId);
}

// ── Search ───────────────────────────────────────────────────────────────────

export interface TasteSearchQloo {
   search(args: {
      query: string;
      type: BartcashEntityType | readonly BartcashEntityType[];
      take?: number;
      purpose?: 'interactive' | 'background';
   }): Promise<QlooResult<QlooSearchEntity[]>>;
}

export type SearchOutcome =
   | { ok: true; entities: SearchEntity[] }
   | { ok: false; reason: string };

/** Qloo search for the caller (interactive budget). Never throws. */
export async function searchTaste(
   qloo: TasteSearchQloo,
   userId: string,
   args: { q: string; type?: BartcashEntityType | undefined; limit: number },
): Promise<SearchOutcome> {
   try {
      // Always the same take, so each query and type is cached once whatever
      // the limit (take is part of the cache key); a few extra cover results
      // of an unknown type, which are dropped.
      const r = await qloo.search({
         query: args.q,
         type: args.type ?? BARTCASH_ENTITY_TYPES,
         take: SEARCH_TAKE,
         purpose: 'interactive',
      });
      if (!r.ok) return { ok: false, reason: r.reason };
      const onProfile = new Set(
         (
            await db.userTasteEntity.findMany({ where: { userId }, select: { qlooEntityId: true } })
         ).map((e) => e.qlooEntityId),
      );
      return { ok: true, entities: toSearchEntities(r.data, onProfile, args.limit) };
   } catch (err) {
      return { ok: false, reason: (err as Error)?.name ?? 'error' };
   }
}

export async function defaultTasteQloo(): Promise<TasteSearchQloo> {
   const { qlooClient } = await import('./qloo');
   return qlooClient;
}
