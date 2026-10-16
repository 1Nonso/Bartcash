import api from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TradeStatus =
  | "negotiating"
  | "accepted"
  | "declined"
  | "cancelled"
  | "completed"
  | "disputed";

export interface CurrentOffer {
  trade_type: "cash" | "item";
  cash_amount: string | null;
  top_up_amount: string | null;
  offered_items: { id: string; title: string; primary_image: string | null }[];
}

export interface TradeOfferHistoryEntry {
  id: string;
  offered_by: string;
  trade_type: string;
  cash_amount: string | null;
  top_up_amount: string | null;
  offered_item_ids: string[];
  is_current: boolean;
  created_at: string;
}

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
  primary_image: string | null;
  valuation: any;
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
  trade_type: "cash" | "item";
  completion_method: "meetup" | "delivery" | null;
  meetup_details?: string | null;
  delivery_details?: string | null;
  proposer_confirmed: boolean;
  receiver_confirmed: boolean;
  completed_at?: string | null;
  proposer: TradeParty;
  receiver: TradeParty;
  proposer_items: TradeItem[];
  receiver_items: TradeItem[];
  current_offer: CurrentOffer | null;
  offer_history?: TradeOfferHistoryEntry[];
  awaiting_response_from: string | null;
  recent_messages: TradeMessage[];
  dispute: TradeDispute | null;
  ratings?: TradeRating[];
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
  my_items_preview: string[];
  their_items_preview: string[];
  last_message: { body: string; created_at: string } | null;
  unread_count: number;
  updated_at: string;
}

export interface CreateTradePayload {
  receiver_id: string;
  receiver_item_id: string;
  trade_type: "cash" | "item";
  cash_amount?: number;
  offered_item_ids?: string[];
  top_up_amount?: number;
  message?: string;
}

export interface RebargainPayload {
  cash_amount?: number;
  offered_item_ids?: string[];
  top_up_amount?: number;
  message?: string;
}

export interface RebargainResult {
  status: "negotiating";
  current_offer: CurrentOffer;
  awaiting_response_from: string;
}

export interface AcceptResult {
  status: "accepted";
  completion_method: "meetup" | "delivery";
  meetup_details: string | null;
  delivery_details: string | null;
  agreed_at: string;
  transaction: { id: string };
}

export interface DeclineResult {
  id: string;
  status: "declined";
}

export interface CancelResult {
  id: string;
  status: "cancelled";
}

export interface CompleteResult {
  id: string;
  status: "accepted" | "completed";
  proposer_confirmed: boolean;
  receiver_confirmed: boolean;
}

export interface TradeRating {
  id: string;
  rater_id: string;
  rated_id: string;
  score: number;
  review: string | null;
  created_at: string;
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
 * Submit a counter-offer.
 * POST /trades/{id}/rebargain
 */
export async function rebargainTrade(
  id: string,
  payload: RebargainPayload,
): Promise<RebargainResult> {
  const response = await api.post(`/trades/${id}/rebargain`, payload);
  return response.data.data.trade;
}

/**
 * Accept a trade proposal — returns a PARTIAL trade. Merge into existing state.
 * PATCH /trades/{id}/accept
 */
export async function acceptTrade(
  id: string,
  completion_method: "meetup" | "delivery",
  details: { meetup_details?: string; delivery_details?: string } = {},
): Promise<AcceptResult> {
  const response = await api.patch(`/trades/${id}/accept`, {
    completion_method,
    ...details,
  });
  const { trade, transaction } = response.data.data;
  return { ...trade, transaction };
}

/**
 * Decline a trade proposal — returns a PARTIAL trade. Merge into existing state.
 * PATCH /trades/{id}/decline
 */
export async function declineTrade(id: string): Promise<DeclineResult> {
  const response = await api.patch(`/trades/${id}/decline`);
  return response.data.data.trade;
}

/**
 * Cancel a trade proposal (proposer only) — returns a PARTIAL trade. Merge into existing state.
 * PATCH /trades/{id}/cancel
 */
export async function cancelTrade(id: string): Promise<CancelResult> {
  const response = await api.patch(`/trades/${id}/cancel`);
  return response.data.data.trade;
}

/**
 * Mark a trade as complete from the authenticated user's side — returns a
 * PARTIAL trade (status may still be "accepted" if the other party hasn't
 * confirmed yet). Merge into existing state.
 * PATCH /trades/{id}/complete
 */
export async function completeTrade(id: string): Promise<CompleteResult> {
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
