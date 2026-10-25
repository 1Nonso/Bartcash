/**
 * Home's Taste lens results (UI spec §13.4, FLOW §10.7): people with
 * compatible taste, each with a CompatibilityPill, up to three shared
 * interests (+n) and up to three listing thumbnails.
 *
 * API: GET /taste/compatible-users (10 per page; poll 3 s up to 30 s while
 * refreshing). 422 TASTE_PROFILE_INACTIVE shows the setup card.
 * `reloadKey` changes on focus and pull-to-refresh. `firstCardRef` and
 * `onLoaded` feed Home's People like you tour.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { getCompatibleUsers, type CompatibleUser } from "@/config/taste";
import { CompatibilityPill, InlineRefreshNote, ScoutBadge, TagChip } from "@/components/scout";

const PAGE = 10;
const POLL_INTERVAL = 3000;
const POLL_TIMEOUT_MS = 30000;
const CHIPS_SHOWN = 3;

type Status = "loading" | "inactive" | "ready" | "refreshing" | "empty" | "error";

export function TastePeople({
  reloadKey,
  firstCardRef,
  onLoaded,
}: {
  reloadKey: number;
  firstCardRef?: React.RefObject<View | null>;
  /** True once the first load has finished (whatever its outcome). */
  onLoaded?: (loaded: boolean) => void;
}) {
  const theme = useAuthTheme();
  const [people, setPeople] = useState<CompatibleUser[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [polling, setPolling] = useState(false);

  const requestId = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    pollRef.current = null;
    pollTimeoutRef.current = null;
    setPolling(false);
  }, []);

  const load = useCallback(async () => {
    const myId = ++requestId.current;
    stopPolling();
    try {
      const data = await getCompatibleUsers({ limit: PAGE });
      if (myId !== requestId.current) return;
      setPeople(data.items);
      setNextCursor(data.next_cursor);
      setStatus(data.meta.status);
      if (data.meta.status === "refreshing") {
        setPolling(true);
        pollRef.current = setInterval(async () => {
          try {
            const d = await getCompatibleUsers({ limit: PAGE });
            if (myId !== requestId.current) return;
            setPeople(d.items);
            setNextCursor(d.next_cursor);
            setStatus(d.meta.status);
            if (d.meta.status !== "refreshing") stopPolling();
          } catch {
            // Keep polling through network blips; the timeout ends it.
          }
        }, POLL_INTERVAL);
        pollTimeoutRef.current = setTimeout(() => {
          stopPolling();
          // Stop the spinner; show what we have.
          setStatus((s) => (s === "refreshing" ? "ready" : s));
        }, POLL_TIMEOUT_MS);
      }
    } catch (err: any) {
      if (myId !== requestId.current) return;
      setPeople([]);
      setNextCursor(null);
      setStatus(err?.response?.data?.code === "TASTE_PROFILE_INACTIVE" ? "inactive" : "error");
    }
  }, [stopPolling]);

  // Latest load, so the reload effect runs only when reloadKey changes.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    loadRef.current();
  }, [reloadKey]);
  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    onLoaded?.(status !== "loading");
  }, [status, onLoaded]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    const myId = requestId.current;
    setLoadingMore(true);
    try {
      const data = await getCompatibleUsers({ cursor: nextCursor, limit: PAGE });
      if (myId !== requestId.current) return;
      setPeople((prev) => [...prev, ...data.items]);
      setNextCursor(data.next_cursor);
    } catch {
      // The button stays; a retry is one tap.
    } finally {
      setLoadingMore(false);
    }
  };

  const openTaste = () => router.push("/(support-pages)/taste");

  if (status === "loading") {
    return (
      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.skeleton, { backgroundColor: theme.surfaceVariant }]} />
        ))}
      </View>
    );
  }

  if (status === "inactive") {
    return (
      <View style={[styles.emptyCard, { backgroundColor: theme.aiSurface }]}>
        <ScoutBadge />
        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Tell Scout what you like</Text>
        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
          Add at least 3 brands, artists or films to meet people with your taste.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: theme.btnPrimary }]}
          onPress={openTaste}
        >
          <Text style={[styles.primaryBtnText, { color: theme.btnPrimaryText }]}>Set up taste profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heading = (
    <View style={styles.head}>
      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>People with your taste</Text>
      {(status === "refreshing" || polling) && <InlineRefreshNote text="Scout is finding people like you..." />}
    </View>
  );

  if (status === "error") {
    return (
      <View>
        {heading}
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyBody, { color: Colors.danger }]}>
            Couldn&apos;t load people. Check your connection.
          </Text>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: theme.borderDefault }]} onPress={load}>
            <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View>
      {heading}
      {people.length === 0 && status !== "refreshing" && !polling ? (
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyBody, { color: theme.textSecondary, textAlign: "center" }]}>
            No one with your taste yet. Scout checks again as people add interests.
          </Text>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: theme.borderDefault }]} onPress={openTaste}>
            <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>Add more interests</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.list}>
          {people.map((p, i) => (
            <View key={p.user.id} ref={i === 0 ? firstCardRef : undefined} collapsable={false}>
              <PersonCard person={p} />
            </View>
          ))}
          {!!nextCursor && (
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.borderDefault }]}
              onPress={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>Show more people</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function PersonCard({ person }: { person: CompatibleUser }) {
  const theme = useAuthTheme();
  const { user, compatibility, listings_preview } = person;
  const rating = Number(user.average_rating);
  const extra = compatibility.shared_count - Math.min(CHIPS_SHOWN, compatibility.shared_entities.length);
  const openProfile = () =>
    router.push({ pathname: "/(support-pages)/profile/[id]", params: { id: user.id } });
  const openListing = (id: string) =>
    router.push({ pathname: "/(support-pages)/listing/[id]", params: { id } });

  return (
    <TouchableOpacity
      onPress={openProfile}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${user.first_name} ${user.last_name}, open profile`}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
    >
      <View style={styles.row}>
        {user.profile_photo ? (
          <Image source={{ uri: user.profile_photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.center, { backgroundColor: theme.surfaceVariant }]}>
            <Text style={[styles.avatarText, { color: theme.textSecondary }]}>
              {user.first_name?.[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.textPrimary }]}>
            {user.first_name} {user.last_name}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={Colors.warning} />
            <Text style={[styles.caption, { color: theme.textMuted }]}>
              {Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "New"}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </View>

      {compatibility.score_label && <CompatibilityPill label={compatibility.score_label} />}

      {compatibility.shared_entities.length > 0 && (
        <View style={styles.chips}>
          {compatibility.shared_entities.slice(0, CHIPS_SHOWN).map((e) => (
            <TagChip key={e.qloo_entity_id} name={e.name} />
          ))}
          {extra > 0 && (
            <Text style={[styles.caption, { color: theme.textSecondary }]}>+{extra}</Text>
          )}
        </View>
      )}

      {listings_preview.length > 0 && (
        <View style={styles.thumbs}>
          {listings_preview.map((it) => (
            <TouchableOpacity
              key={it.id}
              onPress={() => openListing(it.id)}
              activeOpacity={0.85}
              accessibilityLabel={`Open ${it.title}`}
              style={styles.thumbWrap}
            >
              <Thumb uri={it.primary_image} />
              <Text numberOfLines={1} style={[styles.thumbTitle, { color: theme.textSecondary }]}>
                {it.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

function Thumb({ uri }: { uri: string | null }) {
  const theme = useAuthTheme();
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[styles.thumb, styles.center, { backgroundColor: theme.surfaceVariant }]}>
        <Ionicons name="image-outline" size={18} color={theme.textMuted} />
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.thumb} resizeMode="cover" onError={() => setFailed(true)} />;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  // Matches Home's results heading and cards.
  head: { paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing[2], gap: 4 },
  sectionTitle: { ...Typography.sectionTitle },
  list: { paddingHorizontal: Layout.screenPadding, gap: Spacing[2] },
  skeleton: { height: 150, borderRadius: Radius.lg },
  card: { borderWidth: Layout.borderWidth, borderRadius: Radius.lg, padding: Spacing[3], gap: Spacing[2] },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing[3] },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { ...Typography.bodyMedium },
  name: { ...Typography.bodyMedium },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  caption: { ...Typography.caption },
  chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Spacing[2] },
  thumbs: { flexDirection: "row", gap: Spacing[2] },
  thumbWrap: { width: "31%", gap: 4 },
  thumb: { width: "100%", aspectRatio: 1, borderRadius: Radius.md },
  thumbTitle: { ...Typography.caption },
  emptyCard: {
    marginHorizontal: Layout.screenPadding,
    padding: Spacing[4],
    borderRadius: Radius.xl,
    gap: Spacing[2],
  },
  emptyTitle: { ...Typography.cardTitle },
  emptyBody: { ...Typography.body },
  emptyBox: { alignItems: "center", gap: Spacing[3], paddingVertical: Spacing[6], paddingHorizontal: Layout.screenPadding },
  primaryBtn: {
    height: Layout.inputHeight,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing[2],
  },
  primaryBtnText: { ...Typography.button },
  secondaryBtn: {
    alignSelf: "center",
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    minWidth: 120,
    alignItems: "center",
  },
  secondaryBtnText: { ...Typography.buttonSm },
});
