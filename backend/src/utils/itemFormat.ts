// Shared response shapes for items (API §16.3 ItemCard / OwnerRef).

export function formatValuation(
   valuation: any,
) {
   if (!valuation) return null;
   return {
      id: valuation.id,
      value_min: valuation.valueMin,
      value_max: valuation.valueMax,
      currency: valuation.currency,
      confidence: valuation.confidence,
      status: valuation.status,
      failed_reason:
         valuation.failedReason,
   };
}

export function formatOwner(
   user: any,
   { extended = false } = {},
) {
   return {
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      profile_photo: user.profilePhoto,
      average_rating:
         user.averageRating,
      ...(extended
         ? {
              total_trades:
                 user.totalTrades,
           }
         : {}),
   };
}

/** An element of GET /items (API §16.3 ItemCard). */
export function formatItemCard(item: any) {
   return {
      id: item.id,
      title: item.title,
      condition: item.condition,
      is_service: item.isService,
      location: item.location,
      primary_image:
         item.images?.[0]?.url ?? null,
      valuation: formatValuation(
         item.valuation,
      ),
      owner: formatOwner(item.user),
      created_at: item.createdAt,
   };
}
