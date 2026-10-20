import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useAnimatedValue,
} from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useFeatures } from "@/hooks/useFeatures";
import { useWelcome } from "@/components/guide/Welcome";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import {
  Colors,
  Layout,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import {
  Category,
  MarketplaceItem,
  getCategories,
  getMarketplaceItems,
} from "@/config/items";
import { getUnreadCount } from "@/config/notifications";
import { formatValuation, conditionLabel, timeAgo } from "@/constants/listing";

// ─── Sub-components ───────────────────────────────────────────────────────────
interface ListingCardProps {
  item: MarketplaceItem;
  onPress: () => void;
}

function ListingCard({ item, onPress }: ListingCardProps) {
  const theme = useAuthTheme();
  const valuation = formatValuation(item.valuation);
  const CONDITION_COLORS: Record<string, string> = {
    new: Colors.success,
    good: Colors.info,
    fair: Colors.warning,
    poor: Colors.danger,
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface }]}
      onPress={onPress}
      activeOpacity={0.92}
    >
      {/* Image */}
      <View style={styles.cardImageContainer}>
        {item.primary_image ? (
          <Image
            source={{ uri: item.primary_image }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.cardImage,
              styles.cardImagePlaceholder,
              { backgroundColor: Colors.gray[100] },
            ]}
          >
            <Ionicons name="image-outline" size={32} color={Colors.gray[400]} />
          </View>
        )}

        {/* Condition badge */}
        <View
          style={[
            styles.conditionBadge,
            {
              backgroundColor:
                CONDITION_COLORS[item.condition] ?? Colors.gray[600],
            },
          ]}
        >
          <Text style={styles.conditionBadgeText}>
            {conditionLabel(item.condition)}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <Text
          style={[styles.cardTitle, { color: theme.textPrimary }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>

        {/* Valuation row */}
        {valuation && (
          <View style={styles.valuationRow}>
            <Ionicons name="trending-up" size={12} color={Colors.ai} />
            <Text style={styles.valuationText}>{valuation}</Text>
            <Text style={styles.aiLabel}>· Valuation</Text>
          </View>
        )}
        {item.valuation?.status === "pending" && (
          <View style={styles.valuationRow}>
            <ActivityIndicator size={10} color={Colors.ai} />
            <Text style={[styles.aiLabel, { marginLeft: 4 }]}>
              Valuing pending...
            </Text>
          </View>
        )}
        {item.valuation?.status === "failed" && (
          <Text style={styles.aiLabel}>Value estimate unavailable</Text>
        )}

        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          {item.owner.profile_photo ? (
            <Image
              source={{ uri: item.owner.profile_photo }}
              style={{
                height: 20,
                width: 20,
                borderRadius: 20,
                marginRight: 5,
              }}
            />
          ) : (
            <View
              style={[
                {
                  height: 20,
                  width: 20,
                  borderRadius: 20,
                  marginRight: 5,
                },
                { backgroundColor: Colors.gray[200] },
              ]}
            />
          )}
          <Text style={styles.locationText} numberOfLines={1}>
            {item.owner.first_name} · {timeAgo(item.created_at)}
          </Text>
        </View>

        {/* Location */}
        {item.location && (
          <View style={styles.locationRow}>
            <Ionicons
              name="location-outline"
              size={11}
              color={Colors.text.tertiary}
            />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Category chip ────────────────────────────────────────────────────────────

interface CategoryChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function CategoryChip({ label, selected, onPress }: CategoryChipProps) {
  const theme = useAuthTheme();
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: selected ? Colors.primary : theme.surface,
          borderColor: selected ? Colors.primary : theme.borderDefault,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? Colors.white : theme.textPrimary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const theme = useAuthTheme();
  const { qloo, loading } = useFeatures();
  // Flag on: Home replaces this screen; sign-in and other links still land here.
  if (loading) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (qloo) return <Redirect href="/(main-pages)/home" />;
  return <BrowseScreen />;
}

function BrowseScreen() {
  const theme = useAuthTheme();
  // First open (flag off): the welcome card (components/guide).
  const welcome = useWelcome();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const lastFetchedAt = useRef(0);

  // Entrance animation
  const headerAnim = useAnimatedValue(0);
  const contentAnim = useAnimatedValue(0);

  useEffect(() => {
    Animated.stagger(120, [
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
  }, [contentAnim, headerAnim]);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch {
      // Non-blocking — categories failing won't break the feed
    }
  }, []);

  const requestId = useRef(0);
  const fetchItems = useCallback(
    async (categoryId: string | null, cursor?: string): Promise<boolean> => {
      const myId = ++requestId.current;
      try {
        const params: Record<string, any> = { limit: 20 };
        if (categoryId) params.category_id = categoryId;
        if (cursor) params.cursor = cursor;

        const data = await getMarketplaceItems(params);
        if (myId !== requestId.current) return false;

        if (cursor) {
          // Append for pagination
          setItems((prev) => [...prev, ...data.items]);
        } else {
          // Fresh load or filter change
          setItems(data.items);
        }
        if (!cursor) lastFetchedAt.current = Date.now();

        setNextCursor(data.next_cursor);
        setError(null);
        return true;
      } catch (err: any) {
        if (myId !== requestId.current) return false;
        setError(err.response?.data?.message || "Failed to load listings.");
        return true;
      }
    },
    [],
  );

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchCategories(), fetchItems(null)]);
      setLoading(false);
    };
    init();
  }, [fetchCategories, fetchItems]);

  useFocusEffect(
    useCallback(() => {
      getUnreadCount()
        .then(setUnread)
        .catch(() => {});
      if (loading || Date.now() - lastFetchedAt.current < 30_000) return;
      fetchItems(selectedCategory);
    }, [loading, selectedCategory, fetchItems]),
  );

  // Category filter change
  const handleCategorySelect = useCallback(
    async (categoryId: string | null) => {
      if (categoryId === selectedCategory) return;
      setSelectedCategory(categoryId);
      setLoading(true);
      setItems([]);
      setNextCursor(null);
      const applied = await fetchItems(categoryId);
      if (applied) setLoading(false);
    },
    [selectedCategory, fetchItems],
  );

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchCategories(), fetchItems(selectedCategory)]);
    setRefreshing(false);
  }, [selectedCategory, fetchCategories, fetchItems]);

  // Infinite scroll
  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await fetchItems(selectedCategory, nextCursor);
    setLoadingMore(false);
  }, [nextCursor, loadingMore, selectedCategory, fetchItems]);

  // ── Navigation ───────────────────────────────────────────────────────────────

  const handleListingPress = useCallback((itemId: string) => {
    router.push(`/(support-pages)/listing/${itemId}`);
  }, []);

  // ── Render helpers ───────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: MarketplaceItem; index: number }) => (
      <View
        style={[
          styles.cardWrapper,
          index % 2 === 0
            ? { paddingRight: Layout.gridGap / 2 }
            : { paddingLeft: Layout.gridGap / 2 },
        ]}
      >
        <ListingCard item={item} onPress={() => handleListingPress(item.id)} />
      </View>
    ),
    [handleListingPress],
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }, [loadingMore]);

  const renderEmpty = useCallback(() => {
    if (loading || error) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="cube-outline" size={48} color={Colors.gray[300]} />
        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
          No listings found
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
          {selectedCategory
            ? "No listings in this category yet."
            : "Be the first to list something!"}
        </Text>
        {selectedCategory && (
          <TouchableOpacity
            onPress={() => handleCategorySelect(null)}
            style={styles.clearFilterBtn}
          >
            <Text style={styles.clearFilterText}>Clear filter</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [
    error,
    handleCategorySelect,
    loading,
    selectedCategory,
    theme.textMuted,
    theme.textPrimary,
  ]);

  // ── Skeleton ─────────────────────────────────────────────────────────────────

  const SkeletonCard = () => (
    <View style={[styles.skeletonCard, { backgroundColor: theme.surface }]}>
      <View
        style={[styles.skeletonImage, { backgroundColor: Colors.gray[100] }]}
      />
      <View style={styles.skeletonContent}>
        <View
          style={[
            styles.skeletonLine,
            { backgroundColor: Colors.gray[100], width: "80%" },
          ]}
        />
        <View
          style={[
            styles.skeletonLine,
            { backgroundColor: Colors.gray[100], width: "50%", marginTop: 6 },
          ]}
        />
        <View
          style={[styles.skeletonBtn, { backgroundColor: Colors.gray[100] }]}
        />
      </View>
    </View>
  );

  const renderSkeletons = () => (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.cardWrapper,
            i % 2 === 0
              ? { paddingRight: Layout.gridGap / 2 }
              : { paddingLeft: Layout.gridGap / 2 },
          ]}
        >
          <SkeletonCard />
        </View>
      ))}
    </View>
  );

  // ── Header component (rendered above the FlatList) ───────────────────────────

  const listHeader = useMemo(
    () => (
      <View>
        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
          style={styles.chipsScroll}
        >
          <CategoryChip
            label="All"
            selected={selectedCategory === null}
            onPress={() => handleCategorySelect(null)}
          />
          {categories.map((cat) => (
            <CategoryChip
              key={cat.id}
              label={cat.name}
              selected={selectedCategory === cat.id}
              onPress={() => handleCategorySelect(cat.id)}
            />
          ))}
        </ScrollView>

        {/* Error banner */}
        {error && (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: Colors.danger + "15" },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={Colors.danger}
            />
            <Text style={[styles.errorText, { color: Colors.danger }]}>
              {error}
            </Text>
            <TouchableOpacity onPress={handleRefresh}>
              <Text style={[styles.retryText, { color: Colors.danger }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    ),
    [selectedCategory, categories, error, handleCategorySelect, handleRefresh],
  );

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
        translucent={false}
      />

      {/* ── Fixed Header ── */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing[2],
            backgroundColor: theme.bg,
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-16, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* Title row */}
        <View style={styles.headerTop}>
          <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>
            Discover
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: theme.surface }]}
              onPress={() => router.push("/(support-pages)/notification")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="notifications-outline"
                size={Layout.iconMd}
                color={theme.textPrimary}
              />
              {unread > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unread > 9 ? "9+" : unread}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar (navigates to Search screen) */}
        <TouchableOpacity
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.borderDefault,
            },
          ]}
          onPress={() => router.push("/(main-pages)/search")}
          activeOpacity={0.9}
        >
          <Ionicons
            name="search-outline"
            size={Layout.iconMd}
            color={theme.textPlaceholder}
          />
          <Text
            style={[styles.searchPlaceholder, { color: theme.textPlaceholder }]}
          >
            Search listings...
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Content ── */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentAnim,
            transform: [
              {
                translateY: contentAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ],
          },
        ]}
      >
        <FlatList
          data={loading ? [] : items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={loading ? renderSkeletons() : renderEmpty()}
          ListFooterComponent={renderFooter()}
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
          contentContainerStyle={[styles.flatListContent, { paddingBottom: tabSpace }]}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.columnWrapper}
        />
      </Animated.View>
      {welcome.node}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_IMAGE_HEIGHT = 160;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    zIndex: 10,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing[3],
  },
  pageTitle: {
    ...Typography.pageTitle,
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing[2],
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.xs,
  },

  // Search bar
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: Layout.inputHeight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[4],
    borderWidth: Layout.borderWidth,
    gap: Spacing[2],
  },
  searchPlaceholder: {
    ...Typography.body,
  },

  // Content
  content: {
    flex: 1,
  },
  flatListContent: {
    paddingHorizontal: Layout.screenPadding,
  },
  columnWrapper: {
    marginBottom: Spacing[3],
  },

  // Category chips
  chipsScroll: {
    marginTop: Spacing[3],
    marginBottom: Spacing[2],
  },
  chipsContainer: {
    paddingRight: Spacing[4],
    gap: Spacing[2],
    flexDirection: "row",
  },
  chip: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    borderWidth: Layout.borderWidth,
  },
  chipText: {
    ...Typography.captionMedium,
  },

  // Section header
  sectionHeader: {
    marginTop: Spacing[2],
    marginBottom: Spacing[3],
  },
  sectionTitle: {
    ...Typography.sectionTitle,
  },

  // Error banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
    marginTop: Spacing[2],
  },
  errorText: {
    ...Typography.caption,
    flex: 1,
  },
  retryText: {
    ...Typography.captionMedium,
    textDecorationLine: "underline",
  },

  // Listing card
  cardWrapper: {
    width: "50%",
  },
  card: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    ...Shadows.sm,
  },
  cardImageContainer: {
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: CARD_IMAGE_HEIGHT,
  },
  cardImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  conditionBadge: {
    position: "absolute",
    top: Spacing[2],
    left: Spacing[2],
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  conditionBadgeText: {
    ...Typography.micro,
    color: Colors.white,
    fontWeight: "600",
  },
  favouriteBtn: {
    position: "absolute",
    top: Spacing[2],
    right: Spacing[2],
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    padding: Spacing[3],
  },
  cardTitle: {
    ...Typography.cardTitle,
    marginBottom: Spacing[1],
  },
  valuationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: Spacing[1],
  },
  valuationText: {
    ...Typography.captionMedium,
    color: Colors.ai,
  },
  aiLabel: {
    ...Typography.micro,
    color: Colors.text.tertiary,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: Spacing[2],
  },
  locationText: {
    ...Typography.micro,
    color: Colors.text.tertiary,
    flex: 1,
  },
  offerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[1],
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
    borderWidth: Layout.borderWidth,
    marginTop: Spacing[1],
  },
  offerBtnText: {
    ...Typography.buttonSm,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing[16],
    gap: Spacing[2],
  },
  emptyTitle: {
    ...Typography.sectionTitle,
    marginTop: Spacing[2],
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    paddingHorizontal: Spacing[8],
  },
  clearFilterBtn: {
    marginTop: Spacing[2],
  },
  clearFilterText: {
    ...Typography.bodyMedium,
    color: Colors.info,
    textDecorationLine: "underline",
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeText: {
    ...Typography.micro,
    color: Colors.white,
    fontWeight: "700",
  },

  // Footer loader
  footerLoader: {
    paddingVertical: Spacing[6],
    alignItems: "center",
  },

  // Skeleton
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  skeletonCard: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    ...Shadows.sm,
  },
  skeletonImage: {
    width: "100%",
    height: CARD_IMAGE_HEIGHT,
  },
  skeletonContent: {
    padding: Spacing[3],
  },
  skeletonLine: {
    height: 12,
    borderRadius: Radius.sm,
  },
  skeletonBtn: {
    height: 32,
    borderRadius: Radius.md,
    marginTop: Spacing[3],
  },
});
