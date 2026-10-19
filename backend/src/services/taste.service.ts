import { db } from '../config/db.config';
import { qlooConfig } from '../config/qloo.config';
import { createTasteSummary } from './tasteSummary';

export { MIN_ACTIVE_ENTITIES } from './tasteSummary';
export type { TasteSummary } from './tasteSummary';

/** Taste summary for the signed-in user. Never throws. */
export const getTasteSummary = createTasteSummary({
   enabled: () => qlooConfig.enabled,
   countEntities: (userId) => db.userTasteEntity.count({ where: { userId } }),
   onError: (err) => console.error('taste summary failed', err),
});
