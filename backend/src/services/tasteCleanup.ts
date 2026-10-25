// ----------------------------------------------------------------------------
// Remove a deleted user's taste data (Phase 3 v3.0, Section 10.13).
//
// deleteAccount soft-deletes and anonymises the user row, so the schema's
// onDelete: Cascade rules never fire. This does the same work explicitly,
// inside the deleteAccount transaction. It runs whether or not QLOO_ENABLED
// is on: rows can exist from a time the flag was on, and an empty table makes
// these three deletes no-ops.
//
// Items are soft-deleted and kept for trade history, so item_tastes and
// item_wants stay with them; only the user-level taste data and the cached
// matches are removed.
// ----------------------------------------------------------------------------

type DeleteMany<W> = (args: { where: W }) => PromiseLike<{ count: number }>;

/** The slice of a Prisma transaction client this needs. */
export interface TasteCleanupTx {
   userTasteEntity: { deleteMany: DeleteMany<{ userId: string }> };
   tasteCompatibility: {
      deleteMany: DeleteMany<{ OR: [{ userAId: string }, { userBId: string }] }>;
   };
   matchResult: {
      deleteMany: DeleteMany<{
         OR: [{ sourceItem: { userId: string } }, { candidateItem: { userId: string } }];
      }>;
   };
}

export interface TasteCleanupCounts {
   entities: number;
   compatibilities: number;
   matches: number;
}

export async function deleteTasteData(
   tx: TasteCleanupTx,
   userId: string,
): Promise<TasteCleanupCounts> {
   const entities = await tx.userTasteEntity.deleteMany({ where: { userId } });

   // Pairs are stored once (user_a_id < user_b_id), so the user can be either side.
   const compatibilities = await tx.tasteCompatibility.deleteMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
   });

   // Matches for the user's items, and matches where the user's items appear
   // in other people's lists.
   const matches = await tx.matchResult.deleteMany({
      where: {
         OR: [{ sourceItem: { userId } }, { candidateItem: { userId } }],
      },
   });

   return {
      entities: entities.count,
      compatibilities: compatibilities.count,
      matches: matches.count,
   };
}
