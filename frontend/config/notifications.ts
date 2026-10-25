import api from "./api";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { router } from "expo-router";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "trade_request"
  | "trade_accepted"
  | "trade_declined"
  | "trade_cancelled"
  | "trade_completed"
  | "new_message"
  | "dispute_raised"
  | "trade_pending";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  reference_id: string | null;
  reference_type: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unread_count: number;
  next_cursor: string | null;
}

export const isExpo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import("expo-notifications");

/**
 * expo-notifications, or null in Expo Go. Android Expo Go (SDK 53+) throws
 * on import, so the module is loaded only outside Expo Go. Import this
 * instead of "expo-notifications".
 */
export const Notifications: NotificationsModule | null = isExpo
  ? null
  : require("expo-notifications");

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// ─── API Functions ────────────────────────────────────────────────────────────
/** Open the screen a push notification points at (trade or dispute). */
export function navigateFromNotification(data: any) {
  const referenceType = data?.reference_type;
  const referenceId = data?.reference_id;
  if (!referenceType || !referenceId) return;

  if (referenceType === "Trade") {
    router.push({
      pathname: "/(support-pages)/trade/[id]",
      params: { id: referenceId },
    });
  } else if (referenceType === "Dispute") {
    // TODO: point at the dispute detail screen once dispute.tsx exists
    router.push({
      pathname: "/(support-pages)/trade/[id]",
      params: { id: referenceId },
    });
  }
}

export async function registerForPushNotifications(): Promise<void> {
  if (!Notifications) return;
  if (!Device.isDevice) return; // simulators/emulators have no push token

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    await api.patch("/user/push-token", { push_token: token });
  } catch (err) {
    console.error("Failed to register push token:", err);
  }
}

/**
 * Get paginated notifications for authenticated user.
 * GET /notifications
 */
export async function getNotifications(
  params: {
    cursor?: string;
    limit?: number;
  } = {},
): Promise<NotificationsResponse> {
  const response = await api.get("/notifications", { params });
  return response.data.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await api.get("/notifications", { params: { limit: 1 } });
  return res.data.data.unread_count ?? 0;
}

/**
 * Mark a single notification as read.
 * PATCH /notifications/{id}/read
 */
export async function markNotificationRead(
  id: string,
): Promise<{ read_at: string }> {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data.data.notification;
}

/**
 * Mark all notifications as read.
 * PATCH /notifications/read-all
 */
export async function markAllNotificationsRead(): Promise<{
  marked_read: number;
}> {
  const response = await api.patch("/notifications/read-all");
  return response.data.data;
}

/**
 * Delete a notification.
 * DELETE /notifications/{id}
 */
export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}
