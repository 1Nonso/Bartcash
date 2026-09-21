import api from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "trade_request"
  | "trade_accepted"
  | "trade_declined"
  | "trade_cancelled"
  | "trade_completed"
  | "new_message"
  | "dispute_raised"
  | "trade_completion_reminder";

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

// ─── API Functions ────────────────────────────────────────────────────────────

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
