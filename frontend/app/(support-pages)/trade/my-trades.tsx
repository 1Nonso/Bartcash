import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { goBack } from "@/hooks/navigation";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Colors,
  Layout,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { TradeListItem, TradeStatus, getTrades } from "@/config/trades";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function statusConfig(status: TradeStatus): {
  label: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case "pending":
      return {
        label: "Pending",
        color: Colors.warning,
        bg: Colors.warning + "20",
      };
    case "accepted":
      return {
        label: "Accepted",
        color: Colors.success,
        bg: Colors.success + "20",
      };
    case "completed":
      return { label: "Completed", color: Colors.info, bg: Colors.info + "15" };
    case "declined":
      return {
        label: "Declined",
        color: Colors.danger,
        bg: Colors.danger + "15",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        color: Colors.gray[500],
        bg: Colors.gray[100],
      };
    case "disputed":
      return {
        label: "Disputed",
        color: Colors.danger,
        bg: Colors.danger + "15",
      };
    default:
      return { label: status, color: Colors.gray[500], bg: Colors.gray[100] };
  }
}

type FilterTab = "all" | "pending" | "accepted" | "completed";

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Accepted", value: "accepted" },
  { label: "Completed", value: "completed" },
];

// ─── Trade card ───────────────────────────────────────────────────────────────

interface TradeCardProps {
  trade: TradeListItem;
  onPress: () => void;
}

