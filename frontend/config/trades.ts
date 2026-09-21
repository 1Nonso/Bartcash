import api from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TradeStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "completed"
  | "disputed";

export interface TradeParty {
  id: string;
  first_name: string;
  last_name: string;
  profile_photo: string | null;
  average_rating: string;
}

export interface TradeItem {
  id: string;
  title: string;
  condition: string;
  status: string;
  primary_image: string | null;
  valuation: {
    value_min: string | null;
    value_max: string | null;
    status: string;
  } | null;
  images: { id: string; url: string; is_primary: boolean }[];
}

export interface TradeMessage {
  id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface TradeDispute {
  id: string;
  status: string;
  reason: string;
}

export interface Trade {
  id: string;
  status: TradeStatus;
  completion_method: "meetup" | "delivery" | null;
  proposer_confirmed: boolean;
  receiver_confirmed: boolean;
  completed_at: string | null;
  proposer: TradeParty;
  receiver: TradeParty;
  proposer_items: TradeItem[];
  receiver_items: TradeItem[];
  recent_messages: TradeMessage[];
  dispute: TradeDispute | null;
  ratings?: any[];
}

export interface TradeListItem {
  id: string;
  status: TradeStatus;
  other_party: {
    id: string;
    first_name: string;
    last_name: string;
    profile_photo: string | null;
  };
  items_preview: string[];
  last_message: { body: string; created_at: string } | null;
  unread_count: number;
  updated_at: string;
}

export interface CreateTradePayload {
  receiver_id: string;
  receiver_item_id: string;
  offered_item_ids: string[];
  message?: string;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Create a new trade proposal.
 * POST /trades
 */
export async function createTrade(payload: CreateTradePayload): Promise<Trade> {
  const response = await api.post("/trades", payload);
  return response.data.data.trade;
}

/**
 * Get all trades for the authenticated user.
 * GET /trades
 */
export async function getTrades(
  params: {
    status?: TradeStatus;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<{ trades: TradeListItem[]; next_cursor: string | null }> {
  const response = await api.get("/trades", { params });
  return response.data.data;
}

/**
 * Get full detail for a single trade.
 * GET /trades/{id}
 */
export async function getTradeById(id: string): Promise<Trade> {
  const response = await api.get(`/trades/${id}`);
  return response.data.data.trade;
}

/**
 * Accept a trade proposal.
 * PATCH /trades/{id}/accept
 */
export async function acceptTrade(
  id: string,
  completion_method: "meetup" | "delivery",
): Promise<Trade> {
  const response = await api.patch(`/trades/${id}/accept`, {
    completion_method,
  });
  return response.data.data.trade;
}

/**
 * Decline a trade proposal.
 * PATCH /trades/{id}/decline
 */
export async function declineTrade(id: string): Promise<Trade> {
  const response = await api.patch(`/trades/${id}/decline`);
  return response.data.data.trade;
}

/**
 * Cancel a trade proposal (proposer only).
 * PATCH /trades/{id}/cancel
 */
export async function cancelTrade(id: string): Promise<Trade> {
  const response = await api.patch(`/trades/${id}/cancel`);
  return response.data.data.trade;
}

/**
 * Mark a trade as complete from the authenticated user's side.
 * PATCH /trades/{id}/complete
 */
export async function completeTrade(id: string): Promise<Trade> {
  const response = await api.patch(`/trades/${id}/complete`);
  return response.data.data.trade;
}

/**
 * Get messages for a trade thread.
 * GET /trades/{id}/messages
 */
export async function getTradeMessages(
  tradeId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<{ messages: TradeMessage[]; next_cursor: string | null }> {
  const response = await api.get(`/trades/${tradeId}/messages`, { params });
  return response.data.data;
}

/**
 * Send a message in a trade thread.
 * POST /trades/{id}/messages
 */
export async function sendTradeMessage(
  tradeId: string,
  body: string,
): Promise<TradeMessage> {
  const response = await api.post(`/trades/${tradeId}/messages`, { body });
  return response.data.data.message;
}

/**
 * Mark all messages in a trade as read.
 * PATCH /trades/{id}/messages/read
 */
export async function markMessagesRead(
  tradeId: string,
): Promise<{ marked_read: number }> {
  const response = await api.patch(`/trades/${tradeId}/messages/read`);
  return response.data.data;
}
