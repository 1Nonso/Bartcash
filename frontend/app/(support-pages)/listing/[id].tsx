import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  Share,
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
import {
  ItemDetail,
  ItemImage,
  ItemValuationDetail,
  getItemById,
  getItemValuation,
} from "@/config/items";
import { getStoredUser } from "@/config/auth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_WIDTH * 0.72;
const POLL_INTERVAL = 5000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCondition(condition: string): string {
  const map: Record<string, string> = {
    new: "Brand New",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
  };
  return map[condition] ?? condition;
}

function formatValuationRange(v: ItemValuationDetail | null): string | null {
  if (!v || v.status !== "completed") return null;
  if (!v.value_min && !v.value_max) return null;
  const min = v.value_min ? `$${Number(v.value_min).toLocaleString()}` : "";
  const max = v.value_max ? `$${Number(v.value_max).toLocaleString()}` : "";
  if (min && max) return `${min} – ${max}`;
  return min || max;
}

function formatConfidence(confidence: string | null): number {
  if (!confidence) return 0;
  const num = parseFloat(confidence);
  return isNaN(num) ? 0 : Math.min(Math.max(num, 0), 100);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

// ─── Image carousel dot ───────────────────────────────────────────────────────

function CarouselDot({ active }: { active: boolean }) {
  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: active ? Colors.white : "rgba(255,255,255,0.45)" },
      ]}
    />
  );
}

// ─── Valuation card ───────────────────────────────────────────────────────────

interface ValuationCardProps {
  valuation: ItemValuationDetail | null;
}

