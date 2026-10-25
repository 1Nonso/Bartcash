// Loaded once at startup. dotenv is imported here so this file does not
// depend on import order in server.ts / app.ts.
import 'dotenv/config';
import { parseQlooEnv } from './qloo.env';

export const qlooConfig = parseQlooEnv(
   process.env,
);

/** Safe one-line summary for startup logs. Never includes the key. */
export function describeQlooConfig(): string {
   const c = qlooConfig;
   return (
      `qloo enabled=${c.enabled} key=${c.hasApiKey ? 'set' : 'unset'} ` +
      `rps=${c.rps} timeoutMs=${c.timeoutMs} ` +
      `budget=${c.budgetSoftStop}/${c.budgetHardStop}`
   );
}
