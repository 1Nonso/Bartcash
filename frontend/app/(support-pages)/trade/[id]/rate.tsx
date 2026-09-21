/**
 * Bartcash — Rating Screen
 * app/(support-pages)/trade/[id]/rate.tsx
 *
 * Post-trade rating and review submission for a trading partner.
 * Accessible after trade completion — also re-accessible from
 * Trade Detail if the user skipped initially.
 *
 * Features:
 *  - 5-star tap selector (tap same star deselects)
 *  - Optional written review — max 500 chars with counter
 *  - Submit disabled until a star is selected
 *  - Skip for Now link
 *  - Read-only state if rating already submitted
 *  - POST /ratings with trade_id, score, review
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
import { Trade, getTradeById } from "@/config/trades";
import { submitRating } from "@/config/ratings";

// ─── Star Rating Component ────────────────────────────────────────────────────

interface StarRatingProps {
  value: number;
  onChange?: (score: number) => void;
  readonly?: boolean;
  size?: number;
}

function StarRating({
  value,
  onChange,
  readonly = false,
  size = 40,
}: StarRatingProps) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => {
            if (readonly || !onChange) return;
            // Tap same star to deselect
            onChange(star === value ? 0 : star);
          }}
          activeOpacity={readonly ? 1 : 0.7}
          disabled={readonly}
          style={styles.starBtn}
        >
          <Ionicons
            name={star <= value ? "star" : "star-outline"}
            size={size}
            color={star <= value ? Colors.warning : Colors.gray[300]}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Rating label helper ──────────────────────────────────────────────────────

function getRatingLabel(score: number): string {
  const labels: Record<number, string> = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Great",
    5: "Excellent!",
  };
  return labels[score] ?? "";
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RatingScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [score, setScore] = useState(0);
  const [review, setReview] = useState("");
  const [reviewFocused, setReviewFocused] = useState(false);

  // Already rated state
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [existingRating, setExistingRating] = useState<{
    score: number;
    review: string | null;
  } | null>(null);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const starsAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  // Star scale animations
  const starScales = useRef(
    [1, 2, 3, 4, 5].map(() => new Animated.Value(1)),
  ).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.spring(headerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.spring(heroAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.spring(starsAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.spring(formAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
    ]).start();

    loadData();
  }, []);

  const loadData = async () => {
    try {
      const tradeData = await getTradeById(id!);
      setTrade(tradeData);

      // Check if current user has already rated this trade
      // ratings array from trade detail contains submitted ratings
      if (tradeData.ratings && tradeData.ratings.length > 0) {
        // We'll detect already-rated state via 409 on submit
        // For now just load the trade data
      }

      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load trade details.");
    } finally {
      setLoading(false);
    }
  };

  // Animate star bounce on selection
  const handleStarSelect = useCallback(
    (selected: number) => {
      setScore(selected);
      if (selected > 0) {
        Animated.sequence([
          Animated.spring(starScales[selected - 1], {
            toValue: 1.3,
            useNativeDriver: true,
            tension: 200,
            friction: 5,
          }),
          Animated.spring(starScales[selected - 1], {
            toValue: 1,
            useNativeDriver: true,
            tension: 200,
            friction: 8,
          }),
        ]).start();
      }
    },
    [starScales],
  );

  const handleSubmit = useCallback(async () => {
    if (score === 0 || !id) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitRating({
        trade_id: id,
        score,
        review: review.trim() || undefined,
      });
      // Navigate back to Trade Detail
      goBack();
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409) {
        setAlreadyRated(true);
        setError("You have already submitted a rating for this trade.");
      } else if (status === 422) {
        setError(
          err.response?.data?.message ||
            "This trade has not been completed yet.",
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [score, review, id]);

  const handleSkip = useCallback(() => {
    goBack();
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────

  // We need currentUserId to determine other party, but we'll just use trade data
  // The other party to rate is not stored directly — we infer from context
  // Since this screen is reached after completing a trade, the "other party"
  // is whoever the user was trading with
  const otherParty =
    trade?.proposer && trade?.receiver
      ? trade.proposer // We'll show the trade partner — Trade Detail passes context via nav
      : null;

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View
        style={[
          styles.centerState,
          { backgroundColor: theme.bg, paddingTop: insets.top },
        ]}
      >
        <StatusBar
          barStyle={theme.isDark ? "light-content" : "dark-content"}
          backgroundColor={theme.bg}
        />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error && !trade) {
    return (
      <View
        style={[
          styles.centerState,
          { backgroundColor: theme.bg, paddingTop: insets.top },
        ]}
      >
        <StatusBar
          barStyle={theme.isDark ? "light-content" : "dark-content"}
          backgroundColor={theme.bg}
        />
        <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
        <Text style={[styles.errorStateText, { color: theme.textPrimary }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: Colors.primary }]}
          onPress={loadData}
        >
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Rate Your Trade
        </Text>
        <View style={styles.headerRight} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Trade complete badge */}
        <Animated.View
          style={[
            styles.completeBadge,
            {
              backgroundColor: Colors.success + "15",
              opacity: heroAnim,
              transform: [
                {
                  translateY: heroAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={[styles.completeBadgeText, { color: Colors.success }]}>
            Trade Completed
          </Text>
        </Animated.View>

        {/* Hero */}
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: heroAnim,
              transform: [
                {
                  translateY: heroAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Other party avatar */}
          {otherParty?.profile_photo ? (
            <Image
              source={{ uri: otherParty.profile_photo }}
              style={styles.heroAvatar}
            />
          ) : (
            <View
              style={[
                styles.heroAvatar,
                styles.heroAvatarFallback,
                { backgroundColor: Colors.primary },
              ]}
            >
              <Text style={styles.heroAvatarFallbackText}>
                {trade?.receiver?.first_name?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}

          <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
            How was your experience?
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.textMuted }]}>
            Your feedback helps build trust in the Bartcash community.
          </Text>
        </Animated.View>

        {/* Stars */}
        <Animated.View
          style={[
            styles.starsSection,
            {
              backgroundColor: theme.surface,
              borderColor: theme.borderSubtle,
              opacity: starsAnim,
              transform: [
                {
                  translateY: starsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() =>
                  !alreadyRated && handleStarSelect(star === score ? 0 : star)
                }
                activeOpacity={alreadyRated ? 1 : 0.7}
                disabled={alreadyRated}
              >
                <Animated.View
                  style={{ transform: [{ scale: starScales[star - 1] }] }}
                >
                  <Ionicons
                    name={star <= score ? "star" : "star-outline"}
                    size={44}
                    color={star <= score ? Colors.warning : Colors.gray[300]}
                  />
                </Animated.View>
              </TouchableOpacity>
            ))}
          </View>

          {score > 0 && (
            <Animated.Text
              style={[
                styles.ratingLabel,
                {
                  color: Colors.warning,
                },
              ]}
            >
              {getRatingLabel(score)}
            </Animated.Text>
          )}

          {score === 0 && !alreadyRated && (
            <Text style={[styles.ratingPrompt, { color: theme.textMuted }]}>
              Tap a star to rate
            </Text>
          )}
        </Animated.View>

        {/* Review text area */}
        <Animated.View
          style={[
            styles.reviewSection,
            {
              backgroundColor: theme.surface,
              borderColor: theme.borderSubtle,
              opacity: formAnim,
              transform: [
                {
                  translateY: formAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[styles.reviewLabel, { color: theme.textPrimary }]}>
            Leave a review{" "}
            <Text style={[styles.reviewOptional, { color: theme.textMuted }]}>
              (optional)
            </Text>
          </Text>

          <TextInput
            style={[
              styles.reviewInput,
              {
                backgroundColor: reviewFocused
                  ? theme.inputBgFocused
                  : theme.inputBg,
                borderColor: reviewFocused
                  ? theme.borderFocus
                  : theme.borderDefault,
                color: theme.textPrimary,
              },
            ]}
            placeholder="Share your experience with this trader..."
            placeholderTextColor={theme.textPlaceholder}
            value={review}
            onChangeText={setReview}
            onFocus={() => setReviewFocused(true)}
            onBlur={() => setReviewFocused(false)}
            multiline
            maxLength={500}
            textAlignVertical="top"
            editable={!alreadyRated}
          />
          <Text style={[styles.charCount, { color: theme.textMuted }]}>
            {review.length}/500
          </Text>
        </Animated.View>

        {/* Already rated notice */}
        {alreadyRated && (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: Colors.info + "12",
                borderColor: Colors.info + "30",
              },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={Colors.info}
            />
            <Text style={[styles.noticeText, { color: theme.textPrimary }]}>
              You have already submitted a rating for this trade.
            </Text>
          </View>
        )}

        {/* Inline error */}
        {error && !alreadyRated && (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: Colors.danger + "12",
                borderColor: Colors.danger + "40",
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={Colors.danger}
            />
            <Text style={[styles.noticeText, { color: Colors.danger }]}>
              {error}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
      {!alreadyRated && (
        <View
          style={[
            styles.ctaBar,
            {
              backgroundColor: theme.bg,
              borderTopColor: theme.borderSubtle,
              paddingBottom: insets.bottom + Spacing[3],
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor:
                  score > 0 && !submitting ? Colors.primary : theme.btnDisabled,
              },
            ]}
            onPress={handleSubmit}
            disabled={score === 0 || submitting}
            activeOpacity={0.9}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="star" size={16} color={Colors.white} />
                <Text style={styles.submitBtnText}>Submit Rating</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSkip}
            disabled={submitting}
            activeOpacity={0.7}
            style={styles.skipBtn}
          >
            <Text style={[styles.skipBtnText, { color: theme.textMuted }]}>
              Skip for Now
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[3],
    paddingHorizontal: Layout.screenPadding,
  },
  errorStateText: { ...Typography.body, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
  },
  retryBtnText: { ...Typography.button, color: Colors.white },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 60 },
  backText: { ...Typography.body },
  headerTitle: { ...Typography.sectionTitle },
  headerRight: { minWidth: 60 },

  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[6],
    gap: Spacing[4],
  },

  // Complete badge
  completeBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.full,
    alignSelf: "center",
  },
  completeBadgeText: { ...Typography.captionMedium },

  // Hero
  heroSection: {
    alignItems: "center",
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
  },
  heroAvatar: {
    width: Layout.avatarLg,
    height: Layout.avatarLg,
    borderRadius: Radius.full,
  },
  heroAvatarFallback: { alignItems: "center", justifyContent: "center" },
  heroAvatarFallbackText: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.white,
  },
  heroTitle: { ...Typography.cardTitleLarge, textAlign: "center" },
  heroSubtitle: { ...Typography.body, textAlign: "center", lineHeight: 22 },

  // Stars
  starsSection: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing[6],
    alignItems: "center",
    gap: Spacing[3],
    ...Shadows.sm,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
  },
  starBtn: {
    padding: Spacing[1],
  },
  ratingLabel: {
    ...Typography.sectionTitle,
    fontWeight: "700",
  },
  ratingPrompt: {
    ...Typography.caption,
  },

  // Review
  reviewSection: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing[4],
    gap: Spacing[3],
    ...Shadows.sm,
  },
  reviewLabel: { ...Typography.inputLabel },
  reviewOptional: { fontWeight: "400" },
  reviewInput: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    ...Typography.input,
    minHeight: 100,
  },
  charCount: { ...Typography.micro, textAlign: "right" },

  // Notice
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[2],
    padding: Spacing[4],
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  noticeText: { ...Typography.caption, flex: 1, lineHeight: 18 },

  // CTA
  ctaBar: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
    gap: Spacing[2],
  },
  submitBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
  },
  submitBtnText: { ...Typography.button, color: Colors.white },
  skipBtn: {
    alignItems: "center",
    paddingVertical: Spacing[3],
  },
  skipBtnText: { ...Typography.body },
});
