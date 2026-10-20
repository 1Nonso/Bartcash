import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  FlatList,
  Image,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useAnimatedValue,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/hooks/navigation";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Colors,
  Layout,
  Radius,
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
  getMyItems,
  MatchContext,
  retryItemValuation,
} from "@/config/items";
import {
  CheckRow,
  ScoreLabel,
  ScoutBadge,
  TagChip,
  WantChip,
} from "@/components/scout";
import { getStoredUser } from "@/config/auth";
import { draftOffer, scoutDraftStore } from "@/config/scout";
import { useFeatures } from "@/hooks/useFeatures";
import { showToast } from "@/hooks/toast";
import { InfoButton } from "@/components/guide/InfoSheet";
import { useTour } from "@/components/guide/Tour";

type ConfidenceLevel = "high" | "medium" | "low";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_WIDTH * 0.72;
const POLL_INTERVAL = 5000;
// The valuation job retries 3 times with backoff, which can take over 2 min.
const POLL_TIMEOUT_MS = 180000;

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

function normalizeConfidence(
  confidence: string | null,
): ConfidenceLevel | null {
  const lower = confidence?.toLowerCase();
  if (lower === "high" || lower === "medium" || lower === "low") return lower;
  return null;
}

function confidenceFillPercent(level: ConfidenceLevel | null): number {
  switch (level) {
    case "high":
      return 90;
    case "medium":
      return 60;
    case "low":
      return 30;
    default:
      return 0;
  }
}

export function timeAgo(dateStr: string): string {
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
  /** Only the owner sees "Calculating value..."; others see unavailable. */
  isOwner: boolean;
  /** Owner of a failed valuation: show the Retry button. */
  canRetry?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
}

