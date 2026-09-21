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
import { Colors, Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import api from "@/config/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisputeDetail {
  id: string;
  status: "open" | "under_review" | "resolved" | "closed";
  reason: string;
  resolution_notes: string | null;
  created_at: string;
  raised_by: {
    id: string;
    first_name: string;
    last_name: string;
    profile_photo: string | null;
  };
  trade: {
    id: string;
    status: string;
    proposer: { id: string; first_name: string; last_name: string };
    receiver: { id: string; first_name: string; last_name: string };
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function getDisputeById(id: string): Promise<DisputeDetail> {
  const response = await api.get(`/disputes/${id}`);
  return response.data.data.dispute;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30)
    return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? "s" : ""} ago`;
}

function statusConfig(status: DisputeDetail["status"]): {
  label: string;
  color: string;
  bg: string;
  icon: string;
} {
  switch (status) {
    case "open":
      return {
        label: "Open",
        color: Colors.danger,
        bg: Colors.danger + "18",
        icon: "alert-circle-outline",
      };
    case "under_review":
      return {
        label: "Under Review",
        color: Colors.warning,
        bg: Colors.warning + "20",
        icon: "time-outline",
      };
    case "resolved":
      return {
        label: "Resolved",
        color: Colors.success,
        bg: Colors.success + "20",
        icon: "checkmark-circle-outline",
      };
    case "closed":
      return {
        label: "Closed",
        color: Colors.gray[500],
        bg: Colors.gray[100],
        icon: "close-circle-outline",
      };
    default:
      return {
        label: status,
        color: Colors.gray[500],
        bg: Colors.gray[100],
        icon: "help-circle-outline",
      };
  }
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DisputeDetailScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const contentAnim = useRef(new Animated.Value(0)).current;

  // ── Load ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const data = await getDisputeById(id);
        setDispute(data);
        Animated.spring(contentAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 55,
          friction: 11,
        }).start();
      } catch (err: any) {
        Alert.alert("Error", "Failed to load dispute details.");
        goBack();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

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

  if (!dispute) return null;

  const { label, color, bg, icon } = statusConfig(dispute.status);
  const raisedBy = dispute.raised_by;
  const raisedByName = `${raisedBy.first_name} ${raisedBy.last_name}`;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing[2],
            backgroundColor: theme.bg,
            borderBottomColor: theme.borderSubtle,
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
            Dispute
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: bg }]}>
            <Ionicons name={icon as any} size={11} color={color} />
            <Text style={[styles.statusText, { color }]}>{label}</Text>
          </View>
        </View>
        <View style={{ minWidth: 60 }} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        style={{ opacity: contentAnim }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing[8] },
        ]}
      >
        {/* ── Status card ── */}
        <View
          style={[
            styles.statusCard,
            { backgroundColor: bg, borderColor: color + "30" },
          ]}
        >
          <Ionicons name={icon as any} size={24} color={color} />
          <View style={styles.statusCardText}>
            <Text style={[styles.statusCardTitle, { color }]}>
              Dispute is {label}
            </Text>
            <Text style={[styles.statusCardSub, { color }]}>
              {dispute.status === "open"
                ? "Our team has been notified and will review this dispute."
                : dispute.status === "under_review"
                  ? "Our team is actively reviewing this dispute."
                  : dispute.status === "resolved"
                    ? "This dispute has been resolved. See resolution notes below."
                    : "This dispute has been closed."}
            </Text>
          </View>
        </View>

        {/* ── Trade summary ── */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.cardLabel, { color: theme.textMuted }]}>
            RELATED TRADE
          </Text>

          <View style={styles.partiesRow}>
            <View style={styles.partyItem}>
              <Text style={[styles.partyRole, { color: theme.textMuted }]}>
                Proposer
              </Text>
              <Text style={[styles.partyName, { color: theme.textPrimary }]}>
                {dispute.trade.proposer.first_name}{" "}
                {dispute.trade.proposer.last_name}
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
                {dispute.trade.receiver.first_name}{" "}
                {dispute.trade.receiver.last_name}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.viewTradeBtn,
              { borderTopColor: theme.borderSubtle },
            ]}
            onPress={() =>
              router.push({
                pathname: "/(support-pages)/trade/[id]",
                params: { id: dispute.trade.id },
              })
            }
            activeOpacity={0.8}
          >
            <Text style={[styles.viewTradeBtnText, { color: Colors.info }]}>
              View Trade Details
            </Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.info} />
          </TouchableOpacity>
        </View>

        {/* ── Raised by ── */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.cardLabel, { color: theme.textMuted }]}>
            RAISED BY
          </Text>

          <View style={styles.raisedByRow}>
            {raisedBy.profile_photo ? (
              <Image
                source={{ uri: raisedBy.profile_photo }}
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
                <Ionicons name="person" size={16} color={Colors.gray[500]} />
              </View>
            )}
            <View style={styles.raisedByInfo}>
              <Text style={[styles.raisedByName, { color: theme.textPrimary }]}>
                {raisedByName}
              </Text>
              <Text style={[styles.raisedByTime, { color: theme.textMuted }]}>
                {timeAgo(dispute.created_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Reason ── */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.cardLabel, { color: theme.textMuted }]}>
            DISPUTE REASON
          </Text>
          <Text style={[styles.reasonText, { color: theme.textPrimary }]}>
            {dispute.reason}
          </Text>
        </View>

        {/* ── Resolution notes (only if resolved) ── */}
        {dispute.status === "resolved" && dispute.resolution_notes && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: Colors.success + "10",
                borderColor: Colors.success + "30",
              },
            ]}
          >
            <View style={styles.resolutionHeader}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={Colors.success}
              />
              <Text style={[styles.cardLabel, { color: Colors.success }]}>
                RESOLUTION NOTES
              </Text>
            </View>
            <Text style={[styles.reasonText, { color: theme.textPrimary }]}>
              {dispute.resolution_notes}
            </Text>
          </View>
        )}

        {/* ── What happens next (only if open/under review) ── */}
        {(dispute.status === "open" || dispute.status === "under_review") && (
          <View
            style={[styles.infoCard, { backgroundColor: Colors.aiSurface }]}
          >
            <Text style={[styles.infoTitle, { color: Colors.ai }]}>
              What happens next?
            </Text>
            <Text style={[styles.infoBody, { color: Colors.ai }]}>
              Our team will review this dispute and contact both parties. The
              trade will remain paused until the dispute is resolved or closed.
              Thank you for your patience.
            </Text>
          </View>
        )}
      </Animated.ScrollView>
    </View>
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
  headerCenter: { flex: 1, alignItems: "center", gap: Spacing[1] },
  headerTitle: { ...Typography.sectionTitle },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing[3],
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusText: { ...Typography.micro, fontWeight: "600" },

  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
    gap: Spacing[4],
  },

  // Status card
  statusCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  statusCardText: { flex: 1, gap: Spacing[1] },
  statusCardTitle: { ...Typography.bodyMedium },
  statusCardSub: { ...Typography.body, lineHeight: 21 },

  // Card
  card: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  cardLabel: { ...Typography.captionMedium, letterSpacing: 0.5 },

  // Parties
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

  // View trade button
  viewTradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    borderTopWidth: 1,
    paddingTop: Spacing[3],
  },
  viewTradeBtnText: { ...Typography.captionMedium },

  // Raised by
  raisedByRow: { flexDirection: "row", alignItems: "center", gap: Spacing[3] },
  avatar: {
    width: Layout.avatarSm,
    height: Layout.avatarSm,
    borderRadius: Radius.full,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  raisedByInfo: { flex: 1, gap: 3 },
  raisedByName: { ...Typography.bodyMedium },
  raisedByTime: { ...Typography.caption },

  // Reason
  reasonText: { ...Typography.body, lineHeight: 22 },

  // Resolution
  resolutionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
  },

  // Info card
  infoCard: {
    borderRadius: Radius.lg,
    padding: Spacing[4],
    gap: Spacing[2],
  },
  infoTitle: { ...Typography.bodyMedium },
  infoBody: { ...Typography.body, lineHeight: 22 },
});
