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
  Trade,
  TradeItem,
  TradeOfferHistoryEntry,
  CurrentOffer,
  acceptTrade,
  cancelTrade,
  completeTrade,
  declineTrade,
  getTradeById,
} from "@/config/trades";
import { getStoredUser } from "@/config/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusConfig(status: string): {
  label: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case "negotiating":
      return { label: "Negotiating", color: "#D97706", bg: "#D9770620" };
    case "accepted":
      return {
        label: "Accepted",
        color: Colors.success,
        bg: Colors.success + "20",
      };
    case "completed":
      return { label: "Completed", color: Colors.info, bg: Colors.info + "15" };
    case "declined":
      return {
        label: "Declined",
        color: Colors.danger,
        bg: Colors.danger + "15",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        color: Colors.gray[500],
        bg: Colors.gray[100],
      };
    case "disputed":
      return {
        label: "Disputed",
        color: Colors.danger,
        bg: Colors.danger + "15",
      };
    default:
      return { label: status, color: Colors.gray[500], bg: Colors.gray[100] };
  }
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

function formatVal(item: TradeItem): string | null {
  const v = item.valuation;
  if (!v || v.status !== "completed" || !v.value_min || !v.value_max)
    return null;
  return `₦${Number(v.value_min).toLocaleString()} – ₦${Number(v.value_max).toLocaleString()}`;
}

// ─── Trade item card ──────────────────────────────────────────────────────────

interface TradeItemCardProps {
  item: TradeItem;
  label: string;
}

