/**
 * Bartcash — Search & Filter Screen
 * Route: app/(main-pages)/search.tsx
 *
 * Full-screen search with keyword + filter options.
 * Auto-focuses input on mount. Debounced search (300ms).
 * Single-column results list.
 *
 * API:
 *   GET /items?search={query}&category_id={id}&condition={c}&limit=20
 *   GET /categories
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Keyboard,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useAnimatedValue,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
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
import {
  Category,
  MarketplaceItem,
  getCategories,
  getMarketplaceItems,
} from "@/config/items";
import { formatValuation, conditionLabel, timeAgo } from "@/constants/listing";

// ─── Types ────────────────────────────────────────────────────────────────────
type Condition = "new" | "good" | "fair" | "poor";

// ─── Sub-components ───────────────────────────────────────────────────────────
interface SearchResultCardProps {
  item: MarketplaceItem;
  onPress: () => void;
}

function SearchResultCard({ item, onPress }: SearchResultCardProps) {
  const theme = useAuthTheme();
  const val = formatValuation(item.valuation);
  const ownerName = `${item.owner.first_name} ${item.owner.last_name}`;
  const ownerInitials =
    `${item.owner.first_name[0] ?? ""}${item.owner.last_name[0] ?? ""}`.toUpperCase();

  return (
    <TouchableOpacity
      style={[styles.resultCard, { backgroundColor: theme.surface }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Image */}
      <View style={styles.resultImageWrap}>
        {item.primary_image ? (
          <Image
            source={{ uri: item.primary_image }}
            style={styles.resultImage}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.resultImage,
              styles.resultImagePlaceholder,
              { backgroundColor: Colors.gray[100] },
            ]}
          >
            <Ionicons name="image-outline" size={24} color={Colors.gray[400]} />
          </View>
        )}

        {/* Condition badge */}
        <View
          style={[
            styles.conditionBadge,
            {
              backgroundColor:
                item.condition === "new" ? Colors.success : Colors.gray[600],
            },
          ]}
        >
          <Text style={styles.conditionBadgeText}>
            {conditionLabel(item.condition)}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.resultContent}>
        <Text
          style={[styles.resultTitle, { color: theme.textPrimary }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>

        {/* Valuation */}
        {val && (
          <View style={styles.valuationRow}>
            <Ionicons name="trending-up" size={11} color={Colors.ai} />
            <Text style={styles.valuationText}>{val}</Text>
            <Text style={[styles.aiLabel, { color: theme.textMuted }]}>
              · AI Value
            </Text>
          </View>
        )}
        {item.valuation?.status === "pending" && (
          <View style={styles.valuationRow}>
            <ActivityIndicator size={10} color={Colors.ai} />
            <Text
              style={[
                styles.aiLabel,
                { marginLeft: 4, color: theme.textMuted },
              ]}
            >
              Valuing...
            </Text>
          </View>
        )}

        {/* Owner + time */}
        <View style={styles.resultMeta}>
          {item.owner.profile_photo ? (
            <Image
              source={{ uri: item.owner.profile_photo }}
              style={styles.ownerAvatar}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.ownerAvatar,
                styles.ownerAvatarFallback,
                { backgroundColor: Colors.primary },
              ]}
            >
              <Text style={styles.ownerAvatarInitials}>{ownerInitials}</Text>
            </View>
          )}
          <Text
            style={[styles.ownerName, { color: theme.textMuted }]}
            numberOfLines={1}
          >
            {ownerName}
          </Text>
          {item.location && (
            <>
              <Text style={[styles.metaSep, { color: theme.textMuted }]}>
                ·
              </Text>
              <Ionicons
                name="location-outline"
                size={11}
                color={theme.textMuted}
              />
              <Text
                style={[styles.locationText, { color: theme.textMuted }]}
                numberOfLines={1}
              >
                {item.location}
              </Text>
            </>
          )}
          <Text style={[styles.metaSep, { color: theme.textMuted }]}>·</Text>
          <Text style={[styles.timeText, { color: theme.textMuted }]}>
            {timeAgo(item.created_at)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function FilterChip({ label, selected, onPress }: FilterChipProps) {
  const theme = useAuthTheme();
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? Colors.primary : theme.inputBg,
          borderColor: selected ? Colors.primary : theme.borderDefault,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text
        style={[
          styles.filterChipText,
          { color: selected ? Colors.white : theme.textPrimary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

/**
 * mode "discover" (UI spec §13.5, flag on): the same screen as the Discover
 * tab — shows the full listing feed when there is no query or filter, no
 * auto-focus, pull to refresh. Search itself is unchanged.
 */
export default function SearchScreen({
  mode = "search",
}: {
  mode?: "search" | "discover";
}) {
  const discover = mode === "discover";
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<Condition | null>(
    null,
  );
  const [categories, setCategories] = useState<Category[]>([]);

  // Results state
  const [results, setResults] = useState<MarketplaceItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entrance animation
  const headerAnim = useAnimatedValue(0);
  const bodyAnim = useAnimatedValue(0);

  const CONDITIONS: { label: string; value: Condition }[] = [
    { label: "New", value: "new" },
    { label: "Good", value: "good" },
    { label: "Fair", value: "fair" },
    { label: "Poor", value: "poor" },
  ];

  // Auto-focus input (not on Discover, where the feed comes first)
  useFocusEffect(
    useCallback(() => {
      if (discover) return;
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }, [discover]),
  );

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch {}
  };

  useEffect(() => {
    Animated.stagger(80, [
      Animated.spring(headerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.spring(bodyAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
    ]).start();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is set after the await
    loadCategories();
  }, [bodyAnim, headerAnim]);

  // ── Search logic ─────────────────────────────────────────────────────────────

  const requestId = useRef(0);
  const performSearch = useCallback(
    async (
      q: string,
      catId: string | null,
      cond: Condition | null,
      cursor?: string,
    ) => {
      const myId = ++requestId.current;
      if (!discover && !q.trim() && !catId && !cond) {
        setResults([]);
        setHasSearched(false);
        setLoading(false);
        return;
      }

      if (!cursor) setLoading(true);
      else setLoadingMore(true);

      try {
        const params: Record<string, any> = { limit: 20 };
        if (q.trim()) params.search = q.trim();
        if (catId) params.category_id = catId;
        if (cond) params.condition = cond;
        if (cursor) params.cursor = cursor;

        const data = await getMarketplaceItems(params);
        if (myId !== requestId.current) return;
        if (cursor) {
          setResults((prev) => [...prev, ...data.items]);
        } else {
          setResults(data.items);
        }
        setNextCursor(data.next_cursor);
        setHasSearched(true);
        setError(null);
      } catch {
        if (myId !== requestId.current) return;
        setError(
          discover ? "Failed to load listings." : "Search failed. Please try again.",
        );
        setHasSearched(true);
      } finally {
        if (myId === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [discover],
  );

  // Discover: load the feed on mount; pull to refresh reloads the current view.
  const [pullRefreshing, setPullRefreshing] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is set after the await
    if (discover) performSearch("", null, null);
  }, [discover, performSearch]);
  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    await performSearch(query, selectedCategory, selectedCondition);
    setPullRefreshing(false);
  }, [performSearch, query, selectedCategory, selectedCondition]);

  // Debounced search on query change
  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        performSearch(text, selectedCategory, selectedCondition);
      }, 300);
    },
    [selectedCategory, selectedCondition, performSearch],
  );

  // Re-search when filters change
  const handleCategorySelect = useCallback(
    (catId: string | null) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      setSelectedCategory(catId);
      performSearch(query, catId, selectedCondition);
    },
    [query, selectedCondition, performSearch],
  );

  const handleConditionSelect = useCallback(
    (cond: Condition | null) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      setSelectedCondition(cond);
      performSearch(query, selectedCategory, cond);
    },
    [query, selectedCategory, performSearch],
  );

  const handleClearAll = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setQuery("");
    setSelectedCategory(null);
    setSelectedCondition(null);
    if (discover) {
      performSearch("", null, null);
      return;
    }
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  }, [discover, performSearch]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    await performSearch(query, selectedCategory, selectedCondition, nextCursor);
  }, [
    nextCursor,
    loadingMore,
    query,
    selectedCategory,
    selectedCondition,
    performSearch,
  ]);

  // ── Active filters count ─────────────────────────────────────────────────────

  const activeFiltersCount = [selectedCategory, selectedCondition].filter(
    Boolean,
  ).length;

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: MarketplaceItem }) => (
      <SearchResultCard
        item={item}
        onPress={() => {
          Keyboard.dismiss();
          router.push(`/(support-pages)/listing/${item.id}`);
        }}
      />
    ),
    [],
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
    if (loading || !hasSearched) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={48} color={Colors.gray[300]} />
        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
          {discover && !query.trim() && activeFiltersCount === 0
            ? "No listings yet"
            : "No results found"}
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
          Try different keywords or adjust your filters
        </Text>
        {activeFiltersCount > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearAllBtn}>
            <Text style={styles.clearAllText}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [
    loading,
    hasSearched,
    discover,
    query,
    theme.textPrimary,
    theme.textMuted,
    activeFiltersCount,
    handleClearAll,
  ]);

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
        translucent={false}
      />

      {/* ── Search Header ── */}
      <Animated.View
        style={[
          styles.searchHeader,
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
        {discover && (
          <Text style={[styles.discoverTitle, { color: theme.textPrimary }]}>
            Discover
          </Text>
        )}
        <View style={styles.searchRow}>
          {/* Input */}
          <View
            style={[
              styles.searchInputWrap,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.borderDefault,
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={theme.textPlaceholder}
            />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder="Search listings..."
              placeholderTextColor={theme.textPlaceholder}
              value={query}
              onChangeText={handleQueryChange}
              returnKeyType="search"
              onSubmitEditing={() =>
                performSearch(query, selectedCategory, selectedCondition)
              }
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setQuery("");
                  performSearch("", selectedCategory, selectedCondition);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={theme.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Cancel (not on Discover, which is a tab) */}
          {!discover && (
            <TouchableOpacity
              onPress={() => goBack()}
              style={styles.cancelBtn}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelText, { color: theme.textPrimary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ── Body ── */}
      <Animated.View
        style={[
          styles.bodyWrapper,
          {
            opacity: bodyAnim,
            transform: [
              {
                translateY: bodyAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* ── Filters bar ── */}
        <View
          style={[styles.filtersBar, { borderBottomColor: theme.borderSubtle }]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}
          >
            {/* Category chips */}
            <FilterChip
              label="All Categories"
              selected={selectedCategory === null}
              onPress={() => handleCategorySelect(null)}
            />
            {categories.map((cat) => (
              <FilterChip
                key={cat.id}
                label={cat.name}
                selected={selectedCategory === cat.id}
                onPress={() => handleCategorySelect(cat.id)}
              />
            ))}

            {/* Divider */}
            <View
              style={[
                styles.filtersDivider,
                { backgroundColor: theme.borderSubtle },
              ]}
            />

            {/* Condition chips */}
            <FilterChip
              label="All Conditions"
              selected={selectedCondition === null}
              onPress={() => handleConditionSelect(null)}
            />
            {CONDITIONS.map((c) => (
              <FilterChip
                key={c.value}
                label={c.label}
                selected={selectedCondition === c.value}
                onPress={() =>
                  handleConditionSelect(
                    selectedCondition === c.value ? null : c.value,
                  )
                }
              />
            ))}
          </ScrollView>

          {/* Active filter count badge */}
          {activeFiltersCount > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              style={styles.clearFiltersBtn}
            >
              <Text style={styles.clearFiltersText}>
                Clear ({activeFiltersCount})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Results list ── */}
        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>
              Searching...
            </Text>
          </View>
        ) : !hasSearched ? (
          // Default state — show prompt
          <View style={styles.promptState}>
            <Ionicons
              name="search-outline"
              size={56}
              color={Colors.gray[200]}
            />
            <Text style={[styles.promptTitle, { color: theme.textPrimary }]}>
              Search Bartcash
            </Text>
            <Text style={[styles.promptSubtitle, { color: theme.textMuted }]}>
              Find items and services to trade. Use the filters above to narrow
              your results.
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorState}>
            <Ionicons
              name="alert-circle-outline"
              size={40}
              color={Colors.danger}
            />
            <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: Colors.primary }]}
              onPress={() =>
                performSearch(query, selectedCategory, selectedCondition)
              }
            >
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={renderEmpty()}
            ListFooterComponent={renderFooter()}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            contentContainerStyle={styles.flatListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              discover ? (
                <RefreshControl
                  refreshing={pullRefreshing}
                  onRefresh={handlePullRefresh}
                  tintColor={theme.ai}
                />
              ) : undefined
            }
          />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  discoverTitle: {
    ...Typography.pageTitle,
    marginBottom: Spacing[3],
  },

  // Search header
  searchHeader: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: Layout.inputHeight,
    borderRadius: Radius.full,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    gap: Spacing[2],
  },
  searchInput: {
    flex: 1,
    ...Typography.input,
    paddingVertical: 0,
  },
  cancelBtn: { paddingVertical: Spacing[2] },
  cancelText: { ...Typography.bodyMedium },

  // Filters
  filtersBar: {
    borderBottomWidth: 1,
  },
  filtersScroll: {
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing[3],
    gap: Spacing[2],
    flexDirection: "row",
  },
  filtersDivider: {
    width: 1,
    marginHorizontal: Spacing[1],
  },
  filterChip: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    borderWidth: Layout.borderWidth,
  },
  filterChipText: {
    ...Typography.captionMedium,
  },
  clearFiltersBtn: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
  },
  clearFiltersText: {
    ...Typography.captionMedium,
    color: Colors.info,
  },

  // Body
  bodyWrapper: { flex: 1 },
  flatListContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    paddingBottom: Layout.tabBarHeight + Spacing[4],
    gap: Spacing[3],
  },

  // Loading / prompt / error
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[3],
  },
  loadingText: { ...Typography.body },
  promptState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Layout.screenPadding * 2,
    gap: Spacing[3],
  },
  promptTitle: { ...Typography.sectionTitle },
  promptSubtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[3],
    paddingHorizontal: Layout.screenPadding,
  },
  errorTitle: { ...Typography.bodyMedium, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
  },
  retryBtnText: { ...Typography.button, color: Colors.white },

  // Result card
  resultCard: {
    flexDirection: "row",
    borderRadius: Radius.lg,
    overflow: "hidden",
    ...Shadows.sm,
  },
  resultImageWrap: {
    position: "relative",
  },
  resultImage: {
    width: 100,
    height: 100,
  },
  resultImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  conditionBadge: {
    position: "absolute",
    top: Spacing[2],
    left: Spacing[2],
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  conditionBadgeText: {
    ...Typography.micro,
    color: Colors.white,
    fontWeight: "600",
  },
  resultContent: {
    flex: 1,
    padding: Spacing[3],
    gap: Spacing[1],
    justifyContent: "center",
  },
  resultTitle: {
    ...Typography.cardTitle,
  },
  valuationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  valuationText: {
    ...Typography.captionMedium,
    color: Colors.ai,
  },
  aiLabel: {
    ...Typography.micro,
  },
  resultMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing[1],
    flexWrap: "nowrap",
    overflow: "hidden",
  },
  ownerAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  ownerAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  ownerAvatarInitials: {
    fontSize: 7,
    color: Colors.white,
    fontWeight: "700",
  },
  ownerName: {
    ...Typography.micro,
    flexShrink: 1,
  },
  metaSep: {
    ...Typography.micro,
  },
  locationText: {
    ...Typography.micro,
    flexShrink: 1,
  },
  timeText: {
    ...Typography.micro,
  },

  // Empty state
  emptyState: {
    paddingVertical: Spacing[16],
    alignItems: "center",
    gap: Spacing[2],
  },
  emptyTitle: { ...Typography.sectionTitle, marginTop: Spacing[2] },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    paddingHorizontal: Spacing[8],
  },
  clearAllBtn: { marginTop: Spacing[2] },
  clearAllText: {
    ...Typography.bodyMedium,
    color: Colors.info,
    textDecorationLine: "underline",
  },

  // Footer loader
  footerLoader: {
    paddingVertical: Spacing[6],
    alignItems: "center",
  },
});
