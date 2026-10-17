/**
 * Bartcash — Notifications List
 * Route: app/(support-pages)/notifications.tsx
 *
 * API:
 *   GET    /notifications            (list + unread_count)
 *   PATCH  /notifications/{id}/read
 *   PATCH  /notifications/read-all
 *   DELETE /notifications/{id}
 *
 * Spec §12.1: type-coded icon, title, body, time ago, blue unread dot,
 * swipe-left to delete, "Mark all as read", tap → navigate + mark read.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { goBack } from "@/hooks/navigation";
import { Colors, Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import {
  AppNotification,
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/config/notifications";
import { timeAgo } from "@/constants/listing";

// Every notification type currently deep-links to the trade screen using
// reference_id. Change this one constant if your trade route is named
// differently. Verify reference_id for new_message and dispute_raised.
const TRADE_ROUTE = "/(support-pages)/trade/[id]";

const TYPE_META: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  trade_request: { icon: "swap-horizontal", color: Colors.primary },
  trade_rebargain: { icon: "repeat", color: Colors.ai },
  trade_accepted: { icon: "checkmark-circle", color: Colors.success },
  trade_declined: { icon: "close-circle", color: Colors.danger },
  trade_cancelled: { icon: "ban", color: Colors.gray[600] },
  trade_completed: { icon: "checkmark-done-circle", color: Colors.success },
  new_message: { icon: "chatbubble-ellipses", color: Colors.info },
  dispute_raised: { icon: "warning", color: Colors.warning },
};
const FALLBACK_META: { icon: keyof typeof Ionicons.glyphMap; color: string } = {
  icon: "notifications-outline",
  color: Colors.primary,
};

export default function NotificationsScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // ── Data ─────────────────────────────────────────────────────────────────────

  const load = useCallback(async (cursor?: string) => {
    const myId = ++requestId.current;
    try {
      const data = await getNotifications({ limit: 20, cursor });
      if (myId !== requestId.current) return;
      setItems((prev) =>
        cursor ? [...prev, ...data.notifications] : data.notifications,
      );
      setUnread(data.unread_count);
      setNextCursor(data.next_cursor ?? null);
      setError(null);
    } catch (err: any) {
      if (myId !== requestId.current) return;
      setError(err.response?.data?.message ?? "Couldn't load notifications.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is set after the await
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await load(nextCursor);
    setLoadingMore(false);
  }, [nextCursor, loadingMore, load]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleOpen = useCallback((n: AppNotification) => {
    if (!n.read_at) {
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((i) => (i.id === n.id ? { ...i, read_at: now } : i)),
      );
      setUnread((c) => Math.max(0, c - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    if (n.reference_id) {
      router.push({
        pathname: TRADE_ROUTE as any,
        params: { id: n.reference_id },
      });
    }
  }, []);

  const handleMarkAll = useCallback(async () => {
    if (unread === 0) return;
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((i) => (i.read_at ? i : { ...i, read_at: now })),
    );
    setUnread(0);
    try {
      await markAllNotificationsRead();
    } catch {
      load();
    }
  }, [unread, load]);

  const handleDelete = useCallback(
    async (n: AppNotification) => {
      setItems((prev) => prev.filter((i) => i.id !== n.id));
      if (!n.read_at) setUnread((c) => Math.max(0, c - 1));
      try {
        await deleteNotification(n.id);
      } catch {
        load();
      }
    },
    [load],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => {
      const meta = TYPE_META[item.type] ?? FALLBACK_META;
      const isUnread = !item.read_at;
      return (
        <Swipeable
          overshootRight={false}
          renderRightActions={() => (
            <TouchableOpacity
              style={styles.deleteAction}
              onPress={() => handleDelete(item)}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.white} />
            </TouchableOpacity>
          )}
        >
          <TouchableOpacity
            style={[
              styles.row,
              {
                backgroundColor: isUnread ? theme.surface : theme.bg,
                borderBottomColor: theme.borderSubtle,
              },
            ]}
            onPress={() => handleOpen(item)}
            activeOpacity={0.85}
          >
            <View style={styles.dotCol}>
              {isUnread && <View style={styles.unreadDot} />}
            </View>
            <View
              style={[styles.iconWrap, { backgroundColor: meta.color + "1A" }]}
            >
              <Ionicons name={meta.icon} size={18} color={meta.color} />
            </View>
            <View style={styles.rowText}>
              <Text
                style={[
                  styles.rowTitle,
                  {
                    color: theme.textPrimary,
                    fontWeight: isUnread ? "700" : "500",
                  },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text
                style={[styles.rowBody, { color: theme.textMuted }]}
                numberOfLines={2}
              >
                {item.body}
              </Text>
              <Text style={[styles.rowTime, { color: theme.textMuted }]}>
                {timeAgo(item.created_at)}
              </Text>
            </View>
          </TouchableOpacity>
        </Swipeable>
      );
    },
    [theme, handleOpen, handleDelete],
  );

  const renderEmpty = () => {
    if (loading) return null;
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={Colors.danger}
          />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: Colors.primary }]}
            onPress={() => {
              setLoading(true);
              load().finally(() => setLoading(false));
            }}
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name="notifications-off-outline"
          size={48}
          color={Colors.gray[300]}
        />
        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
          No notifications yet.
        </Text>
        <Text style={[styles.emptySub, { color: theme.textMuted }]}>
          Trade updates and messages will show up here.
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing[2],
            borderBottomColor: theme.borderSubtle,
            backgroundColor: theme.bg,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => goBack()}
          style={styles.headerSide}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          <Text style={[styles.backText, { color: theme.textPrimary }]}>
            Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Notifications
        </Text>
        <TouchableOpacity
          onPress={handleMarkAll}
          disabled={unread === 0}
          style={[styles.headerSide, styles.headerRight]}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.markAll,
              { color: unread === 0 ? theme.textMuted : Colors.info },
            ]}
          >
            Mark all read
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty()}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : null
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing[4] }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
  },
  headerSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 90,
  },
  headerRight: { justifyContent: "flex-end" },
  backText: { ...Typography.body },
  title: { ...Typography.sectionTitle },
  markAll: { ...Typography.captionMedium },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing[3],
    paddingRight: Layout.screenPadding,
    borderBottomWidth: 1,
    gap: Spacing[3],
  },
  dotCol: {
    width: Layout.screenPadding,
    alignItems: "center",
    paddingTop: Spacing[3],
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.info,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...Typography.bodyMedium },
  rowBody: { ...Typography.caption },
  rowTime: { ...Typography.micro, marginTop: 2 },

  deleteAction: {
    width: 76,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.danger,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing[16],
    paddingHorizontal: Spacing[8],
    gap: Spacing[2],
  },
  emptyTitle: {
    ...Typography.sectionTitle,
    marginTop: Spacing[2],
    textAlign: "center",
  },
  emptySub: { ...Typography.body, textAlign: "center" },
  retryBtn: {
    marginTop: Spacing[2],
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
  },
  retryText: { ...Typography.button, color: Colors.white },
  footer: { paddingVertical: Spacing[6], alignItems: "center" },
});
