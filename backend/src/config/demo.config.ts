// Demo judge accounts from the demo seed (judge1@example.com …). They share
// identical listings and taste, so they never appear in each other's
// matches or People like you; everyone else sees them as normal users.

const JUDGE_EMAIL = /^judge\d+@example\.com$/i;

export function isDemoJudge(email: string | null | undefined): boolean {
   return !!email && JUDGE_EMAIL.test(email);
}

/** Prisma user filter: not a demo judge account. */
export const NOT_DEMO_JUDGE = {
   NOT: { email: { startsWith: 'judge', endsWith: '@example.com' } },
} as const;
