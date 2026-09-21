/**
 * BartCash Design System — Spacing, Border Radius, Shadows & Layout
 *
 * All values derived from visual measurement of the Figma designs.
 *
 * Usage:
 *   import { Spacing, Radius, Shadows, Layout } from '@/theme/spacing';
 */

import { Platform } from 'react-native';

// ─── Spacing Scale (base 4) ──────────────────────────────────────────────────
export const Spacing = {
  /** 2px — micro gap between inline elements */
  0.5: 2,
  /** 4px — tight component padding */
  1:  4,
  /** 6px — between badge elements */
  1.5: 6,
  /** 8px — small padding, icon margins */
  2:  8,
  /** 10px */
  2.5: 10,
  /** 12px — internal card padding, row gaps */
  3:  12,
  /** 14px */
  3.5: 14,
  /** 16px — standard screen horizontal padding */
  4:  16,
  /** 20px — generous padding */
  5:  20,
  /** 24px — card padding, section gaps */
  6:  24,
  /** 28px */
  7:  28,
  /** 32px — large section spacing */
  8:  32,
  /** 40px */
  10: 40,
  /** 48px — screen-level spacing */
  12: 48,
  /** 64px — hero spacing */
  16: 64,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────
export const Radius = {
  /** 4px — small elements, badges */
  xs:   4,
  /** 6px — small buttons */
  sm:   6,
  /** 8px — inputs, small cards */
  md:   8,
  /** 12px — standard cards */
  lg:   12,
  /** 16px — large cards, modals */
  xl:   16,
  /** 20px — filter pill bottom sheet */
  '2xl': 20,
  /** 24px — large bottom sheets */
  '3xl': 24,
  /** 9999px — circular/pill */
  full: 9999,
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
// Card shadows observed in Figma: very subtle, low-elevation shadows.
// Using platform-specific implementations.

export const Shadows = {
  /** No shadow — flat surfaces */
  none: Platform.select({
    ios: {},
    android: { elevation: 0 },
  }),

  /** xs — barely visible card border-shadow */
  xs: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
  }),

  /** sm — standard listing card, profile stats card */
  sm: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
  }),

  /** md — floating buttons, focused input cards */
  md: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
  }),

  /** lg — bottom sheets, modals, sticky headers */
  lg: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: { elevation: 8 },
  }),

  /** xl — tab bar, floating action buttons */
  xl: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -1 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    android: { elevation: 12 },
  }),
} as const;

// ─── Layout Constants ─────────────────────────────────────────────────────────

export const Layout = {
  /** Standard horizontal screen padding (16px each side) */
  screenPadding: Spacing[4],

  /** Gap between grid cards (listing grid) */
  gridGap: Spacing[2],

  /** Number of columns in listing grid */
  gridColumns: 2,

  /** Bottom tab bar height */
  tabBarHeight: 60,

  /** Safe area top padding (status bar) — use with useSafeAreaInsets() */
  statusBarHeight: 44, // iOS default; override with hook

  /** Standard header height */
  headerHeight: 56,

  /** Standard input height */
  inputHeight: 48,

  /** Standard button height */
  buttonHeight: 48,

  /** Button height small */
  buttonHeightSm: 36,

  /** Border width — input, card borders */
  borderWidth: 1,

  /** Border width thick — active/selected states */
  borderWidthThick: 1.5,

  /** Standard icon size */
  iconSm:  16,
  iconMd:  20,
  iconLg:  24,
  iconXl:  28,

  /** Avatar sizes */
  avatarXs: 28,
  avatarSm: 36,
  avatarMd: 44,
  avatarLg: 56,
  avatarXl: 80,

  /** Listing card photo aspect ratio (roughly square in grid) */
  listingCardAspect: 1.0,

  /** Listing detail hero image aspect ratio */
  listingHeroAspect: 1.0,

  /** Bottom sheet handle height */
  bottomSheetHandleHeight: 4,
} as const;

// ─── Z-Index Stack ───────────────────────────────────────────────────────────
export const ZIndex = {
  base:       0,
  card:       10,
  overlay:    20,
  header:     30,
  tabBar:     40,
  bottomSheet: 50,
  modal:      60,
  toast:      70,
} as const;