function ValuationCard({ valuation }: ValuationCardProps) {
  const theme = useAuthTheme();
  const range = formatValuationRange(valuation);
  const confidence = formatConfidence(valuation?.confidence ?? null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const isOverride =
    valuation?.status === "completed" && valuation.confidence === null;

  useEffect(() => {
    if (valuation?.status === "completed" && !isOverride) {
      Animated.timing(progressAnim, {
        toValue: confidence / 100,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [valuation?.status]);

  if (!valuation || valuation.status === "failed") {
    return (
      <View
        style={[styles.valuationCard, { backgroundColor: Colors.aiSurface }]}
      >
        <View style={styles.valuationHeader}>
          <Ionicons name="sparkles" size={16} color={Colors.ai} />
          <Text style={styles.valuationTitle}>AI Estimated Value</Text>
        </View>
        <Text style={[styles.valuationUnavailable, { color: theme.textMuted }]}>
          {valuation?.failed_reason
            ? "Valuation failed. Owner can retry."
            : "Value estimate unavailable."}
        </Text>
      </View>
    );
  }

  if (valuation.status === "pending") {
    return (
      <View
        style={[styles.valuationCard, { backgroundColor: Colors.aiSurface }]}
      >
        <View style={styles.valuationHeader}>
          <Ionicons name="sparkles" size={16} color={Colors.ai} />
          <Text style={styles.valuationTitle}>AI Estimated Value</Text>
        </View>
        <View style={styles.valuationPending}>
          <ActivityIndicator size="small" color={Colors.ai} />
          <Text
            style={[styles.valuationPendingText, { color: theme.textMuted }]}
          >
            Calculating value...
          </Text>
        </View>
      </View>
    );
  }

  if (isOverride) {
    return (
      <View
        style={[styles.valuationCard, { backgroundColor: Colors.aiSurface }]}
      >
        <View style={styles.valuationHeader}>
          <Ionicons name="pricetag-outline" size={16} color={Colors.ai} />
          <Text style={styles.valuationTitle}>Owner{"'"}s Estimated Value</Text>
        </View>
        <Text style={styles.valuationRange}>{range}</Text>
        <Text style={[styles.valuationSubtitle, { color: theme.textMuted }]}>
          Set by the item owner
        </Text>
        <View
          style={[styles.overrideBadge, { backgroundColor: Colors.aiLight }]}
        >
          <Ionicons
            name="information-circle-outline"
            size={13}
            color={Colors.ai}
          />
          <Text style={[styles.overrideBadgeText, { color: Colors.ai }]}>
            This value was manually set and may differ from market rates
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.valuationCard, { backgroundColor: Colors.aiSurface }]}>
      <View style={styles.valuationHeader}>
        <Ionicons name="sparkles" size={16} color={Colors.ai} />
        <Text style={styles.valuationTitle}>AI Estimated Value</Text>
      </View>
      <Text style={styles.valuationRange}>{range}</Text>
      <Text style={[styles.valuationSubtitle, { color: theme.textMuted }]}>
        Based on similar items and market data
      </Text>
      <View style={styles.confidenceRow}>
        <Text style={[styles.confidenceLabel, { color: theme.textMuted }]}>
          Confidence level
        </Text>
        <Text style={styles.confidenceValue}>{confidence.toFixed(0)}%</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: Colors.aiLight }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: Colors.ai,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
      <View
        style={[styles.confidenceNote, { backgroundColor: Colors.aiLight }]}
      >
        <Ionicons
          name="information-circle-outline"
          size={13}
          color={Colors.ai}
        />
        <Text style={[styles.confidenceNoteText, { color: Colors.ai }]}>
          {confidence >= 80
            ? "High Confidence — AI is very certain about this value"
            : confidence >= 50
              ? "Medium Confidence — estimate may vary"
              : "Low Confidence — limited data available"}
        </Text>
      </View>
    </View>
  );
}

// ─── Owner card ───────────────────────────────────────────────────────────────

interface OwnerCardProps {
  owner: ItemDetail["owner"];
  onPress: () => void;
}

function OwnerCard({ owner, onPress }: OwnerCardProps) {
  const theme = useAuthTheme();
  const fullName = `${owner.first_name} ${owner.last_name}`;
  const rating = parseFloat(owner.average_rating ?? "0").toFixed(1);

  return (
    <TouchableOpacity
      style={[
        styles.ownerCard,
        { backgroundColor: theme.surface, borderColor: theme.cardBorder },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {owner.profile_photo ? (
        <Image
          source={{ uri: owner.profile_photo }}
          style={styles.ownerAvatar}
        />
      ) : (
        <View
          style={[
            styles.ownerAvatar,
            styles.ownerAvatarFallback,
            { backgroundColor: Colors.gray[200] },
          ]}
        >
          <Ionicons name="person" size={20} color={Colors.gray[500]} />
        </View>
      )}
      <View style={styles.ownerInfo}>
        <Text style={[styles.ownerName, { color: theme.textPrimary }]}>
          {fullName}
        </Text>
        <View style={styles.ownerMeta}>
          <Ionicons name="star" size={12} color={Colors.warning} />
          <Text style={[styles.ownerMetaText, { color: theme.textMuted }]}>
            {rating} · {owner.total_trades} trades
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ListingDetailScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentAnim = useRef(new Animated.Value(0)).current;

  // ── handleBack is now correctly inside the component ──────────────────────
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      goBack();
    } else {
      router.replace("/(main-pages)/dashboard");
    }
  }, []);

  useEffect(() => {
    getStoredUser().then((user) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const fetchItem = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getItemById(id);
      setItem(data);
      setError(null);

      if (data.valuation?.status === "pending") {
        startValuationPolling(id);
      }

      Animated.spring(contentAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 55,
        friction: 11,
      }).start();
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 404) {
        setError("This listing is no longer available.");
      } else {
        setError(err.response?.data?.message || "Failed to load listing.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchItem();
    return () => stopValuationPolling();
  }, [fetchItem]);

  const startValuationPolling = useCallback((itemId: string) => {
    stopValuationPolling();
    pollRef.current = setInterval(async () => {
      try {
        const valuation = await getItemValuation(itemId);
        if (valuation.status !== "pending") {
          stopValuationPolling();
          setItem((prev) => (prev ? { ...prev, valuation } : prev));
        }
      } catch {
        stopValuationPolling();
      }
    }, POLL_INTERVAL);
  }, []);

  const stopValuationPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const isOwner = item ? item.owner.id === currentUserId : false;
  const canProposeTrade = !isOwner && item?.status === "available";

  const handleShare = useCallback(async () => {
    if (!item) return;
    try {
      await Share.share({ message: `Check out "${item.title}" on Bartcash!` });
    } catch {}
  }, [item]);

  const handleProposeTrade = useCallback(() => {
    if (!item) return;
    router.push({
      pathname: "/(support-pages)/trade/[id]/propose",
      params: { id: item.id },
    });
  }, [item]);

  const handleChat = useCallback(() => {
    handleProposeTrade();
  }, [handleProposeTrade]);

  const handleEditListing = useCallback(() => {
    if (!item) return;
    router.push({
      pathname: "/(support-pages)/listing/[id]/edit",
      params: { id: item.id },
    });
  }, [item]);

  const handleOwnerPress = useCallback(() => {
    if (!item) return;
    router.push({
      pathname: "/(support-pages)/profile/[id]",
      params: { id: item.owner.id },
    });
  }, [item]);

  const handleImageScroll = useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveImageIndex(index);
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
        <View
          style={[styles.skeletonHero, { backgroundColor: Colors.gray[100] }]}
        />
        <View style={styles.skeletonBody}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.skeletonLine,
                {
                  backgroundColor: Colors.gray[100],
                  width: i === 1 ? "80%" : i === 2 ? "55%" : "65%",
                },
              ]}
            />
          ))}
          <View
            style={[styles.skeletonCard, { backgroundColor: Colors.gray[100] }]}
          />
          <View
            style={[styles.skeletonCard, { backgroundColor: Colors.gray[100] }]}
          />
        </View>
      </View>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (error || !item) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.bg },
        ]}
      >
        <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={Colors.gray[300]}
        />
        <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
          {error ?? "Something went wrong."}
        </Text>
        <TouchableOpacity
          style={[styles.goBackBtn, { backgroundColor: Colors.primary }]}
          onPress={handleBack}
        >
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images: ItemImage[] = item.images ?? [];
  const hasImages = images.length > 0;

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Floating header */}
      <View
        style={[styles.floatingHeader, { paddingTop: insets.top + Spacing[2] }]}
      >
        <TouchableOpacity
          style={styles.floatingBtn}
          onPress={handleBack}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.floatingActions}>
          <TouchableOpacity
            style={styles.floatingBtn}
            onPress={handleShare}
            activeOpacity={0.85}
          >
            <Ionicons name="share-outline" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        style={{ opacity: contentAnim }}
      >
        {/* Hero carousel */}
        <View style={styles.heroContainer}>
          {hasImages ? (
            <>
              <FlatList
                data={images}
                keyExtractor={(img) => img.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleImageScroll}
                scrollEventThrottle={16}
                renderItem={({ item: img }) => (
                  <Image
                    source={{ uri: img.url }}
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                )}
              />
              {images.length > 1 && (
                <View style={styles.dotsRow}>
                  {images.map((_, i) => (
                    <CarouselDot key={i} active={i === activeImageIndex} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View
              style={[
                styles.heroImage,
                styles.heroPlaceholder,
                { backgroundColor: Colors.gray[100] },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={48}
                color={Colors.gray[300]}
              />
            </View>
          )}
        </View>

        {/* Detail content */}
        <View style={styles.detailContainer}>
          <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
            {item.title}
          </Text>

          <View style={styles.metaRow}>
            <View
              style={[styles.metaBadge, { backgroundColor: Colors.gray[100] }]}
            >
              <Text
                style={[styles.metaBadgeText, { color: theme.textPrimary }]}
              >
                {formatCondition(item.condition)}
              </Text>
            </View>
            <View style={styles.metaDivider} />
            <Ionicons name="cube-outline" size={13} color={theme.textMuted} />
            <Text style={[styles.metaText, { color: theme.textMuted }]}>
              {item.category?.name ?? "General"}
            </Text>
            <View style={styles.metaDivider} />
            <Ionicons name="time-outline" size={13} color={theme.textMuted} />
            <Text style={[styles.metaText, { color: theme.textMuted }]}>
              {timeAgo(item.created_at)}
            </Text>
          </View>

          <ValuationCard valuation={item.valuation} />

          {item.description && (
            <View
              style={[styles.section, { borderTopColor: theme.borderSubtle }]}
            >
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={theme.textPrimary}
                />
                <Text
                  style={[styles.sectionTitle, { color: theme.textPrimary }]}
                >
                  Description
                </Text>
              </View>
              <Text style={[styles.sectionBody, { color: theme.textMuted }]}>
                {item.description}
              </Text>
            </View>
          )}

          {item.desired_trade && (
            <View
              style={[styles.section, { borderTopColor: theme.borderSubtle }]}
            >
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={theme.textPrimary}
                />
                <Text
                  style={[styles.sectionTitle, { color: theme.textPrimary }]}
                >
                  Looking For
                </Text>
              </View>
              <Text style={[styles.sectionBody, { color: theme.textMuted }]}>
                {item.desired_trade}
              </Text>
            </View>
          )}

          {item.location && (
            <View
              style={[styles.section, { borderTopColor: theme.borderSubtle }]}
            >
              <View style={styles.locationRow}>
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={theme.textMuted}
                />
                <Text style={[styles.locationText, { color: theme.textMuted }]}>
                  {item.location}
                </Text>
              </View>
            </View>
          )}

          <View
            style={[styles.section, { borderTopColor: theme.borderSubtle }]}
          >
            <OwnerCard owner={item.owner} onPress={handleOwnerPress} />
          </View>

          {item.status === "in_trade" && (
            <View
              style={[
                styles.statusBanner,
                { backgroundColor: Colors.warning + "20" },
              ]}
            >
              <Ionicons
                name="swap-horizontal"
                size={16}
                color={Colors.warning}
              />
              <Text
                style={[styles.statusBannerText, { color: Colors.warning }]}
              >
                This item is currently in a trade
              </Text>
            </View>
          )}

          {item.status === "traded" && (
            <View
              style={[
                styles.statusBanner,
                { backgroundColor: Colors.success + "20" },
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={Colors.success}
              />
              <Text
                style={[styles.statusBannerText, { color: Colors.success }]}
              >
                This item has been traded
              </Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* CTA bar */}
      <View
        style={[
          styles.ctaBar,
          {
            backgroundColor: theme.bg,
            paddingBottom: insets.bottom + Spacing[3],
            borderTopColor: theme.borderSubtle,
          },
        ]}
      >
        {isOwner ? (
          <TouchableOpacity
            style={[styles.ctaPrimary, { backgroundColor: Colors.primary }]}
            onPress={handleEditListing}
            activeOpacity={0.9}
          >
            <Ionicons name="create-outline" size={18} color={Colors.white} />
            <Text style={styles.ctaPrimaryText}>Edit Listing</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={[
                styles.ctaSecondary,
                {
                  backgroundColor: theme.surface,
                  borderColor: canProposeTrade
                    ? theme.borderFocus
                    : theme.borderDefault,
                  opacity: canProposeTrade ? 1 : 0.5,
                },
              ]}
              onPress={handleProposeTrade}
              disabled={!canProposeTrade}
              activeOpacity={0.85}
            >
              <Ionicons
                name="sparkles-outline"
                size={16}
                color={canProposeTrade ? theme.textPrimary : theme.textMuted}
              />
              <Text
                style={[
                  styles.ctaSecondaryText,
                  {
                    color: canProposeTrade
                      ? theme.textPrimary
                      : theme.textMuted,
                  },
                ]}
              >
                {item.status === "in_trade"
                  ? "In a Trade"
                  : item.status === "traded"
                    ? "Already Traded"
                    : "Make Offer"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ctaPrimary, { backgroundColor: Colors.primary }]}
              onPress={handleChat}
              activeOpacity={0.9}
            >
              <Ionicons
                name="chatbubble-outline"
                size={16}
                color={Colors.white}
              />
              <Text style={styles.ctaPrimaryText}>Chat</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[3],
    paddingHorizontal: Layout.screenPadding,
  },

  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Layout.screenPadding,
  },
  floatingBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingActions: { flexDirection: "row", gap: Spacing[2] },

  heroContainer: { position: "relative" },
  heroImage: { width: SCREEN_WIDTH, height: HERO_HEIGHT },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  dotsRow: {
    position: "absolute",
    bottom: Spacing[3],
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },

  detailContainer: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
  },
  itemTitle: { ...Typography.cardTitleLarge, marginBottom: Spacing[2] },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing[2],
    marginBottom: Spacing[4],
  },
  metaBadge: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  metaBadgeText: { ...Typography.captionMedium },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.gray[300],
  },
  metaText: { ...Typography.caption },

  valuationCard: {
    borderRadius: Radius.lg,
    padding: Spacing[4],
    marginBottom: Spacing[4],
  },
  valuationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    marginBottom: Spacing[3],
  },
  valuationTitle: { ...Typography.bodyMedium, color: Colors.ai },
  valuationRange: {
    ...Typography.cardTitleLarge,
    color: Colors.text.primary,
    fontSize: 28,
    marginBottom: Spacing[1],
  },
  valuationSubtitle: { ...Typography.caption, marginBottom: Spacing[3] },
  valuationUnavailable: { ...Typography.body },
  valuationPending: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
  },
  valuationPendingText: { ...Typography.body },
  confidenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing[2],
  },
  confidenceLabel: { ...Typography.caption },
  confidenceValue: { ...Typography.captionMedium, color: Colors.ai },
  progressTrack: {
    height: 6,
    borderRadius: Radius.full,
    overflow: "hidden",
    marginBottom: Spacing[3],
  },
  progressFill: { height: "100%", borderRadius: Radius.full },
  confidenceNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[2],
    borderRadius: Radius.sm,
  },
  confidenceNoteText: { ...Typography.micro, flex: 1 },
  overrideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[2],
    borderRadius: Radius.sm,
    marginTop: Spacing[1],
  },
  overrideBadgeText: { ...Typography.micro, flex: 1 },

  section: {
    borderTopWidth: 1,
    paddingTop: Spacing[4],
    marginBottom: Spacing[4],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    marginBottom: Spacing[2],
  },
  sectionTitle: { ...Typography.bodyMedium },
  sectionBody: { ...Typography.body, lineHeight: 22 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },
  locationText: { ...Typography.body },

  ownerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    gap: Spacing[3],
  },
  ownerAvatar: {
    width: Layout.avatarSm,
    height: Layout.avatarSm,
    borderRadius: Radius.full,
  },
  ownerAvatarFallback: { alignItems: "center", justifyContent: "center" },
  ownerInfo: { flex: 1 },
  ownerName: { ...Typography.bodyMedium, marginBottom: 2 },
  ownerMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  ownerMetaText: { ...Typography.caption },

  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
    marginBottom: Spacing[4],
  },
  statusBannerText: { ...Typography.bodyMedium },

  ctaBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
  },
  ctaRow: { flexDirection: "row", gap: Spacing[3] },
  ctaSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
  },
  ctaSecondaryText: { ...Typography.button },
  ctaPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
  },
  ctaPrimaryText: { ...Typography.button, color: Colors.white },

  errorTitle: { ...Typography.sectionTitle, textAlign: "center" },
  goBackBtn: {
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
  },
  goBackBtnText: { ...Typography.button, color: Colors.white },

  skeletonHero: { width: SCREEN_WIDTH, height: HERO_HEIGHT },
  skeletonBody: { padding: Layout.screenPadding, gap: Spacing[3] },
  skeletonLine: { height: 14, borderRadius: Radius.sm },
  skeletonCard: { height: 120, borderRadius: Radius.lg, marginTop: Spacing[2] },
});
