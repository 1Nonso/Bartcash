import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Colors,
  Layout,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants';
import { useAuthTheme } from '@/constants/useAuthTheme';
import { TradeListItem, TradeStatus, getTrades } from '@/config/trades';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function statusConfig(status: TradeStatus): {
  label: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case 'pending':
      return { label: 'Pending', color: Colors.warning, bg: Colors.warning + '20' };
    case 'accepted':
      return { label: 'Accepted', color: Colors.success, bg: Colors.success + '20' };
    case 'completed':
      return { label: 'Completed', color: Colors.info, bg: Colors.info + '15' };
    case 'declined':
      return { label: 'Declined', color: Colors.danger, bg: Colors.danger + '15' };
    case 'cancelled':
      return { label: 'Cancelled', color: Colors.gray[500], bg: Colors.gray[100] };
    case 'disputed':
      return { label: 'Disputed', color: Colors.danger, bg: Colors.danger + '15' };
    default:
      return { label: status, color: Colors.gray[500], bg: Colors.gray[100] };
  }
}

type InboxTab = 'chats' | 'offers';

// ─── Chat row (active trades with messages) ───────────────────────────────────

interface ChatRowProps {
  trade: TradeListItem;
  onPress: () => void;
}

function ChatRow({ trade, onPress }: ChatRowProps) {
  const theme = useAuthTheme();
  const party = trade.other_party;
  const fullName = `${party.first_name} ${party.last_name}`;
  const hasUnread = trade.unread_count > 0;

  return (
    <TouchableOpacity
      style={[
        styles.chatRow,
        { backgroundColor: theme.surface, borderColor: theme.borderSubtle },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {party.profile_photo ? (
          <Image source={{ uri: party.profile_photo }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarFallback,
              { backgroundColor: Colors.gray[200] },
            ]}
          >
            <Ionicons name="person" size={18} color={Colors.gray[500]} />
          </View>
        )}
        {/* Online-ish indicator — shown for accepted trades */}
        {trade.status === 'accepted' && (
          <View
            style={[styles.activeIndicator, { backgroundColor: Colors.success }]}
          />
        )}
      </View>

      {/* Content */}
      <View style={styles.chatContent}>
        <View style={styles.chatTop}>
          <Text
            style={[
              styles.chatName,
              {
                color: theme.textPrimary,
                fontWeight: hasUnread ? '700' : '500',
              },
            ]}
            numberOfLines={1}
          >
            {fullName}
          </Text>
          <Text style={[styles.chatTime, { color: theme.textMuted }]}>
            {timeAgo(trade.updated_at)}
          </Text>
        </View>
        <Text
          style={[
            styles.chatPreview,
            {
              color: hasUnread ? theme.textPrimary : theme.textMuted,
              fontWeight: hasUnread ? '500' : '400',
            },
          ]}
          numberOfLines={1}
        >
          {trade.last_message?.body ?? 'No messages yet'}
        </Text>
      </View>

      {/* Unread badge */}
      {hasUnread && (
        <View style={[styles.unreadBadge, { backgroundColor: Colors.primary }]}>
          <Text style={styles.unreadText}>
            {trade.unread_count > 9 ? '9+' : trade.unread_count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Offer card (trade proposals) ────────────────────────────────────────────

interface OfferCardProps {
  trade: TradeListItem;
  onPress: () => void;
}

function OfferCard({ trade, onPress }: OfferCardProps) {
  const theme = useAuthTheme();
  const party = trade.other_party;
  const fullName = `${party.first_name} ${party.last_name}`;
  const { label, color, bg } = statusConfig(trade.status);

  return (
    <TouchableOpacity
      style={[
        styles.offerCard,
        { backgroundColor: theme.surface, borderColor: theme.cardBorder },
      ]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Header */}
      <View style={styles.offerHeader}>
        {party.profile_photo ? (
          <Image source={{ uri: party.profile_photo }} style={styles.offerAvatar} />
        ) : (
          <View
            style={[
              styles.offerAvatar,
              styles.avatarFallback,
              { backgroundColor: Colors.gray[200] },
            ]}
          >
            <Ionicons name="person" size={16} color={Colors.gray[500]} />
          </View>
        )}
        <View style={styles.offerHeaderInfo}>
          <Text
            style={[styles.offerName, { color: theme.textPrimary }]}
            numberOfLines={1}
          >
            {fullName}
          </Text>
          <Text style={[styles.offerTime, { color: theme.textMuted }]}>
            {timeAgo(trade.updated_at)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: bg }]}>
          <Text style={[styles.statusText, { color }]}>{label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
      </View>

      {/* Items preview */}
      {trade.items_preview && trade.items_preview.length > 0 && (
        <View
          style={[styles.offerItems, { borderTopColor: theme.borderSubtle }]}
        >
          <View style={styles.offerItemsRow}>
            <Text style={[styles.offerItemsLabel, { color: theme.textMuted }]}>
              For Your
            </Text>
            <View style={styles.offerImageRow}>
              {trade.items_preview.slice(0, 3).map((url, i) => (
                <Image
                  key={i}
                  source={{ uri: url }}
                  style={styles.offerItemImage}
                  resizeMode="cover"
                />
              ))}
            </View>
          </View>

          <View style={styles.offerSwap}>
            <Ionicons name="swap-vertical" size={16} color={theme.textMuted} />
          </View>

          <View style={styles.offerItemsRow}>
            <Text style={[styles.offerItemsLabel, { color: theme.textMuted }]}>
              They Offer
            </Text>
            <View style={styles.offerImageRow}>
              {trade.items_preview.slice(0, 3).map((url, i) => (
                <Image
                  key={i}
                  source={{ uri: url }}
                  style={styles.offerItemImage}
                  resizeMode="cover"
                />
              ))}
            </View>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InboxScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<InboxTab>('chats');
  const [trades, setTrades] = useState<TradeListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

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

  const fetchTrades = useCallback(
    async (tab: InboxTab, cursor?: string) => {
      try {
        // Chats tab — accepted trades (have active messaging)
        // Offers tab — pending trades (incoming/outgoing proposals)
        const statusFilter: TradeStatus =
          tab === 'chats' ? 'accepted' : 'pending';

        const data = await getTrades({
          status: statusFilter,
          cursor,
          limit: 20,
        });

        if (cursor) {
          setTrades((prev) => [...prev, ...data.trades]);
        } else {
          setTrades(data.trades);
        }
        setNextCursor(data.next_cursor);

        // Count total unread across chats
        if (tab === 'chats') {
          const unread = data.trades.reduce(
            (sum, t) => sum + (t.unread_count ?? 0),
            0
          );
          setTotalUnread(unread);
        }
      } catch (err: any) {
        console.error('Failed to load inbox:', err);
      }
    },
    []
  );

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
    (tab: InboxTab) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
    },
    [activeTab]
  );

  // ── Navigate to trade ────────────────────────────────────────────────────────

  const handleTradePress = useCallback((trade: TradeListItem) => {
    if (trade.status === 'accepted') {
      // Go straight to chat for accepted trades
      router.push({
        pathname: '/(support-pages)/chat/[tradeId]',
        params: { tradeId: trade.id },
      });
    } else {
      router.push({
        pathname: '/(support-pages)/trade/[id]',
        params: { id: trade.id },
      });
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: TradeListItem }) => {
      if (activeTab === 'chats') {
        return (
          <ChatRow trade={item} onPress={() => handleTradePress(item)} />
        );
      }
      return (
        <OfferCard trade={item} onPress={() => handleTradePress(item)} />
      );
    },
    [activeTab, handleTradePress]
  );

  const renderEmpty = useCallback(
    () =>
      loading ? null : (
        <View style={styles.emptyState}>
          <Ionicons
            name={
              activeTab === 'chats'
                ? 'chatbubbles-outline'
                : 'swap-horizontal-outline'
            }
            size={48}
            color={Colors.gray[300]}
          />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            {activeTab === 'chats' ? 'No active chats' : 'No trade offers'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            {activeTab === 'chats'
              ? 'Accept a trade offer to start chatting with the other party.'
              : 'Browse the marketplace and propose a trade to get started.'}
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: Colors.primary }]}
            onPress={() => router.push('/(main-pages)/dashboard')}
            activeOpacity={0.9}
          >
            <Text style={styles.emptyBtnText}>Browse Listings</Text>
          </TouchableOpacity>
        </View>
      ),
    [loading, activeTab, theme]
  );

  const renderSkeleton = useCallback(
    () => (
      <View style={styles.skeletonList}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.skeletonItem,
              {
                backgroundColor: theme.surface,
                borderColor: theme.borderSubtle,
              },
            ]}
          >
            <View
              style={[
                styles.skeletonAvatar,
                { backgroundColor: Colors.gray[100] },
              ]}
            />
            <View style={styles.skeletonContent}>
              <View
                style={[
                  styles.skeletonLine,
                  { backgroundColor: Colors.gray[100], width: '55%' },
                ]}
              />
              <View
                style={[
                  styles.skeletonLine,
                  {
                    backgroundColor: Colors.gray[100],
                    width: '80%',
                    marginTop: 6,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    ),
    [theme]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
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
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>
          Messages
        </Text>

        {/* Tabs */}
        <View
          style={[
            styles.tabsContainer,
            { backgroundColor: theme.inputBg, borderColor: theme.borderDefault },
          ]}
        >
          {(['chats', 'offers'] as InboxTab[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  isActive && {
                    backgroundColor: Colors.primary,
                    ...Shadows.xs,
                  },
                ]}
                onPress={() => handleTabChange(tab)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={
                    tab === 'chats'
                      ? 'chatbubble-ellipses-outline'
                      : 'cube-outline'
                  }
                  size={14}
                  color={isActive ? Colors.white : theme.textMuted}
                />
                <Text
                  style={[
                    styles.tabText,
                    { color: isActive ? Colors.white : theme.textMuted },
                  ]}
                >
                  {tab === 'chats' ? 'Chats' : 'Offers'}
                </Text>
                {tab === 'chats' && totalUnread > 0 && (
                  <View
                    style={[
                      styles.tabBadge,
                      {
                        backgroundColor: isActive
                          ? Colors.white
                          : Colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabBadgeText,
                        {
                          color: isActive ? Colors.primary : Colors.white,
                        },
                      ]}
                    >
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
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
          renderSkeleton()
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
              { paddingBottom: insets.bottom + Layout.tabBarHeight + Spacing[4] },
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

  header: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
    gap: Spacing[3],
  },
  pageTitle: { ...Typography.pageTitle },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
  },
  tabText: { ...Typography.captionMedium },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { ...Typography.micro, fontWeight: '700' },

  content: { flex: 1 },
  listContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    gap: Spacing[2],
  },

  // Chat row
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[1],
    gap: Spacing[3],
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: Layout.avatarMd,
    height: Layout.avatarMd,
    borderRadius: Radius.full,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  activeIndicator: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  chatContent: { flex: 1, gap: 3 },
  chatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatName: { ...Typography.bodyMedium, flex: 1 },
  chatTime: { ...Typography.micro },
  chatPreview: { ...Typography.caption },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { ...Typography.micro, color: Colors.white, fontWeight: '700' },

  // Offer card
  offerCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    padding: Spacing[3],
  },
  offerAvatar: {
    width: Layout.avatarSm,
    height: Layout.avatarSm,
    borderRadius: Radius.full,
  },
  offerHeaderInfo: { flex: 1 },
  offerName: { ...Typography.bodyMedium },
  offerTime: { ...Typography.caption, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  statusText: { ...Typography.micro, fontWeight: '600' },
  offerItems: {
    borderTopWidth: 1,
    padding: Spacing[3],
    gap: Spacing[2],
  },
  offerItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  offerItemsLabel: { ...Typography.caption },
  offerImageRow: { flexDirection: 'row', gap: Spacing[1] },
  offerItemImage: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
  },
  offerSwap: { alignItems: 'center' },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing[16],
    gap: Spacing[2],
    paddingHorizontal: Layout.screenPadding,
  },
  emptyTitle: { ...Typography.sectionTitle, marginTop: Spacing[2] },
  emptySubtitle: { ...Typography.body, textAlign: 'center' },
  emptyBtn: {
    marginTop: Spacing[3],
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
  },
  emptyBtnText: { ...Typography.button, color: Colors.white },

  // Skeleton
  skeletonList: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    gap: Spacing[2],
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: Spacing[3],
    gap: Spacing[3],
  },
  skeletonAvatar: {
    width: Layout.avatarMd,
    height: Layout.avatarMd,
    borderRadius: Radius.full,
  },
  skeletonContent: { flex: 1, gap: Spacing[2] },
  skeletonLine: { height: 12, borderRadius: Radius.sm },

  footerLoader: { paddingVertical: Spacing[6], alignItems: 'center' },
});