import { db } from '../config/db.config';

export type NotificationType =
   | 'trade_request'
   | 'trade_rebargain'
   | 'trade_accepted'
   | 'trade_declined'
   | 'trade_cancelled'
   | 'trade_completed'
   | 'new_message'
   | 'dispute_raised';

export interface NotificationInput {
   userId: string;
   type: NotificationType;
   title: string;
   body: string;
   referenceId?: string;
   /** Related entity model name, e.g. 'Trade' or 'Dispute'. */
   referenceType?: 'Trade' | 'Dispute';
}

// Best-effort: a failed notification must never fail the request that
// triggered it, so errors are logged and swallowed.
export async function notify(
   inputs:
      | NotificationInput
      | NotificationInput[],
): Promise<void> {
   const list = Array.isArray(inputs)
      ? inputs
      : [inputs];
   if (list.length === 0) return;

   try {
      await db.notification.createMany({
         data: list.map((n) => ({
            userId: n.userId,
            type: n.type,
            title: n.title,
            body: n.body,
            referenceId:
               n.referenceId ?? null,
            referenceType:
               n.referenceType ?? null,
         })),
      });
      // TODO: push dispatch (Expo push) once device tokens are stored
   } catch (err) {
      console.error(
         'Failed to create notification(s):',
         err,
      );
   }
}
