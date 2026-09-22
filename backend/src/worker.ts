import 'dotenv/config';
import { startQueue } from './config/queue.config';
import { registerValuationWorker } from './queue/valuation.worker';

// Standalone worker process (local dev / paid hosting): `npm run worker`
async function main() {
   await startQueue();
   await registerValuationWorker();
   console.log('Worker started.');
}

main().catch((err) => {
   console.error(
      'Worker failed to start',
      err,
   );
   process.exit(1);
});
