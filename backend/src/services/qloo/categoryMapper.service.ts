import { z } from 'zod';
import {
   CATEGORY_TAG_MAP,
   TAG_PREFIX,
   type TagRule,
} from '../../config/categoryTagMap';

// ---------------------------------------------------------------------------
// Config shape check — runs once at import, so a malformed map fails the
// process at boot instead of silently mis-mapping brands.
// ---------------------------------------------------------------------------
const prefixSchema = z
   .string()
   .min(1)
   .refine(
      (p) => !p.startsWith('urn:'),
      {
         message: `prefix must omit "${TAG_PREFIX}"`,
      },
   )
   .refine(
      (p) =>
         !p.startsWith(':') &&
         !p.endsWith(':') &&
         !p.includes('::'),
      {
         message:
            'prefix must not start/end with ":" or contain "::"',
      },
   );

const tagMapSchema = z.record(
   z.string().min(1),
   z.array(
      z.object({
         prefix: prefixSchema,
         weak: z.boolean().optional(),
      }),
   ),
);

tagMapSchema.parse(CATEGORY_TAG_MAP);

// Flattened once: [{ slug, prefix, weak, depth, order }]
interface FlatRule {
   slug: string;
   prefix: string;
   weak: boolean;
   depth: number;
   order: number;
}

const FLAT_RULES: FlatRule[] =
   Object.entries(
      CATEGORY_TAG_MAP,
   ).flatMap(([slug, rules], order) =>
      rules.map((r: TagRule) => ({
         slug,
         prefix: r.prefix,
         weak: r.weak === true,
         depth: r.prefix.split(':')
            .length,
         order,
      })),
   );

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export type CategoryMatch =
   | { status: 'mapped'; slug: string }
   // Matched only weak rules: caller should confirm via the Groq batch call.
   | { status: 'weak'; slug: string }
   | { status: 'unmapped' };

/** A tag as stored by Bartcash ({ tag_id, name }) or a bare tag id string. */
export type TagInput =
   string | { tag_id: string };

function normalise(
   tag: TagInput,
): string | null {
   const id =
      typeof tag === 'string'
         ? tag
         : tag.tag_id;
   if (
      typeof id !== 'string' ||
      !id.startsWith(TAG_PREFIX)
   )
      return null;
   const rest = id.slice(
      TAG_PREFIX.length,
   );
   return rest.length > 0 ? rest : null;
}

function matches(
   tag: string,
   prefix: string,
): boolean {
   return (
      tag === prefix ||
      tag.startsWith(prefix + ':')
   );
}

/**
 * Map one brand's tags to a category slug.
 * Strong rules beat weak ones; then longest prefix; then file order.
 */
export function mapTagsToCategory(
   tags:
      | readonly TagInput[]
      | null
      | undefined,
): CategoryMatch {
   if (!tags || tags.length === 0)
      return { status: 'unmapped' };

   const normalised = tags
      .map(normalise)
      .filter(
         (t): t is string => t !== null,
      );

   let best: FlatRule | null = null;

   for (const tag of normalised) {
      for (const rule of FLAT_RULES) {
         if (!matches(tag, rule.prefix))
            continue;
         if (
            best === null ||
            isBetter(rule, best)
         )
            best = rule;
      }
   }

   if (best === null)
      return { status: 'unmapped' };
   return best.weak
      ? {
           status: 'weak',
           slug: best.slug,
        }
      : {
           status: 'mapped',
           slug: best.slug,
        };
}

function isBetter(
   a: FlatRule,
   b: FlatRule,
): boolean {
   if (a.weak !== b.weak)
      return !a.weak; // strong beats weak
   if (a.depth !== b.depth)
      return a.depth > b.depth; // longer prefix wins
   return a.order < b.order; // earlier slug in the file wins
}

/**
 * Call at boot with the slugs of ACTIVE categories (from the database).
 * Throws if the map references a slug that is missing or inactive.
 */
export function validateTagMapSlugs(
   activeSlugs: readonly string[],
): void {
   const active = new Set(activeSlugs);
   const bad = Object.keys(
      CATEGORY_TAG_MAP,
   ).filter((s) => !active.has(s));
   if (bad.length > 0) {
      throw new Error(
         `categoryTagMap references missing or inactive categories: ${bad.join(', ')}`,
      );
   }
}
