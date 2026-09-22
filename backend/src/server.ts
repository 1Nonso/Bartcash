import 'dotenv/config';

import app from './app';
import config from './config/config';
import { startQueue } from './config/queue.config';
import { registerValuationWorker } from './queue/valuation.worker';

await startQueue();

if (process.env.RUN_WORKER === 'true') {
   await registerValuationWorker();
}

app.listen(config.port, () => {
   console.log(
      `Server running on port ${config.port}`,
   );
});
