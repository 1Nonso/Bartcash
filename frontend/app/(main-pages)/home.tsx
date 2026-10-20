/**
 * Home (UI spec §13.4) — shown instead of Home / Browse when features.qloo is on.
 * Lens slider of the user's available listings, then Scout's top 5 matches
 * for the selected one and "See all N matches" (the All matches screen).
 *
 * API:
 *   GET /items/mine?status=available&include=match_summary
 *   GET /items/{id}/matches?limit=5   (poll 3 s up to 30 s while refreshing)
 *   GET /notifications (unread count)
 *
 * The Taste lens ("People like you") comes with the taste profile step.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "@/hooks/useTabBarSpace";
import { Colors, Layout, Radius, Shadows, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { timeAgo } from "@/constants/listing";
import { getStoredUser } from "@/config/auth";
import { getUnreadCount } from "@/config/notifications";
import { getTasteProfile } from "@/config/taste";
import type { MyItem } from "@/config/items";
import {
  getMatches,
  getMyListingsWithMatches,
  type MatchEntry,
  type MatchesMeta,
} from "@/config/matches";
import {
  AddListingLensCard,
  InlineRefreshNote,
  LensCard,
  MatchCard,
  ScoutBadge,
} from "@/components/scout";

/** Matches shown on Home; the rest are on the All matches screen. */
const HOME_LIMIT = 5;
const POLL_INTERVAL = 3000;
const POLL_TIMEOUT_MS = 30000;

// Last lens used this session (not stored, per §13.4).
let lastLensId: string | null = null;

function hasWants(item: MyItem | null): boolean {
  return (item?.wants?.length ?? 0) > 0;
}

function primaryImage(item: MyItem): string | null {
  const img = item.primary_image;
  return typeof img === "string" ? img : (img?.url ?? null);
}

