import 'dotenv/config';
import { startQueue } from './config/queue.config';
import { registerValuationWorker } from './queue/valuation.worker';
import { registerItemTasteWorker } from './queue/itemTaste.worker';
import { registerMatchRefreshWorker } from './queue/matchRefresh.worker';

// Standalone worker process (local dev / paid hosting): `npm run worker`
async function main() {
   await startQueue();
   await registerValuationWorker();
   await registerItemTasteWorker();
   await registerMatchRefreshWorker();
   console.log('Worker started.');
}

main().catch((err) => {
   console.error(
      'Worker failed to start',
      err,
   );
   process.exit(1);
});
