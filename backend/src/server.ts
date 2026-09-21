import 'dotenv/config';

import app from './app';
import config from './config/config';
import { startQueue } from './config/queue.config';

await startQueue();

app.listen(config.port, () => {
   console.log(
      process.env.DATABASE_URL,
   );
   console.log(
      `Server running on port ${config.port}`,
   );
});