function TradeItemCard({ item, label }: TradeItemCardProps) {
  const theme = useAuthTheme();
  const valuation = formatVal(item);
  const primaryImage = item.primary_image ?? item.images?.[0]?.url ?? null;

  return (
    <View
      style={[
        styles.tradeItemCard,
        { backgroundColor: theme.surface, borderColor: theme.cardBorder },
      ]}
    >
      <Text style={[styles.tradeItemLabel, { color: theme.textMuted }]}>
        {label}
      </Text>
      <View style={styles.tradeItemInner}>
        {primaryImage ? (
          <Image
            source={{ uri: primaryImage }}
            style={styles.tradeItemImage}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.tradeItemImage,
              styles.tradeItemImagePlaceholder,
              { backgroundColor: Colors.gray[100] },
            ]}
          >
            <Ionicons name="image-outline" size={20} color={Colors.gray[400]} />
          </View>
        )}
        <View style={styles.tradeItemInfo}>
          <Text
            style={[styles.tradeItemTitle, { color: theme.textPrimary }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <Text style={[styles.tradeItemMeta, { color: theme.textMuted }]}>
            {conditionLabel(item.condition)}
          </Text>
          {valuation && (
            <View style={styles.valuationRow}>
              <Ionicons name="trending-up" size={11} color={Colors.ai} />
              <Text style={styles.valuationText}>{valuation}</Text>
              <Text style={[styles.aiLabel, { color: theme.textMuted }]}>
                · AI Value
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function CurrentOfferCard({ offer }: { offer: CurrentOffer }) {
  const theme = useAuthTheme();
  return (
    <View
      style={[
        styles.tradeItemCard,
        { backgroundColor: theme.surface, borderColor: theme.cardBorder },
      ]}
    >
      <Text style={[styles.tradeItemLabel, { color: theme.textMuted }]}>
        CURRENT OFFER
      </Text>
      {offer.trade_type === "cash" ? (
        <Text style={[styles.offerAmount, { color: theme.textPrimary }]}>
          {offer.cash_amount
            ? `$${Number(offer.cash_amount).toLocaleString()}`
            : "—"}
        </Text>
      ) : (
        <>
          <View style={styles.offerItemsRow}>
            {offer.offered_items.map((item) => (
              <View key={item.id} style={styles.offerItemThumb}>
                {item.primary_image ? (
                  <Image
                    source={{ uri: item.primary_image }}
                    style={styles.offerItemThumbImg}
                  />
                ) : (
                  <View
                    style={[
                      styles.offerItemThumbImg,
                      { backgroundColor: Colors.gray[100] },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>
          {offer.top_up_amount && Number(offer.top_up_amount) > 0 && (
            <Text style={[styles.offerTopUpText, { color: theme.textMuted }]}>
              Plus a cash top-up of $
              {Number(offer.top_up_amount).toLocaleString()}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function OfferHistorySection({
  history,
  currentUserId,
}: {
  history: TradeOfferHistoryEntry[];
  currentUserId: string | null;
}) {
  const theme = useAuthTheme();
  const [expanded, setExpanded] = useState(false);
  if (history.length === 0) return null;

  return (
    <View
      style={[
        styles.tradeItemCard,
        { backgroundColor: theme.surface, borderColor: theme.cardBorder },
      ]}
    >
      <TouchableOpacity
        style={styles.historyHeader}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.8}
      >
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Offer History
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.textMuted}
        />
      </TouchableOpacity>
      {expanded &&
        history.map((entry, i) => {
          const isMe = entry.offered_by === currentUserId;
          return (
            <View key={entry.id} style={styles.historyRow}>
              <Text style={[styles.historyMeta, { color: theme.textMuted }]}>
                Round {i + 1} · {isMe ? "You" : "Them"}
              </Text>
              <Text
                style={[styles.historyDetail, { color: theme.textPrimary }]}
              >
                {entry.trade_type === "cash"
                  ? entry.cash_amount
                    ? `$${Number(entry.cash_amount).toLocaleString()}`
                    : "—"
                  : `${entry.offered_item_ids.length} item(s)${
                      entry.top_up_amount && Number(entry.top_up_amount) > 0
                        ? ` + $${Number(entry.top_up_amount).toLocaleString()} top-up`
                        : ""
                    }`}
              </Text>
              <Text style={[styles.historyTime, { color: theme.textMuted }]}>
                {new Date(entry.created_at).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          );
        })}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TradeDetailScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const contentAnim = useRef(new Animated.Value(0)).current;

  // ── Load ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    getStoredUser().then((user) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const loadTrade = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getTradeById(id);
      setTrade(data);
      Animated.spring(contentAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 55,
        friction: 11,
      }).start();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.message ?? "Failed to load trade.",
      );
      goBack();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTrade();
  }, [loadTrade]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isProposer = trade?.proposer?.id === currentUserId;
  const isReceiver = trade?.receiver?.id === currentUserId;
  const otherParty = isProposer ? trade?.receiver : trade?.proposer;
  const isMyTurn =
    trade?.status === "negotiating" &&
    trade?.awaiting_response_from === currentUserId;
  const tradeTypeLabel =
    trade?.trade_type === "cash" ? "Cash Trade" : "Item Trade";

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleAccept = useCallback(() => {
    if (!id) return;
    router.push({
      pathname: "/(support-pages)/trade/[id]/agreement",
      params: { id },
    });
  }, [id]);

  const handleRebargain = useCallback(() => {
    if (!id) return;
    router.push({
      pathname: "/(support-pages)/trade/[id]/rebargain",
      params: { id },
    });
  }, [id]);
  const handleDecline = useCallback(() => {
    if (!id) return;
    Alert.alert(
      "Decline Trade",
      "Are you sure you want to decline this trade proposal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setActionLoading("decline");
            try {
              const updated = await declineTrade(id);
              setTrade((prev) => (prev ? { ...prev, ...updated } : prev));
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.response?.data?.message ?? "Failed to decline trade.",
              );
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }, [id]);
  const handleCancel = useCallback(() => {
    if (!id) return;
    Alert.alert(
      "Cancel Proposal",
      "Are you sure you want to cancel your trade proposal?",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Proposal",
          style: "destructive",
          onPress: async () => {
            setActionLoading("cancel");
            try {
              const updated = await cancelTrade(id);
              setTrade((prev) => (prev ? { ...prev, ...updated } : prev));
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.response?.data?.message ?? "Failed to cancel trade.",
              );
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }, [id]);
  const handleComplete = useCallback(() => {
    if (!id) return;
    Alert.alert(
      "Confirm Completion",
      "Confirm that you have successfully exchanged items with the other party.",
      [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setActionLoading("complete");
            try {
              const updated = await completeTrade(id);
              setTrade((prev) => (prev ? { ...prev, ...updated } : prev));
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.response?.data?.message ?? "Failed to confirm completion.",
              );
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }, [id]);

  const canChat = trade?.status === "accepted";

  const handleOpenChat = useCallback(() => {
    if (!id) return;
    if (!canChat) {
      Alert.alert("Chat Locked", "Chat unlocks once terms are agreed.");
      return;
    }
    router.push({
      pathname: "/(support-pages)/chat/[tradeId]",
      params: { tradeId: id },
    });
  }, [id, canChat]);

  const handleRate = useCallback(() => {
    if (!id) return;
    router.push({
      pathname: "/(support-pages)/trade/[id]/rate",
      params: { id },
    });
  }, [id]);

  const handleRaiseDispute = useCallback(() => {
    if (!id) return;
    router.push({
      pathname: "/(support-pages)/trade/[id]/dispute",
      params: { id },
    });
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

  if (!trade) return null;

  const { label, color, bg } = statusConfig(trade.status);

  const myConfirmed = isProposer
    ? trade.proposer_confirmed
    : trade.receiver_confirmed;
  const theirConfirmed = isProposer
    ? trade.receiver_confirmed
    : trade.proposer_confirmed;

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
            Trade Details
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: bg }]}>
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
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {trade.status === "negotiating" && (
          <>
            <View
              style={[
                styles.tradeTypeBadge,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.tradeTypeBadgeText,
                  { color: theme.textPrimary },
                ]}
              >
                {tradeTypeLabel}
              </Text>
            </View>
            <Text
              style={[
                styles.turnSubheader,
                {
                  color: isMyTurn ? "#D97706" : theme.textMuted,
                  fontWeight: isMyTurn ? "700" : "400",
                },
              ]}
            >
              {isMyTurn
                ? "Your turn to respond"
                : `Waiting for ${otherParty?.first_name}...`}
            </Text>
          </>
        )}

        {trade.status === "negotiating" && trade.current_offer && (
          <CurrentOfferCard offer={trade.current_offer} />
        )}
        {trade.status === "negotiating" && (
          <OfferHistorySection
            history={trade.offer_history ?? []}
            currentUserId={currentUserId}
          />
        )}

        {/* ── Parties ── */}
        <View
          style={[
            styles.partiesCard,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          {[trade.proposer, trade.receiver].map((party, i) => {
            const isMe = party.id === currentUserId;
            const rating = parseFloat(party.average_rating ?? "0").toFixed(1);
            return (
              <React.Fragment key={party.id}>
                {i === 1 && (
                  <View style={styles.partiesSwap}>
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
                          backgroundColor: theme.bg,
                          borderColor: theme.borderDefault,
                        },
                      ]}
                    >
                      <Ionicons
                        name="swap-vertical"
                        size={16}
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
                )}
                <View style={styles.partyRow}>
                  {party.profile_photo ? (
                    <Image
                      source={{ uri: party.profile_photo }}
                      style={styles.partyAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.partyAvatar,
                        styles.partyAvatarFallback,
                        { backgroundColor: Colors.gray[200] },
                      ]}
                    >
                      <Ionicons
                        name="person"
                        size={18}
                        color={Colors.gray[500]}
                      />
                    </View>
                  )}
                  <View style={styles.partyInfo}>
                    <Text
                      style={[styles.partyName, { color: theme.textPrimary }]}
                    >
                      {party.first_name} {party.last_name}
                      {isMe && (
                        <Text
                          style={[styles.youLabel, { color: theme.textMuted }]}
                        >
                          {" "}
                          (You)
                        </Text>
                      )}
                    </Text>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={11} color={Colors.warning} />
                      <Text
                        style={[styles.ratingText, { color: theme.textMuted }]}
                      >
                        {rating}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.partyRole, { color: theme.textMuted }]}>
                    {i === 0 ? "Proposer" : "Receiver"}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* ── Completion method ── */}
        {trade.completion_method && (
          <View
            style={[
              styles.infoRow,
              { backgroundColor: theme.surface, borderColor: theme.cardBorder },
            ]}
          >
            <Ionicons
              name={
                trade.completion_method === "meetup"
                  ? "people-outline"
                  : "car-outline"
              }
              size={16}
              color={theme.textMuted}
            />
            <Text style={[styles.infoText, { color: theme.textMuted }]}>
              Completion method:{" "}
              <Text style={[styles.infoTextBold, { color: theme.textPrimary }]}>
                {trade.completion_method === "meetup"
                  ? "In-person meetup"
                  : "Delivery"}
              </Text>
            </Text>
          </View>
        )}

        {/* ── Confirmation state ── */}
        {trade.status === "accepted" && (
          <View
            style={[
              styles.confirmationCard,
              { backgroundColor: theme.surface, borderColor: theme.cardBorder },
            ]}
          >
            <Text
              style={[styles.confirmationTitle, { color: theme.textPrimary }]}
            >
              Completion Status
            </Text>
            {[
              { label: "You", confirmed: myConfirmed },
              {
                label: otherParty ? `${otherParty.first_name}` : "Other party",
                confirmed: theirConfirmed,
              },
            ].map((p, i) => (
              <View key={i} style={styles.confirmationRow}>
                <Ionicons
                  name={p.confirmed ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={p.confirmed ? Colors.success : Colors.gray[300]}
                />
                <Text
                  style={[styles.confirmationLabel, { color: theme.textMuted }]}
                >
                  {p.label}: {p.confirmed ? "Confirmed" : "Not yet confirmed"}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Dispute banner ── */}
        {trade.dispute && (
          <TouchableOpacity
            style={[
              styles.disputeBanner,
              { backgroundColor: Colors.danger + "15" },
            ]}
            onPress={() =>
              router.push({
                pathname: "/(support-pages)/dispute/[id]",
                params: { id: trade.dispute!.id },
              })
            }
            activeOpacity={0.85}
          >
            <Ionicons name="warning-outline" size={16} color={Colors.danger} />
            <Text style={[styles.disputeText, { color: Colors.danger }]}>
              A dispute has been raised on this trade. Tap to view.
            </Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.danger} />
          </TouchableOpacity>
        )}

        {/* ── Trade items ── */}
        <View style={styles.itemsSection}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Items Being Traded
          </Text>

          {trade.proposer_items.map((item) => (
            <TradeItemCard
              key={item.id}
              item={item}
              label={`${isProposer ? "Your offer" : `${trade.proposer.first_name}'s offer`}`}
            />
          ))}

          <View style={styles.swapRow}>
            <View
              style={[
                styles.swapDividerH,
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
                size={16}
                color={theme.textPrimary}
              />
            </View>
            <View
              style={[
                styles.swapDividerH,
                { backgroundColor: theme.borderSubtle },
              ]}
            />
          </View>

          {trade.receiver_items.map((item) => (
            <TradeItemCard
              key={item.id}
              item={item}
              label={`${isReceiver ? "Your item" : `${trade.receiver.first_name}'s item`}`}
            />
          ))}
        </View>

        {/* ── Recent messages preview ── */}
        {trade.recent_messages && trade.recent_messages.length > 0 && (
          <TouchableOpacity
            style={[
              styles.messagesPreview,
              { backgroundColor: theme.surface, borderColor: theme.cardBorder },
            ]}
            onPress={handleOpenChat}
            activeOpacity={0.85}
          >
            <View style={styles.messagesPreviewHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Recent Messages
              </Text>
              <Text style={[styles.openChatText, { color: Colors.info }]}>
                Open Chat
              </Text>
            </View>
            {trade.recent_messages.slice(-2).map((msg) => {
              const isMe = msg.sender_id === currentUserId;
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messagePreviewRow,
                    { justifyContent: isMe ? "flex-end" : "flex-start" },
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      {
                        backgroundColor: isMe
                          ? Colors.primary
                          : Colors.gray[100],
                        alignSelf: isMe ? "flex-end" : "flex-start",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageBubbleText,
                        { color: isMe ? Colors.white : theme.textPrimary },
                      ]}
                    >
                      {msg.body}
                    </Text>
                  </View>
                </View>
              );
            })}
          </TouchableOpacity>
        )}
      </Animated.ScrollView>

      {/* ── Bottom action bar ── */}
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
        {/* Pending — receiver sees Accept + Decline */}
        {trade.status === "negotiating" && isMyTurn && (
          <View>
            <View style={styles.ctaRow}>
              <TouchableOpacity
                style={[
                  styles.ctaSecondary,
                  {
                    borderColor: Colors.danger,
                    opacity: actionLoading ? 0.6 : 1,
                  },
                ]}
                onPress={handleDecline}
                disabled={!!actionLoading}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.ctaSecondaryText, { color: Colors.danger }]}
                >
                  Decline
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.ctaSecondary,
                  {
                    borderColor: theme.borderDefault,
                    opacity: actionLoading ? 0.6 : 1,
                  },
                ]}
                onPress={handleRebargain}
                disabled={!!actionLoading}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.ctaSecondaryText,
                    { color: theme.textPrimary },
                  ]}
                >
                  Re-Bargain
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.ctaPrimary,
                  {
                    backgroundColor: Colors.primary,
                    opacity: actionLoading ? 0.6 : 1,
                  },
                ]}
                onPress={handleAccept}
                disabled={!!actionLoading}
                activeOpacity={0.9}
              >
                <Text style={styles.ctaPrimaryText}>Accept Terms</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.ctaSecondary,
                {
                  borderColor: theme.borderSubtle,
                  opacity: 0.5,
                  marginTop: Spacing[2],
                },
              ]}
              onPress={handleOpenChat}
              activeOpacity={0.85}
            >
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={theme.textMuted}
              />
              <Text
                style={[styles.ctaSecondaryText, { color: theme.textMuted }]}
              >
                Chat unlocks once terms are agreed
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {trade.status === "negotiating" && !isMyTurn && (
          <View>
            <View
              style={[
                styles.waitingBadge,
                { backgroundColor: Colors.warning + "20" },
              ]}
            >
              <Text style={[styles.waitingText, { color: Colors.warning }]}>
                Awaiting {otherParty?.first_name}'s response.
              </Text>
            </View>
            {isProposer && (
              <TouchableOpacity
                style={[
                  styles.ctaSecondary,
                  {
                    borderColor: Colors.danger,
                    marginTop: Spacing[2],
                    opacity: actionLoading ? 0.6 : 1,
                  },
                ]}
                onPress={handleCancel}
                disabled={!!actionLoading}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.ctaSecondaryText, { color: Colors.danger }]}
                >
                  Cancel Proposal
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.ctaSecondary,
                {
                  borderColor: theme.borderSubtle,
                  opacity: 0.5,
                  marginTop: Spacing[2],
                },
              ]}
              onPress={handleOpenChat}
              activeOpacity={0.85}
            >
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={theme.textMuted}
              />
              <Text
                style={[styles.ctaSecondaryText, { color: theme.textMuted }]}
              >
                Chat unlocks once terms are agreed
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Accepted — Open Chat + Mark Complete */}
        {trade.status === "accepted" && (
          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={[
                styles.ctaSecondary,
                { borderColor: theme.borderDefault },
              ]}
              onPress={handleOpenChat}
              activeOpacity={0.85}
            >
              <Ionicons
                name="chatbubble-outline"
                size={16}
                color={theme.textPrimary}
              />
              <Text
                style={[styles.ctaSecondaryText, { color: theme.textPrimary }]}
              >
                Chat
              </Text>
            </TouchableOpacity>
            {!myConfirmed && (
              <TouchableOpacity
                style={[
                  styles.ctaPrimary,
                  {
                    backgroundColor: Colors.primary,
                    opacity: actionLoading ? 0.6 : 1,
                  },
                ]}
                onPress={handleComplete}
                disabled={!!actionLoading}
                activeOpacity={0.9}
              >
                {actionLoading === "complete" ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.ctaPrimaryText}>Mark Complete</Text>
                )}
              </TouchableOpacity>
            )}
            {myConfirmed && !theirConfirmed && (
              <View
                style={[
                  styles.waitingBadge,
                  { backgroundColor: Colors.warning + "20" },
                ]}
              >
                <Text style={[styles.waitingText, { color: Colors.warning }]}>
                  Waiting for {otherParty?.first_name} to confirm
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Completed — Rate + Dispute */}
        {trade.status === "completed" && (
          <View style={styles.ctaRow}>
            {!trade.dispute && (
              <TouchableOpacity
                style={[styles.ctaSecondary, { borderColor: Colors.danger }]}
                onPress={handleRaiseDispute}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.ctaSecondaryText, { color: Colors.danger }]}
                >
                  Raise Dispute
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.ctaPrimary, { backgroundColor: Colors.primary }]}
              onPress={handleRate}
              activeOpacity={0.9}
            >
              <Ionicons name="star-outline" size={16} color={Colors.white} />
              <Text style={styles.ctaPrimaryText}>Rate Trade</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Accepted — can also raise dispute */}
        {trade.status === "accepted" && !trade.dispute && (
          <TouchableOpacity
            style={styles.disputeLink}
            onPress={handleRaiseDispute}
            activeOpacity={0.7}
          >
            <Text style={[styles.disputeLinkText, { color: Colors.danger }]}>
              Raise a dispute
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
    paddingHorizontal: Spacing[3],
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusText: { ...Typography.captionMedium },

  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
    gap: Spacing[4],
  },

  // Parties card
  partiesCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  partiesSwap: { flexDirection: "row", alignItems: "center", gap: Spacing[3] },
  swapDivider: { flex: 1, height: 1 },
  swapIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: Layout.borderWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  partyRow: { flexDirection: "row", alignItems: "center", gap: Spacing[3] },
  partyAvatar: {
    width: Layout.avatarSm,
    height: Layout.avatarSm,
    borderRadius: Radius.full,
  },
  partyAvatarFallback: { alignItems: "center", justifyContent: "center" },
  partyInfo: { flex: 1 },
  partyName: { ...Typography.bodyMedium },
  youLabel: { ...Typography.body },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  ratingText: { ...Typography.caption },
  partyRole: { ...Typography.caption },

  // Info row
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

  // Confirmation card
  confirmationCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  confirmationTitle: { ...Typography.bodyMedium },
  confirmationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
  },
  confirmationLabel: { ...Typography.body },

  // Dispute banner
  disputeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
  },
  disputeText: { ...Typography.bodyMedium, flex: 1 },

  // Items section
  itemsSection: { gap: Spacing[3] },
  sectionTitle: { ...Typography.sectionTitle },
  tradeItemCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[3],
    gap: Spacing[2],
  },
  tradeItemLabel: { ...Typography.captionMedium, letterSpacing: 0.3 },
  tradeItemInner: {
    flexDirection: "row",
    gap: Spacing[3],
    alignItems: "center",
  },
  tradeItemImage: { width: 72, height: 72, borderRadius: Radius.md },
  tradeItemImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  tradeItemInfo: { flex: 1, gap: 3 },
  tradeItemTitle: { ...Typography.cardTitle },
  tradeItemMeta: { ...Typography.caption },
  valuationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  valuationText: { ...Typography.captionMedium, color: Colors.ai },
  aiLabel: { ...Typography.micro },

  swapRow: { flexDirection: "row", alignItems: "center", gap: Spacing[3] },
  swapDividerH: { flex: 1, height: 1 },

  // Messages preview
  messagesPreview: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  messagesPreviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  openChatText: { ...Typography.captionMedium },
  messagePreviewRow: { flexDirection: "row" },
  messageBubble: {
    maxWidth: "75%",
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.lg,
  },
  messageBubbleText: { ...Typography.body },

  // CTA bar
  ctaBar: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
    gap: Spacing[2],
  },
  ctaRow: { flexDirection: "row", gap: Spacing[3] },
  ctaSecondary: {
    flex: 1,
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
  },
  ctaSecondaryText: { ...Typography.button },
  ctaPrimary: {
    flex: 1,
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
  },
  ctaPrimaryText: { ...Typography.button, color: Colors.white },
  waitingBadge: {
    flex: 1,
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing[3],
  },
  waitingText: { ...Typography.captionMedium, textAlign: "center" },
  disputeLink: { alignItems: "center", paddingVertical: Spacing[1] },
  disputeLinkText: { ...Typography.caption, textDecorationLine: "underline" },
  tradeTypeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1],
    borderRadius: Radius.md,
    borderWidth: Layout.borderWidth,
  },
  tradeTypeBadgeText: { ...Typography.captionMedium },
  turnSubheader: { ...Typography.body },
  offerAmount: { fontSize: 28, fontWeight: "700" },
  offerItemsRow: {
    flexDirection: "row",
    gap: Spacing[2],
    marginTop: Spacing[2],
  },
  offerItemThumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  offerItemThumbImg: { width: "100%", height: "100%" },
  offerTopUpText: { ...Typography.caption, marginTop: Spacing[2] },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyRow: { paddingTop: Spacing[3], gap: 2 },
  historyMeta: { ...Typography.captionMedium },
  historyDetail: { ...Typography.body },
  historyTime: { ...Typography.micro },
});
