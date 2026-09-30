import api from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export interface ItemValuation {
  value_min: string | null;
  value_max: string | null;
  status: "pending" | "completed" | "failed";
}

export interface ItemOwner {
  id: string;
  first_name: string;
  last_name: string;
  profile_photo: string | null;
  average_rating: string;
}

export interface MarketplaceItem {
  id: string;
  title: string;
  condition: "new" | "good" | "fair" | "poor";
  is_service: boolean;
  location: string | null;
  primary_image: string | null;
  valuation: ItemValuation | null;
  owner: ItemOwner;
  created_at: string;
}

export interface MarketplaceResponse {
  items: MarketplaceItem[];
  next_cursor: string | null;
  total: number;
}

export interface GetItemsParams {
  cursor?: string;
  limit?: number;
  category_id?: string;
  search?: string;
  condition?: string;
  value_min?: number;
  value_max?: number;
}

// ─── Image types ──────────────────────────────────────────────────────────────

export interface ItemImage {
  id: string;
  url: string;
  is_primary: boolean;
  display_order: number;
}

// ─── Full item detail (used in Listing Detail screen) ─────────────────────────

export interface ItemValuationDetail {
  id: string;
  value_min: string | null;
  value_max: string | null;
  currency: string;
  confidence: string | null;
  status: "pending" | "completed" | "failed";
  failed_reason: string | null;
}

export interface ItemOwnerDetail {
  id: string;
  first_name: string;
  last_name: string;
  profile_photo: string | null;
  average_rating: string;
  total_trades: number;
}

export interface ItemDetail {
  id: string;
  title: string;
  description: string;
  condition: "new" | "good" | "fair" | "poor";
  desired_trade: string | null;
  is_service: boolean;
  status: string;
  location: string | null;
  user_declared_value: string | null;
  category: Category;
  images: ItemImage[];
  valuation: ItemValuationDetail | null;
  owner: ItemOwnerDetail;
  created_at: string;
}

// ─── Create / Update payloads ─────────────────────────────────────────────────

export interface CreateItemPayload {
  title: string;
  description: string;
  category_id: string;
  condition: "new" | "good" | "fair" | "poor";
  desired_trade?: string;
  is_service?: boolean;
  location?: string;
}

export interface UpdateItemPayload {
  title?: string;
  description?: string;
  category_id?: string;
  condition?: "new" | "good" | "fair" | "poor";
  desired_trade?: string;
  location?: string;
  user_declared_value?: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Fetch all active categories.
 * GET /categories
 */
export async function getCategories(): Promise<Category[]> {
  const response = await api.get("/categories");
  return response.data.data.categories;
}

/**
 * Fetch paginated marketplace listings.
 * GET /items
 */
export async function getMarketplaceItems(
  params: GetItemsParams = {},
): Promise<MarketplaceResponse> {
  const response = await api.get("/items", { params });
  return response.data.data;
}

/**
 * Fetch full detail for a single item.
 * GET /items/{id}
 */
export async function getItemById(id: string): Promise<ItemDetail> {
  const response = await api.get(`/items/${id}`);
  return response.data.data.item;
}

/**
 * Fetch the authenticated user's own listings.
 * GET /items/mine
 */
export async function getMyItems(
  params: {
    status?: string;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<{ items: ItemDetail[]; next_cursor: string | null }> {
  const response = await api.get("/items/mine", { params });
  return response.data.data;
}

/**
 * Create a new item listing.
 * POST /items
 */
export async function createItem(payload: CreateItemPayload): Promise<{
  id: string;
  title: string;
  status: string;
  valuation_status: string;
}> {
  const response = await api.post("/items", payload);
  return response.data.data.item;
}

/**
 * Upload images for an item.
 * POST /items/{id}/images
 */
export async function uploadItemImages(
  itemId: string,
  images: { uri: string; name: string; type: string }[],
): Promise<{ images: ItemImage[]; valuation_status: string }> {
  const formData = new FormData();
  images.forEach((img) => {
    formData.append("images", {
      uri: img.uri,
      name: img.name,
      type: img.type,
    } as any);
  });
  const response = await api.post(`/items/${itemId}/images`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 30000,
  });
  return response.data.data;
}

/**
 * Update an existing item listing.
 * PUT /items/{id}
 */
export async function updateItem(
  id: string,
  payload: UpdateItemPayload,
): Promise<{ item: ItemDetail; warnings?: Record<string, string> }> {
  const response = await api.put(`/items/${id}`, payload);
  return { item: response.data.data.item, warnings: response.data.warnings };
}

/**
 * Deactivate an item listing.
 * PATCH /items/{id}/deactivate
 */
export async function deactivateItem(id: string): Promise<{ status: string }> {
  const response = await api.patch(`/items/${id}/deactivate`);
  return response.data.data.item;
}

/**
 * Delete an item listing.
 * DELETE /items/{id}
 */
export async function deleteItem(id: string): Promise<void> {
  await api.delete(`/items/${id}`);
}

/**
 * Get the valuation for an item.
 * GET /items/{id}/valuation
 */
export async function getItemValuation(
  id: string,
): Promise<ItemValuationDetail> {
  const response = await api.get(`/items/${id}/valuation`);
  return response.data.data.valuation;
}

/**
 * Retry a failed AI valuation.
 * POST /items/{id}/valuation/retry
 */
export async function retryItemValuation(
  id: string,
): Promise<{ status: string }> {
  const response = await api.post(`/items/${id}/valuation/retry`);
  return response.data.data.valuation;
}

/**
 * Override the AI valuation with a user-supplied value range.
 * PATCH /items/{id}/valuation/override
 */
export async function overrideItemValuation(
  id: string,
  payload: { value_min: number; value_max: number },
): Promise<{
  id: string;
  value_min: string;
  value_max: string;
  status: string;
}> {
  const response = await api.patch(`/items/${id}/valuation/override`, payload);
  return response.data.data.valuation;
}
