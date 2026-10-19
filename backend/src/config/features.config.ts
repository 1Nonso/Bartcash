import { qlooConfig } from './qloo.config';
export const isQlooEnabled = () =>
   qlooConfig.enabled;

/* export const isQlooEnabled = () => process.env.QLOO_ENABLED === 'true'; */
