/**
 * Bartcash — shared listing helpers
 * Place at: utils/listing.ts
 *
 * Replaces the copies of formatValuation / conditionLabel / timeAgo that live
 * in dashboard.tsx, search.tsx and my-listings.tsx. Currency is USD.
 */

import { Colors } from "@/constants";

type ValuationLike = {
  status: "pending" | "completed" | "failed";
  value_min: string | null;
  value_max: string | null;
} | null;

const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export function conditionLabel(condition: string): string {
  return CONDITION_LABELS[condition] ?? condition;
}

/** Spec ConditionBadge: New green, Good blue, Fair amber, Poor red. */
export function conditionColor(condition: string): string {
  switch (condition) {
    case "new":
      return Colors.success;
    case "good":
      return Colors.info;
    case "fair":
      return Colors.warning;
    case "poor":
      return Colors.danger;
    default:
      return Colors.gray[600];
  }
}

/** "$120 – $180" when the AI valuation is completed, otherwise null. */
export function formatValuation(v: ValuationLike | undefined): string | null {
  if (!v || v.status !== "completed") return null;
  if (!v.value_min && !v.value_max) return null;
  const min = v.value_min ? `$${Number(v.value_min).toLocaleString()}` : "";
  const max = v.value_max ? `$${Number(v.value_max).toLocaleString()}` : "";
  return min && max ? `${min} – ${max}` : min || max;
}

/** "just now", "5m ago", "3h ago", "2d ago", "4mo ago". */
export function timeAgo(iso: string): string {
  const diff = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}
