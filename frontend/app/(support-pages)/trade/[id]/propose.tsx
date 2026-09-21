import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
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
import {
  ItemDetail,
  MarketplaceItem,
  getItemById,
  getMyItems,
} from "@/config/items";
import { createTrade } from "@/config/trades";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatValuation(item: ItemDetail): string | null {
  const v = item.valuation;
  if (!v || v.status !== "completed") return null;
  if (!v.value_min && !v.value_max) return null;
  const min = v.value_min ? `₦${Number(v.value_min).toLocaleString()}` : "";
  const max = v.value_max ? `₦${Number(v.value_max).toLocaleString()}` : "";
  if (min && max) return `${min} – ${max}`;
  return min || max;
}

function conditionLabel(c: string): string {
  const map: Record<string, string> = {
    new: "Brand New",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
  };
  return map[c] ?? c;
}

function getPrimaryImage(item: ItemDetail): string | null {
  if (!item.images || item.images.length === 0) return null;
  const primary = item.images.find((img) => img.is_primary);
  return primary ? primary.url : item.images[0].url;
}

// ─── Selectable item card ─────────────────────────────────────────────────────

interface SelectableCardProps {
  item: ItemDetail;
  selected: boolean;
  onToggle: () => void;
}

function SelectableCard({ item, selected, onToggle }: SelectableCardProps) {
  const theme = useAuthTheme();
  const valuation = formatValuation(item);

  return (
    <TouchableOpacity
      style={[
        styles.selectableCard,
        {
          backgroundColor: theme.surface,
          borderColor: selected ? Colors.primary : theme.cardBorder,
          borderWidth: selected ? 2 : Layout.borderWidth,
        },
      ]}
      onPress={onToggle}
      activeOpacity={0.88}
    >
      {/* Selection indicator */}
      <View
        style={[
          styles.selectionIndicator,
          {
            backgroundColor: selected ? Colors.primary : "transparent",
            borderColor: selected ? Colors.primary : theme.borderDefault,
          },
        ]}
      >
        {selected && (
          <Ionicons name="checkmark" size={12} color={Colors.white} />
        )}
      </View>

      {/* Image */}
      {getPrimaryImage(item) ? (
        <Image
          source={{ uri: getPrimaryImage(item)! }}
          style={styles.selectableImage}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.selectableImage,
            styles.selectableImagePlaceholder,
            { backgroundColor: Colors.gray[100] },
          ]}
        >
          <Ionicons name="image-outline" size={20} color={Colors.gray[400]} />
        </View>
      )}

      {/* Info */}
      <View style={styles.selectableInfo}>
        <Text
          style={[styles.selectableTitle, { color: theme.textPrimary }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text style={[styles.selectableMeta, { color: theme.textMuted }]}>
          {conditionLabel(item.condition)}
        </Text>
        {valuation && (
          <View style={styles.valuationRow}>
            <Ionicons name="trending-up" size={11} color={Colors.ai} />
            <Text style={styles.valuationText}>{valuation}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProposeTradeScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id: receiverItemId } = useLocalSearchParams<{ id: string }>();

  // Data
  const [receiverItem, setReceiverItem] = useState<ItemDetail | null>(null);
  const [myItems, setMyItems] = useState<ItemDetail[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [messageFocused, setMessageFocused] = useState(false);

  // UI
  const [loadingItem, setLoadingItem] = useState(true);
  const [loadingMyItems, setLoadingMyItems] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  // ── Load data ────────────────────────────────────────────────────────────────

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

    const loadAll = async () => {
      if (!receiverItemId) return;
      try {
        const [itemData, myItemsData] = await Promise.all([
          getItemById(receiverItemId),
          getMyItems({ status: "available", limit: 50 }),
        ]);
        setReceiverItem(itemData);
        setMyItems(myItemsData.items);
      } catch (err: any) {
        Alert.alert("Error", "Failed to load listing details.");
        goBack();
      } finally {
        setLoadingItem(false);
        setLoadingMyItems(false);
      }
    };
    loadAll();
  }, [receiverItemId]);

  // ── Toggle item selection ────────────────────────────────────────────────────

  const toggleItem = useCallback((itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!receiverItem || selectedItemIds.length === 0) return;
    setSubmitting(true);
    try {
      const trade = await createTrade({
        receiver_id: receiverItem.owner.id,
        receiver_item_id: receiverItem.id,
        offered_item_ids: selectedItemIds,
        message: message.trim() || undefined,
      });
      router.replace({
        pathname: "/(support-pages)/trade/[id]",
        params: { id: trade.id },
      });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 422) {
        Alert.alert(
          "Items Unavailable",
          "One or more items are no longer available. Please refresh and try again.",
        );
      } else if (status === 403) {
        Alert.alert("Error", "You cannot trade with yourself.");
      } else {
        Alert.alert(
          "Error",
          err.response?.data?.message ?? "Failed to send proposal.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [receiverItem, selectedItemIds, message]);

  // ── Back guard ───────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (selectedItemIds.length > 0 || message.trim()) {
      Alert.alert("Discard proposal?", "Your trade proposal will be lost.", [
        { text: "Keep Editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => goBack() },
      ]);
    } else {
      goBack();
    }
  }, [selectedItemIds, message]);

  // ── Match score (simple value comparison) ────────────────────────────────────

  const matchScore = useCallback((): number | null => {
    if (
      !receiverItem?.valuation ||
      receiverItem.valuation.status !== "completed"
    )
      return null;
    if (selectedItemIds.length === 0) return null;

    const selectedItems = myItems.filter((i) => selectedItemIds.includes(i.id));
    const hasValuations = selectedItems.every(
      (i) => i.valuation?.status === "completed",
    );
    if (!hasValuations) return null;

    const theirAvg =
      (Number(receiverItem.valuation.value_min) +
        Number(receiverItem.valuation.value_max)) /
      2;

    const myTotal = selectedItems.reduce((sum, item) => {
      if (!item.valuation?.value_min || !item.valuation?.value_max) return sum;
      return (
        sum +
        (Number(item.valuation.value_min) + Number(item.valuation.value_max)) /
          2
      );
    }, 0);

    if (theirAvg === 0) return null;
    const ratio = myTotal / theirAvg;
    // Score: 100% = perfect match, scales down as ratio diverges from 1
    const score = Math.max(0, Math.min(100, 100 - Math.abs(1 - ratio) * 100));
    return Math.round(score);
  }, [receiverItem, myItems, selectedItemIds]);

  const score = matchScore();
  const isFairTrade = score !== null && score >= 70;

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loadingItem) {
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

  if (!receiverItem) return null;

  const receiverValuation = formatValuation(receiverItem);

  // ── Render ───────────────────────────────────────────────────────────────────

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
          onPress={handleBack}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          <Text style={[styles.backText, { color: theme.textPrimary }]}>
            Back
          </Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            Make an Offer
          </Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>
            What would you trade for this item?
          </Text>
        </View>
        <View style={{ minWidth: 60 }} />
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ opacity: contentAnim }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* ── YOU WANT section ── */}
        <View
          style={[
            styles.wantCard,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.wantLabel, { color: theme.textMuted }]}>
            YOU WANT
          </Text>
          <Text
            style={[styles.wantTitle, { color: theme.textPrimary }]}
            numberOfLines={2}
          >
            {receiverItem.title}
          </Text>
          <Text style={[styles.wantMeta, { color: theme.textMuted }]}>
            {conditionLabel(receiverItem.condition)} ·{" "}
            {receiverItem.category?.name}
          </Text>
          {receiverValuation && (
            <View style={styles.valuationRow}>
              <Ionicons name="trending-up" size={13} color={Colors.ai} />
              <Text style={styles.valuationText}>{receiverValuation}</Text>
              <Text style={[styles.aiLabel, { color: theme.textMuted }]}>
                · AI Value
              </Text>
            </View>
          )}

          {/* Images strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imageStrip}
          >
            {receiverItem.images.map((img) => (
              <Image
                key={img.id}
                source={{ uri: img.url }}
                style={styles.stripImage}
                resizeMode="cover"
              />
            ))}
            {receiverItem.images.length === 0 && (
              <View
                style={[
                  styles.stripImage,
                  {
                    backgroundColor: Colors.gray[100],
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Ionicons
                  name="image-outline"
                  size={20}
                  color={Colors.gray[400]}
                />
              </View>
            )}
          </ScrollView>
        </View>

        {/* Swap icon */}
        <View style={styles.swapRow}>
          <View
            style={[
              styles.swapDivider,
              { backgroundColor: theme.borderSubtle },
            ]}
          />
          <View
            style={[
              styles.swapIcon,
              {
                backgroundColor: theme.surface,
                borderColor: theme.borderDefault,
              },
            ]}
          >
            <Ionicons
              name="swap-vertical"
              size={18}
              color={theme.textPrimary}
            />
          </View>
          <View
            style={[
              styles.swapDivider,
              { backgroundColor: theme.borderSubtle },
            ]}
          />
        </View>

        {/* ── YOU OFFER section ── */}
        <View
          style={[
            styles.offerSection,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.offerLabel, { color: theme.textMuted }]}>
            YOU OFFER
          </Text>
          <Text style={[styles.offerSubtitle, { color: theme.textPrimary }]}>
            Select one or more of your listings to offer
          </Text>

          {loadingMyItems ? (
            <View style={styles.loadingItems}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={[styles.loadingText, { color: theme.textMuted }]}>
                Loading your listings...
              </Text>
            </View>
          ) : myItems.length === 0 ? (
            <View style={styles.noItemsState}>
              <Ionicons
                name="cube-outline"
                size={32}
                color={Colors.gray[300]}
              />
              <Text style={[styles.noItemsText, { color: theme.textMuted }]}>
                You have no available listings to offer.
              </Text>
              <TouchableOpacity
                style={[
                  styles.createListingBtn,
                  { backgroundColor: Colors.primary },
                ]}
                onPress={() => router.push("/(support-pages)/listing/create")}
              >
                <Text style={styles.createListingBtnText}>
                  Create a Listing
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            myItems.map((item) => (
              <SelectableCard
                key={item.id}
                item={item}
                selected={selectedItemIds.includes(item.id)}
                onToggle={() => toggleItem(item.id)}
              />
            ))
          )}
        </View>

        {/* ── Message (optional) ── */}
        <View
          style={[
            styles.messageSection,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.messageLabel, { color: theme.textPrimary }]}>
            Message{" "}
            <Text style={[styles.optionalLabel, { color: theme.textMuted }]}>
              (optional)
            </Text>
          </Text>
          <TextInput
            style={[
              styles.messageInput,
              {
                backgroundColor: messageFocused
                  ? theme.inputBgFocused
                  : theme.inputBg,
                borderColor: messageFocused
                  ? theme.borderFocus
                  : theme.borderDefault,
                color: theme.textPrimary,
              },
            ]}
            placeholder="Say something to start the conversation..."
            placeholderTextColor={theme.textPlaceholder}
            value={message}
            onChangeText={setMessage}
            onFocus={() => setMessageFocused(true)}
            onBlur={() => setMessageFocused(false)}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: theme.textMuted }]}>
            {message.length}/500
          </Text>
        </View>

        {/* ── AI Match Score ── */}
        {score !== null && (
          <View
            style={[styles.matchCard, { backgroundColor: Colors.aiSurface }]}
          >
            <View style={styles.matchHeader}>
              <Ionicons name="sparkles" size={16} color={Colors.ai} />
              <Text style={styles.matchTitle}>AI Estimated Value</Text>
            </View>

            <View style={styles.matchValues}>
              <View style={styles.matchValueItem}>
                <Text
                  style={[styles.matchValueLabel, { color: theme.textMuted }]}
                >
                  Your items value
                </Text>
                <Text
                  style={[
                    styles.matchValueAmount,
                    { color: theme.textPrimary },
                  ]}
                >
                  {(() => {
                    const selected = myItems.filter((i) =>
                      selectedItemIds.includes(i.id),
                    );
                    const total = selected.reduce((sum, i) => {
                      if (!i.valuation?.value_min || !i.valuation?.value_max)
                        return sum;
                      return (
                        sum +
                        (Number(i.valuation.value_min) +
                          Number(i.valuation.value_max)) /
                          2
                      );
                    }, 0);
                    return total > 0 ? `₦${total.toLocaleString()}` : "—";
                  })()}
                </Text>
              </View>
              <View style={styles.matchValueItem}>
                <Text
                  style={[styles.matchValueLabel, { color: theme.textMuted }]}
                >
                  Their item value
                </Text>
                <Text
                  style={[
                    styles.matchValueAmount,
                    { color: theme.textPrimary },
                  ]}
                >
                  {receiverValuation ?? "—"}
                </Text>
              </View>
            </View>

            <View style={styles.scoreRow}>
              <Text style={[styles.scoreLabel, { color: theme.textMuted }]}>
                Trade match score
              </Text>
              <Text style={[styles.scoreValue, { color: Colors.ai }]}>
                {score}%
              </Text>
            </View>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: Colors.aiLight },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${score}%`, backgroundColor: Colors.ai },
                ]}
              />
            </View>

            {isFairTrade && (
              <View
                style={[
                  styles.fairTradeBadge,
                  {
                    backgroundColor: Colors.success + "15",
                    borderColor: Colors.success + "30",
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={Colors.success}
                />
                <Text style={[styles.fairTradeText, { color: Colors.success }]}>
                  This is a fair trade!
                </Text>
              </View>
            )}
          </View>
        )}
      </Animated.ScrollView>

      {/* CTA */}
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
            styles.ctaBtn,
            {
              backgroundColor:
                selectedItemIds.length > 0 && !submitting
                  ? Colors.primary
                  : theme.btnDisabled,
            },
          ]}
          onPress={handleSubmit}
          disabled={selectedItemIds.length === 0 || submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={Colors.white}
              />
              <Text style={styles.ctaBtnText}>Send Trade Offer</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 60 },
  backText: { ...Typography.body },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { ...Typography.sectionTitle },
  headerSub: { ...Typography.caption, marginTop: 2 },

  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
    gap: Spacing[4],
  },

  // Want card
  wantCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[2],
  },
  wantLabel: { ...Typography.captionMedium, letterSpacing: 0.5 },
  wantTitle: { ...Typography.cardTitleLarge },
  wantMeta: { ...Typography.caption },
  valuationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  valuationText: { ...Typography.captionMedium, color: Colors.ai },
  aiLabel: { ...Typography.micro },
  imageStrip: { marginTop: Spacing[2] },
  stripImage: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    marginRight: Spacing[2],
  },

  // Swap
  swapRow: { flexDirection: "row", alignItems: "center", gap: Spacing[3] },
  swapDivider: { flex: 1, height: 1 },
  swapIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: Layout.borderWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  // Offer section
  offerSection: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  offerLabel: { ...Typography.captionMedium, letterSpacing: 0.5 },
  offerSubtitle: { ...Typography.bodyMedium },

  loadingItems: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    paddingVertical: Spacing[4],
  },
  loadingText: { ...Typography.body },
  noItemsState: {
    alignItems: "center",
    paddingVertical: Spacing[6],
    gap: Spacing[3],
  },
  noItemsText: { ...Typography.body, textAlign: "center" },
  createListingBtn: {
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
  },
  createListingBtnText: { ...Typography.button, color: Colors.white },

  // Selectable card
  selectableCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.lg,
    padding: Spacing[3],
    gap: Spacing[3],
    ...Shadows.xs,
  },
  selectionIndicator: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  selectableImage: { width: 60, height: 60, borderRadius: Radius.md },
  selectableImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  selectableInfo: { flex: 1, gap: 3 },
  selectableTitle: { ...Typography.cardTitle },
  selectableMeta: { ...Typography.caption },

  // Message
  messageSection: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[2],
  },
  messageLabel: { ...Typography.inputLabel },
  optionalLabel: { ...Typography.caption },
  messageInput: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    ...Typography.input,
    minHeight: 80,
  },
  charCount: { ...Typography.micro, textAlign: "right" },

  // Match card
  matchCard: {
    borderRadius: Radius.lg,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  matchHeader: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },
  matchTitle: { ...Typography.bodyMedium, color: Colors.ai },
  matchValues: { flexDirection: "row", gap: Spacing[4] },
  matchValueItem: { flex: 1, gap: 4 },
  matchValueLabel: { ...Typography.caption },
  matchValueAmount: { ...Typography.sectionTitle },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreLabel: { ...Typography.caption },
  scoreValue: { ...Typography.bodyMedium },
  progressTrack: { height: 6, borderRadius: Radius.full, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: Radius.full },
  fairTradeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[2],
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  fairTradeText: { ...Typography.captionMedium },

  // CTA
  ctaBar: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
  },
  ctaBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
  },
  ctaBtnText: { ...Typography.button, color: Colors.white },
});
