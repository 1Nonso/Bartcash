// ============================================================================
// Category tag map — Phase 3 v3.0, Section 10.5 (revised after the Oct 9 review
// of the Qloo spike data).
//
// Maps Qloo brand-taxonomy tags to Bartcash category slugs. Edit this file to
// correct a mapping; no other code changes are needed.
//
// Rules (implemented in src/services/qloo/categoryMapper.ts):
//   - `prefix` is the tag id AFTER "urn:tag:genre:brand:" (e.g. "electronics",
//     "fashion:athletic"). It matches that tag and anything nested under it,
//     on ":" boundaries only.
//   - Across all of a brand's tags, the LONGEST matching prefix wins.
//   - Ties on length go to the slug listed first in this file.
//   - A rule marked `weak: true` is too generic to trust on its own. A brand
//     that matches ONLY weak rules is not assigned a category; the caller
//     sends it to the batched Groq call to confirm. Any strong match beats a
//     weak one regardless of length.
//   - Slugs with no rules (kids-baby, services, other) are never assigned
//     from tags: Qloo has no usable evidence for them.
//
// Deliberately NOT mapped: `academic` (Oxford University Press resolved to the
// university), `software`, `telecom`, and the bare `entertainment` root.
// ============================================================================

export const TAG_PREFIX =
   'urn:tag:genre:brand:';

export interface TagRule {
   prefix: string;
   weak?: boolean;
}

export const CATEGORY_TAG_MAP: Record<
   string,
   TagRule[]
> = {
   electronics: [
      { prefix: 'electronics' },
      // Nintendo carries only this tag, not an electronics one (spike 2).
      {
         prefix:
            'entertainment:video_game_developer',
      },
   ],
   'fashion-apparel': [
      { prefix: 'fashion' },
      // Beauty was merged into Fashion & Beauty (Phase 3, 10.5).
      { prefix: 'health_and_beauty' },
   ],
   // More specific than `fashion`, so it wins for brands that carry it
   // (Wilson, Decathlon). Sneaker tags stay in fashion on purpose.
   'sports-fitness': [
      { prefix: 'fashion:athletic' },
   ],
   'vehicles-parts': [
      { prefix: 'automotive' },
   ],
   'books-stationery': [
      {
         prefix:
            'entertainment:publisher',
      },
   ],
   // `retail` is generic (IKEA, Ashley, but also any retailer): weak.
   'home-furniture': [
      { prefix: 'retail', weak: true },
   ],
   'kids-baby': [],
   services: [],
   other: [],
};
