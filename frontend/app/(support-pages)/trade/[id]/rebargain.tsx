import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Colors, Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Trade, rebargainTrade, getTradeById } from "@/config/trades";
import { ItemDetail, getMyItems } from "@/config/items";
import { getStoredUser } from "@/config/auth";

export default function ReBargainScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [myItems, setMyItems] = useState<ItemDetail[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [cashAmount, setCashAmount] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [topUp, setTopUp] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getStoredUser().then((user) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getTradeById(id),
      getMyItems({ status: "available", limit: 50 }),
    ])
      .then(([tradeData, myItemsData]) => {
        setTrade(tradeData);
        setMyItems(myItemsData.items);
        const offer = tradeData.current_offer;
        if (offer) {
          if (offer.trade_type === "cash" && offer.cash_amount) {
            setCashAmount(String(Number(offer.cash_amount)));
          }
          if (offer.trade_type === "item") {
            setSelectedItemIds(offer.offered_items.map((i) => i.id));
            if (offer.top_up_amount)
              setTopUp(String(Number(offer.top_up_amount)));
          }
        }
      })
      .catch(() => {
        Alert.alert("Error", "Failed to load trade.");
        goBack();
      })
      .finally(() => setLoading(false));
  }, [id]);

  const toggleItem = useCallback((itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((i) => i !== itemId)
        : [...prev, itemId],
    );
  }, []);

  const offer = trade?.current_offer;
  const isCash = trade?.trade_type === "cash";

  // Has anything actually changed from the current offer?
  const hasChanged = (() => {
    if (!offer) return false;
    if (isCash) {
      const original = offer.cash_amount ? Number(offer.cash_amount) : 0;
      const current = parseFloat(cashAmount) || 0;
      return current !== original && cashAmount.trim() !== "";
    }
    const originalIds = [...offer.offered_items.map((i) => i.id)].sort();
    const currentIds = [...selectedItemIds].sort();
    const itemsChanged =
      JSON.stringify(originalIds) !== JSON.stringify(currentIds);
    const originalTopUp = offer.top_up_amount ? Number(offer.top_up_amount) : 0;
    const currentTopUp = parseFloat(topUp) || 0;
    const topUpChanged = currentTopUp !== originalTopUp;
    return itemsChanged || topUpChanged;
  })();

  const isValid =
    hasChanged &&
    (isCash ? parseFloat(cashAmount) > 0 : selectedItemIds.length > 0);

  const theirItemValue = (() => {
    if (!trade) return null;
    const theirItems =
      currentUserId === trade.proposer.id
        ? trade.receiver_items
        : trade.proposer_items;
    const item = theirItems[0];
    if (!item?.valuation || item.valuation.status !== "completed") return null;
    if (!item.valuation.value_min || !item.valuation.value_max) return null;
    return (
      (Number(item.valuation.value_min) + Number(item.valuation.value_max)) / 2
    );
  })();

  const myOfferValue = (() => {
    if (isCash) return parseFloat(cashAmount) || 0;
    const selected = myItems.filter((i) => selectedItemIds.includes(i.id));
    const itemsTotal = selected.reduce((sum, i) => {
      if (!i.valuation?.value_min || !i.valuation?.value_max) return sum;
      return (
        sum +
        (Number(i.valuation.value_min) + Number(i.valuation.value_max)) / 2
      );
    }, 0);
    return itemsTotal + (parseFloat(topUp) || 0);
  })();

  const valueDiff =
    theirItemValue !== null ? myOfferValue - theirItemValue : null;

  const handleSubmit = useCallback(async () => {
    if (!id || !isValid) return;
    setSubmitting(true);
    try {
      await rebargainTrade(id, {
        cash_amount: isCash ? parseFloat(cashAmount) : undefined,
        offered_item_ids: !isCash ? selectedItemIds : undefined,
        top_up_amount: !isCash ? parseFloat(topUp) || 0 : undefined,
        message: message.trim() || undefined,
      });
      router.replace({
        pathname: "/(support-pages)/trade/[id]",
        params: { id },
      });
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.message ?? "Failed to submit counter-offer.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [id, isValid, isCash, cashAmount, selectedItemIds, topUp, message]);

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

  if (!trade || !offer) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing[2],
            borderBottomColor: theme.borderSubtle,
            backgroundColor: theme.bg,
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
          Counter-Offer
        </Text>
        <View style={{ minWidth: 60 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 140 },
        ]}
      >
        {/* Current offer — read only */}
        <View
          style={[
            styles.currentCard,
            {
              backgroundColor: Colors.gray[50],
              borderColor: theme.borderSubtle,
            },
          ]}
        >
          <Text style={[styles.currentLabel, { color: theme.textMuted }]}>
            Current Offer
          </Text>
          {isCash ? (
            <Text style={[styles.currentValue, { color: theme.textMuted }]}>
              {offer.cash_amount
                ? `$${Number(offer.cash_amount).toLocaleString()}`
                : "—"}
            </Text>
          ) : (
            <>
              <View style={styles.currentItemsRow}>
                {offer.offered_items.map((item) => (
                  <View key={item.id} style={styles.currentItemThumb}>
                    {item.primary_image ? (
                      <Image
                        source={{ uri: item.primary_image }}
                        style={styles.currentItemImg}
                      />
                    ) : (
                      <View
                        style={[
                          styles.currentItemImg,
                          { backgroundColor: Colors.gray[200] },
                        ]}
                      />
                    )}
                  </View>
                ))}
              </View>
              {offer.top_up_amount && Number(offer.top_up_amount) > 0 && (
                <Text
                  style={[
                    styles.currentValue,
                    { color: theme.textMuted, fontSize: 14 },
                  ]}
                >
                  + ₦{Number(offer.top_up_amount).toLocaleString()} top-up
                </Text>
              )}
            </>
          )}
        </View>

        {theirItemValue !== null && (
          <View
            style={[styles.aiReference, { backgroundColor: Colors.aiSurface }]}
          >
            <Ionicons name="sparkles" size={14} color={Colors.ai} />
            <Text style={[styles.aiReferenceText, { color: Colors.ai }]}>
              Their item's AI value: ₦{theirItemValue.toLocaleString()}
            </Text>
          </View>
        )}

        {/* Cash mode */}
        {isCash && (
          <View>
            <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
              Your counter offer
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.borderDefault,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="Enter amount ($)"
              placeholderTextColor={theme.textPlaceholder}
              value={cashAmount}
              onChangeText={setCashAmount}
              keyboardType="numeric"
            />
          </View>
        )}

        {/* Item mode */}
        {!isCash && (
          <View>
            <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
              Your items
            </Text>
            {myItems.map((item) => {
              const selected = selectedItemIds.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.selectableCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: selected ? Colors.primary : theme.cardBorder,
                      borderWidth: selected ? 2 : Layout.borderWidth,
                    },
                  ]}
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.selectionIndicator,
                      {
                        backgroundColor: selected
                          ? Colors.primary
                          : "transparent",
                        borderColor: selected
                          ? Colors.primary
                          : theme.borderDefault,
                      },
                    ]}
                  >
                    {selected && (
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={Colors.white}
                      />
                    )}
                  </View>
                  {item.images?.[0]?.url ? (
                    <Image
                      source={{ uri: item.images[0].url }}
                      style={styles.selectableImg}
                    />
                  ) : (
                    <View
                      style={[
                        styles.selectableImg,
                        { backgroundColor: Colors.gray[100] },
                      ]}
                    />
                  )}
                  <Text
                    style={[
                      styles.selectableTitle,
                      { color: theme.textPrimary },
                    ]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <Text
              style={[
                styles.fieldLabel,
                { color: theme.textPrimary, marginTop: Spacing[4] },
              ]}
            >
              Cash top-up (optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.borderDefault,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="₦0"
              placeholderTextColor={theme.textPlaceholder}
              value={topUp}
              onChangeText={setTopUp}
              keyboardType="numeric"
            />
          </View>
        )}

        {/* Value difference indicator */}
        {theirItemValue !== null && valueDiff !== null && (
          <View
            style={[
              styles.diffBox,
              {
                backgroundColor:
                  valueDiff >= 0
                    ? Colors.success + "15"
                    : Colors.warning + "15",
              },
            ]}
          >
            <Ionicons
              name={valueDiff >= 0 ? "trending-up" : "trending-down"}
              size={14}
              color={valueDiff >= 0 ? Colors.success : Colors.warning}
            />
            <Text
              style={[
                styles.diffText,
                { color: valueDiff >= 0 ? Colors.success : Colors.warning },
              ]}
            >
              Your offer is ₦{Math.abs(valueDiff).toLocaleString()}{" "}
              {valueDiff >= 0 ? "above" : "below"} their item's value
            </Text>
          </View>
        )}

        {!hasChanged && (
          <Text style={[styles.noChangeNote, { color: theme.textMuted }]}>
            Your counter-offer must differ from the current terms.
          </Text>
        )}

        {/* Message */}
        <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
          Explain your counter-offer{" "}
          <Text style={{ color: theme.textMuted }}>(optional)</Text>
        </Text>
        <TextInput
          style={[
            styles.textarea,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.borderDefault,
              color: theme.textPrimary,
            },
          ]}
          placeholder="Let them know why you're countering..."
          placeholderTextColor={theme.textPlaceholder}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
      </ScrollView>

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
          onPress={() => goBack()}
          style={styles.cancelLink}
          activeOpacity={0.7}
        >
          <Text style={[styles.cancelLinkText, { color: theme.textMuted }]}>
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            {
              backgroundColor:
                isValid && !submitting ? Colors.primary : theme.btnDisabled,
            },
          ]}
          onPress={handleSubmit}
          disabled={!isValid || submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>Submit Counter-Offer</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
  headerTitle: {
    ...Typography.sectionTitle,
    flex: 1,
    textAlign: "center",
    marginRight: 60,
  },
  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
    gap: Spacing[3],
  },
  currentCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[2],
    opacity: 0.75,
  },
  currentLabel: { ...Typography.captionMedium, letterSpacing: 0.3 },
  currentValue: { fontSize: 22, fontWeight: "700" },
  currentItemsRow: { flexDirection: "row", gap: Spacing[2] },
  currentItemThumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  currentItemImg: { width: "100%", height: "100%" },
  aiReference: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[2],
    borderRadius: Radius.sm,
  },
  aiReferenceText: { ...Typography.micro },
  fieldLabel: { ...Typography.inputLabel, marginBottom: Spacing[2] },
  input: {
    height: Layout.inputHeight,
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    ...Typography.input,
  },
  selectableCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.lg,
    padding: Spacing[3],
    gap: Spacing[3],
    marginBottom: Spacing[2],
  },
  selectionIndicator: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  selectableImg: { width: 48, height: 48, borderRadius: Radius.md },
  selectableTitle: { ...Typography.body, flex: 1 },
  diffBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
  },
  diffText: { ...Typography.micro, flex: 1 },
  noChangeNote: { ...Typography.caption, fontStyle: "italic" },
  textarea: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    ...Typography.input,
    minHeight: 80,
  },
  ctaBar: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
    gap: Spacing[2],
  },
  cancelLink: { alignItems: "center", paddingVertical: Spacing[1] },
  cancelLinkText: { ...Typography.caption, textDecorationLine: "underline" },
  submitBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: { ...Typography.button, color: Colors.white },
});
