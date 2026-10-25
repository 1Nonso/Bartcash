import 'dotenv/config';

import app from './app';
import config from './config/config';
import { startQueue } from './config/queue.config';
import { registerValuationWorker } from './queue/valuation.worker';
import { registerItemTasteWorker } from './queue/itemTaste.worker';
import { registerMatchRefreshWorker } from './queue/matchRefresh.worker';
import { registerTasteCompatWorker } from './queue/tasteCompat.worker';

await startQueue();

if (process.env.RUN_WORKER === 'true') {
   await registerValuationWorker();
   await registerItemTasteWorker();
   await registerMatchRefreshWorker();
   await registerTasteCompatWorker();
}

app.listen(config.port, () => {
   console.log(
      `Server running on port ${config.port}`,
   );
});
