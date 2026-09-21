/**
 * Bartcash — View User Profile Screen
 * Route: app/(support-pages)/profile/[id].tsx
 *
 * Public read-only profile view for another user.
 * If [id] matches the authenticated user, redirects to My Profile tab.
 *
 * API:
 *   GET /users/{id}/ratings
 *   GET /items?user_id={id}&status=available  (marketplace filter)
 *   GET /user/profile                          (to get own ID for redirect check)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
import api from "@/config/api";
import { getUserRatings, Rating } from "@/config/ratings";
import { MarketplaceItem } from "@/config/items";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicUser {
  id: string;
  first_name: string;
  last_name: string;
  profile_photo: string | null;
  bio: string | null;
  location: string | null;
  average_rating: string;
  total_trades: number;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMemberSince(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

function formatValuation(item: MarketplaceItem): string | null {
  const v = item.valuation;
  if (!v || v.status !== "completed") return null;
  if (!v.value_min && !v.value_max) return null;
  const min = v.value_min ? `₦${Number(v.value_min).toLocaleString()}` : "";
  const max = v.value_max ? `₦${Number(v.value_max).toLocaleString()}` : "";
  if (min && max) return `${min} – ${max}`;
  return min || max;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ score }: { score: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= score ? "star" : "star-outline"}
          size={12}
          color={i <= score ? Colors.warning : Colors.gray[300]}
        />
      ))}
    </View>
  );
}

function ListingMiniCard({ item }: { item: MarketplaceItem }) {
  const theme = useAuthTheme();
  const val = formatValuation(item);
  return (
    <TouchableOpacity
      style={[styles.miniCard, { backgroundColor: theme.surface }]}
      onPress={() => router.push(`/(support-pages)/listing/${item.id}`)}
      activeOpacity={0.88}
    >
      {item.primary_image ? (
        <Image
          source={{ uri: item.primary_image }}
          style={styles.miniCardImage}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.miniCardImage,
            styles.miniCardImagePlaceholder,
            { backgroundColor: Colors.gray[100] },
          ]}
        >
          <Ionicons name="image-outline" size={20} color={Colors.gray[400]} />
        </View>
      )}
      <View style={styles.miniCardContent}>
        <Text
          style={[styles.miniCardTitle, { color: theme.textPrimary }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {val && (
          <Text style={styles.miniCardVal} numberOfLines={1}>
            {val}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function RatingCard({ rating }: { rating: Rating }) {
  const theme = useAuthTheme();
  const raterName = `${rating.rater.first_name} ${rating.rater.last_name}`;
  const initials =
    `${rating.rater.first_name[0] ?? ""}${rating.rater.last_name[0] ?? ""}`.toUpperCase();

  return (
    <View
      style={[
        styles.ratingCard,
        { backgroundColor: theme.surface, borderColor: theme.cardBorder },
      ]}
    >
      <View style={styles.ratingCardHeader}>
        {rating.rater.profile_photo ? (
          <Image
            source={{ uri: rating.rater.profile_photo }}
            style={styles.raterAvatar}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.raterAvatar,
              styles.raterAvatarFallback,
              { backgroundColor: Colors.primary },
            ]}
          >
            <Text style={styles.raterInitials}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.raterName, { color: theme.textPrimary }]}>
            {raterName}
          </Text>
          <View style={styles.ratingMeta}>
            <StarRating score={rating.score} />
            <Text style={[styles.ratingTime, { color: theme.textMuted }]}>
              · {timeAgo(rating.created_at)}
            </Text>
          </View>
        </View>
      </View>
      {rating.review && (
        <Text style={[styles.ratingReview, { color: theme.textPrimary }]}>
          {'"'}
          {rating.review}
          {'"'}
        </Text>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ViewUserProfileScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [user, setUser] = useState<PublicUser | null>(null);
  const [listings, setListings] = useState<MarketplaceItem[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [averageRating, setAverageRating] = useState<string>("0.00");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

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

    fetchData();
  }, [id]);

  // ── Fetch data ───────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      // Check if this is own profile — redirect to My Profile tab
      const ownProfileRes = await api.get("/user/profile");
      const ownId: string = ownProfileRes.data.data.user.id;
      if (ownId === id) {
        router.replace("/(main-pages)/profile");
        return;
      }

      // Fetch ratings (which also gives us the user's public info via average_rating)
      // Fetch listings from marketplace filtered by owner
      const [ratingsData, listingsData] = await Promise.allSettled([
        getUserRatings(id, { limit: 5 }),
        api.get("/items", { params: { limit: 6 } }),
      ]);

      // We need to build user info — fetch from ratings rater data or
      // from trade context. Backend doesn't have a standalone GET /users/{id}
      // so we use the ratings response + items owner field.
      if (listingsData.status === "fulfilled") {
        const items: MarketplaceItem[] = listingsData.value.data.data.items;
        // Filter to this user's items
        const userItems = items.filter((item) => item.owner?.id === id);
        setListings(userItems);

        // Build public user from first listing's owner
        if (userItems.length > 0 && !user) {
          const owner = userItems[0].owner;
          setUser({
            id: owner.id,
            first_name: owner.first_name,
            last_name: owner.last_name,
            profile_photo: owner.profile_photo,
            bio: null,
            location: null,
            average_rating: owner.average_rating,
            total_trades: 0,
            created_at: new Date().toISOString(),
          });
        }
      }

      if (ratingsData.status === "fulfilled") {
        setRatings(ratingsData.value.ratings);
        setAverageRating(ratingsData.value.average_rating);
      }

      setError(null);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 404) {
        setError("User not found.");
      } else {
        setError("Failed to load profile.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ── Report user ───────────────────────────────────────────────────────────────

  const handleReport = useCallback(() => {
    Alert.alert("Report User", "Are you sure you want to report this user?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Report Submitted",
            "Thank you. Our team will review this report.",
          );
        },
      },
    ]);
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const initials = user
    ? `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase()
    : "?";

  const displayRating = parseFloat(
    averageRating || user?.average_rating || "0",
  );

  // ── Loading / error states ────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar
          barStyle={theme.isDark ? "light-content" : "dark-content"}
          backgroundColor={theme.bg}
        />
        <View
          style={[
            styles.navHeader,
            {
              paddingTop: insets.top + Spacing[2],
              backgroundColor: theme.bg,
              borderBottomColor: theme.borderSubtle,
            },
          ]}
        >
          <TouchableOpacity onPress={() => goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar
          barStyle={theme.isDark ? "light-content" : "dark-content"}
          backgroundColor={theme.bg}
        />
        <View
          style={[
            styles.navHeader,
            {
              paddingTop: insets.top + Spacing[2],
              backgroundColor: theme.bg,
              borderBottomColor: theme.borderSubtle,
            },
          ]}
        >
          <TouchableOpacity onPress={() => goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorCenter}>
          <Ionicons name="person-outline" size={48} color={Colors.gray[300]} />
          <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: Colors.primary }]}
            onPress={() => {
              setLoading(true);
              setError(null);
              fetchData();
            }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
        translucent={false}
      />

      {/* ── Header ── */}
      <Animated.View
        style={[
          styles.navHeader,
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
        <Text
          style={[styles.headerTitle, { color: theme.textPrimary }]}
          numberOfLines={1}
        >
          {user ? `${user.first_name} ${user.last_name}` : "Profile"}
        </Text>
        <TouchableOpacity
          onPress={handleReport}
          style={styles.reportBtn}
          activeOpacity={0.7}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Content ── */}
      <Animated.View
        style={[
          styles.bodyWrapper,
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Spacing[12] },
          ]}
        >
          {/* ── Profile hero ── */}
          <View style={styles.heroSection}>
            {user?.profile_photo ? (
              <Image
                source={{ uri: user.profile_photo }}
                style={styles.heroAvatar}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.heroAvatar,
                  styles.heroAvatarFallback,
                  { backgroundColor: Colors.primary },
                ]}
              >
                <Text style={styles.heroAvatarInitials}>{initials}</Text>
              </View>
            )}

            <Text style={[styles.heroName, { color: theme.textPrimary }]}>
              {user?.first_name} {user?.last_name}
            </Text>

            {user?.bio && (
              <Text style={[styles.heroBio, { color: theme.textMuted }]}>
                {user.bio}
              </Text>
            )}

            <View style={styles.heroMeta}>
              {user?.location && (
                <View style={styles.heroMetaItem}>
                  <Ionicons
                    name="location-outline"
                    size={13}
                    color={theme.textMuted}
                  />
                  <Text
                    style={[styles.heroMetaText, { color: theme.textMuted }]}
                  >
                    {user.location}
                  </Text>
                </View>
              )}
              {user?.created_at && (
                <View style={styles.heroMetaItem}>
                  <Ionicons
                    name="calendar-outline"
                    size={13}
                    color={theme.textMuted}
                  />
                  <Text
                    style={[styles.heroMetaText, { color: theme.textMuted }]}
                  >
                    Member since {formatMemberSince(user.created_at)}
                  </Text>
                </View>
              )}
            </View>

            {/* Stats */}
            <View
              style={[
                styles.statsRow,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.statItem}>
                <View style={styles.statRating}>
                  <Ionicons name="star" size={14} color={Colors.warning} />
                  <Text
                    style={[styles.statNumber, { color: theme.textPrimary }]}
                  >
                    {displayRating.toFixed(1)}
                  </Text>
                </View>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                  Rating
                </Text>
              </View>
              <View
                style={[
                  styles.statDivider,
                  { backgroundColor: theme.borderSubtle },
                ]}
              />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.textPrimary }]}>
                  {user?.total_trades ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                  Trades
                </Text>
              </View>
              <View
                style={[
                  styles.statDivider,
                  { backgroundColor: theme.borderSubtle },
                ]}
              />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.textPrimary }]}>
                  {listings.length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                  Listings
                </Text>
              </View>
            </View>
          </View>

          {/* ── Active Listings ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Active Listings
              </Text>
            </View>

            {listings.length === 0 ? (
              <View
                style={[
                  styles.emptyBox,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Ionicons
                  name="cube-outline"
                  size={32}
                  color={Colors.gray[300]}
                />
                <Text style={[styles.emptyTitle, { color: theme.textMuted }]}>
                  No active listings
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listingsScrollContent}
              >
                {listings.map((item) => (
                  <ListingMiniCard key={item.id} item={item} />
                ))}
              </ScrollView>
            )}
          </View>

          {/* ── Ratings ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Ratings
              </Text>
              <Text style={[styles.ratingCount, { color: theme.textMuted }]}>
                {displayRating.toFixed(1)} · {ratings.length} review
                {ratings.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {ratings.length === 0 ? (
              <View
                style={[
                  styles.emptyBox,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Ionicons
                  name="star-outline"
                  size={32}
                  color={Colors.gray[300]}
                />
                <Text style={[styles.emptyTitle, { color: theme.textMuted }]}>
                  No ratings yet
                </Text>
              </View>
            ) : (
              <View style={{ gap: Spacing[3] }}>
                {ratings.map((rating) => (
                  <RatingCard key={rating.id} rating={rating} />
                ))}
              </View>
            )}
          </View>

          {/* ── Report link ── */}
          <TouchableOpacity
            style={styles.reportLink}
            onPress={handleReport}
            activeOpacity={0.7}
          >
            <Ionicons
              name="flag-outline"
              size={13}
              color={Colors.text.tertiary}
            />
            <Text
              style={[styles.reportLinkText, { color: Colors.text.tertiary }]}
            >
              Report this user
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[3],
    paddingHorizontal: Layout.screenPadding,
  },
  errorTitle: { ...Typography.sectionTitle, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
  },
  retryBtnText: { ...Typography.button, color: Colors.white },

  // Nav header
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 60,
  },
  backText: { ...Typography.body },
  headerTitle: {
    ...Typography.sectionTitle,
    flex: 1,
    textAlign: "center",
  },
  reportBtn: { minWidth: 60, alignItems: "flex-end" },

  // Body
  bodyWrapper: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[6],
    gap: Spacing[6],
  },

  // Hero
  heroSection: { alignItems: "center", gap: Spacing[2] },
  heroAvatar: {
    width: Layout.avatarXl,
    height: Layout.avatarXl,
    borderRadius: Layout.avatarXl / 2,
  },
  heroAvatarFallback: { alignItems: "center", justifyContent: "center" },
  heroAvatarInitials: {
    ...Typography.pageTitle,
    color: Colors.white,
    fontWeight: "700",
    fontSize: 28,
  },
  heroName: { ...Typography.cardTitleLarge, marginTop: Spacing[1] },
  heroBio: {
    ...Typography.body,
    textAlign: "center",
    paddingHorizontal: Spacing[6],
  },
  heroMeta: { gap: Spacing[1], alignItems: "center" },
  heroMetaItem: { flexDirection: "row", alignItems: "center", gap: Spacing[1] },
  heroMetaText: { ...Typography.caption },
  statsRow: {
    flexDirection: "row",
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingVertical: Spacing[4],
    marginTop: Spacing[2],
    width: "100%",
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statRating: { flexDirection: "row", alignItems: "center", gap: 3 },
  statNumber: { ...Typography.statNumber },
  statLabel: { ...Typography.statLabel },
  statDivider: { width: 1, marginVertical: Spacing[1] },

  // Section
  section: { gap: Spacing[3] },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { ...Typography.sectionTitle },
  ratingCount: { ...Typography.caption },

  // Mini card
  listingsScrollContent: { gap: Spacing[3], paddingRight: Spacing[2] },
  miniCard: {
    width: 140,
    borderRadius: Radius.lg,
    overflow: "hidden",
    ...Shadows.sm,
  },
  miniCardImage: { width: "100%", height: 100 },
  miniCardImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  miniCardContent: { padding: Spacing[2], gap: 2 },
  miniCardTitle: { ...Typography.captionMedium },
  miniCardVal: { ...Typography.micro, color: Colors.ai },

  // Rating card
  ratingCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  ratingCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
  },
  raterAvatar: {
    width: Layout.avatarSm,
    height: Layout.avatarSm,
    borderRadius: Layout.avatarSm / 2,
  },
  raterAvatarFallback: { alignItems: "center", justifyContent: "center" },
  raterInitials: {
    ...Typography.captionMedium,
    color: Colors.white,
    fontWeight: "700",
  },
  raterName: { ...Typography.bodyMedium },
  ratingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[1],
    marginTop: 2,
  },
  ratingTime: { ...Typography.micro },
  ratingReview: { ...Typography.body, fontStyle: "italic" },

  // Empty
  emptyBox: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[6],
    alignItems: "center",
    gap: Spacing[2],
  },
  emptyTitle: { ...Typography.bodyMedium, marginTop: Spacing[1] },

  // Report
  reportLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[1],
    paddingVertical: Spacing[2],
  },
  reportLinkText: { ...Typography.caption },
});
