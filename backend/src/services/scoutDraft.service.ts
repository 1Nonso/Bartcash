// Scout "Draft an offer" (API §16.7, DB §10.9, FLOW §10.9). Read-only by
// design: it never creates a trade, offer, message or notification; the user
// edits the draft and sends it through the unchanged POST /trades.
// Pure parts (top-up, notes, prompt, validation) are exported for
// src/scripts/scout-fixtures.ts.

import z from 'zod';
import { db } from '../config/db.config';
import { groqJson as defaultGroqJson, type GroqJsonFn } from './groqJson';
import { getMatchContext } from './matchContext.service';
import { loadOwnerFits } from './matchCandidates.service';
import type { SharedEntity } from './tasteCompat';

export const MESSAGE_MAX = 500;
export const MESSAGE_MIN = 20;
export const RATIONALE_MAX = 140;
/** Server wait for Groq; the app waits 8 s for the whole request. */
export const GROQ_LIMIT_MS = 7000;
const MESSAGE_MAX_TOKENS = 200;
/** Yours worth this much more than theirs (ratio) before suggesting they top up. */
const ASK_TOP_UP_RATIO = 1.1;

export const draftBodySchema = z.object({
   source_item_id: z.uuid('Enter a valid item id.'),
   target_item_id: z.uuid('Enter a valid item id.'),
});

// ── Pure helpers ─────────────────────────────────────────────────────────────

type ValuationLike = { status: string; valueMin: unknown; valueMax: unknown } | null | undefined;

/** Midpoint of a completed AI valuation, or null. */
export function midValue(v: ValuationLike): number | null {
   if (!v || v.status !== 'completed') return null;
   const lo = Number(v.valueMin);
   const hi = Number(v.valueMax);
   if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
   return (lo + hi) / 2;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Top-up = target mid − offered mid, rounded up to the next 5 USD, never
 * negative; 0 with a note when a valuation is missing (DB §10.9).
 */
export function computeTopUp(
   offeredMid: number | null,
   targetMid: number | null,
): { topUp: number; note: string } {
   if (offeredMid === null || targetMid === null) {
      return { topUp: 0, note: "A valuation is missing, so Scout didn't suggest a top-up." };
   }
   const gap = targetMid - offeredMid;
   if (gap > 0) {
      const topUp = Math.ceil(gap / 5) * 5;
      return { topUp, note: `Their item is valued about ${usd(gap)} more, so Scout added a ${usd(topUp)} top-up.` };
   }
   if (targetMid > 0 && offeredMid / targetMid > ASK_TOP_UP_RATIO) {
      return {
         topUp: 0,
         note: `Yours is valued about ${usd(-gap)} more. You could ask them for a top-up instead.`,
      };
   }
   return { topUp: 0, note: 'The two items are close in value.' };
}

/** Spec template; adds a shared interest (when there is one) and the top-up. */
export function templateMessage(
   name: string,
   offered: string,
   target: string,
   topUp: number,
   shared: string | null = null,
): string {
   const liked = shared ? ` We both like ${shared}, so I thought you might like this swap.` : '';
   const base = `Hi ${name}, I would like to swap my ${offered} for your ${target}.${liked} Would you be open to it?`;
   return clip(topUp > 0 ? `${base} I can add ${usd(topUp)} to balance the values.` : base, MESSAGE_MAX);
}

function clip(s: string, max: number): string {
   return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Facts only, all true from the receiver's side. `theyWant` is the sender's
 * category when the receiver has said they'd take it (mutual want).
 */
export function messagePrompt(f: {
   name: string;
   offered: string;
   target: string;
   topUp: number;
   theyWant: string | null;
   /** An interest on both people's taste profiles. */
   shared?: string | null;
}): string {
   return [
      'You write a short, friendly opening message from one person to another on a barter marketplace.',
      `The sender offers their ${JSON.stringify(f.offered)} for the receiver's ${JSON.stringify(f.target)}.`,
      `The receiver's first name is ${JSON.stringify(f.name)}.`,
      f.topUp > 0 ? `The sender will add ${usd(f.topUp)} in cash to balance the values.` : '',
      f.theyWant
         ? `The receiver has said they would take items in ${JSON.stringify(f.theyWant)}, which is what the sender is offering.`
         : '',
      f.shared ? `Both people list ${JSON.stringify(f.shared)} among their interests; you may mention it once.` : '',
      'Use only these facts. Do not invent condition, extras, meeting places or promises.',
      'Do not mention cash unless a cash amount is given above. Do not mention apps, algorithms, matching, scores or categories by name except as stated.',
      `At most ${MESSAGE_MAX} characters, 2 or 3 sentences, plain text, no links, no emojis.`,
      'Respond ONLY with a JSON object in this exact format: {"message": string}',
   ]
      .filter(Boolean)
      .join('\n');
}

/** A usable Groq message, or null. */
export function validateMessage(v: unknown): string | null {
   if (!v || typeof v !== 'object') return null;
   const m = (v as { message?: unknown }).message;
   if (typeof m !== 'string') return null;
   const text = m.trim().replace(/\s+/g, ' ');
   if (text.length < MESSAGE_MIN || text.length > MESSAGE_MAX) return null;
   if (/https?:\/\/|www\./i.test(text)) return null;
   return text;
}

// ── Draft ────────────────────────────────────────────────────────────────────

export interface OfferDraft {
   receiver_id: string;
   receiver_item_id: string;
   trade_type: 'item';
   offered_item_ids: string[];
   top_up_amount: number;
   message: string;
   drafted_by: 'scout' | 'template';
   value_note: string | null;
   rationale: string;
   shared_interests: SharedEntity[];
}

export type DraftResult =
   | { ok: true; draft: OfferDraft }
   | { ok: false; status: 403 | 404 | 422; code?: string; message: string };

const ITEM_SELECT = {
   id: true,
   userId: true,
   categoryId: true,
   title: true,
   status: true,
   createdAt: true,
   deletedAt: true,
   valuation: { select: { status: true, valueMin: true, valueMax: true } },
   user: { select: { firstName: true, deletedAt: true } },
} as const;

/** Resolves within `ms` (null on timeout); the slower promise is ignored. */
async function withLimit<T>(p: Promise<T>, ms: number): Promise<T | null> {
   let timer: ReturnType<typeof setTimeout> | undefined;
   const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
   });
   try {
      return await Promise.race([p, timeout]);
   } finally {
      clearTimeout(timer);
   }
}

