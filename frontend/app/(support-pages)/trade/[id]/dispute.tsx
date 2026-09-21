import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { Colors, Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Trade, getTradeById } from "@/config/trades";
import api from "@/config/api";

// ─── API ──────────────────────────────────────────────────────────────────────

async function raiseDispute(payload: {
  trade_id: string;
  reason: string;
}): Promise<{ id: string; status: string; reason: string }> {
  const response = await api.post("/disputes", payload);
  return response.data.data.dispute;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RaiseDisputeScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id: tradeId } = useLocalSearchParams<{ id: string }>();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [reason, setReason] = useState("");
  const [reasonFocused, setReasonFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  // ── Load trade ───────────────────────────────────────────────────────────────

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

    const load = async () => {
      if (!tradeId) return;
      try {
        const data = await getTradeById(tradeId);

        // If dispute already exists, redirect to dispute detail
        if (data.dispute) {
          router.replace({
            pathname: "/(support-pages)/dispute/[id]",
            params: { id: data.dispute.id },
          });
          return;
        }

        setTrade(data);
      } catch (err: any) {
        Alert.alert("Error", "Failed to load trade details.");
        goBack();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tradeId]);

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!tradeId || reason.trim().length < 50) return;
    setSubmitting(true);
    try {
      const dispute = await raiseDispute({
        trade_id: tradeId,
        reason: reason.trim(),
      });
      router.replace({
        pathname: "/(support-pages)/dispute/[id]",
        params: { id: dispute.id },
      });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409) {
        // Dispute already exists — navigate to it
        Alert.alert(
          "Dispute Exists",
          "An open dispute already exists for this trade.",
          [
            {
              text: "View Dispute",
              onPress: () => {
                if (trade?.dispute?.id) {
                  router.replace({
                    pathname: "/(support-pages)/dispute/[id]",
                    params: { id: trade.dispute!.id },
                  });
                } else {
                  goBack();
                }
              },
            },
          ],
        );
      } else if (status === 422) {
        Alert.alert(
          "Cannot Raise Dispute",
          "Disputes can only be raised on accepted or completed trades.",
        );
      } else {
        Alert.alert(
          "Error",
          err.response?.data?.message ??
            "Failed to raise dispute. Please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [tradeId, reason, trade]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const isValid = reason.trim().length >= 50;
  const charCount = reason.length;
  const remaining = 50 - reason.trim().length;

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

  if (!trade) return null;

  const otherParty = trade.proposer; // Will be refined by current user check in detail screen

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
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            Raise a Dispute
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
        {/* Notice banner */}
        <View
          style={[
            styles.noticeBanner,
            {
              backgroundColor: Colors.warning + "18",
              borderColor: Colors.warning + "40",
            },
          ]}
        >
          <Ionicons name="warning-outline" size={18} color={Colors.warning} />
          <Text style={[styles.noticeText, { color: Colors.warning }]}>
            Raising a dispute will pause this trade and notify both parties. Our
            team will review and follow up.
          </Text>
        </View>

        {/* Trade summary */}
        <View
          style={[
            styles.tradeSummary,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.tradeSummaryLabel, { color: theme.textMuted }]}>
            TRADE SUMMARY
          </Text>

          <View style={styles.partiesRow}>
            <View style={styles.partyItem}>
              <Text style={[styles.partyRole, { color: theme.textMuted }]}>
                Proposer
              </Text>
              <Text style={[styles.partyName, { color: theme.textPrimary }]}>
                {trade.proposer.first_name} {trade.proposer.last_name}
              </Text>
            </View>

            <View
              style={[styles.swapIcon, { borderColor: theme.borderDefault }]}
            >
              <Ionicons
                name="swap-horizontal"
                size={14}
                color={theme.textMuted}
              />
            </View>

            <View style={[styles.partyItem, { alignItems: "flex-end" }]}>
              <Text style={[styles.partyRole, { color: theme.textMuted }]}>
                Receiver
              </Text>
              <Text style={[styles.partyName, { color: theme.textPrimary }]}>
                {trade.receiver.first_name} {trade.receiver.last_name}
              </Text>
            </View>
          </View>

          <View
            style={[styles.statusRow, { borderTopColor: theme.borderSubtle }]}
          >
            <Text style={[styles.statusLabel, { color: theme.textMuted }]}>
              Trade status:
            </Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    trade.status === "accepted"
                      ? Colors.success + "20"
                      : Colors.info + "15",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color:
                      trade.status === "accepted"
                        ? Colors.success
                        : Colors.info,
                  },
                ]}
              >
                {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Reason input */}
        <View
          style={[
            styles.reasonCard,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.reasonTitle, { color: theme.textPrimary }]}>
            Describe the Issue
          </Text>
          <Text style={[styles.reasonSubtitle, { color: theme.textMuted }]}>
            Provide a detailed description of the problem. Minimum 50 characters
            required.
          </Text>

          <TextInput
            style={[
              styles.reasonInput,
              {
                backgroundColor: reasonFocused
                  ? theme.inputBgFocused
                  : theme.inputBg,
                borderColor: reasonFocused
                  ? theme.borderFocus
                  : theme.borderDefault,
                color: theme.textPrimary,
              },
            ]}
            placeholder="Describe the issue in detail — what went wrong, what was agreed, and what actually happened..."
            placeholderTextColor={theme.textPlaceholder}
            value={reason}
            onChangeText={setReason}
            onFocus={() => setReasonFocused(true)}
            onBlur={() => setReasonFocused(false)}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />

          <View style={styles.charRow}>
            {!isValid && reason.length > 0 && (
              <Text style={[styles.charHint, { color: Colors.warning }]}>
                {remaining} more character{remaining !== 1 ? "s" : ""} needed
              </Text>
            )}
            {isValid && (
              <View style={styles.validRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={13}
                  color={Colors.success}
                />
                <Text style={[styles.charHint, { color: Colors.success }]}>
                  Minimum reached
                </Text>
              </View>
            )}
            {reason.length === 0 && <View />}
            <Text style={[styles.charCount, { color: theme.textMuted }]}>
              {charCount}/1000
            </Text>
          </View>
        </View>

        {/* What happens next */}
        <View style={[styles.infoCard, { backgroundColor: Colors.aiSurface }]}>
          <Text style={[styles.infoTitle, { color: Colors.ai }]}>
            What happens next?
          </Text>
          {[
            "Both parties will be notified of the dispute.",
            "The trade will be paused until the dispute is resolved.",
            "Our team will review the details and follow up with both parties.",
            "You can view the dispute status in the Dispute Detail screen.",
          ].map((step, i) => (
            <View key={i} style={styles.infoStep}>
              <View
                style={[styles.infoStepNum, { backgroundColor: Colors.ai }]}
              >
                <Text style={styles.infoStepNumText}>{i + 1}</Text>
              </View>
              <Text style={[styles.infoStepText, { color: Colors.ai }]}>
                {step}
              </Text>
            </View>
          ))}
        </View>
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
          style={[styles.cancelLink]}
          onPress={() => goBack()}
          activeOpacity={0.7}
        >
          <Text style={[styles.cancelText, { color: theme.textMuted }]}>
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            {
              backgroundColor:
                isValid && !submitting ? Colors.danger : theme.btnDisabled,
            },
          ]}
          onPress={handleSubmit}
          disabled={!isValid || submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="warning-outline" size={16} color={Colors.white} />
              <Text style={styles.submitBtnText}>Submit Dispute</Text>
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

  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
    gap: Spacing[4],
  },

  // Notice
  noticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  noticeText: { ...Typography.body, flex: 1, lineHeight: 21 },

  // Trade summary
  tradeSummary: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  tradeSummaryLabel: {
    ...Typography.captionMedium,
    letterSpacing: 0.5,
  },
  partiesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  partyItem: { flex: 1, gap: 3 },
  partyRole: { ...Typography.caption },
  partyName: { ...Typography.bodyMedium },
  swapIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: Layout.borderWidth,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing[2],
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: Spacing[3],
  },
  statusLabel: { ...Typography.body },
  statusBadge: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusBadgeText: { ...Typography.captionMedium },

  // Reason card
  reasonCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  reasonTitle: { ...Typography.sectionTitle },
  reasonSubtitle: { ...Typography.body },
  reasonInput: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    ...Typography.input,
    minHeight: 140,
  },
  charRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  charHint: { ...Typography.caption },
  validRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  charCount: { ...Typography.micro },

  // Info card
  infoCard: {
    borderRadius: Radius.lg,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  infoTitle: { ...Typography.bodyMedium },
  infoStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[3],
  },
  infoStepNum: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  infoStepNumText: {
    ...Typography.micro,
    color: Colors.white,
    fontWeight: "700",
  },
  infoStepText: { ...Typography.body, flex: 1, lineHeight: 21 },

  // CTA
  ctaBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
  },
  cancelLink: {
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
  },
  cancelText: { ...Typography.button },
  submitBtn: {
    flex: 1,
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
  },
  submitBtnText: { ...Typography.button, color: Colors.white },
});
