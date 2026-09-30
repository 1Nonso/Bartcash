import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
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
import { logout, getStoredUser } from "@/config/auth";
import api from "@/config/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePhoto: string | null;
  bio: string | null;
  location: string | null;
  averageRating: string;
  totalTrades: number;
  createdAt: string;
}

interface Rating {
  id: string;
  score: number;
  review: string | null;
  created_at: string;
  rater: {
    id: string;
    first_name: string;
    last_name: string;
    profile_photo: string | null;
  };
}

interface MyListing {
  id: string;
  title: string;
  primary_image: string | null;
  condition: string;
  valuation: {
    value_min: string | null;
    value_max: string | null;
    status: string;
  } | null;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchProfile(): Promise<UserProfile> {
  const response = await api.get("/user/profile");
  return response.data.data.user;
}

async function fetchMyListings(): Promise<MyListing[]> {
  const response = await api.get("/items/mine", {
    params: { status: "available", limit: 6 },
  });
  return response.data.data.items;
}

async function fetchMyRatings(userId: string): Promise<{
  ratings: Rating[];
  average_rating: string;
  total_ratings: number;
}> {
  const response = await api.get(`/users/${userId}/ratings`, {
    params: { limit: 5 },
  });
  return response.data.data;
}

async function deleteAccount(): Promise<void> {
  await api.delete("/user", { data: { confirmation: "DELETE" } });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function memberSince(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatValuation(item: MyListing): string | null {
  const v = item.valuation;
  if (!v || v.status !== "completed" || !v.value_min || !v.value_max)
    return null;
  return `$${Number(v.value_min).toLocaleString()} – $${Number(v.value_max).toLocaleString()}`;
}

function conditionLabel(c: string): string {
  const map: Record<string, string> = {
    new: "New",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
  };
  return map[c] ?? c;
}

// ─── Star rating component ────────────────────────────────────────────────────

function StarRating({ score }: { score: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= score ? "star" : "star-outline"}
          size={13}
          color={star <= score ? Colors.warning : Colors.gray[300]}
        />
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<MyListing[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [totalRatings, setTotalRatings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  // ── Load ─────────────────────────────────────────────────────────────────────

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

    const load = async () => {
      try {
        const profileData = await fetchProfile();
        setProfile(profileData);

        const [listingsData, ratingsData] = await Promise.all([
          fetchMyListings(),
          fetchMyRatings(profileData.id),
        ]);
        setListings(listingsData);
        setRatings(ratingsData.ratings);
        setTotalRatings(ratingsData.total_ratings);
      } catch {
        // Non-blocking — profile loaded, sections may be empty
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    Alert.alert("Log Out", "Log out of Bartcash?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } catch {
            // Clear session regardless of API response
          } finally {
            setLoggingOut(false);
            router.replace("/(auth)/sign-in");
          }
        },
      },
    ]);
  }, []);

  // ── Delete account ───────────────────────────────────────────────────────────

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all associated data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await deleteAccount();
              router.replace("/(auth)/sign-in");
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.response?.data?.message ?? "Failed to delete account.",
              );
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.bg },
        ]}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!profile) return null;

  const fullName = `${profile.firstName} ${profile.lastName}`;
  const rating = parseFloat(profile.averageRating ?? "0").toFixed(1);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Layout.tabBarHeight + Spacing[6] },
          { paddingTop: 60 },
        ]}
      >
        {/* ── Profile header ── */}
        <Animated.View
          style={[
            styles.profileHeader,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
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
          {/* Avatar */}
          <View style={styles.avatarSection}>
            {profile.profilePhoto ? (
              <Image
                source={{ uri: profile.profilePhoto }}
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
                <Text
                  style={[styles.avatarInitials, { color: Colors.gray[600] }]}
                >
                  {profile.firstName[0]}
                  {profile.lastName[0]}
                </Text>
              </View>
            )}
          </View>

          {/* Name + info */}
          <Text style={[styles.profileName, { color: theme.textPrimary }]}>
            {fullName}
          </Text>

          {profile.location && (
            <View style={styles.locationRow}>
              <Ionicons
                name="location-outline"
                size={13}
                color={theme.textMuted}
              />
              <Text style={[styles.locationText, { color: theme.textMuted }]}>
                {profile.location}
              </Text>
            </View>
          )}

          <Text style={[styles.memberSince, { color: theme.textMuted }]}>
            Member since {memberSince(profile.createdAt)}
          </Text>

          {/* Stats */}
          <View
            style={[styles.statsRow, { borderTopColor: theme.borderSubtle }]}
          >
            {[
              { label: "Listings", value: listings.length.toString() },
              { label: "Trades", value: profile.totalTrades.toString() },
              { label: "Reviews", value: totalRatings.toString() },
            ].map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && (
                  <View
                    style={[
                      styles.statDivider,
                      { backgroundColor: theme.borderSubtle },
                    ]}
                  />
                )}
                <View style={styles.statItem}>
                  <Text
                    style={[styles.statNumber, { color: theme.textPrimary }]}
                  >
                    {stat.value}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                    {stat.label}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Edit profile button */}
          <TouchableOpacity
            style={[styles.editProfileBtn, { backgroundColor: Colors.primary }]}
            onPress={() => router.push("/(support-pages)/profile/edit")}
            activeOpacity={0.9}
          >
            <Ionicons name="create-outline" size={16} color={Colors.white} />
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={{
            gap: Spacing[4],
            opacity: contentAnim,
            transform: [
              {
                translateY: contentAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ],
          }}
        >
          {/* ── Menu rows ── */}
          <View
            style={[
              styles.menuCard,
              { backgroundColor: theme.surface, borderColor: theme.cardBorder },
            ]}
          >
            {[
              {
                icon: "cube-outline",
                label: "My Listings",
                count: listings.length,
                onPress: () =>
                  router.push("/(support-pages)/listing/my-listings"),
              },
              {
                icon: "swap-horizontal-outline",
                label: "My Trades",
                count: null,
                onPress: () => router.push("/(support-pages)/trade/my-trades"),
              },
              {
                icon: "notifications-outline",
                label: "Notifications",
                count: null,
                // onPress: () => router.push("/(support-pages)/notifications"),
              },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={item.onPress}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.menuIconWrap,
                      { backgroundColor: Colors.gray[100] },
                    ]}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={18}
                      color={theme.textPrimary}
                    />
                  </View>
                  <Text
                    style={[styles.menuLabel, { color: theme.textPrimary }]}
                  >
                    {item.label}
                  </Text>
                  {item.count !== null && (
                    <Text
                      style={[styles.menuCount, { color: theme.textMuted }]}
                    >
                      {item.count}
                    </Text>
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
                {i < arr.length - 1 && (
                  <View
                    style={[
                      styles.menuDivider,
                      { backgroundColor: theme.borderSubtle },
                    ]}
                  />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* ── My Listings preview ── */}
          {listings.length > 0 && (
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.sectionCardHeader}>
                <Text
                  style={[styles.sectionTitle, { color: theme.textPrimary }]}
                >
                  My Listings
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    router.push("/(support-pages)/listing/my-listings")
                  }
                  activeOpacity={0.7}
                >
                  <Text style={[styles.seeAll, { color: Colors.info }]}>
                    See All
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listingsStrip}
              >
                {listings.map((item) => {
                  const val = formatValuation(item);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.listingCard,
                        {
                          backgroundColor: theme.bg,
                          borderColor: theme.borderSubtle,
                        },
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/(support-pages)/listing/[id]",
                          params: { id: item.id },
                        })
                      }
                      activeOpacity={0.88}
                    >
                      {item.primary_image ? (
                        <Image
                          source={{ uri: item.primary_image }}
                          style={styles.listingImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.listingImage,
                            styles.listingImagePlaceholder,
                            { backgroundColor: Colors.gray[100] },
                          ]}
                        >
                          <Ionicons
                            name="image-outline"
                            size={20}
                            color={Colors.gray[400]}
                          />
                        </View>
                      )}
                      <View style={styles.listingInfo}>
                        <Text
                          style={[
                            styles.listingTitle,
                            { color: theme.textPrimary },
                          ]}
                          numberOfLines={2}
                        >
                          {item.title}
                        </Text>
                        {val && (
                          <Text style={styles.listingVal} numberOfLines={1}>
                            {val}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ── Recent ratings ── */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.cardBorder },
            ]}
          >
            <View style={styles.sectionCardHeader}>
              <View style={styles.ratingsTitleRow}>
                <Text
                  style={[styles.sectionTitle, { color: theme.textPrimary }]}
                >
                  Reviews
                </Text>
                <View style={styles.ratingAvgRow}>
                  <Ionicons name="star" size={14} color={Colors.warning} />
                  <Text
                    style={[styles.ratingAvg, { color: theme.textPrimary }]}
                  >
                    {rating}
                  </Text>
                  <Text
                    style={[styles.ratingTotal, { color: theme.textMuted }]}
                  >
                    ({totalRatings})
                  </Text>
                </View>
              </View>
            </View>

            {ratings.length === 0 ? (
              <View style={styles.noRatings}>
                <Ionicons
                  name="star-outline"
                  size={28}
                  color={Colors.gray[300]}
                />
                <Text
                  style={[styles.noRatingsText, { color: theme.textMuted }]}
                >
                  No reviews yet
                </Text>
              </View>
            ) : (
              <View style={styles.ratingsList}>
                {ratings.map((r) => (
                  <View
                    key={r.id}
                    style={[
                      styles.ratingItem,
                      { borderTopColor: theme.borderSubtle },
                    ]}
                  >
                    <View style={styles.ratingItemHeader}>
                      {r.rater.profile_photo ? (
                        <Image
                          source={{ uri: r.rater.profile_photo }}
                          style={styles.raterAvatar}
                        />
                      ) : (
                        <View
                          style={[
                            styles.raterAvatar,
                            styles.avatarFallback,
                            { backgroundColor: Colors.gray[200] },
                          ]}
                        >
                          <Ionicons
                            name="person"
                            size={12}
                            color={Colors.gray[500]}
                          />
                        </View>
                      )}
                      <View style={styles.ratingItemInfo}>
                        <Text
                          style={[
                            styles.raterName,
                            { color: theme.textPrimary },
                          ]}
                        >
                          {r.rater.first_name} {r.rater.last_name}
                        </Text>
                        <StarRating score={r.score} />
                      </View>
                    </View>
                    {r.review && (
                      <Text
                        style={[styles.reviewText, { color: theme.textMuted }]}
                        numberOfLines={3}
                      >
                        {r.review}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Account actions ── */}
          <View
            style={[
              styles.menuCard,
              { backgroundColor: theme.surface, borderColor: theme.cardBorder },
            ]}
          >
            {/* Settings */}
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => router.push("/(support-pages)/profile/edit")}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.menuIconWrap,
                  { backgroundColor: Colors.gray[100] },
                ]}
              >
                <Ionicons
                  name="settings-outline"
                  size={18}
                  color={theme.textPrimary}
                />
              </View>
              <Text style={[styles.menuLabel, { color: theme.textPrimary }]}>
                Settings
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.textMuted}
              />
            </TouchableOpacity>

            <View
              style={[
                styles.menuDivider,
                { backgroundColor: theme.borderSubtle },
              ]}
            />

            {/* Log out */}
            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleLogout}
              disabled={loggingOut}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.menuIconWrap,
                  { backgroundColor: Colors.danger + "18" },
                ]}
              >
                {loggingOut ? (
                  <ActivityIndicator size="small" color={Colors.danger} />
                ) : (
                  <Ionicons
                    name="log-out-outline"
                    size={18}
                    color={Colors.danger}
                  />
                )}
              </View>
              <Text style={[styles.menuLabel, { color: Colors.danger }]}>
                {loggingOut ? "Logging out..." : "Log Out"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Delete account ── */}
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            activeOpacity={0.7}
          >
            {deletingAccount ? (
              <ActivityIndicator size="small" color={Colors.danger} />
            ) : (
              <Text
                style={[styles.deleteAccountText, { color: Colors.danger }]}
              >
                Delete Account
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },

  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
    gap: Spacing[4],
  },

  // Profile header
  profileHeader: {
    borderRadius: Radius.xl,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    alignItems: "center",
    gap: Spacing[2],
  },
  avatarSection: { marginBottom: Spacing[1] },
  avatar: {
    width: Layout.avatarXl,
    height: Layout.avatarXl,
    borderRadius: Radius.full,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitials: {
    fontSize: 28,
    fontWeight: "700",
  },
  profileName: { ...Typography.cardTitleLarge, textAlign: "center" },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: { ...Typography.caption },
  memberSince: { ...Typography.caption },

  // Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    borderTopWidth: 1,
    paddingTop: Spacing[4],
    marginTop: Spacing[2],
  },
  statItem: { alignItems: "center", gap: 3, flex: 1 },
  statNumber: { ...Typography.statNumber },
  statLabel: { ...Typography.statLabel },
  statDivider: { width: 1, height: 32 },

  // Edit profile button
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    marginTop: Spacing[2],
  },
  editProfileBtnText: { ...Typography.button, color: Colors.white },

  // Menu card
  menuCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { ...Typography.bodyMedium, flex: 1 },
  menuCount: { ...Typography.body },
  menuDivider: { height: 1, marginLeft: Spacing[4] + 36 + Spacing[3] },

  // Section card
  sectionCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    overflow: "hidden",
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
  },
  sectionTitle: { ...Typography.sectionTitle },
  seeAll: { ...Typography.captionMedium },

  // Listings strip
  listingsStrip: {
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[4],
    gap: Spacing[3],
  },
  listingCard: {
    width: 130,
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    overflow: "hidden",
  },
  listingImage: { width: "100%", height: 100 },
  listingImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  listingInfo: { padding: Spacing[2], gap: 3 },
  listingTitle: { ...Typography.captionMedium },
  listingVal: { ...Typography.micro, color: Colors.ai },

  // Ratings
  ratingsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
  },
  ratingAvgRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingAvg: { ...Typography.bodyMedium },
  ratingTotal: { ...Typography.caption },
  noRatings: {
    alignItems: "center",
    paddingVertical: Spacing[6],
    gap: Spacing[2],
  },
  noRatingsText: { ...Typography.body },
  ratingsList: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4] },
  ratingItem: {
    borderTopWidth: 1,
    paddingTop: Spacing[3],
    marginTop: Spacing[3],
    gap: Spacing[2],
  },
  ratingItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
  },
  raterAvatar: { width: 32, height: 32, borderRadius: Radius.full },
  ratingItemInfo: { gap: 3 },
  raterName: { ...Typography.captionMedium },
  starsRow: { flexDirection: "row", gap: 2 },
  reviewText: { ...Typography.caption, lineHeight: 18 },

  // Delete account
  deleteAccountBtn: {
    alignItems: "center",
    paddingVertical: Spacing[3],
  },
  deleteAccountText: { ...Typography.caption, textDecorationLine: "underline" },
});
