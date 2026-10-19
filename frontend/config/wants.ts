import api from "./api";
import { Category } from "./items";

// ─── Types (Phase 4b, Section 16.5) ───────────────────────────────────────────

export interface WantSuggestion {
  category: Category;
  rank: number;
  /** Scout's reason; null for fallback suggestions. */
  reason: string | null;
}

export interface WantSuggestionsData {
  status: "pending" | "ready" | "fallback";
  source: "qloo" | "fallback" | null;
  /** Exactly 5 when ready or fallback; empty while pending. */
  suggestions: WantSuggestion[];
  /** Current picks in rank order. */
  picked_category_ids: string[];
  max_picks: number;
  retry_after_ms: number | null;
}

export interface SetWantsResult {
  wants: { category: Category; rank: number; was_suggested: boolean }[];
  note: string | null;
  matches_status: "refreshing" | "not_published";
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Scout's five suggested want-categories and the current picks.
 * GET /items/{id}/want-suggestions — poll while status is pending.
 */
export async function getWantSuggestions(
  id: string,
): Promise<WantSuggestionsData> {
  const response = await api.get(`/items/${id}/want-suggestions`);
  return response.data.data;
}

/**
 * Replace the item's wants (1 to 3, ranked by position) and the note.
 * PUT /items/{id}/wants — note: omit to keep, null to clear.
 */
export async function setWants(
  id: string,
  category_ids: string[],
  note?: string | null,
): Promise<SetWantsResult> {
  const response = await api.put(`/items/${id}/wants`, {
    category_ids,
    ...(note !== undefined ? { note } : {}),
  });
  return response.data.data;
}

/** The first readable message from an API error (field errors included). */
export function apiErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  const fieldErrors = data?.errors
    ? (Object.values(data.errors).flat() as string[])
    : [];
  return fieldErrors[0] ?? data?.message ?? fallback;
}
