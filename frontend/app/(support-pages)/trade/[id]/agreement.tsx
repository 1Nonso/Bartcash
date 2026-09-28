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
import { Trade, acceptTrade, getTradeById } from "@/config/trades";
import { getStoredUser } from "@/config/auth";

type CompletionMethod = "meetup" | "delivery";

export default function TradeAgreementScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [method, setMethod] = useState<CompletionMethod | null>(null);
  const [details, setDetails] = useState("");

  useEffect(() => {
    getStoredUser().then((user) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    getTradeById(id)
      .then(setTrade)
      .catch(() => {
        Alert.alert("Error", "Failed to load trade.");
        goBack();
      })
      .finally(() => setLoading(false));
  }, [id]);

  const isProposer = trade?.proposer?.id === currentUserId;
  const myLabel =
    trade?.trade_type === "cash"
      ? isProposer
        ? "You will pay"
        : "You will receive"
      : null;

  const isValid = method !== null && details.trim().length > 0;

  const handleConfirm = useCallback(async () => {
    if (!id || !method || !details.trim()) return;
    setSubmitting(true);
    try {
      await acceptTrade(id, method, {
        [method === "meetup" ? "meetup_details" : "delivery_details"]:
          details.trim(),
      });
      router.replace({
        pathname: "/(support-pages)/trade/[id]",
        params: { id },
      });
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.message ?? "Failed to accept trade.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [id, method, details]);

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

  if (!trade) return null;

  const offer = trade.current_offer;

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
          Accept Trade Terms
        </Text>
        <View style={{ minWidth: 60 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 140 },
        ]}
      >
        {/* Trade type badge */}
        <View
          style={[
            styles.badge,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.badgeText, { color: theme.textPrimary }]}>
            {trade.trade_type === "cash" ? "Cash Trade" : "Item Trade"}
          </Text>
        </View>

        {/* Cash mode */}
        {trade.trade_type === "cash" && offer && (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.cardLabel, { color: theme.textMuted }]}>
              {myLabel}
            </Text>
            <Text style={[styles.cashAmount, { color: "#0F766E" }]}>
              {offer.cash_amount
                ? `₦${Number(offer.cash_amount).toLocaleString()}`
                : "—"}
            </Text>
          </View>
        )}

        {/* Item mode */}
        {trade.trade_type === "item" && (
          <View style={styles.itemsRow}>
            <View
              style={[
                styles.card,
                styles.itemsCol,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.cardLabel, { color: theme.textMuted }]}>
                {isProposer
                  ? "Your items"
                  : `${trade.proposer.first_name}'s items`}
              </Text>
              {trade.proposer_items.map((item) => (
                <View key={item.id} style={styles.itemMini}>
                  {item.primary_image ? (
                    <Image
                      source={{ uri: item.primary_image }}
                      style={styles.itemMiniImg}
                    />
                  ) : (
                    <View
                      style={[
                        styles.itemMiniImg,
                        { backgroundColor: Colors.gray[100] },
                      ]}
                    />
                  )}
                  <Text
                    style={[styles.itemMiniTitle, { color: theme.textPrimary }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={[
                styles.card,
                styles.itemsCol,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.cardLabel, { color: theme.textMuted }]}>
                {isProposer
                  ? `${trade.receiver.first_name}'s item`
                  : "Your item"}
              </Text>
              {trade.receiver_items.map((item) => (
                <View key={item.id} style={styles.itemMini}>
                  {item.primary_image ? (
                    <Image
                      source={{ uri: item.primary_image }}
                      style={styles.itemMiniImg}
                    />
                  ) : (
                    <View
                      style={[
                        styles.itemMiniImg,
                        { backgroundColor: Colors.gray[100] },
                      ]}
                    />
                  )}
                  <Text
                    style={[styles.itemMiniTitle, { color: theme.textPrimary }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {trade.trade_type === "item" &&
          offer?.top_up_amount &&
          Number(offer.top_up_amount) > 0 && (
            <View
              style={[
                styles.infoRow,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Ionicons name="cash-outline" size={16} color={theme.textMuted} />
              <Text style={[styles.infoText, { color: theme.textMuted }]}>
                Plus a cash top-up of{" "}
                <Text
                  style={[styles.infoTextBold, { color: theme.textPrimary }]}
                >
                  ₦{Number(offer.top_up_amount).toLocaleString()}
                </Text>
              </Text>
            </View>
          )}

        {/* Completion method */}
        <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>
          Completion Method <Text style={{ color: Colors.danger }}>*</Text>
        </Text>
        <View style={styles.methodRow}>
          {(["meetup", "delivery"] as CompletionMethod[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.methodChip,
                {
                  backgroundColor:
                    method === m ? Colors.primary : theme.inputBg,
                  borderColor:
                    method === m ? Colors.primary : theme.borderDefault,
                },
              ]}
              onPress={() => {
                setMethod(m);
                setDetails("");
              }}
              activeOpacity={0.85}
            >
              <Ionicons
                name={m === "meetup" ? "people-outline" : "car-outline"}
                size={16}
                color={method === m ? Colors.white : theme.textPrimary}
              />
              <Text
                style={[
                  styles.methodChipText,
                  { color: method === m ? Colors.white : theme.textPrimary },
                ]}
              >
                {m === "meetup" ? "Meetup" : "Delivery"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {method && (
          <View style={{ marginTop: Spacing[3] }}>
            <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
              {method === "meetup"
                ? "Meetup location & time"
                : "Delivery address & instructions"}
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
              placeholder={
                method === "meetup"
                  ? "e.g. Saturday 2pm, Ikeja City Mall entrance"
                  : "e.g. Full address and any delivery notes"
              }
              placeholderTextColor={theme.textPlaceholder}
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Chat unlock notice */}
        <View style={[styles.noticeBox, { backgroundColor: Colors.aiSurface }]}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={16}
            color={Colors.ai}
          />
          <Text style={[styles.noticeText, { color: Colors.ai }]}>
            Chat will open after you accept to arrange logistics.
          </Text>
        </View>
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
            styles.confirmBtn,
            {
              backgroundColor:
                isValid && !submitting ? Colors.primary : theme.btnDisabled,
            },
          ]}
          onPress={handleConfirm}
          disabled={!isValid || submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.confirmBtnText}>Accept & Open Chat</Text>
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
    gap: Spacing[4],
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1],
    borderRadius: Radius.md,
    borderWidth: Layout.borderWidth,
  },
  badgeText: { ...Typography.captionMedium },
  card: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[2],
  },
  cardLabel: { ...Typography.captionMedium },
  cashAmount: { fontSize: 32, fontWeight: "700" },
  itemsRow: { flexDirection: "row", gap: Spacing[3] },
  itemsCol: { flex: 1 },
  itemMini: { gap: Spacing[1] },
  itemMiniImg: { width: "100%", height: 70, borderRadius: Radius.md },
  itemMiniTitle: { ...Typography.caption },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
  },
  infoText: { ...Typography.body, flex: 1 },
  infoTextBold: { ...Typography.bodyMedium },
  sectionLabel: { ...Typography.inputLabel },
  methodRow: { flexDirection: "row", gap: Spacing[3] },
  methodChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
  },
  methodChipText: { ...Typography.captionMedium },
  fieldLabel: { ...Typography.inputLabel, marginBottom: Spacing[2] },
  textarea: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    ...Typography.input,
    minHeight: 80,
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
  },
  noticeText: { ...Typography.micro, flex: 1 },
  ctaBar: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
    gap: Spacing[2],
  },
  cancelLink: { alignItems: "center", paddingVertical: Spacing[1] },
  cancelLinkText: { ...Typography.caption, textDecorationLine: "underline" },
  confirmBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: { ...Typography.button, color: Colors.white },
});
