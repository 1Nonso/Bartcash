import api from "./api";
import type { ItemOwner, MarketplaceItem } from "./items";

// ─── Types (Phase 4b, Section 16.4) ───────────────────────────────────────────

export type TasteEntityType =
  | "brand"
  | "artist"
  | "movie"
  | "tv_show"
  | "videogame"
  | "book"
  | "podcast";

export interface TasteTag {
  tag_id: string;
  name: string;
}

/** An interest on the profile (or picked from search, not yet saved). */
export interface TasteEntity {
  qloo_entity_id: string;
  name: string;
  entity_type: TasteEntityType;
  image_url: string | null;
  /** Kept from search so the server can store them; absent for saved rows. */
  tags?: TasteTag[];
}

export interface TasteSearchResult extends TasteEntity {
  tags: TasteTag[];
  already_added: boolean;
}

export interface TasteProfile {
  entities: (TasteEntity & { id: string })[];
  entity_count: number;
  is_active: boolean;
  min_active: number;
  max_entities: number;
  updated_at: string | null;
}

export const TASTE_TYPE_LABELS: Record<TasteEntityType, string> = {
  brand: "Brands",
  artist: "Music",
  movie: "Films",
  tv_show: "TV",
  videogame: "Games",
  book: "Books",
  podcast: "Podcasts",
};

/** Singular, for result rows. */
export const TASTE_TYPE_NAME: Record<TasteEntityType, string> = {
  brand: "Brand",
  artist: "Artist",
  movie: "Film",
  tv_show: "TV show",
  videogame: "Game",
  book: "Book",
  podcast: "Podcast",
};

export const TASTE_TYPES = Object.keys(TASTE_TYPE_LABELS) as TasteEntityType[];

// ─── API Functions ────────────────────────────────────────────────────────────

/** GET /taste/search — one Qloo search (all types when type is omitted). */
export async function searchTaste(
  q: string,
  type?: TasteEntityType,
  limit = 15,
): Promise<TasteSearchResult[]> {
  const response = await api.get("/taste/search", {
    params: { q, limit, ...(type ? { type } : {}) },
  });
  return response.data.data.entities;
}

export interface TasteSuggestionSection {
  key: "listed" | "for_you" | "popular";
  title: string;
  entities: TasteSearchResult[];
}

/** GET /taste/suggestions — shown on Add Interests before a search. */
export async function getTasteSuggestions(
  type?: TasteEntityType,
): Promise<TasteSuggestionSection[]> {
  const response = await api.get("/taste/suggestions", {
    params: type ? { type } : undefined,
  });
  return response.data.data.sections;
}

/** GET /taste/profile */
export async function getTasteProfile(): Promise<TasteProfile> {
  const response = await api.get("/taste/profile");
  return response.data.data;
}

/** PUT /taste/profile — replace the whole profile ([] clears it). */
export async function saveTasteProfile(entities: TasteEntity[]): Promise<TasteProfile> {
  const response = await api.put("/taste/profile", {
    entities: entities.map((e) => ({
      qloo_entity_id: e.qloo_entity_id,
      name: e.name,
      entity_type: e.entity_type,
      image_url: e.image_url ?? null,
      ...(e.tags ? { tags: e.tags } : {}),
    })),
  });
  return response.data.data;
}

// ─── Draft shared by Taste Profile and Add Interests ─────────────────────────
// Add Interests never saves (UI §13.7): Done merges its picks into this draft
// and Taste Profile reads it back on focus.

let draft: TasteEntity[] | null = null;

export const tasteDraft = {
  get: (): TasteEntity[] | null => draft,
  set: (list: TasteEntity[] | null) => {
    draft = list;
  },
};

// ─── Taste compatibility (Phase 4b, Section 16.4) ─────────────────────────────

export type CompatLabel = "high" | "medium" | "low";

/** Only what two people share; never the other person's full profile. */
export interface Compatibility {
  score_label: CompatLabel | null;
  shared_entities: TasteEntity[];
  shared_count: number;
  shared_tags?: TasteTag[];
}

export interface CompatibleUser {
  user: ItemOwner;
  compatibility: Compatibility;
  listings_preview: MarketplaceItem[];
}

export interface CompatibleUsersData {
  items: CompatibleUser[];
  next_cursor: string | null;
  meta: { status: "ready" | "refreshing" | "empty" };
}

/**
 * GET /taste/compatible-users — 422 TASTE_PROFILE_INACTIVE when the caller
 * has fewer than 3 interests. Poll while meta.status is refreshing.
 */
export async function getCompatibleUsers(
  params: { cursor?: string; limit?: number } = {},
): Promise<CompatibleUsersData> {
  const response = await api.get("/taste/compatible-users", { params });
  return response.data.data;
}

export interface TasteCompatibilityData {
  compatibility: Compatibility | null;
  reason: "profile_inactive_self" | "profile_inactive_other" | null;
}

/** GET /users/{id}/taste-compatibility — View User Profile strip. */
export async function getTasteCompatibility(userId: string): Promise<TasteCompatibilityData> {
  const response = await api.get(`/users/${userId}/taste-compatibility`);
  return response.data.data;
}
