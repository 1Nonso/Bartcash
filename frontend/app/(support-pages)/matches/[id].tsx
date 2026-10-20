/**
 * All matches — every match for one of the user's listings, opened from
 * "See all N matches" on Home. 10 per page via the matches cursor.
 *
 * API: GET /items/{id}/matches?limit=10&cursor=
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { goBack } from "@/hooks/navigation";
import { Colors, Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { timeAgo } from "@/constants/listing";
import { getMatches, type MatchEntry, type MatchesMeta } from "@/config/matches";
import { InlineRefreshNote, MatchCard } from "@/components/scout";

const PAGE_SIZE = 10;

export default function AllMatchesScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();

  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [meta, setMeta] = useState<MatchesMeta | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!id) return;
    const myId = ++requestId.current;
    try {
      const data = await getMatches(id, { limit: PAGE_SIZE });
      if (myId !== requestId.current) return;
      setMatches(data.items);
      setMeta(data.meta);
      setNextCursor(data.next_cursor);
      setError(null);
    } catch (err: any) {
      if (myId !== requestId.current) return;
      setError(err?.response?.data?.message ?? "Couldn't load matches. Check your connection.");
    } finally {
      if (myId === requestId.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is set after the await
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!id || !nextCursor || loadingMore || loading) return;
    const myId = requestId.current;
    setLoadingMore(true);
    try {
      const data = await getMatches(id, { limit: PAGE_SIZE, cursor: nextCursor });
      if (myId !== requestId.current) return;
      setMatches((prev) => [...prev, ...data.items]);
      setNextCursor(data.next_cursor);
    } catch {
      // Silent: scrolling again retries.
    } finally {
      setLoadingMore(false);
    }
  }, [id, nextCursor, loadingMore, loading]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openMatch = (itemId: string) =>
    router.push({
      pathname: "/(support-pages)/listing/[id]",
      params: { id: itemId, ...(id ? { context: id } : {}) },
    });
  const browseAll = () => router.push("/(main-pages)/discover");

  const listHeader = (
    <View style={styles.listHead}>
      {meta?.status === "refreshing" ? (
        <InlineRefreshNote text="Scout is updating your matches..." />
      ) : meta?.computed_at ? (
        <Text style={[styles.caption, { color: theme.textMuted }]}>
          Updated {timeAgo(meta.computed_at)}
        </Text>
      ) : null}
      {meta?.source === "fallback" && matches.length > 0 && (
        <Text style={[styles.caption, { color: theme.textSecondary }]}>Close matches by category</Text>
      )}
    </View>
  );

  const empty = loading ? (
    <View style={styles.list}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.skeleton, { backgroundColor: theme.surfaceVariant }]} />
      ))}
    </View>
  ) : error ? (
    <View style={styles.center}>
      <Text style={[styles.body, { color: Colors.danger, textAlign: "center" }]}>{error}</Text>
      <TouchableOpacity
        style={[styles.secondaryBtn, { borderColor: theme.borderDefault }]}
        onPress={() => {
          setLoading(true);
          load();
        }}
      >
        <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>Retry</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.center}>
      <Text style={[styles.body, { color: theme.textSecondary, textAlign: "center" }]}>
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

  const footer =
    matches.length === 0 ? null : (
      <View style={styles.footer}>
        {loadingMore && <ActivityIndicator color={theme.ai} />}
        {!nextCursor && (
          <TouchableOpacity onPress={browseAll} style={styles.linkBtn}>
            <Text style={[styles.linkText, { color: theme.link }]}>Browse all listings</Text>
          </TouchableOpacity>
        )}
      </View>
    );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
        translucent={false}
      />
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing[2], borderBottomColor: theme.borderSubtle },
        ]}
      >
        <TouchableOpacity onPress={() => goBack()} style={styles.back} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={[styles.title, { color: theme.textPrimary }]}>
          {title ? `Matches for ${title}` : "Matches"}
        </Text>
        <View style={styles.back} />
      </View>
      <FlatList
        data={matches}
        keyExtractor={(m) => m.item.id}
        renderItem={({ item }) => (
          <View style={styles.matchWrap}>
            <MatchCard match={item} onPress={() => openMatch(item.item.id)} />
          </View>
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.ai} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
  },
  back: { width: 32 },
  title: { ...Typography.sectionTitle, flex: 1, textAlign: "center" },
  listContent: { paddingBottom: Spacing[8] },
  listHead: { paddingHorizontal: Layout.screenPadding, paddingVertical: Spacing[3], gap: 4 },
  caption: { ...Typography.caption },
  list: { paddingHorizontal: Layout.screenPadding, gap: Spacing[2] },
  skeleton: { height: 96, borderRadius: Radius.lg },
  matchWrap: { paddingHorizontal: Layout.screenPadding, marginBottom: Spacing[2] },
  center: { alignItems: "center", gap: Spacing[3], paddingVertical: Spacing[6], paddingHorizontal: Layout.screenPadding },
  body: { ...Typography.body },
  secondaryBtn: {
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  secondaryBtnText: { ...Typography.buttonSm },
  footer: { alignItems: "center", paddingVertical: Spacing[3], gap: Spacing[2] },
  linkBtn: { alignSelf: "center", paddingVertical: Spacing[2] },
  linkText: { ...Typography.bodyMedium },
});
