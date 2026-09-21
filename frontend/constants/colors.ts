/**
 * BartCash Design System — Color Tokens
 * Extracted from Figma design files (February 2026)
 *
 * Usage:
 *   import { Colors } from '@/theme/colors';
 *   style={{ color: Colors.text.primary }}
 */

export const Colors = {
  // ─── Brand / Primary ────────────────────────────────────────────────────────
  /** Main black used for primary buttons, nav, headings */
  primary: "#1D1B20",
  /** Pure white — card surfaces, modal backgrounds */
  white: "#FFFFFF",
  /** Off-white page background */
  background: "#F5F5F5",
  /** Card / surface background */
  surface: "#FFFFFF",
  /** Slightly warm off-white — input backgrounds, secondary surfaces */
  surfaceVariant: "#FAFAFA",

  // ─── AI / Purple Accent ─────────────────────────────────────────────────────
  /** Purple — AI Estimated Value label, AI icon, progress bars */
  ai: "#6750A4",
  /** Light purple chip background — AI value tag bg */
  aiLight: "#E8DEF8",
  /** Lightest purple tint — subtle AI section bg */
  aiSurface: "#F7F2FA",

  // ─── Semantic ───────────────────────────────────────────────────────────────
  /** Green — "New" condition badge, "Fair trade" indicator, success */
  success: "#518740",
  /** Light green bg for success states */
  successLight: "#E8F5E3",
  /** Red — destructive actions, reject offer, delete, errors */
  danger: "#F00004",
  /** Light red bg */
  dangerLight: "#FEE2E2",
  /** Blue — links, active state, "Accepted" offer status */
  info: "#0800F9",
  /** Light blue bg */
  infoLight: "#EEF2FF",
  /** Yellow — "Pending" offer status, warnings */
  warning: "#F9CB00",
  /** Light yellow bg */
  warningLight: "#FEF9C3",

  // ─── Offer Status Badges ────────────────────────────────────────────────────
  statusPending: {
    text: "#92400E",
    background: "#FEF9C3",
    dot: "#F9CB00",
  },
  statusAccepted: {
    text: "#166534",
    background: "#DCFCE7",
    dot: "#518740",
  },
  statusRejected: {
    text: "#991B1B",
    background: "#FEE2E2",
    dot: "#F00004",
  },
  statusCountered: {
    text: "#1E3A8A",
    background: "#EEF2FF",
    dot: "#0800F9",
  },
  statusSold: {
    text: "#374151",
    background: "#F3F4F6",
    dot: "#6B7280",
  },

  // ─── Text ────────────────────────────────────────────────────────────────────
  text: {
    /** Primary text — headings, body */
    primary: "#1D1B20",
    /** Secondary text — meta info, subtitles */
    secondary: "#49454F",
    /** Tertiary / muted — timestamps, captions */
    tertiary: "#625B71",
    /** Placeholder text in inputs */
    placeholder: "#757575",
    /** Disabled text */
    disabled: "#B3B3B3",
    /** Text on dark/colored backgrounds */
    inverse: "#FFFFFF",
    /** Link color */
    link: "#0800F9",
    /** Danger text (inline errors) */
    danger: "#F00004",
  },

  // ─── Border / Dividers ───────────────────────────────────────────────────────
  border: {
    /** Default card / input border */
    default: "#CAC4D0",
    /** Subtle divider */
    subtle: "#E6E6E6",
    /** Strong border */
    strong: "#B2B2B2",
    /** Input focused border */
    focus: "#1D1B20",
  },

  // ─── UI Grays ────────────────────────────────────────────────────────────────
  gray: {
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#E6E6E6",
    300: "#D9D9D9",
    400: "#B3B3B3",
    500: "#767676",
    600: "#625B71",
    700: "#49454F",
    800: "#2C2C2C",
    900: "#1E1E1E",
  },

  // ─── Tab Bar ─────────────────────────────────────────────────────────────────
  tabBar: {
    background: "#FFFFFF",
    active: "#1D1B20",
    inactive: "#757575",
    border: "#E6E6E6",
    sellButton: "#1D1B20",
    sellButtonIcon: "#FFFFFF",
  },

  // ─── Transparent Overlays ────────────────────────────────────────────────────
  overlay: {
    dark: "rgba(0, 0, 0, 0.50)",
    light: "rgba(255, 255, 255, 0.90)",
    card: "rgba(0, 0, 0, 0.10)",
    badge: "rgba(0, 0, 0, 0.25)",
    input: "rgba(0, 0, 0, 0.15)",
  },
} as const;

export const ThemeColors = {
  light: {
    text: "#1D1B20",
    background: "#F5F5F5",
    tint: "#6750A4",
    icon: "#49454F",
    tabIconDefault: "#757575",
    tabIconSelected: "#1D1B20",
  },
  dark: {
    text: "#F5F5F5",
    background: "#1D1B20",
    tint: "#A78BFA",
    icon: "#CAC4D0",
    tabIconDefault: "#625B71",
    tabIconSelected: "#F5F5F5",
  },
} as const;

export type ColorToken = typeof Colors;
