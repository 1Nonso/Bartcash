import api from "./api";
import { ItemOwner, MarketplaceItem, MyItem, ScoreLabelValue } from "./items";

// ─── Types (Phase 4b, Section 16.6) ───────────────────────────────────────────

export interface MatchEntry {
  /** ItemCard: the same shape as an element of GET /items. */
  item: MarketplaceItem;
  owner: ItemOwner;
  /** Null for pool tier 3 (no label). */
  score_label: ScoreLabelValue | null;
  reason: string | null;
  owner_compatibility: null;
  source: "qloo" | "fallback";
  pool_tier: 1 | 2 | 3;
}

export interface MatchesMeta {
  status: "ready" | "refreshing" | "empty";
  source: "qloo" | "fallback" | "mixed";
  computed_at: string | null;
}

export interface MatchesData {
  items: MatchEntry[];
  next_cursor: string | null;
  meta: MatchesMeta;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Ranked matches for one of the caller's available listings.
 * GET /items/{id}/matches — poll while meta.status is refreshing.
 */
export async function getMatches(
  id: string,
  params: { limit?: number; cursor?: string } = {},
): Promise<MatchesData> {
  const response = await api.get(`/items/${id}/matches`, { params });
  return response.data.data;
}

/**
 * The caller's available listings with their match summary (Home lenses).
 * GET /items/mine?status=available&include=match_summary
 */
export async function getMyListingsWithMatches(): Promise<MyItem[]> {
  const response = await api.get("/items/mine", {
    params: { status: "available", include: "match_summary", limit: 50 },
  });
  return response.data.data.items;
}