function ValuationCard({
  valuation,
  isOwner,
  canRetry,
  retrying,
  onRetry,
}: ValuationCardProps) {
  const theme = useAuthTheme();
  const range = formatValuationRange(valuation);
  const confidenceLevel = normalizeConfidence(valuation?.confidence ?? null);
  const confidenceFill = confidenceFillPercent(confidenceLevel);
  const progressAnim = useAnimatedValue(0);

  const isOverride =
    valuation?.status === "completed" && valuation.confidence === null;

  useEffect(() => {
    if (valuation?.status === "completed" && !isOverride) {
      Animated.timing(progressAnim, {
        toValue: confidenceFill / 100,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [confidenceFill, isOverride, progressAnim, valuation?.status]);

  if (
    !valuation ||
    valuation.status === "failed" ||
    (valuation.status === "pending" && !isOwner)
  ) {
    return (
      <View
        style={[styles.valuationCard, { backgroundColor: theme.aiSurface }]}
      >
        <View style={styles.valuationHeader}>
          <Ionicons name="sparkles" size={16} color={theme.ai} />
          <Text style={[styles.valuationTitle, { color: theme.ai, flex: 1 }]}>Automated Valuation Result</Text>
          <InfoButton topic="valuation" color={theme.ai} />
        </View>
        <Text style={[styles.valuationUnavailable, { color: theme.textMuted }]}>
          {valuation?.status === "failed"
            ? "Valuation failed."
            : "Value estimate unavailable."}
        </Text>
        {/* Owner only: what went wrong, as a short message from the API. */}
        {isOwner && valuation?.status === "failed" && !!valuation.failed_reason && (
          <Text style={[styles.valuationFailedReason, { color: theme.textSecondary }]}>
            {valuation.failed_reason}
          </Text>
        )}
        {canRetry && (
          <TouchableOpacity
            style={[styles.retryBtn, { borderColor: theme.borderDefault }]}
            onPress={onRetry}
            disabled={retrying}
            activeOpacity={0.85}
          >
            {retrying ? (
              <ActivityIndicator size="small" color={theme.ai} />
            ) : (
              <>
                <Ionicons name="refresh" size={14} color={theme.ai} />
                <Text style={[styles.retryBtnText, { color: theme.ai }]}>
                  Retry valuation
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (valuation.status === "pending") {
    return (
      <View
        style={[styles.valuationCard, { backgroundColor: theme.aiSurface }]}
      >
        <View style={styles.valuationHeader}>
          <Ionicons name="sparkles" size={16} color={theme.ai} />
          <Text style={[styles.valuationTitle, { color: theme.ai, flex: 1 }]}>Automated Valuation Result</Text>
          <InfoButton topic="valuation" color={theme.ai} />
        </View>
        <View style={styles.valuationPending}>
          <ActivityIndicator size="small" color={theme.ai} />
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
        style={[styles.valuationCard, { backgroundColor: theme.aiSurface }]}
      >
        <View style={styles.valuationHeader}>
          <Ionicons name="pricetag-outline" size={16} color={theme.ai} />
          <Text style={[styles.valuationTitle, { color: theme.ai }]}>Owner{"'"}s Estimated Value</Text>
        </View>
        <Text style={[styles.valuationRange, { color: theme.textPrimary }]}>{range}</Text>
        <Text style={[styles.valuationSubtitle, { color: theme.textMuted }]}>
          Set by the item owner
        </Text>
        <View
          style={[styles.overrideBadge, { backgroundColor: theme.aiLight }]}
        >
          <Ionicons
            name="information-circle-outline"
            size={13}
            color={theme.ai}
          />
          <Text style={[styles.overrideBadgeText, { color: theme.ai }]}>
            This value was manually set and may differ from market rates
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.valuationCard, { backgroundColor: theme.aiSurface }]}>
      <View style={styles.valuationHeader}>
        <Ionicons name="sparkles" size={16} color={theme.ai} />
        <Text style={[styles.valuationTitle, { color: theme.ai, flex: 1 }]}>Automated Valuation Result</Text>
          <InfoButton topic="valuation" color={theme.ai} />
      </View>
      <Text style={[styles.valuationRange, { color: theme.textPrimary }]}>{range}</Text>
      <Text style={[styles.valuationSubtitle, { color: theme.textMuted }]}>
        Based on similar items and market data
      </Text>
      <View style={styles.confidenceRow}>
        <Text style={[styles.confidenceLabel, { color: theme.textMuted }]}>
          Confidence level
        </Text>
        <Text style={[styles.confidenceValue, { color: theme.ai }]}>
          {confidenceLevel
            ? confidenceLevel.charAt(0).toUpperCase() + confidenceLevel.slice(1)
            : "—"}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.aiLight }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.ai,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
      <View
        style={[styles.confidenceNote, { backgroundColor: theme.aiLight }]}
      >
        <Ionicons
          name="information-circle-outline"
          size={13}
          color={theme.ai}
        />
        <Text style={[styles.confidenceNoteText, { color: theme.ai }]}>
          {confidenceLevel === "high"
            ? "High Confidence — this valuation is very reliable"
            : confidenceLevel === "medium"
              ? "Medium Confidence — estimate may vary"
              : "Low Confidence — limited data available"}{" "}
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

// ─── Why this matches (UI spec §13.10) ────────────────────────────────────────

function WhyThisMatchesCard({ context }: { context: MatchContext }) {
  const theme = useAuthTheme();
  return (
    <View style={[styles.whyCard, { backgroundColor: theme.aiSurface }]}>
      <View style={styles.whyHeader}>
        <Text style={[styles.whyTitle, { color: theme.textPrimary }]}>
          Why this matches
        </Text>
        <ScoutBadge />
      </View>
      {context.score_label && <ScoreLabel label={context.score_label} />}
      <Text style={[styles.whyReason, { color: theme.textSecondary }]}>
        {context.reason}
      </Text>
      <View style={styles.whyChecks}>
        {context.checked.map((c) => (
          <CheckRow key={c.key} label={c.label} result={c.result} />
        ))}
      </View>
      {context.shared_tags.length > 0 && (
        <>
          <Text style={[styles.whyTagsLabel, { color: theme.textSecondary }]}>
            In common
          </Text>
          <View style={styles.chipWrap}>
            {context.shared_tags.map((t) => (
              <TagChip key={t.tag_id} name={t.name} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ListingDetailScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  // context: the viewer's listing this was opened from on Home (match context).
  const { id, context } = useLocalSearchParams<{ id: string; context?: string }>();

  const [item, setItem] = useState<ItemDetail | null>(null);

  // Opened from a match: a short tour of the Why card and Propose Trade.
  const whyRef = useRef<View>(null);
  const proposeRef = useRef<View>(null);
  const tourSteps = useMemo(
    () => [
      { target: whyRef, text: "Why Scout picked this: what fits, and whether they may want yours." },
      { target: proposeRef, text: "Ready? Make an offer here. Scout never sends anything for you." },
    ],
    [],
  );
  const scrollRef = useRef<any>(null);
  const tour = useTour("match", tourSteps, !!context && !!item?.match_context, { scrollRef });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { qloo } = useFeatures();
  // Viewer's available listings (Draft an offer needs one to offer).
  const [myAvailable, setMyAvailable] = useState<{ id: string; title: string }[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentAnim = useAnimatedValue(0);

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

  const stopValuationPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

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
        // Keep polling through network blips; the timeout below ends it.
      }
    }, POLL_INTERVAL);

    // Safety timeout — if still pending after 3 min, show it as failed so the
    // owner gets the Retry button instead of an endless spinner.
    pollTimeoutRef.current = setTimeout(() => {
      stopValuationPolling();
      setItem((prev) =>
        prev?.valuation?.status === "pending"
          ? { ...prev, valuation: { ...prev.valuation, status: "failed" } }
          : prev,
      );
    }, POLL_TIMEOUT_MS);
  }, [stopValuationPolling]);

  const fetchItem = useCallback(async () => {
    if (!id) return;
    try {
      const [data, user] = await Promise.all([
        getItemById(id, context),
        getStoredUser(),
      ]);
      setItem(data);
      setError(null);

      // Only the owner watches a pending valuation; others see it as unavailable.
      if (
        data.valuation?.status === "pending" &&
        data.owner.id === user?.id
      ) {
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
  }, [contentAnim, id, context, startValuationPolling]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is set after the await
    fetchItem();
    return () => stopValuationPolling();
  }, [fetchItem, stopValuationPolling]);

  const isOwner = item ? item.owner.id === currentUserId : false;
  const canProposeTrade = !isOwner && item?.status === "available";

  const handleRetryValuation = useCallback(async () => {
    if (!item) return;
    setRetrying(true);
    try {
      await retryItemValuation(item.id);
      setItem((prev) =>
        prev?.valuation
          ? { ...prev, valuation: { ...prev.valuation, status: "pending" } }
          : prev,
      );
      startValuationPolling(item.id);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.message ?? "Could not retry valuation.",
      );
    } finally {
      setRetrying(false);
    }
  }, [item, startValuationPolling]);

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

  // ── Draft an offer with Scout (UI §13.10, FLOW §10.9) ──────────────────────

  useEffect(() => {
    if (!qloo || !item || isOwner) return;
    let live = true;
    getMyItems({ status: "available", limit: 50 })
      .then((d) => live && setMyAvailable(d.items.map((i) => ({ id: i.id, title: i.title }))))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [qloo, item, isOwner]);

  const canDraft = qloo && !isOwner && item?.status === "available" && myAvailable.length > 0;

  const runDraft = useCallback(
    async (sourceId: string) => {
      if (!item || drafting) return;
      setPickerOpen(false);
      setDrafting(true);
      try {
        const draft = await draftOffer(sourceId, item.id);
        scoutDraftStore.set(draft);
        router.push({
          pathname: "/(support-pages)/trade/[id]/propose",
          params: { id: item.id, draft: "1" },
        });
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 422) {
          showToast("error", "This listing is no longer available.");
          fetchItem();
        } else if (status === 429) {
          showToast("info", "Slow down a moment.");
        } else {
          showToast("error", "Scout could not draft that. You can still make an offer yourself.");
        }
      } finally {
        setDrafting(false);
      }
    },
    [item, drafting, fetchItem],
  );

  const handleDraft = useCallback(() => {
    // From a Home match: offer that listing. Otherwise ask which one.
    if (context && myAvailable.some((m) => m.id === context)) return runDraft(context);
    if (myAvailable.length === 1) return runDraft(myAvailable[0]!.id);
    setPickerOpen(true);
  }, [context, myAvailable, runDraft]);

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
        ref={scrollRef}
        onScroll={tour.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + (canDraft ? 156 : 100) }}
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
              style={[styles.metaBadge, { backgroundColor: theme.surfaceVariant }]}
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

          <ValuationCard
            valuation={item.valuation}
            isOwner={isOwner}
            canRetry={isOwner && item.valuation?.status === "failed"}
            retrying={retrying}
            onRetry={handleRetryValuation}
          />

          {item.match_context && (
            <View ref={whyRef} collapsable={false}>
              <WhyThisMatchesCard context={item.match_context} />
            </View>
          )}

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

          <View
            style={[styles.section, { borderTopColor: theme.borderSubtle }]}
          >
            <View style={styles.sectionHeader}>
              <Ionicons
                name="pricetags-sharp"
                size={16}
                color={theme.textPrimary}
              />
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Seller Price / Value
              </Text>
            </View>
            <Text style={[styles.sectionBody, { color: theme.textMuted }]}>
              {item.user_declared_value === null
                ? "Seller did not declare a price"
                : `$${item.user_declared_value}`}
            </Text>
          </View>

          {item.wants && item.wants.length > 0 ? (
            <View
              style={[styles.section, { borderTopColor: theme.borderSubtle }]}
            >
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="swap-horizontal-outline"
                  size={16}
                  color={theme.textPrimary}
                />
                <Text
                  style={[styles.sectionTitle, { color: theme.textPrimary }]}
                >
                  {item.owner.first_name} would take
                </Text>
              </View>
              <View style={styles.chipWrap}>
                {item.wants.map((w) => (
                  <WantChip key={w.category.id} name={w.category.name} rank={w.rank} />
                ))}
              </View>
              {!!item.desired_trade && (
                <Text
                  style={[
                    styles.sectionBody,
                    styles.wantNote,
                    { color: theme.textMuted },
                  ]}
                >
                  {item.desired_trade}
                </Text>
              )}
            </View>
          ) : !!item.desired_trade && (
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
        ) : item.status === "traded" ? null : (
          <>
          {canDraft && (
            <TouchableOpacity
              style={[styles.draftBtn, { backgroundColor: theme.aiLight, borderColor: theme.ai }]}
              onPress={handleDraft}
              disabled={drafting}
              activeOpacity={0.85}
              accessibilityLabel="Draft an offer with Scout"
            >
              {drafting ? (
                <>
                  <ActivityIndicator size="small" color={theme.ai} />
                  <Text style={[styles.draftBtnText, { color: theme.ai }]}>Scout is drafting...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color={theme.ai} />
                  <Text style={[styles.draftBtnText, { color: theme.ai }]}>Draft an offer with Scout</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <View ref={proposeRef} collapsable={false} style={styles.ctaWrap}>
          <TouchableOpacity
            style={[
              styles.ctaPrimary,
              styles.ctaInWrap,
              {
                backgroundColor: canProposeTrade
                  ? Colors.primary
                  : theme.btnDisabled,
              },
            ]}
            onPress={handleProposeTrade}
            disabled={!canProposeTrade}
            activeOpacity={0.9}
          >
            <Ionicons name="sparkles-outline" size={18} color={Colors.white} />
            <Text style={styles.ctaPrimaryText}>
              {item.status === "in_trade" ? "In a Trade" : "Propose Trade"}
            </Text>
          </TouchableOpacity>
          </View>
          </>
        )}
      </View>
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setPickerOpen(false)} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.bg, paddingBottom: insets.bottom + Spacing[4], borderColor: theme.borderSubtle },
          ]}
        >
          <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Which listing do you want to offer?</Text>
          <ScrollView style={styles.sheetList}>
            {myAvailable.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.sheetRow, { borderBottomColor: theme.borderSubtle }]}
                onPress={() => runDraft(m.id)}
              >
                <Text numberOfLines={1} style={[styles.sheetRowText, { color: theme.textPrimary }]}>
                  {m.title}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
      {tour.node}
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
  },
  valuationTitle: { ...Typography.bodyMedium },
  valuationRange: {
    ...Typography.cardTitleLarge,
    fontSize: 28,
    marginBottom: Spacing[1],
    paddingTop: Spacing[3],
  },
  valuationSubtitle: { ...Typography.caption, marginBottom: Spacing[3] },
  valuationUnavailable: { ...Typography.body },
  valuationFailedReason: { ...Typography.caption, marginTop: Spacing[1] },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.lg,
    paddingVertical: Spacing[2],
    marginTop: Spacing[3],
  },
  retryBtnText: { ...Typography.captionMedium },
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
  confidenceValue: { ...Typography.captionMedium },
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
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing[2] },
  wantNote: { marginTop: Spacing[2] },
  whyCard: {
    marginTop: Spacing[3],
    borderRadius: Radius.xl,
    padding: Spacing[4],
    gap: Spacing[2],
  },
  whyHeader: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },
  whyTitle: { ...Typography.bodyMedium, flex: 1 },
  whyReason: { ...Typography.body },
  whyChecks: { marginTop: Spacing[1] },
  whyTagsLabel: { ...Typography.captionMedium, marginTop: Spacing[1] },
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
  ctaWrap: { alignSelf: "stretch" },
  draftBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    height: 44,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing[2],
  },
  draftBtnText: { ...Typography.buttonSm },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "70%",
    borderTopLeftRadius: Radius["3xl"],
    borderTopRightRadius: Radius["3xl"],
    borderTopWidth: 1,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
  },
  sheetTitle: { ...Typography.sectionTitle, marginBottom: Spacing[2] },
  sheetList: { flexGrow: 0 },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowText: { ...Typography.body, flex: 1 },
  ctaInWrap: { flex: 0 },
  ctaPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    height: Layout.buttonHeight,
    borderWidth: 1,
    borderRadius: Radius.lg,
    borderColor: Colors.white,
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
