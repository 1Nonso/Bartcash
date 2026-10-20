import api from "./api";

// ─── Types (Phase 4b, Section 16.7) ───────────────────────────────────────────

/** Uses the field names of POST /trades so it can be passed on after review. */
export interface OfferDraft {
  receiver_id: string;
  receiver_item_id: string;
  trade_type: "item";
  offered_item_ids: string[];
  top_up_amount: number;
  message: string;
  drafted_by: "scout" | "template";
  value_note: string | null;
  rationale: string;
  shared_interests: unknown[];
}

/** Client limit (FLOW §10.9): the server's Groq call is capped at 5 s. */
const DRAFT_TIMEOUT_MS = 8000;

/**
 * Ask Scout to draft a trade proposal. Nothing is created.
 * POST /scout/draft-offer
 */
export async function draftOffer(sourceItemId: string, targetItemId: string): Promise<OfferDraft> {
  const response = await api.post(
    "/scout/draft-offer",
    { source_item_id: sourceItemId, target_item_id: targetItemId },
    { timeout: DRAFT_TIMEOUT_MS },
  );
  return response.data.data.draft;
}

// ─── Hand-off to Propose Trade ────────────────────────────────────────────────
// Listing Detail stores the draft; Propose Trade takes it once on load.

let pending: OfferDraft | null = null;

export const scoutDraftStore = {
  set: (d: OfferDraft | null) => {
    pending = d;
  },
  /** The draft for this target listing, removed from the store. */
  take: (receiverItemId: string): OfferDraft | null => {
    const d = pending && pending.receiver_item_id === receiverItemId ? pending : null;
    pending = null;
    return d;
  },
};