export default function HomeScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();

  const [firstName, setFirstName] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  // Interests on the taste profile; null until loaded (no card meanwhile).
  const [tasteCount, setTasteCount] = useState<number | null>(null);

  const [lenses, setLenses] = useState<MyItem[] | null>(null);
  const [lensError, setLensError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(lastLensId);

  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [meta, setMeta] = useState<MatchesMeta | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [polling, setPolling] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  const requestId = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Header data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    getStoredUser().then((u) => setFirstName(u?.first_name ?? null));
  }, []);

  // ── Polling (API §16.10: 3 s, stop after 30 s) ─────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    pollRef.current = null;
    pollTimeoutRef.current = null;
    setPolling(false);
  }, []);

  const startPolling = useCallback(
    (itemId: string) => {
      stopPolling();
      setPolling(true);
      const myId = requestId.current;
      pollRef.current = setInterval(async () => {
        try {
          const data = await getMatches(itemId, { limit: HOME_LIMIT });
          if (myId !== requestId.current) return;
          setMatches(data.items);
          setMeta(data.meta);
          setNextCursor(data.next_cursor);
          if (data.meta.status !== "refreshing") stopPolling();
        } catch {
          // Keep polling through network blips; the timeout ends it.
        }
      }, POLL_INTERVAL);
      pollTimeoutRef.current = setTimeout(stopPolling, POLL_TIMEOUT_MS);
    },
    [stopPolling],
  );

  useEffect(() => stopPolling, [stopPolling]);

  // ── Matches for the selected lens ───────────────────────────────────────────

  const loadMatches = useCallback(
    async (itemId: string) => {
      const myId = ++requestId.current;
      stopPolling();
      setLoadingMatches(true);
      setMatchError(null);
      try {
        const data = await getMatches(itemId, { limit: HOME_LIMIT });
        if (myId !== requestId.current) return;
        setMatches(data.items);
        setMeta(data.meta);
        setNextCursor(data.next_cursor);
        if (data.meta.status === "refreshing") startPolling(itemId);
      } catch (err: any) {
        if (myId !== requestId.current) return;
        setMatches([]);
        setMeta(null);
        setNextCursor(null);
        setMatchError(
          err?.response?.data?.message ?? "Couldn't load matches. Check your connection.",
        );
      } finally {
        if (myId === requestId.current) setLoadingMatches(false);
      }
    },
    [startPolling, stopPolling],
  );

  /** Load a lens's matches; a listing without wants has none (§ Oct 20 rule). */
  const showLens = useCallback(
    (item: MyItem | null) => {
      if (item && hasWants(item)) {
        loadMatches(item.id);
        return;
      }
      ++requestId.current;
      stopPolling();
      setMatches([]);
      setMeta(null);
      setNextCursor(null);
      setMatchError(null);
      setLoadingMatches(false);
    },
    [loadMatches, stopPolling],
  );

  // ── Lenses (reloaded on every focus) ────────────────────────────────────────

  const loadLenses = useCallback(async () => {
    try {
      const items = await getMyListingsWithMatches();
      setLenses(items);
      setLensError(false);
      const keep =
        items.find((i) => i.id === selectedId) ??
        items.find((i) => i.id === lastLensId) ??
        items[0] ??
        null;
      const nextId = keep?.id ?? null;
      lastLensId = nextId;
      setSelectedId(nextId);
      showLens(keep);
    } catch {
      setLensError(true);
      setLenses((prev) => prev ?? []);
    }
  }, [selectedId, showLens]);

  // Latest loadLenses for the focus effect, without re-running it on every
  // selection change.
  const loadLensesRef = useRef(loadLenses);
  useEffect(() => {
    loadLensesRef.current = loadLenses;
  }, [loadLenses]);

  useFocusEffect(
    useCallback(() => {
      getUnreadCount()
        .then(setUnread)
        .catch(() => {});
      getTasteProfile()
        .then((p) => setTasteCount(p.entity_count))
        .catch(() => {});
      loadLensesRef.current();
      return () => stopPolling();
    }, [stopPolling]),
  );

  const selectLens = useCallback(
    (item: MyItem) => {
      if (item.id === selectedId) return;
      lastLensId = item.id;
      setSelectedId(item.id);
      setMatches([]);
      setMeta(null);
      setNextCursor(null);
      showLens(item);
    },
    [selectedId, showLens],
  );

  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    await loadLenses();
    setPullRefreshing(false);
  }, [loadLenses]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const openMatch = useCallback(
    (itemId: string) => {
      router.push({
        pathname: "/(support-pages)/listing/[id]",
        params: { id: itemId, ...(selectedId ? { context: selectedId } : {}) },
      });
    },
    [selectedId],
  );
  const browseAll = () => router.push("/(main-pages)/discover");
  const createListing = () => router.push("/(support-pages)/listing/create");
  const openTaste = () => router.push("/(support-pages)/taste");
  const addWants = (id: string) =>
    router.push({ pathname: "/(support-pages)/listing/[id]/edit", params: { id } });
  const seeAll = (item: MyItem) =>
    router.push({
      pathname: "/(support-pages)/matches/[id]",
      params: { id: item.id, title: item.title },
    });

  // ── Derived ────────────────────────────────────────────────────────────────

  const selected = lenses?.find((l) => l.id === selectedId) ?? null;
  const refreshing = polling || meta?.status === "refreshing";
  const isFallback = meta?.source === "fallback";
  const noListings = lenses !== null && lenses.length === 0;

  // ── Render pieces ──────────────────────────────────────────────────────────

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
      <View style={styles.headerTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.textSecondary }]}>
            {firstName ? `Hi ${firstName}` : "Hi there"}
          </Text>
          <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>Home</Text>
        </View>
        <ScoutBadge style={styles.headerBadge} />
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: theme.surface }]}
          onPress={() => router.push("/(support-pages)/notification")}
          activeOpacity={0.8}
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={Layout.iconMd} color={theme.textPrimary} />
          {unread > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unread > 9 ? "9+" : unread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const lensSlider =
    lenses === null ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lensRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.lensSkeleton, { backgroundColor: theme.surfaceVariant }]} />
        ))}
      </ScrollView>
    ) : noListings ? null : (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lensRow}>
        {lenses.map((l) => (
          <LensCard
            key={l.id}
            title={l.title}
            image={primaryImage(l)}
            selected={l.id === selectedId}
            onPress={() => selectLens(l)}
            needsWants={!hasWants(l)}
            count={l.match_summary?.status === "ready" ? l.match_summary.count : null}
            refreshing={l.match_summary?.status === "refreshing"}
          />
        ))}
        <AddListingLensCard onPress={createListing} />
      </ScrollView>
    );

  const resultsHeading = selected && hasWants(selected) ? (
    <View style={styles.resultsHead}>
      <Text numberOfLines={1} style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        Matches for {selected.title}
      </Text>
      {refreshing ? (
        <InlineRefreshNote text="Scout is updating your matches..." />
      ) : meta?.computed_at ? (
        <Text style={[styles.caption, { color: theme.textMuted }]}>
          Updated {timeAgo(meta.computed_at)}
        </Text>
      ) : null}
      {isFallback && matches.length > 0 && (
        <Text style={[styles.caption, { color: theme.textSecondary }]}>Close matches by category</Text>
      )}
    </View>
  ) : null;

  // "Tell Scout what you like" until the profile is active (3 interests).
  const tasteCard =
    tasteCount !== null && tasteCount < 3 && !noListings ? (
      <TouchableOpacity
        onPress={openTaste}
        activeOpacity={0.85}
        style={[styles.tasteCard, { backgroundColor: theme.aiSurface }]}
      >
        <Ionicons name="sparkles" size={18} color={theme.ai} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.tasteTitle, { color: theme.textPrimary }]}>Tell Scout what you like</Text>
          <Text style={[styles.caption, { color: theme.textSecondary }]}>
            {tasteCount === 0
              ? "Add brands, music and films you love for sharper matches."
              : `Add ${3 - tasteCount} more to turn on taste matching.`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </TouchableOpacity>
    ) : null;

  const listHeader = (
    <View>
      {header}
      {tasteCard}
      {lensError && (
        <TouchableOpacity
          onPress={loadLenses}
          style={[styles.errorBanner, { backgroundColor: Colors.danger + "15" }]}
        >
          <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
          <Text style={[styles.errorText, { color: Colors.danger }]}>
            Couldn&apos;t load your listings. Tap to retry.
          </Text>
        </TouchableOpacity>
      )}
      {lensSlider}
      {resultsHeading}
    </View>
  );

  const emptyState = (() => {
    if (lenses === null || (loadingMatches && matches.length === 0)) {
      return (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.matchSkeleton, { backgroundColor: theme.surfaceVariant }]} />
          ))}
        </View>
      );
    }
    if (noListings) {
      return (
        <View style={[styles.emptyCard, { backgroundColor: theme.aiSurface }]}>
          <ScoutBadge />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            List something to see matches
          </Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            Scout finds people who have what you want and want what you have.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.btnPrimary }]}
            onPress={createListing}
          >
            <Text style={[styles.primaryBtnText, { color: theme.btnPrimaryText }]}>Create Listing</Text>
          </TouchableOpacity>
          {tasteCount !== null && tasteCount < 3 && (
            <TouchableOpacity
              style={[styles.secondaryBtn, styles.stretch, { borderColor: theme.borderDefault }]}
              onPress={openTaste}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>Set up taste profile</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={browseAll} style={styles.linkBtn}>
            <Text style={[styles.linkText, { color: theme.link }]}>Browse all listings</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (selected && !hasWants(selected)) {
      return (
        <View style={[styles.emptyCard, { backgroundColor: theme.aiSurface }]}>
          <ScoutBadge />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            Add what you want to see matches
          </Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            Tell Scout which categories you&apos;d take for {selected.title}.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.btnPrimary }]}
            onPress={() => addWants(selected.id)}
          >
            <Text style={[styles.primaryBtnText, { color: theme.btnPrimaryText }]}>Add wants</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (matchError && selectedId) {
      return (
        <View style={styles.emptyMatches}>
          <Text style={[styles.emptyBody, { color: Colors.danger }]}>{matchError}</Text>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: theme.borderDefault }]}
            onPress={() => loadMatches(selectedId)}
          >
            <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (refreshing) return null;
    return (
      <View style={styles.emptyMatches}>
        <Text style={[styles.emptyBody, { color: theme.textSecondary, textAlign: "center" }]}>
          No close matches yet. Scout will keep looking.
        </Text>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: theme.borderDefault }]}
          onPress={browseAll}
        >
          <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>Browse all listings</Text>
        </TouchableOpacity>
      </View>
    );
  })();

  const total = selected?.match_summary?.count ?? null;
  const footer =
    matches.length === 0 ? null : (
      <View style={styles.footer}>
        {!!nextCursor && selected && (
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: theme.borderDefault }]}
            onPress={() => seeAll(selected)}
          >
            <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>
              {total && total > matches.length ? `See all ${total} matches` : "See all matches"}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={browseAll} style={styles.linkBtn}>
          <Text style={[styles.linkText, { color: theme.link }]}>Browse all listings</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
        translucent={false}
      />
      <FlatList
        data={matches}
        keyExtractor={(m) => m.item.id}
        renderItem={({ item }) => (
          <View style={styles.matchWrap}>
            <MatchCard match={item} onPress={() => openMatch(item.item.id)} />
          </View>
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyState}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingBottom: tabSpace }}
        refreshControl={
          <RefreshControl refreshing={pullRefreshing} onRefresh={handlePullRefresh} tintColor={theme.ai} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing[3] },
  headerTop: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },
  greeting: { ...Typography.caption },
  pageTitle: { ...Typography.pageTitle },
  headerBadge: { alignSelf: "center" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.xs,
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeText: { ...Typography.micro, color: Colors.white, fontWeight: "700" },

  lensRow: { paddingHorizontal: Layout.screenPadding, gap: Spacing[2], paddingBottom: Spacing[3] },
  lensSkeleton: { width: 96, height: 120, borderRadius: Radius.lg },

  resultsHead: { paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing[2], gap: 4 },
  sectionTitle: { ...Typography.sectionTitle },
  caption: { ...Typography.caption },

  list: { paddingHorizontal: Layout.screenPadding, gap: Spacing[2] },
  matchWrap: { paddingHorizontal: Layout.screenPadding, marginBottom: Spacing[2] },
  matchSkeleton: { height: 96, borderRadius: Radius.lg },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing[3],
    padding: Spacing[3],
    borderRadius: Radius.md,
  },
  errorText: { ...Typography.caption, flex: 1 },

  emptyCard: {
    marginHorizontal: Layout.screenPadding,
    padding: Spacing[4],
    borderRadius: Radius.xl,
    gap: Spacing[2],
  },
  emptyTitle: { ...Typography.cardTitle },
  emptyMatches: { alignItems: "center", gap: Spacing[3], paddingVertical: Spacing[6] },
  emptyBody: { ...Typography.body },
  primaryBtn: {
    height: Layout.inputHeight,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing[2],
  },
  primaryBtnText: { ...Typography.button },
  secondaryBtn: {
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  secondaryBtnText: { ...Typography.buttonSm },
  linkBtn: { alignSelf: "center", paddingVertical: Spacing[2] },
  stretch: { alignSelf: "stretch", alignItems: "center" },
  tasteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing[3],
    padding: Spacing[3],
    borderRadius: Radius.lg,
  },
  tasteTitle: { ...Typography.bodyMedium },
  linkText: { ...Typography.bodyMedium },
  footer: { alignItems: "center", paddingVertical: Spacing[3], gap: Spacing[2] },
});
