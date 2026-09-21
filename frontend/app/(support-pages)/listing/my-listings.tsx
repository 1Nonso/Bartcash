import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
import { ItemDetail, deleteItem, getMyItems } from "@/config/items";

type FilterTab = "available" | "inactive" | "traded";

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: "Available", value: "available" },
  { label: "Inactive", value: "inactive" },
  { label: "Traded", value: "traded" },
];

function conditionLabel(c: string): string {
  const map: Record<string, string> = {
    new: "New",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
  };
  return map[c] ?? c;
}

function formatValuation(item: ItemDetail): string | null {
  const v = item.valuation;
  if (!v || v.status !== "completed") return null;
  if (!v.value_min && !v.value_max) return null;
  const min = v.value_min ? `$${Number(v.value_min).toLocaleString()}` : "";
  const max = v.value_max ? `$${Number(v.value_max).toLocaleString()}` : "";
  if (min && max) return `${min} – ${max}`;
  return min || max;
}

// ─── Listing card ─────────────────────────────────────────────────────────────

interface MyListingCardProps {
  item: ItemDetail;
  onEdit: () => void;
  onDelete: () => void;
  onPress: () => void;
}

function MyListingCard({
  item,
  onEdit,
  onDelete,
  onPress,
}: MyListingCardProps) {
  const theme = useAuthTheme();
  const valuation = formatValuation(item);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.cardBorder },
      ]}
      onPress={onPress}
      activeOpacity={0.92}
    >
      <View style={styles.cardInner}>
        {/* Image */}
        <View style={styles.cardImageWrap}>
          {item.images && item.images.length > 0 ? (
            <Image
              source={{ uri: item.images[0].url }}
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
              <Ionicons
                name="image-outline"
                size={24}
                color={Colors.gray[400]}
              />
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
        <View style={styles.cardContent}>
          <Text
            style={[styles.cardTitle, { color: theme.textPrimary }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>

          {valuation && (
            <View style={styles.valuationRow}>
              <Ionicons name="trending-up" size={12} color={Colors.ai} />
              <Text style={styles.valuationText}>{valuation}</Text>
              <Text style={[styles.aiLabel, { color: theme.textMuted }]}>
                · AI Value
              </Text>
            </View>
          )}

          {item.location && (
            <View style={styles.locationRow}>
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
            </View>
          )}

          {/* Status badge */}
          {item.status === "in_trade" && (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: Colors.warning + "20" },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: Colors.warning }]}>
                In Trade
              </Text>
            </View>
          )}
          {item.status === "inactive" && (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: Colors.gray[100] },
              ]}
            >
              <Text
                style={[styles.statusBadgeText, { color: theme.textMuted }]}
              >
                Inactive
              </Text>
            </View>
          )}
          {item.status === "traded" && (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: Colors.success + "20" },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: Colors.success }]}>
                Traded
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Action row */}
      <View
        style={[styles.cardActions, { borderTopColor: theme.borderSubtle }]}
      >
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={14} color={theme.textPrimary} />
          <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>
            Edit Listing
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.actionDivider,
            { backgroundColor: theme.borderSubtle },
          ]}
        />

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onDelete}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={14} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MyListingsScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<ItemDetail[]>([]);
  const [filteredItems, setFilteredItems] = useState<ItemDetail[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("available");
  const [searchQuery, setSearchQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

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

  const fetchItems = useCallback(async (tab: FilterTab, cursor?: string) => {
    try {
      const data = await getMyItems({ status: tab, cursor, limit: 20 });
      if (cursor) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
      }
      setNextCursor(data.next_cursor);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.message ?? "Failed to load listings.",
      );
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchItems(activeTab);
      setLoading(false);
    };
    load();
  }, [activeTab]);

  // ── Search filter (client-side) ──────────────────────────────────────────────

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredItems(
        items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q),
        ),
      );
    }
  }, [searchQuery, items]);

  // ── Refresh ──────────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchItems(activeTab);
    setRefreshing(false);
  }, [activeTab, fetchItems]);

  // ── Load more ────────────────────────────────────────────────────────────────

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await fetchItems(activeTab, nextCursor);
    setLoadingMore(false);
  }, [nextCursor, loadingMore, activeTab, fetchItems]);

  // ── Tab change ───────────────────────────────────────────────────────────────

  const handleTabChange = useCallback(
    (tab: FilterTab) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
      setSearchQuery("");
      setItems([]);
    },
    [activeTab],
  );

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = useCallback((item: ItemDetail) => {
    Alert.alert(
      "Delete Listing",
      `Delete "${item.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteItem(item.id);
              setItems((prev) => prev.filter((i) => i.id !== item.id));
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.response?.data?.message ?? "Failed to delete.",
              );
            }
          },
        },
      ],
    );
  }, []);

  // ── Render item ──────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: ItemDetail }) => (
      <MyListingCard
        item={item}
        onPress={() =>
          router.push({
            pathname: "/(support-pages)/listing/[id]",
            params: { id: item.id },
          })
        }
        onEdit={() =>
          router.push({
            pathname: "/(support-pages)/listing/[id]/edit",
            params: { id: item.id },
          })
        }
        onDelete={() => handleDelete(item)}
      />
    ),
    [handleDelete],
  );

  const renderFooter = useCallback(
    () =>
      loadingMore ? (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      ) : null,
    [loadingMore],
  );

  const renderEmpty = useCallback(
    () =>
      loading ? null : (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={48} color={Colors.gray[300]} />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            {searchQuery ? "No results found" : `No ${activeTab} listings`}
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            {searchQuery
              ? "Try a different search term."
              : activeTab === "available"
                ? "Create your first listing to start trading."
                : `You have no ${activeTab} listings yet.`}
          </Text>
          {activeTab === "available" && !searchQuery && (
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: Colors.primary }]}
              onPress={() => router.push("/(support-pages)/listing/create")}
            >
              <Text style={styles.createBtnText}>Create Listing</Text>
            </TouchableOpacity>
          )}
        </View>
      ),
    [loading, searchQuery, activeTab, theme],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

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

          <View style={styles.headerCenter}>
            <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>
              My Listings
            </Text>
            {!loading && (
              <Text style={[styles.itemCount, { color: theme.textMuted }]}>
                {filteredItems.length} item
                {filteredItems.length !== 1 ? "s" : ""}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.newListingBtn, { backgroundColor: Colors.primary }]}
            onPress={() => router.push("/(support-pages)/listing/create")}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={16} color={Colors.white} />
            <Text style={styles.newListingText}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: searchFocused
                ? theme.inputBgFocused
                : theme.inputBg,
              borderColor: searchFocused
                ? theme.borderFocus
                : theme.borderDefault,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={16}
            color={theme.textPlaceholder}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search your listings..."
            placeholderTextColor={theme.textPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
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
            data={filteredItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={renderEmpty()}
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
  headerCenter: { flex: 1, alignItems: "center" },
  pageTitle: { ...Typography.sectionTitle },
  itemCount: { ...Typography.caption, marginTop: 2 },
  newListingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.lg,
  },
  newListingText: { ...Typography.buttonSm, color: Colors.white },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: Layout.inputHeight,
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[3],
    gap: Spacing[2],
  },
  searchInput: { flex: 1, ...Typography.input },

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
  cardInner: { flexDirection: "row", padding: Spacing[3], gap: Spacing[3] },
  cardImageWrap: { position: "relative" },
  cardImage: { width: 90, height: 90, borderRadius: Radius.md },
  cardImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  conditionBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  conditionBadgeText: {
    ...Typography.micro,
    color: Colors.white,
    fontWeight: "600",
  },
  cardContent: { flex: 1, gap: Spacing[1] },
  cardTitle: { ...Typography.cardTitle },
  valuationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  valuationText: { ...Typography.captionMedium, color: Colors.ai },
  aiLabel: { ...Typography.micro },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: { ...Typography.micro, flex: 1 },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
    borderRadius: Radius.xs,
    marginTop: Spacing[1],
  },
  statusBadgeText: { ...Typography.micro, fontWeight: "600" },

  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    paddingVertical: Spacing[3],
  },
  actionBtnText: { ...Typography.captionMedium },
  actionDivider: { width: 1, height: 20 },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing[16],
    gap: Spacing[2],
    paddingHorizontal: Layout.screenPadding,
  },
  emptyTitle: { ...Typography.sectionTitle, marginTop: Spacing[2] },
  emptySubtitle: { ...Typography.body, textAlign: "center" },
  createBtn: {
    marginTop: Spacing[3],
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
  },
  createBtnText: { ...Typography.button, color: Colors.white },

  footerLoader: { paddingVertical: Spacing[6], alignItems: "center" },
});
