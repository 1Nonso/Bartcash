import type {
   QlooInsightEntity,
   QlooSearchEntity,
   QlooTag,
   QlooTagResult,
} from './qlooTypes';

// ----------------------------------------------------------------------------
// Response validation + normalisation (Section 10.4: "a response that parses
// but lacks the expected fields counts as a failure"). Each parser returns
// null for an invalid response. An empty result list is VALID: it means
// "Qloo knows nothing about this", not an error.
//
// Normalised output is what gets cached: raw search results carry large
// translation lists (`akas`) that Bartcash never uses.
// ----------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
   return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function str(v: unknown): string | null {
   return typeof v === 'string' && v.length > 0 ? v : null;
}
function num(v: unknown): number | null {
   return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function normaliseTags(raw: unknown): QlooTag[] {
   if (!Array.isArray(raw)) return [];
   const out: QlooTag[] = [];
   for (const t of raw) {
      if (!isObj(t)) continue;
      const id = str(t.id) ?? str(t.tag_id);
      const name = str(t.name);
      if (id && name) out.push({ tag_id: id, name });
   }
   return out;
}

function imageOf(properties: unknown): string | null {
   if (!isObj(properties)) return null;
   const img = properties.image;
   if (typeof img === 'string' && img.startsWith('http')) return img;
   if (isObj(img)) {
      const url = str(img.url);
      if (url && url.startsWith('http')) return url;
   }
   return null;
}

export function parseSearch(body: unknown): QlooSearchEntity[] | null {
   if (!isObj(body) || !Array.isArray(body.results)) return null;
   const out: QlooSearchEntity[] = [];
   for (const r of body.results) {
      if (!isObj(r)) continue;
      const entity_id = str(r.entity_id);
      const name = str(r.name);
      if (!entity_id || !name || !Array.isArray(r.types)) continue;
      out.push({
         entity_id,
         name,
         types: r.types.filter((t): t is string => typeof t === 'string'),
         tags: normaliseTags(r.tags),
         image_url: imageOf(r.properties),
      });
   }
   if (body.results.length > 0 && out.length === 0) return null;
   return out;
}

export function parseInsights(body: unknown): QlooInsightEntity[] | null {
   if (!isObj(body) || body.success === false || !isObj(body.results)) return null;
   const raw = body.results.entities;
   if (!Array.isArray(raw)) return null;
   const out: QlooInsightEntity[] = [];
   for (const e of raw) {
      if (!isObj(e)) continue;
      const entity_id = str(e.entity_id);
      const name = str(e.name);
      if (!entity_id || !name) continue;
      const query = isObj(e.query) ? e.query : {};
      out.push({
         entity_id,
         name,
         tags: normaliseTags(e.tags),
         affinity: num(query.affinity),
         popularity: num(e.popularity),
         explain: query.explainability ?? null,
      });
   }
   if (raw.length > 0 && out.length === 0) return null;
   return out;
}

export function parseTags(body: unknown): QlooTagResult[] | null {
   if (!isObj(body) || body.success === false || !isObj(body.results)) return null;
   const raw = body.results.tags;
   if (!Array.isArray(raw)) return null;
   const out: QlooTagResult[] = [];
   for (const t of raw) {
      if (!isObj(t)) continue;
      const tag_id = str(t.id);
      const name = str(t.name);
      if (!tag_id || !name) continue;
      out.push({ tag_id, name, type: str(t.type), popularity: num(t.popularity) });
   }
   if (raw.length > 0 && out.length === 0) return null;
   return out;
}
