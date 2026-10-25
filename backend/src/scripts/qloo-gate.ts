// ============================================================================
// Qloo client gate (Phase 2, item 5). Run ONCE with a real key:
//
//   QLOO_ENABLED=true QLOO_API_KEY=... npx tsx scripts/qloo-gate.ts
//
// Makes one live search, insights and tags call, repeats each to prove the
// repeat costs zero Qloo calls, and compares the call counter in qloo_usage.
// Costs about 5 of the monthly calls on a cold cache, 0 on a warm one.
// ============================================================================
import 'dotenv/config';
import { db } from '../config/db.config';
import { qlooConfig } from '../config/qloo.config';
import { qlooClient } from '../services/qloo';
import { QLOO_USAGE_ROW_ID } from '../services/qloo/qlooStores';

const checks: {
   name: string;
   pass: boolean;
   detail?: string;
}[] = [];
const check = (
   name: string,
   pass: boolean,
   detail?: string,
) =>
   checks.push(
      detail === undefined
         ? { name, pass }
         : { name, pass, detail },
   );

async function usage() {
   const row =
      await db.qlooUsage.findUnique({
         where: {
            id: QLOO_USAGE_ROW_ID,
         },
      });
   return {
      calls: row?.callsSinceStart ?? 0,
      remaining:
         row?.remainingReported ?? null,
   };
}

async function main() {
   if (!qlooConfig.enabled) {
      console.error(
         'Set QLOO_ENABLED=true and QLOO_API_KEY to run the gate.',
      );
      process.exit(2);
   }
   const before = await usage();
   let live = 0; // successful, uncached calls (each cost exactly one request)
   let failures = 0;
   const track = (r: {
      ok: boolean;
      cached?: boolean;
   }) => {
      if (!r.ok) failures++;
      else if (!r.cached) live++;
   };

   // --- search -------------------------------------------------------------
   const s1 = await qlooClient.search({
      query: 'Nike',
      type: 'brand',
      purpose: 'interactive',
   });
   track(s1);
   check(
      'search ok',
      s1.ok,
      s1.ok ? undefined : s1.reason,
   );
   const s2 = await qlooClient.search({
      query: 'Nike',
      type: 'brand',
      purpose: 'interactive',
   });
   track(s2);
   check(
      'search repeat is cached',
      s2.ok && s2.cached,
   );
   if (
      !s1.ok &&
      (s1.reason === 'timeout' ||
         s1.reason ===
            'invalid_response')
   ) {
      console.log(
         '\n[hint] The search call timed out. If your network is slow, raise QLOO_TIMEOUT_MS (try 15000) for this run.',
      );
   }

   const nike = (
      s1.ok ? s1 : s2.ok ? s2 : null
   )?.data[0];
   check(
      'search returned an entity with id and name',
      !!nike?.entity_id && !!nike?.name,
   );
   console.log(
      '\n[info] search entity:',
      nike && {
         name: nike.name,
         types: nike.types,
         tags: nike.tags.length,
         image_url: nike.image_url,
      },
   );
   if (nike && nike.tags.length === 0) {
      console.log(
         '[warn] search results carried NO tags. Tag mapping for the resolved entity must use another source.',
      );
   }
   if (
      nike &&
      nike.image_url === null
   ) {
      console.log(
         '[warn] no image_url found in search results; user_taste_entities.image_url will stay null.',
      );
   }

   // --- insights -----------------------------------------------------------
   let candidateIds: string[] = [];
   if (nike) {
      const i1 =
         await qlooClient.insights({
            filterType: 'brand',
            signals: [nike.entity_id],
            purpose: 'interactive',
         });
      track(i1);
      check(
         'insights ok',
         i1.ok,
         i1.ok ? undefined : i1.reason,
      );
      if (i1.ok) {
         candidateIds = i1.data
            .slice(0, 5)
            .map((e) => e.entity_id);
         check(
            'insights returned related entities',
            i1.data.length > 0,
            `${i1.data.length}`,
         );
         check(
            'insights entities carry tags',
            i1.data.some(
               (e) => e.tags.length > 0,
            ),
         );
      }
      const i2 =
         await qlooClient.insights({
            filterType: 'brand',
            signals: [nike.entity_id],
            purpose: 'interactive',
         });
      track(i2);
      check(
         'insights repeat is cached',
         i2.ok && i2.cached,
      );

      if (candidateIds.length > 0) {
         const args = {
            filterType:
               'brand' as const,
            signals: [nike.entity_id],
            candidates: candidateIds,
            explain: true,
            purpose:
               'interactive' as const,
         };
         const a1 =
            await qlooClient.insights(
               args,
            );
         track(a1);
         check(
            'insights with candidates ok',
            a1.ok,
            a1.ok
               ? undefined
               : a1.reason,
         );
         if (a1.ok) {
            check(
               'candidate results carry affinity',
               a1.data.every(
                  (e) =>
                     typeof e.affinity ===
                     'number',
               ),
            );
            console.log(
               '[info] explainability sample:',
               JSON.stringify(
                  a1.data[0]?.explain ??
                     null,
               ),
            );
         }
         const a2 =
            await qlooClient.insights(
               args,
            );
         track(a2);
         check(
            'insights with candidates repeat is cached',
            a2.ok && a2.cached,
         );
      }
   }

   // --- tags ---------------------------------------------------------------
   const t1 = await qlooClient.tags({
      query: 'sneakers',
      purpose: 'interactive',
   });
   track(t1);
   check(
      'tags ok',
      t1.ok,
      t1.ok ? undefined : t1.reason,
   );
   if (t1.ok) {
      check(
         'tags returned results',
         t1.data.length > 0,
         `${t1.data.length}`,
      );
   }
   const t2 = await qlooClient.tags({
      query: 'sneakers',
      purpose: 'interactive',
   });
   track(t2);
   check(
      'tags repeat is cached',
      t2.ok && t2.cached,
   );

   // --- accounting ---------------------------------------------------------
   const after = await usage();
   const delta =
      after.calls - before.calls;
   if (failures === 0) {
      check(
         'Qloo calls made equals the uncached calls',
         delta === live,
         `counter +${delta}, uncached ${live}`,
      );
   } else {
      // A failed call can cost a request (or, on a timeout, a request that is never recorded),
      // so the counter cannot be compared exactly. Fix the failures and re-run.
      console.log(
         `\n[info] accounting check skipped: ${failures} call(s) failed (counter +${delta}).`,
      );
   }
   console.log(
      `\n[info] remaining before: ${before.remaining ?? 'unknown'}, after: ${after.remaining ?? 'unknown'}`,
   );

   console.log('\nGATE RESULTS');
   for (const c of checks)
      console.log(
         `${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`,
      );
   const failed = checks.filter(
      (c) => !c.pass,
   ).length;
   console.log(
      failed === 0
         ? '\nGate passed.'
         : `\n${failed} check(s) failed.`,
   );
   process.exitCode =
      failed === 0 ? 0 : 1;
}

main()
   .catch((err) => {
      console.error(
         'Gate crashed:',
         err instanceof Error
            ? err.message
            : err,
      );
      process.exitCode = 1;
   })
   .finally(() => db.$disconnect());