export async function draftOffer(
   callerId: string,
   sourceId: string,
   targetId: string,
   groq: GroqJsonFn = defaultGroqJson,
): Promise<DraftResult> {
   const started = Date.now();
   const [source, target] = await Promise.all([
      db.item.findUnique({ where: { id: sourceId }, select: ITEM_SELECT }),
      db.item.findUnique({ where: { id: targetId }, select: ITEM_SELECT }),
   ]);

   if (!source || source.deletedAt || !target || target.deletedAt || target.user.deletedAt) {
      return { ok: false, status: 404, message: 'Item not found.' };
   }
   if (source.userId !== callerId) {
      return { ok: false, status: 403, message: 'You do not have permission to offer this item.' };
   }
   if (target.userId === callerId) {
      return { ok: false, status: 422, code: 'SELF_TRADE', message: 'You cannot draft an offer for your own item.' };
   }
   if (source.status !== 'available' || target.status !== 'available') {
      return { ok: false, status: 422, code: 'ITEM_UNAVAILABLE', message: 'This item is not available.' };
   }

   const { topUp, note } = computeTopUp(midValue(source.valuation), midValue(target.valuation));
   // Stored "why this matches", or the database-only version (no Qloo call).
   const context = await getMatchContext(source.id, callerId, target);
   const reason = context?.reason ?? null;
   const name = target.user.firstName;
   // Mutual want: the receiver would take the sender's category.
   const reciprocal = context?.checked.find((c) => c.key === 'reciprocal_fit')?.result;
   const theyWant =
      reciprocal === 'strong' || reciprocal === 'partial'
         ? ((await db.category.findUnique({ where: { id: source.categoryId }, select: { name: true } }))?.name ?? null)
         : null;

   // Interests both owners share (stored taste compatibility, DB §10.8).
   const fits = await loadOwnerFits(callerId, [target.userId]);
   const shared = (fits?.get(target.userId)?.shared ?? []) as SharedEntity[];

   let message: string | null = null;
   let groqOutcome = 'ok';
   const res = await withLimit(
      groq(messagePrompt({
         name,
         offered: source.title,
         target: target.title,
         topUp,
         theyWant,
         shared: shared[0]?.name ?? null,
      }), validateMessage, {
         maxTokens: MESSAGE_MAX_TOKENS,
      }),
      GROQ_LIMIT_MS,
   );
   if (res === null) groqOutcome = 'timeout';
   else if (!res.ok) groqOutcome = res.reason;
   else message = res.value;

   const draftedBy = message ? 'scout' : 'template';
   // Trace (DB §10.9): ids and outcome only, no personal data.
   console.log(
      `scout: draft-offer source=${source.id} target=${target.id} drafted_by=${draftedBy} groq=${groqOutcome} ms=${Date.now() - started}`,
   );

   return {
      ok: true,
      draft: {
         receiver_id: target.userId,
         receiver_item_id: target.id,
         trade_type: 'item',
         offered_item_ids: [source.id],
         top_up_amount: topUp,
         message: message ?? templateMessage(name, source.title, target.title, topUp, shared[0]?.name ?? null),
         drafted_by: draftedBy,
         value_note: note,
         rationale: clip(reason ?? `Your ${source.title} for their ${target.title}.`, RATIONALE_MAX),
         shared_interests: shared,
      },
   };
}
