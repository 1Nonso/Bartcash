import { db } from '../config/db.config';
import { Expo } from 'expo-server-sdk';
import type { ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

export type NotificationType =
   | 'trade_request'
   | 'trade_rebargain'
   | 'trade_accepted'
   | 'trade_declined'
   | 'trade_cancelled'
   | 'trade_completed'
   | 'trade_pending'
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
   } catch (err) {
      console.error(
         'Failed to create notification(s):',
         err,
      );
      return; // don't attempt push if the DB write failed
   }

   try {
      const users =
         await db.user.findMany({
            where: {
               id: {
                  in: list.map(
                     (n) => n.userId,
                  ),
               },
            },
            select: {
               id: true,
               pushToken: true,
            },
         });
      const tokenByUser = new Map(
         users.map((u) => [
            u.id,
            u.pushToken,
         ]),
      );

      const messages: ExpoPushMessage[] =
         [];
      for (const n of list) {
         const token = tokenByUser.get(
            n.userId,
         );
         if (
            !token ||
            !Expo.isExpoPushToken(token)
         )
            continue;
         messages.push({
            to: token,
            sound: 'default',
            title: n.title,
            body: n.body,
            data: {
               reference_type:
                  n.referenceType ??
                  null,
               reference_id:
                  n.referenceId ?? null,
            },
         });
      }
      if (messages.length === 0) return;

      const chunks =
         expo.chunkPushNotifications(
            messages,
         );
      for (const chunk of chunks) {
         try {
            await expo.sendPushNotificationsAsync(
               chunk,
            );
         } catch (err) {
            console.error(
               'Expo push dispatch failed:',
               err,
            );
         }
      }
   } catch (err) {
      console.error(
         'Push dispatch failed:',
         err,
      );
   }
}
