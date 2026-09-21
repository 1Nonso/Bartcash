/**
 * Bartcash — Trade Completion Confirmation Screen
 * app/(support-pages)/trade/[id]/complete.tsx
 *
 * Shown when a user taps "Mark as Complete" on Trade Detail.
 * Both parties must independently confirm before the trade status
 * moves to completed.
 *
 * Flow:
 *  1. Load trade data to show summary
 *  2. User reads confirmation message and taps Confirm
 *  3. PATCH /trades/{id}/complete
 *  4a. Both confirmed → navigate to Rating Screen
 *  4b. Only one confirmed → navigate back to Trade Detail
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Colors,
  Layout,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Trade, completeTrade, getTradeById } from "@/config/trades";

const USER_KEY = "bartcash_user";

function formatValueRange(
  min: string | null,
  max: string | null,
): string | null {
  if (!min && !max) return null;
  const fMin = min ? `₦${Number(min).toLocaleString()}` : "";
  const fMax = max ? `₦${Number(max).toLocaleString()}` : "";
  if (fMin && fMax) return `${fMin} – ${fMax}`;
  return fMin || fMax;
}

interface ItemRowProps {
  title: string;
  image: string | null;
  valueRange: string | null;
  condition: string;
}

function ItemRow({ title, image, valueRange, condition }: ItemRowProps) {
  const theme = useAuthTheme();
  return (
    <View style={[styles.itemRow, { borderColor: theme.borderSubtle }]}>
      {image ? (
        <Image source={{ uri: image }} style={styles.itemThumb} />
      ) : (
        <View
          style={[
            styles.itemThumb,
            styles.itemThumbPlaceholder,
            { backgroundColor: Colors.gray[100] },
          ]}
        >
          <Ionicons name="image-outline" size={20} color={Colors.gray[400]} />
        </View>
      )}
      <View style={styles.itemRowMeta}>
        <Text
          style={[styles.itemRowTitle, { color: theme.textPrimary }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <View style={styles.itemRowBadges}>
          <View
            style={[
              styles.conditionBadge,
              { backgroundColor: Colors.gray[100] },
            ]}
          >
            <Text
              style={[styles.conditionBadgeText, { color: theme.textMuted }]}
            >
              {condition.charAt(0).toUpperCase() + condition.slice(1)}
            </Text>
          </View>
          {valueRange && (
            <View
              style={[styles.valueBadge, { backgroundColor: Colors.aiSurface }]}
            >
              <Ionicons name="trending-up" size={10} color={Colors.ai} />
              <Text style={styles.valueBadgeText}>{valueRange}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function TradeCompletionScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const noticeAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(headerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.spring(cardAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.spring(noticeAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.spring(ctaAnim, {
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
      const [raw, tradeData] = await Promise.all([
        AsyncStorage.getItem(USER_KEY),
        getTradeById(id!),
      ]);
      if (raw) setCurrentUserId(JSON.parse(raw).id);
      setTrade(tradeData);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load trade details.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = useCallback(async () => {
    if (!id) return;
    setConfirming(true);
    setError(null);
    try {
      const updated = await completeTrade(id);
      if (updated.status === "completed") {
        router.replace({
          pathname: "/(support-pages)/trade/[id]/rate",
          params: { id },
        });
      } else {
        // One party confirmed — go back to Trade Detail
        goBack();
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 422) {
        setError(
          err.response?.data?.message ||
            "This trade cannot be completed right now.",
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setConfirming(false);
    }
  }, [id]);

  const myItems =
    trade && currentUserId
      ? trade.proposer.id === currentUserId
        ? trade.proposer_items
        : trade.receiver_items
      : [];

  const theirItems =
    trade && currentUserId
      ? trade.proposer.id === currentUserId
        ? trade.receiver_items
        : trade.proposer_items
      : [];

  const otherParty =
    trade && currentUserId
      ? trade.proposer.id === currentUserId
        ? trade.receiver
        : trade.proposer
      : null;

  const alreadyConfirmed =
    trade && currentUserId
      ? trade.proposer.id === currentUserId
        ? trade.proposer_confirmed
        : trade.receiver_confirmed
      : false;

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
          Confirm Completion
        </Text>
        <View style={styles.headerRight} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: cardAnim,
              transform: [
                {
                  translateY: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.heroIconWrap,
              { backgroundColor: Colors.success + "15" },
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={48}
              color={Colors.success}
            />
          </View>
          <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
            Confirm the Exchange
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.textMuted }]}>
            By confirming, you are stating that the exchange has taken place and
            you have received what was agreed.
          </Text>
        </Animated.View>

        {/* Summary card */}
        <Animated.View
          style={[
            styles.summaryCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.borderSubtle,
              opacity: cardAnim,
              transform: [
                {
                  translateY: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Other party */}
          {otherParty && (
            <View
              style={[
                styles.partyRow,
                { borderBottomColor: theme.borderSubtle },
              ]}
            >
              {otherParty.profile_photo ? (
                <Image
                  source={{ uri: otherParty.profile_photo }}
                  style={styles.partyAvatar}
                />
              ) : (
                <View
                  style={[
                    styles.partyAvatar,
                    styles.avatarFallback,
                    { backgroundColor: Colors.primary },
                  ]}
                >
                  <Text style={styles.avatarFallbackText}>
                    {otherParty.first_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.partyMeta}>
                <Text style={[styles.partyLabel, { color: theme.textMuted }]}>
                  Trading with
                </Text>
                <Text style={[styles.partyName, { color: theme.textPrimary }]}>
                  {otherParty.first_name} {otherParty.last_name}
                </Text>
              </View>
              {trade?.completion_method && (
                <View
                  style={[
                    styles.methodBadge,
                    { backgroundColor: Colors.aiSurface },
                  ]}
                >
                  <Ionicons
                    name={
                      trade.completion_method === "meetup"
                        ? "people-outline"
                        : "cube-outline"
                    }
                    size={12}
                    color={Colors.ai}
                  />
                  <Text style={styles.methodBadgeText}>
                    {trade.completion_method === "meetup"
                      ? "Meetup"
                      : "Delivery"}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Items */}
          <View style={styles.itemsSection}>
            {myItems.length > 0 && (
              <View style={styles.itemsGroup}>
                <Text
                  style={[styles.itemsGroupLabel, { color: theme.textMuted }]}
                >
                  You gave
                </Text>
                {myItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    title={item.title}
                    image={item.primary_image}
                    valueRange={formatValueRange(
                      item.valuation?.value_min ?? null,
                      item.valuation?.value_max ?? null,
                    )}
                    condition={item.condition}
                  />
                ))}
              </View>
            )}

            <View style={styles.swapDivider}>
              <View
                style={[
                  styles.swapLine,
                  { backgroundColor: theme.borderSubtle },
                ]}
              />
              <View
                style={[
                  styles.swapIconWrap,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.borderSubtle,
                  },
                ]}
              >
                <Ionicons
                  name="swap-vertical"
                  size={16}
                  color={theme.textMuted}
                />
              </View>
              <View
                style={[
                  styles.swapLine,
                  { backgroundColor: theme.borderSubtle },
                ]}
              />
            </View>

            {theirItems.length > 0 && (
              <View style={styles.itemsGroup}>
                <Text
                  style={[styles.itemsGroupLabel, { color: theme.textMuted }]}
                >
                  You received
                </Text>
                {theirItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    title={item.title}
                    image={item.primary_image}
                    valueRange={formatValueRange(
                      item.valuation?.value_min ?? null,
                      item.valuation?.value_max ?? null,
                    )}
                    condition={item.condition}
                  />
                ))}
              </View>
            )}
          </View>
        </Animated.View>

        {/* Warning notice */}
        <Animated.View
          style={[
            styles.notice,
            {
              backgroundColor: Colors.warning + "15",
              borderColor: Colors.warning + "40",
              opacity: noticeAnim,
              transform: [
                {
                  translateY: noticeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={Colors.warning}
          />
          <Text style={[styles.noticeText, { color: theme.textPrimary }]}>
            Both parties must confirm independently. The trade will only close
            once <Text style={{ fontWeight: "600" }}>both sides confirm</Text>.
          </Text>
        </Animated.View>

        {/* Already confirmed notice */}
        {alreadyConfirmed && (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: Colors.success + "15",
                borderColor: Colors.success + "40",
              },
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color={Colors.success}
            />
            <Text style={[styles.noticeText, { color: theme.textPrimary }]}>
              You have already confirmed. Waiting for{" "}
              <Text style={{ fontWeight: "600" }}>
                {otherParty?.first_name}
              </Text>{" "}
              to confirm.
            </Text>
          </View>
        )}

        {/* Inline API error */}
        {error && (
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
      <Animated.View
        style={[
          styles.ctaBar,
          {
            backgroundColor: theme.bg,
            borderTopColor: theme.borderSubtle,
            paddingBottom: insets.bottom + Spacing[3],
            opacity: ctaAnim,
            transform: [
              {
                translateY: ctaAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            {
              backgroundColor:
                confirming || alreadyConfirmed
                  ? theme.btnDisabled
                  : Colors.success,
            },
          ]}
          onPress={handleConfirm}
          disabled={confirming || !!alreadyConfirmed}
          activeOpacity={0.9}
        >
          {confirming ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={Colors.white}
              />
              <Text style={styles.confirmBtnText}>
                {alreadyConfirmed
                  ? "Awaiting Other Party"
                  : "Confirm Completion"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.cancelBtn,
            {
              backgroundColor: theme.surface,
              borderColor: theme.borderDefault,
            },
          ]}
          onPress={() => goBack()}
          disabled={confirming}
          activeOpacity={0.8}
        >
          <Text style={[styles.cancelBtnText, { color: theme.textPrimary }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

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

  heroSection: {
    alignItems: "center",
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    marginBottom: Spacing[2],
  },
  heroIconWrap: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { ...Typography.cardTitleLarge, textAlign: "center" },
  heroSubtitle: { ...Typography.body, textAlign: "center", lineHeight: 22 },

  summaryCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: "hidden",
    ...Shadows.sm,
  },

  partyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    padding: Spacing[4],
    borderBottomWidth: 1,
  },
  partyAvatar: {
    width: Layout.avatarSm,
    height: Layout.avatarSm,
    borderRadius: Radius.full,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { ...Typography.bodyMedium, color: Colors.white },
  partyMeta: { flex: 1 },
  partyLabel: { ...Typography.micro },
  partyName: { ...Typography.bodyMedium, marginTop: 2 },
  methodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing[2],
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  methodBadgeText: { ...Typography.micro, color: Colors.ai, fontWeight: "600" },

  itemsSection: { padding: Spacing[4], gap: Spacing[3] },
  itemsGroup: { gap: Spacing[2] },
  itemsGroupLabel: { ...Typography.captionMedium, marginBottom: Spacing[1] },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    paddingVertical: Spacing[2],
    borderBottomWidth: 1,
  },
  itemThumb: { width: 52, height: 52, borderRadius: Radius.md },
  itemThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  itemRowMeta: { flex: 1, gap: 4 },
  itemRowTitle: { ...Typography.captionMedium },
  itemRowBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
  },
  conditionBadge: {
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  conditionBadgeText: { ...Typography.micro },
  valueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  valueBadgeText: { ...Typography.micro, color: Colors.ai, fontWeight: "600" },

  swapDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    marginVertical: Spacing[1],
  },
  swapLine: { flex: 1, height: 1 },
  swapIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[2],
    padding: Spacing[4],
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  noticeText: { ...Typography.caption, flex: 1, lineHeight: 18 },

  ctaBar: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
    gap: Spacing[3],
  },
  confirmBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
  },
  confirmBtnText: { ...Typography.button, color: Colors.white },
  cancelBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cancelBtnText: { ...Typography.button },
});
