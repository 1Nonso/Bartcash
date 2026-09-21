/**
 * BartCash Design System — Typography Tokens
 *
 * Font families observed in Figma:
 *   - Headings/Display: System default sans-serif (likely SF Pro on iOS, Roboto on Android)
 *     The Figma design uses a clean geometric sans throughout at varying weights.
 *     We map this to the React Native system font stack for native feel.
 *
 * Usage:
 *   import { Typography } from '@/theme/typography';
 *   <Text style={Typography.heading1}>...</Text>
 */

import { Platform, TextStyle } from 'react-native';

// Platform-native font stacks
const fontFamily = {
  /** Default system sans (SF Pro / Roboto) */
  sans: Platform.select({
    ios: undefined,   // undefined = system default on iOS (SF Pro)
    android: undefined, // undefined = system default on Android (Roboto)
  }),
  /** Monospace — used for code/values if needed */
  mono: Platform.select({
    ios: 'Courier New',
    android: 'monospace',
  }),
};

// Font weights (as string literals for RN)
export const FontWeight = {
  regular: '400' as TextStyle['fontWeight'],
  medium:  '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold:    '700' as TextStyle['fontWeight'],
  extrabold: '800' as TextStyle['fontWeight'],
} as const;

// Font size scale (sp — scales with system accessibility settings)
export const FontSize = {
  /** 11sp — timestamps, tiny labels */
  xs:   11,
  /** 12sp — captions, meta, badges */
  sm:   12,
  /** 13sp — secondary body */
  base: 13,
  /** 14sp — body, input text, list items */
  md:   14,
  /** 15sp — emphasized body */
  lg:   15,
  /** 17sp — section titles, card titles */
  xl:   17,
  /** 20sp — screen subtitles */
  '2xl': 20,
  /** 24sp — screen titles (e.g. "Discover", "Search") */
  '3xl': 24,
  /** 28sp — large page headers */
  '4xl': 28,
  /** 32sp — hero headers */
  '5xl': 32,
} as const;

// Line height scale
export const LineHeight = {
  tight:   1.2,
  snug:    1.35,
  normal:  1.5,
  relaxed: 1.625,
} as const;

// ─── Semantic Typography Styles ─────────────────────────────────────────────
// These map to the actual text styles visible in the Figma designs.

export const Typography = {
  // Page-level headings (e.g. "Discover", "Search", "My Listings")
  pageTitle: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    letterSpacing: -0.5,
    lineHeight: FontSize['3xl'] * LineHeight.tight,
  } as TextStyle,

  // Section headers within pages
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.xl * LineHeight.snug,
  } as TextStyle,

  // Card/listing title (e.g. "iPhone 11 - 64GB (Clean)")
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.md * LineHeight.snug,
  } as TextStyle,

  // Card title large (e.g. on Listing Detail, Offer screens)
  cardTitleLarge: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    lineHeight: FontSize['2xl'] * LineHeight.tight,
  } as TextStyle,

  // Chat/offer headline (e.g. "Razer BlackWidow V3 Gaming Keyboard")
  offerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.xl * LineHeight.snug,
  } as TextStyle,

  // Body text
  body: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.md * LineHeight.normal,
  } as TextStyle,

  // Body medium weight
  bodyMedium: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.md * LineHeight.normal,
  } as TextStyle,

  // Secondary / meta text (e.g. "Brand New • Gadget • 2 days ago")
  caption: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.sm * LineHeight.normal,
  } as TextStyle,

  // Caption medium
  captionMedium: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.sm * LineHeight.normal,
  } as TextStyle,

  // Timestamps, tiny labels
  micro: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.xs * LineHeight.normal,
  } as TextStyle,

  // Input labels (e.g. "Email Address", "Full Name")
  inputLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.md * LineHeight.snug,
  } as TextStyle,

  // Input text / placeholder
  input: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.md * LineHeight.normal,
  } as TextStyle,

  // Button text
  button: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.1,
    lineHeight: FontSize.md * LineHeight.snug,
  } as TextStyle,

  // Button text small
  buttonSm: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.1,
    lineHeight: FontSize.sm * LineHeight.snug,
  } as TextStyle,

  // Tab bar label
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.xs * LineHeight.snug,
  } as TextStyle,

  // Badge / chip text
  badge: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
    lineHeight: FontSize.xs * LineHeight.snug,
  } as TextStyle,

  // AI value price display (e.g. "$85 - $95" / "N330k")
  aiValue: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.bold,
    letterSpacing: -1,
    lineHeight: FontSize['4xl'] * LineHeight.tight,
  } as TextStyle,

  // Trade match score percentage (e.g. "80%")
  matchScore: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.md * LineHeight.snug,
  } as TextStyle,

  // Section subtitle / subheading (e.g. form section labels)
  formSectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.lg * LineHeight.snug,
  } as TextStyle,

  // Small hint/tip text
  hint: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.sm * LineHeight.relaxed,
  } as TextStyle,

  // Screen back/nav label
  navLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.md * LineHeight.snug,
  } as TextStyle,

  // Stats numbers on profile (e.g. "12", "48", "156")
  statNumber: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.xl * LineHeight.tight,
  } as TextStyle,

  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.xs * LineHeight.snug,
  } as TextStyle,
} as const;
