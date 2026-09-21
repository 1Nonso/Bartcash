/**
 * Bartcash — Chat Thread Screen
 * app/(support-pages)/chat/[tradeId].tsx
 *
 * In-app messaging between two trade participants.
 *
 * Features:
 *  - Message list (own right-aligned, other left-aligned)
 *  - 5-second polling for new messages
 *  - Optimistic message send with error state + retry
 *  - Read receipts on own messages (single tick sent, double tick read)
 *  - Date separator dividers
 *  - Pinned collapsible trade summary card at top
 *  - Keyboard-aware layout
 *  - Input disabled when trade is closed
 *  - Cursor pagination for older messages (scroll to top)
 *  - Mark messages as read on mount
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import {
  Trade,
  TradeMessage,
  getTradeById,
  getTradeMessages,
  markMessagesRead,
  sendTradeMessage,
} from "@/config/trades";

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 5000;
const USER_KEY = "bartcash_user";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageStatus = "sending" | "sent" | "failed";

interface LocalMessage extends TradeMessage {
  _status?: MessageStatus;
  _localId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function isClosedTrade(status: string): boolean {
  return ["completed", "cancelled", "declined", "disputed"].includes(status);
}

function getTradeStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Pending",
    accepted: "Active",
    completed: "Completed",
    cancelled: "Cancelled",
    declined: "Declined",
    disputed: "Disputed",
  };
  return map[status] ?? status;
}

function getTradeStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: Colors.warning,
    accepted: Colors.success,
    completed: Colors.ai,
    cancelled: Colors.text.tertiary,
    declined: Colors.danger,
    disputed: Colors.danger,
  };
  return map[status] ?? Colors.text.tertiary;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface DateDividerProps {
  label: string;
}
function DateDivider({ label }: DateDividerProps) {
  const theme = useAuthTheme();
  return (
    <View style={styles.dateDivider}>
      <View
        style={[
          styles.dateDividerLine,
          { backgroundColor: theme.borderSubtle },
        ]}
      />
      <Text style={[styles.dateDividerText, { color: theme.textMuted }]}>
        {label}
      </Text>
      <View
        style={[
          styles.dateDividerLine,
          { backgroundColor: theme.borderSubtle },
        ]}
      />
    </View>
  );
}

interface MessageBubbleProps {
  message: LocalMessage;
  isOwn: boolean;
  showAvatar: boolean;
  otherPartyPhoto: string | null;
  otherPartyName: string;
  onRetry: (localId: string) => void;
}

function MessageBubble({
  message,
  isOwn,
  showAvatar,
  otherPartyPhoto,
  otherPartyName,
  onRetry,
}: MessageBubbleProps) {
  const theme = useAuthTheme();
  const isFailed = message._status === "failed";
  const isSending = message._status === "sending";

  return (
    <View
      style={[
        styles.bubbleRow,
        isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther,
      ]}
    >
      {/* Other party avatar (left side) */}
      {!isOwn && (
        <View style={styles.avatarSlot}>
          {showAvatar ? (
            otherPartyPhoto ? (
              <Image
                source={{ uri: otherPartyPhoto }}
                style={styles.bubbleAvatar}
              />
            ) : (
              <View
                style={[
                  styles.bubbleAvatar,
                  styles.avatarFallback,
                  { backgroundColor: Colors.primary },
                ]}
              >
                <Text style={styles.avatarFallbackText}>
                  {otherPartyName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )
          ) : (
            <View style={styles.avatarPlaceholder} />
          )}
        </View>
      )}

      <View
        style={[
          styles.bubbleContainer,
          isOwn ? styles.bubbleContainerOwn : styles.bubbleContainerOther,
        ]}
      >
        {/* Bubble */}
        <Pressable
          onPress={
            isFailed && message._localId
              ? () => onRetry(message._localId!)
              : undefined
          }
          style={[
            styles.bubble,
            isOwn
              ? [styles.bubbleOwn, { backgroundColor: Colors.primary }]
              : [
                  styles.bubbleOther,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.borderSubtle,
                  },
                ],
            isFailed && styles.bubbleFailed,
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              {
                color: isOwn ? Colors.white : theme.textPrimary,
                opacity: isSending ? 0.6 : 1,
              },
            ]}
          >
            {message.body}
          </Text>
        </Pressable>

        {/* Timestamp + read receipt row */}
        <View
          style={[
            styles.bubbleMeta,
            isOwn ? styles.bubbleMetaOwn : styles.bubbleMetaOther,
          ]}
        >
          {isFailed ? (
            <View style={styles.failedRow}>
              <Ionicons
                name="alert-circle-outline"
                size={12}
                color={Colors.danger}
              />
              <Text style={[styles.failedText, { color: Colors.danger }]}>
                Failed · Tap to retry
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.bubbleTime, { color: theme.textMuted }]}>
                {message.created_at ? formatTime(message.created_at) : ""}
              </Text>
              {isOwn && (
                <Ionicons
                  name={
                    isSending
                      ? "time-outline"
                      : message.read_at
                        ? "checkmark-done"
                        : "checkmark"
                  }
                  size={13}
                  color={
                    isSending
                      ? theme.textMuted
                      : message.read_at
                        ? Colors.info
                        : theme.textMuted
                  }
                />
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Trade Summary Card ───────────────────────────────────────────────────────

interface TradeSummaryCardProps {
  trade: Trade;
  currentUserId: string;
  onPress: () => void;
}

function TradeSummaryCard({
  trade,
  currentUserId,
  onPress,
}: TradeSummaryCardProps) {
  const theme = useAuthTheme();
  const [collapsed, setCollapsed] = useState(false);
  const statusColor = getTradeStatusColor(trade.status);

  const myItems =
    trade.proposer.id === currentUserId
      ? trade.proposer_items
      : trade.receiver_items;
  const theirItems =
    trade.proposer.id === currentUserId
      ? trade.receiver_items
      : trade.proposer_items;

  return (
    <View
      style={[
        styles.tradeSummaryCard,
        { backgroundColor: theme.surface, borderColor: theme.borderSubtle },
      ]}
    >
      {/* Header row */}
      <TouchableOpacity
        style={styles.tradeSummaryHeader}
        onPress={() => setCollapsed((c) => !c)}
        activeOpacity={0.8}
      >
        <View style={styles.tradeSummaryLeft}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text
            style={[styles.tradeSummaryStatus, { color: theme.textPrimary }]}
          >
            Trade · {getTradeStatusLabel(trade.status)}
          </Text>
        </View>
        <View style={styles.tradeSummaryRight}>
          <TouchableOpacity
            onPress={onPress}
            style={styles.viewTradeLink}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewTradeLinkText, { color: Colors.info }]}>
              View
            </Text>
          </TouchableOpacity>
          <Ionicons
            name={collapsed ? "chevron-down" : "chevron-up"}
            size={16}
            color={theme.textMuted}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded: item thumbnails */}
      {!collapsed && (
        <View style={styles.tradeSummaryBody}>
          {/* My side */}
          <View style={styles.tradeSummaryColumn}>
            <Text
              style={[styles.tradeSummaryLabel, { color: theme.textMuted }]}
            >
              Your offer
            </Text>
            <View style={styles.tradeSummaryImages}>
              {myItems.slice(0, 3).map((item, i) => (
                <View
                  key={item.id}
                  style={[
                    styles.tradeSummaryThumb,
                    { zIndex: 3 - i, marginLeft: i > 0 ? -10 : 0 },
                  ]}
                >
                  {item.primary_image ? (
                    <Image
                      source={{ uri: item.primary_image }}
                      style={styles.tradeSummaryThumbImg}
                    />
                  ) : (
                    <View
                      style={[
                        styles.tradeSummaryThumbImg,
                        { backgroundColor: Colors.gray[200] },
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>
            <Text
              style={[
                styles.tradeSummaryItemName,
                { color: theme.textPrimary },
              ]}
              numberOfLines={1}
            >
              {myItems[0]?.title ?? "—"}
              {myItems.length > 1 ? ` +${myItems.length - 1}` : ""}
            </Text>
          </View>

          {/* Swap icon */}
          <View style={styles.tradeSummarySwap}>
            <Ionicons
              name="swap-horizontal"
              size={18}
              color={theme.textMuted}
            />
          </View>

          {/* Their side */}
          <View style={styles.tradeSummaryColumn}>
            <Text
              style={[styles.tradeSummaryLabel, { color: theme.textMuted }]}
            >
              Their offer
            </Text>
            <View style={styles.tradeSummaryImages}>
              {theirItems.slice(0, 3).map((item, i) => (
                <View
                  key={item.id}
                  style={[
                    styles.tradeSummaryThumb,
                    { zIndex: 3 - i, marginLeft: i > 0 ? -10 : 0 },
                  ]}
                >
                  {item.primary_image ? (
                    <Image
                      source={{ uri: item.primary_image }}
                      style={styles.tradeSummaryThumbImg}
                    />
                  ) : (
                    <View
                      style={[
                        styles.tradeSummaryThumbImg,
                        { backgroundColor: Colors.gray[200] },
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>
            <Text
              style={[
                styles.tradeSummaryItemName,
                { color: theme.textPrimary },
              ]}
              numberOfLines={1}
            >
              {theirItems[0]?.title ?? "—"}
              {theirItems.length > 1 ? ` +${theirItems.length - 1}` : ""}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatThreadScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { tradeId } = useLocalSearchParams<{ tradeId: string }>();

  // Current user
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Data
  const [trade, setTrade] = useState<Trade | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestMessageIdRef = useRef<string | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const inputBarAnim = useRef(new Animated.Value(0)).current;

  // ── Load current user ───────────────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(USER_KEY).then((raw) => {
      if (raw) {
        const user = JSON.parse(raw);
        setCurrentUserId(user.id);
      }
    });
  }, []);

  // ── Entrance animation ──────────────────────────────────────────────────────

  useEffect(() => {
    Animated.stagger(80, [
      Animated.spring(headerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.spring(inputBarAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
    ]).start();
  }, []);

  // ── Initial data load ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!tradeId) return;
    loadInitial();
    return () => stopPolling();
  }, [tradeId]);

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [tradeData, messagesData] = await Promise.all([
        getTradeById(tradeId!),
        getTradeMessages(tradeId!, { limit: 30 }),
      ]);
      setTrade(tradeData);
      setMessages(messagesData.messages);
      setNextCursor(messagesData.next_cursor);

      if (messagesData.messages.length > 0) {
        latestMessageIdRef.current =
          messagesData.messages[messagesData.messages.length - 1].id;
      }

      // Mark messages as read
      await markMessagesRead(tradeId!).catch(() => {});

      setError(null);
      startPolling();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load chat.");
    } finally {
      setLoading(false);
    }
  };

  // ── Polling ─────────────────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    stopPolling();
    pollTimerRef.current = setInterval(pollMessages, POLL_INTERVAL);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollMessages = useCallback(async () => {
    if (!tradeId) return;
    try {
      const data = await getTradeMessages(tradeId, { limit: 30 });
      setMessages((prev) => {
        // Only keep local-only (optimistic) messages that aren't in the server response
        const serverIds = new Set(data.messages.map((m) => m.id));
        const localOnly = prev.filter(
          (m) => m._localId && !serverIds.has(m.id),
        );
        return [...data.messages, ...localOnly];
      });

      if (data.messages.length > 0) {
        const newest = data.messages[data.messages.length - 1];
        if (newest.id !== latestMessageIdRef.current) {
          latestMessageIdRef.current = newest.id;
          // Scroll to bottom on new message
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: true }),
            100,
          );
          // Mark as read
          await markMessagesRead(tradeId).catch(() => {});
        }
      }
    } catch {
      // Silent — polling errors don't interrupt the user
    }
  }, [tradeId]);

  // ── Load older messages ─────────────────────────────────────────────────────

  const handleLoadOlder = useCallback(async () => {
    if (!nextCursor || loadingOlder || !tradeId) return;
    setLoadingOlder(true);
    try {
      const data = await getTradeMessages(tradeId, {
        cursor: nextCursor,
        limit: 30,
      });
      setMessages((prev) => [...data.messages, ...prev]);
      setNextCursor(data.next_cursor);
    } catch {
      // Silent
    } finally {
      setLoadingOlder(false);
    }
  }, [nextCursor, loadingOlder, tradeId]);

  // ── Send message ────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending || !tradeId) return;

    const localId = `local_${Date.now()}`;
    const optimisticMessage: LocalMessage = {
      id: localId,
      sender_id: currentUserId ?? "",
      body: text,
      read_at: null,
      created_at: new Date().toISOString(),
      _status: "sending",
      _localId: localId,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText("");
    setSending(false);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const sent = await sendTradeMessage(tradeId, text);
      setMessages((prev) =>
        prev.map((m) =>
          m._localId === localId
            ? { ...sent, _status: "sent" as MessageStatus }
            : m,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m._localId === localId
            ? { ...m, _status: "failed" as MessageStatus }
            : m,
        ),
      );
    }
  }, [inputText, sending, tradeId, currentUserId]);

  // ── Retry failed message ────────────────────────────────────────────────────

  const handleRetry = useCallback(
    async (localId: string) => {
      const msg = messages.find((m) => m._localId === localId);
      if (!msg || !tradeId) return;

      setMessages((prev) =>
        prev.map((m) =>
          m._localId === localId
            ? { ...m, _status: "sending" as MessageStatus }
            : m,
        ),
      );

      try {
        const sent = await sendTradeMessage(tradeId, msg.body);
        setMessages((prev) =>
          prev.map((m) =>
            m._localId === localId
              ? { ...sent, _status: "sent" as MessageStatus }
              : m,
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m._localId === localId
              ? { ...m, _status: "failed" as MessageStatus }
              : m,
          ),
        );
      }
    },
    [messages, tradeId],
  );

  // ── Navigate to trade detail ────────────────────────────────────────────────

  const handleViewTrade = useCallback(() => {
    router.push(`/(support-pages)/trade/${tradeId}`);
  }, [tradeId]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const isClosed = trade ? isClosedTrade(trade.status) : false;
  const canSend = inputText.trim().length > 0 && !isClosed;

  const otherParty = useMemo(() => {
    if (!trade || !currentUserId) return null;
    return trade.proposer.id === currentUserId
      ? trade.receiver
      : trade.proposer;
  }, [trade, currentUserId]);

  // Build message list items with date dividers
  const listData = useMemo(() => {
    const result: (| { type: "message"; data: LocalMessage }
      | { type: "divider"; label: string; key: string }
      | { type: "load-older"; key: string })[] = [];

    if (nextCursor) {
      result.push({ type: "load-older", key: "load-older" });
    }

    messages.forEach((msg, index) => {
      const prev = messages[index - 1];
      if (!prev || !isSameDay(prev.created_at, msg.created_at)) {
        result.push({
          type: "divider",
          label: formatDateLabel(msg.created_at),
          key: `divider_${msg.created_at}`,
        });
      }
      result.push({ type: "message", data: msg });
    });

    return result;
  }, [messages, nextCursor]);

  // ── Render item ─────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: (typeof listData)[number]; index: number }) => {
      if (item.type === "divider") {
        return <DateDivider label={item.label} />;
      }

      if (item.type === "load-older") {
        return (
          <TouchableOpacity
            style={styles.loadOlderBtn}
            onPress={handleLoadOlder}
            activeOpacity={0.7}
          >
            {loadingOlder ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={[styles.loadOlderText, { color: Colors.info }]}>
                Load older messages
              </Text>
            )}
          </TouchableOpacity>
        );
      }

      const msg = item.data;
      const isOwn = msg.sender_id === currentUserId;

      // Show avatar if this is the first message from other party in a consecutive run
      const prevItem = listData[index - 1];
      const prevMsg = prevItem?.type === "message" ? prevItem.data : null;
      const showAvatar =
        !isOwn &&
        (!prevMsg ||
          prevMsg.sender_id !== msg.sender_id ||
          prevItem?.type === "divider");

      return (
        <MessageBubble
          key={msg._localId ?? msg.id}
          message={msg}
          isOwn={isOwn}
          showAvatar={showAvatar}
          otherPartyPhoto={otherParty?.profile_photo ?? null}
          otherPartyName={
            otherParty ? `${otherParty.first_name} ${otherParty.last_name}` : ""
          }
          onRetry={handleRetry}
        />
      );
    },
    [
      listData,
      currentUserId,
      otherParty,
      loadingOlder,
      handleLoadOlder,
      handleRetry,
    ],
  );

  // ── Scroll to bottom on first load ──────────────────────────────────────────

  const handleContentSizeChange = useCallback(() => {
    if (!loading) {
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  }, [loading]);

  // ── Loading / error states ──────────────────────────────────────────────────

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

  if (error) {
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
        <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: Colors.primary }]}
          onPress={loadInitial}
        >
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />

      {/* ── Header ── */}
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
        </TouchableOpacity>

        {/* Other party info */}
        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() =>
            otherParty &&
            router.push(`/(support-pages)/profile/${otherParty.id}`)
          }
          activeOpacity={0.8}
        >
          {otherParty?.profile_photo ? (
            <Image
              source={{ uri: otherParty.profile_photo }}
              style={styles.headerAvatar}
            />
          ) : (
            <View
              style={[
                styles.headerAvatar,
                styles.avatarFallback,
                { backgroundColor: Colors.primary },
              ]}
            >
              <Text style={styles.avatarFallbackText}>
                {otherParty?.first_name?.charAt(0).toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <View style={styles.headerMeta}>
            <Text
              style={[styles.headerName, { color: theme.textPrimary }]}
              numberOfLines={1}
            >
              {otherParty
                ? `${otherParty.first_name} ${otherParty.last_name}`
                : "Chat"}
            </Text>
            {trade && (
              <View style={styles.headerStatusRow}>
                <View
                  style={[
                    styles.headerStatusDot,
                    {
                      backgroundColor: getTradeStatusColor(trade.status),
                    },
                  ]}
                />
                <Text
                  style={[styles.headerStatusText, { color: theme.textMuted }]}
                >
                  Trade {getTradeStatusLabel(trade.status)}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* View Trade button */}
        <TouchableOpacity
          onPress={handleViewTrade}
          style={[
            styles.viewTradeBtn,
            {
              backgroundColor: theme.surface,
              borderColor: theme.borderDefault,
            },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={15}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Trade Summary Card ── */}
      {trade && currentUserId && (
        <TradeSummaryCard
          trade={trade}
          currentUserId={currentUserId}
          onPress={handleViewTrade}
        />
      )}

      {/* ── Messages ── */}
      <FlatList
        ref={flatListRef}
        data={listData}
        keyExtractor={(item) =>
          item.type === "message"
            ? (item.data._localId ?? item.data.id)
            : item.key
        }
        renderItem={renderItem}
        contentContainerStyle={[
          styles.messageList,
          { paddingBottom: Spacing[3] },
        ]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={handleContentSizeChange}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={Colors.gray[300]}
            />
            <Text style={[styles.emptyChatText, { color: theme.textMuted }]}>
              No messages yet. Say hello!
            </Text>
          </View>
        }
      />

      {/* ── Input Bar ── */}
      <Animated.View
        style={[
          styles.inputBarWrapper,
          {
            backgroundColor: theme.bg,
            borderTopColor: theme.borderSubtle,
            paddingBottom: insets.bottom + Spacing[2],
            opacity: inputBarAnim,
            transform: [
              {
                translateY: inputBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        {isClosed ? (
          <View
            style={[
              styles.closedBar,
              {
                backgroundColor: theme.surface,
                borderColor: theme.borderSubtle,
              },
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={theme.textMuted}
            />
            <Text style={[styles.closedBarText, { color: theme.textMuted }]}>
              This trade is closed. Messaging is disabled.
            </Text>
          </View>
        ) : (
          <View style={styles.inputBar}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.borderDefault,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="Type a message..."
              placeholderTextColor={theme.textPlaceholder}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={2000}
              returnKeyType="default"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                {
                  backgroundColor: canSend ? Colors.primary : theme.btnDisabled,
                },
              ]}
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.85}
            >
              <Ionicons name="send" size={16} color={Colors.white} />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
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
  errorTitle: {
    ...Typography.body,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
  },
  retryBtnText: {
    ...Typography.button,
    color: Colors.white,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
    gap: Spacing[3],
  },
  backBtn: {
    padding: Spacing[1],
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
  },
  headerAvatar: {
    width: Layout.avatarSm,
    height: Layout.avatarSm,
    borderRadius: Radius.full,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    ...Typography.bodyMedium,
    color: Colors.white,
  },
  headerMeta: { flex: 1 },
  headerName: {
    ...Typography.bodyMedium,
  },
  headerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[1],
    marginTop: 2,
  },
  headerStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerStatusText: {
    ...Typography.micro,
  },
  viewTradeBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Trade summary card
  tradeSummaryCard: {
    marginHorizontal: Layout.screenPadding,
    marginTop: Spacing[3],
    marginBottom: Spacing[1],
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    ...Shadows.xs,
  },
  tradeSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },
  tradeSummaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tradeSummaryStatus: {
    ...Typography.captionMedium,
  },
  tradeSummaryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
  },
  viewTradeLink: {},
  viewTradeLinkText: {
    ...Typography.captionMedium,
  },
  tradeSummaryBody: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[3],
    gap: Spacing[2],
  },
  tradeSummaryColumn: {
    flex: 1,
    gap: Spacing[1],
  },
  tradeSummaryLabel: {
    ...Typography.micro,
  },
  tradeSummaryImages: {
    flexDirection: "row",
    alignItems: "center",
  },
  tradeSummaryThumb: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: Colors.white,
  },
  tradeSummaryThumbImg: {
    width: "100%",
    height: "100%",
  },
  tradeSummaryItemName: {
    ...Typography.micro,
    fontWeight: "500",
  },
  tradeSummarySwap: {
    width: 32,
    alignItems: "center",
  },

  // Message list
  messageList: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    flexGrow: 1,
  },

  // Date divider
  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing[4],
    gap: Spacing[3],
  },
  dateDividerLine: {
    flex: 1,
    height: 1,
  },
  dateDividerText: {
    ...Typography.micro,
  },

  // Load older
  loadOlderBtn: {
    alignItems: "center",
    paddingVertical: Spacing[3],
  },
  loadOlderText: {
    ...Typography.captionMedium,
  },

  // Empty
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[3],
    paddingVertical: Spacing[16],
  },
  emptyChatText: {
    ...Typography.body,
    textAlign: "center",
  },

  // Message bubble
  bubbleRow: {
    flexDirection: "row",
    marginBottom: Spacing[1],
    alignItems: "flex-end",
  },
  bubbleRowOwn: {
    justifyContent: "flex-end",
  },
  bubbleRowOther: {
    justifyContent: "flex-start",
  },
  avatarSlot: {
    width: 30,
    marginRight: Spacing[2],
    alignSelf: "flex-end",
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
  },
  avatarPlaceholder: {
    width: 28,
  },
  bubbleContainer: {
    maxWidth: "75%",
  },
  bubbleContainerOwn: {
    alignItems: "flex-end",
  },
  bubbleContainerOther: {
    alignItems: "flex-start",
  },
  bubble: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderRadius: Radius.xl,
  },
  bubbleOwn: {
    borderBottomRightRadius: Radius.xs,
  },
  bubbleOther: {
    borderWidth: 1,
    borderBottomLeftRadius: Radius.xs,
  },
  bubbleFailed: {
    opacity: 0.7,
  },
  bubbleText: {
    ...Typography.body,
    lineHeight: 20,
  },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
    paddingHorizontal: Spacing[1],
  },
  bubbleMetaOwn: {
    justifyContent: "flex-end",
  },
  bubbleMetaOther: {
    justifyContent: "flex-start",
  },
  bubbleTime: {
    ...Typography.micro,
  },
  failedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  failedText: {
    ...Typography.micro,
  },

  // Input bar
  inputBarWrapper: {
    borderTopWidth: 1,
    paddingTop: Spacing[2],
    paddingHorizontal: Layout.screenPadding,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing[2],
  },
  input: {
    flex: 1,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    ...Typography.body,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.sm,
  },
  closedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  closedBarText: {
    ...Typography.caption,
  },
});
