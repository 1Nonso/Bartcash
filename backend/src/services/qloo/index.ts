import { db } from '../../config/db.config';
import { qlooConfig } from '../../config/qloo.config';
import { createQlooClient } from './qlooClient';
import { prismaCacheStore, prismaUsageStore } from './qlooStores';

/**
 * The production Qloo client. One instance per process: the pacer and the
 * circuit breaker are per-process state; cache, budget and usage count live
 * in the database and are shared by the API and the worker.
 */
export const qlooClient = createQlooClient({
   config: qlooConfig,
   cache: prismaCacheStore(db),
   usage: prismaUsageStore(db),
});

export type {
   BartcashEntityType,
   QlooFailureReason,
   QlooInsightEntity,
   QlooPurpose,
   QlooResult,
   QlooSearchEntity,
   QlooTag,
   QlooTagResult,
} from './qlooTypes';
export { BARTCASH_ENTITY_TYPES, fromQlooTypes, QlooUsageError } from './qlooTypes';