function TradeCard({ trade, onPress }: TradeCardProps) {
  const theme = useAuthTheme();
  const { label, color, bg } = statusConfig(trade.status);
  const otherParty = trade.other_party;
  const fullName = `${otherParty.first_name} ${otherParty.last_name}`;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.cardBorder },
      ]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Header row */}
      <View style={styles.cardHeader}>
        {/* Avatar */}
        {otherParty.profile_photo ? (
          <Image
            source={{ uri: otherParty.profile_photo }}
            style={styles.avatar}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarFallback,
              { backgroundColor: Colors.gray[200] },
            ]}
          >
            <Ionicons name="person" size={16} color={Colors.gray[500]} />
          </View>
        )}

        {/* Name + status */}
        <View style={styles.cardHeaderInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.partyName, { color: theme.textPrimary }]}>
              {fullName}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: bg }]}>
              <Text style={[styles.statusText, { color }]}>{label}</Text>
            </View>
          </View>
          <Text style={[styles.timeText, { color: theme.textMuted }]}>
            {timeAgo(trade.updated_at)}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </View>

      {/* Items preview */}
      {trade.items_preview && trade.items_preview.length > 0 && (
        <View
          style={[styles.itemsPreview, { borderTopColor: theme.borderSubtle }]}
        >
          <View style={styles.itemsPreviewImages}>
            {trade.items_preview.slice(0, 4).map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ))}
          </View>
          <Ionicons name="swap-horizontal" size={14} color={theme.textMuted} />
        </View>
      )}

      {/* Last message */}
      {trade.last_message && (
        <View
          style={[styles.lastMessage, { borderTopColor: theme.borderSubtle }]}
        >
          <Ionicons
            name="chatbubble-outline"
            size={12}
            color={theme.textMuted}
          />
          <Text
            style={[styles.lastMessageText, { color: theme.textMuted }]}
            numberOfLines={1}
          >
            {trade.last_message.body}
          </Text>
          {trade.unread_count > 0 && (
            <View
              style={[styles.unreadBadge, { backgroundColor: Colors.primary }]}
            >
              <Text style={styles.unreadCount}>{trade.unread_count}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MyTradesScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();

  const [trades, setTrades] = useState<TradeListItem[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(headerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.spring(contentAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
    ]).start();
  }, []);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchTrades = useCallback(async (tab: FilterTab, cursor?: string) => {
    try {
      const params: any = { limit: 20 };
      if (tab !== "all") params.status = tab;
      if (cursor) params.cursor = cursor;

      const data = await getTrades(params);
      if (cursor) {
        setTrades((prev) => [...prev, ...data.trades]);
      } else {
        setTrades(data.trades);
      }
      setNextCursor(data.next_cursor);
    } catch (err: any) {
      console.error("Failed to load trades:", err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setTrades([]);
      await fetchTrades(activeTab);
      setLoading(false);
    };
    load();
  }, [activeTab]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTrades(activeTab);
    setRefreshing(false);
  }, [activeTab, fetchTrades]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await fetchTrades(activeTab, nextCursor);
    setLoadingMore(false);
  }, [nextCursor, loadingMore, activeTab, fetchTrades]);

  const handleTabChange = useCallback(
    (tab: FilterTab) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
    },
    [activeTab],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: TradeListItem }) => (
      <TradeCard
        trade={item}
        onPress={() =>
          router.push({
            pathname: "/(support-pages)/trade/[id]",
            params: { id: item.id },
          })
        }
      />
    ),
    [],
  );

  const renderEmpty = useCallback(
    () =>
      loading ? null : (
        <View style={styles.emptyState}>
          <Ionicons
            name="swap-horizontal-outline"
            size={48}
            color={Colors.gray[300]}
          />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            {activeTab === "all" ? "No trades yet" : `No ${activeTab} trades`}
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            {activeTab === "all"
              ? "Browse the marketplace and propose a trade to get started."
              : `You have no ${activeTab} trades at the moment.`}
          </Text>
          {activeTab === "all" && (
            <TouchableOpacity
              style={[styles.browseBtn, { backgroundColor: Colors.primary }]}
              onPress={() => router.push("/(main-pages)/dashboard")}
            >
              <Text style={styles.browseBtnText}>Browse Listings</Text>
            </TouchableOpacity>
          )}
        </View>
      ),
    [loading, activeTab, theme],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing[2],
            backgroundColor: theme.bg,
            borderBottomColor: theme.borderSubtle,
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
            <Text style={[styles.backText, { color: theme.textPrimary }]}>
              Back
            </Text>
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>
            My Trades
          </Text>
          <View style={{ minWidth: 60 }} />
        </View>

        {/* Filter tabs */}
        <View style={styles.tabsRow}>
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.value}
              style={[
                styles.tab,
                {
                  backgroundColor:
                    activeTab === tab.value ? Colors.primary : theme.inputBg,
                  borderColor:
                    activeTab === tab.value
                      ? Colors.primary
                      : theme.borderDefault,
                },
              ]}
              onPress={() => handleTabChange(tab.value)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === tab.value
                        ? Colors.white
                        : theme.textPrimary,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentAnim,
            transform: [
              {
                translateY: contentAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={trades}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={renderEmpty()}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
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
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + Spacing[4] },
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
    gap: Spacing[3],
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 60 },
  backText: { ...Typography.body },
  pageTitle: { ...Typography.sectionTitle },

  tabsRow: { flexDirection: "row", gap: Spacing[2] },
  tab: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    borderWidth: Layout.borderWidth,
  },
  tabText: { ...Typography.captionMedium },

  content: { flex: 1 },
  listContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
    gap: Spacing[3],
  },

  // Card
  card: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    overflow: "hidden",
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing[3],
    gap: Spacing[3],
  },
  avatar: {
    width: Layout.avatarSm,
    height: Layout.avatarSm,
    borderRadius: Radius.full,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  cardHeaderInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },
  partyName: { ...Typography.bodyMedium },
  statusBadge: {
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  statusText: { ...Typography.micro, fontWeight: "600" },
  timeText: { ...Typography.caption, marginTop: 2 },

  itemsPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderTopWidth: 1,
  },
  itemsPreviewImages: { flexDirection: "row", gap: Spacing[2] },
  previewImage: { width: 40, height: 40, borderRadius: Radius.sm },

  lastMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderTopWidth: 1,
  },
  lastMessageText: { ...Typography.caption, flex: 1 },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadCount: { ...Typography.micro, color: Colors.white, fontWeight: "700" },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing[16],
    gap: Spacing[2],
    paddingHorizontal: Layout.screenPadding,
  },
  emptyTitle: { ...Typography.sectionTitle, marginTop: Spacing[2] },
  emptySubtitle: { ...Typography.body, textAlign: "center" },
  browseBtn: {
    marginTop: Spacing[3],
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
  },
  browseBtnText: { ...Typography.button, color: Colors.white },

  footerLoader: { paddingVertical: Spacing[6], alignItems: "center" },
});
