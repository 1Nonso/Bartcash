import { db } from '../config/db.config';

const GROQ_MODEL =
   process.env.GROQ_MODEL!;
const GROQ_BASE_URL =
   process.env.GROQ_BASE_URL!;
const GROQ_API_KEY =
   process.env.GROQ_API_KEY!;

function buildPrompt(item: {
   title: string;
   condition: string;
   description: string;
}): string {
   return [
      'You are a fair market value estimator for a barter marketplace in Nigeria.',
      'Based on the provided image and item details, estimate the current',
      'fair market value of this item in USD.',
      `Item title: ${item.title}.`,
      `Condition: ${item.condition}.`,
      `Description: ${item.description}.`,
      'Respond ONLY with a valid JSON object in this exact format:',
      '{"value_min": number, "value_max": number, "confidence": number}',
      'where confidence is a number between 0 and 100 representing your certainty.',
      'Do not include any other text, explanation, or markdown.',
   ].join(' ');
}

/** item_valuations.confidence is a String bucket (high/medium/low), not the
 *  numeric 0–100 Groq returns — see flagged conflict #2 below. */
function confidenceBucket(
   score: number,
): string {
   if (score >= 80) return 'high';
   if (score >= 50) return 'medium';
   return 'low';
}

async function fetchImageAsBase64(
   publicUrl: string,
): Promise<string> {
   const response =
      await fetch(publicUrl);
   if (!response.ok) {
      throw new Error(
         `Failed to fetch image for valuation: ${publicUrl}`,
      );
   }
   const buffer = Buffer.from(
      await response.arrayBuffer(),
   );
   return buffer.toString('base64');
}

async function callGroq(
   prompt: string,
   imageBase64: string,
) {
   const response = await fetch(
      `${GROQ_BASE_URL}/chat/completions`,
      {
         method: 'POST',
         headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type':
               'application/json',
         },
         body: JSON.stringify({
            model: GROQ_MODEL,
            temperature: 0.1,
            messages: [
               {
                  role: 'user',
                  content: [
                     {
                        type: 'image_url',
                        image_url: {
                           url: `data:image/jpeg;base64,${imageBase64}`,
                        },
                     },
                     {
                        type: 'text',
                        text: prompt,
                     },
                  ],
               },
            ],
         }),
      },
   );

   if (!response.ok) {
      throw new Error(
         `Groq API request failed: ${await response.text()}`,
      );
   }

   const raw = await response.json();
   const text =
      raw?.choices?.[0]?.message
         ?.content;
   if (!text) {
      throw new Error(
         'Groq returned an empty response.',
      );
   }

   const cleaned = text
      .replace(/```json|```/g, '')
      .trim();
   const parsed = JSON.parse(cleaned);

   if (
      typeof parsed.value_min !==
         'number' ||
      typeof parsed.value_max !==
         'number' ||
      typeof parsed.confidence !==
         'number' ||
      parsed.value_min >
         parsed.value_max
   ) {
      throw new Error(
         `Groq returned an unexpected format: ${cleaned}`,
      );
   }

   return {
      valueMin: parsed.value_min,
      valueMax: parsed.value_max,
      confidence: confidenceBucket(
         Math.min(
            Math.max(
               parsed.confidence,
               0,
            ),
            100,
         ),
      ),
      raw,
   };
}

// Drop MAX_ATTEMPTS / RETRY_DELAY_MS and the recursive retry — pg-boss
// now owns retries. This function does one attempt and either succeeds
// or throws; the worker decides what happens after that.
export async function runItemValuation(
   itemId: string,
   valuationId: string,
): Promise<void> {
   const item =
      await db.item.findUnique({
         where: { id: itemId },
         include: { images: true },
      });
   const valuation =
      await db.itemValuation.findUnique(
         {
            where: { id: valuationId },
         },
      );

   if (!item || !valuation) {
      console.error(
         'runItemValuation: item or valuation not found',
         {
            itemId,
            valuationId,
         },
      );
      return;
   }

   const primaryImage =
      item.images.find(
         (img) => img.isPrimary,
      ) ?? item.images[0];

   if (!primaryImage) {
      await db.itemValuation.update({
         where: { itemId },
         data: {
            status: 'failed',
            failedReason:
               'No images available for valuation.',
         },
      });
      return;
   }

   const imageBase64 =
      await fetchImageAsBase64(
         primaryImage.url,
      );
   const prompt = buildPrompt(item);
   const result = await callGroq(
      prompt,
      imageBase64,
   );

   await db.itemValuation.update({
      where: { itemId },
      data: {
         valueMin: result.valueMin,
         valueMax: result.valueMax,
         confidence: result.confidence,
         status: 'completed',
         rawResponse: result.raw,
         apiModel: GROQ_MODEL,
      },
   });
}
