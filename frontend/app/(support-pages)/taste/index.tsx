/**
 * Taste Profile (UI spec §13.6) — the interests Scout uses for matching.
 * The list on screen is the source of truth; Save replaces the stored profile.
 *
 * API: GET /taste/profile, PUT /taste/profile
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { goBack } from "@/hooks/navigation";
import { showToast } from "@/hooks/toast";
import { Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { ScoutBadge } from "@/components/scout";
import {
  getTasteProfile,
  saveTasteProfile,
  tasteDraft,
  TASTE_TYPE_LABELS,
  TASTE_TYPES,
  type TasteEntity,
} from "@/config/taste";

const MAX_ENTITIES = 25;
const MIN_ACTIVE = 3;

const idsKey = (list: TasteEntity[]) =>
  list
    .map((e) => e.qloo_entity_id)
    .sort()
    .join(",");

export default function TasteProfileScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();

  const [saved, setSaved] = useState<TasteEntity[] | null>(null);
  const [list, setList] = useState<TasteEntity[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await getTasteProfile();
      setSaved(p.entities);
      setList(p.entities);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is set after the await
    load();
  }, [load]);

  // Picks merged on Add Interests come back through the shared draft.
  useFocusEffect(
    useCallback(() => {
      const d = tasteDraft.get();
      if (d) {
        setList(d);
        tasteDraft.set(null);
      }
    }, []),
  );

  const dirty = saved !== null && idsKey(saved) !== idsKey(list);
  const count = list.length;
  const atMax = count >= MAX_ENTITIES;

  const groups = useMemo(
    () =>
      TASTE_TYPES.map((t) => ({ type: t, items: list.filter((e) => e.entity_type === t) })).filter(
        (g) => g.items.length > 0,
      ),
    [list],
  );

  const remove = (id: string) => setList((prev) => prev.filter((e) => e.qloo_entity_id !== id));

  const openAdd = () => {
    if (atMax) return;
    tasteDraft.set(list);
    router.push("/(support-pages)/taste/add");
  };

  const clearAll = () =>
    Alert.alert("Clear all interests?", "Matching uses them; you can add them again later.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => setList([]) },
    ]);

  const handleBack = () => {
    if (!dirty) return goBack();
    Alert.alert("Discard changes?", "Your unsaved changes will be lost.", [
      { text: "Keep Editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => goBack() },
    ]);
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const p = await saveTasteProfile(list);
      setSaved(p.entities);
      setList(p.entities);
      showToast(
        "success",
        p.is_active ? "Taste profile saved. Scout will use it for your matches." : "Taste profile saved.",
      );
      goBack();
    } catch {
      showToast("error", "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const statusNote =
    count === 0 ? null : count < MIN_ACTIVE ? (
      <View style={[styles.note, { backgroundColor: theme.infoLight }]}>
        <Ionicons name="information-circle-outline" size={16} color={theme.info} />
        <Text style={[styles.noteText, { color: theme.textPrimary }]}>
          Add {MIN_ACTIVE - count} more to turn on matching.
        </Text>
      </View>
    ) : (
      <View style={[styles.note, { backgroundColor: theme.successLight }]}>
        <Ionicons name="checkmark-circle" size={16} color={theme.success} />
        <Text style={[styles.noteText, { color: theme.textPrimary }]}>Matching is on.</Text>
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
        <TouchableOpacity onPress={handleBack} style={styles.headerSide} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Your taste</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.introRow}>
          <ScoutBadge />
        </View>
        <Text style={[styles.intro, { color: theme.textSecondary }]}>
          Add things you love. Scout uses them, with Qloo&apos;s taste data, to find listings and people you&apos;ll click with.
        </Text>

        <View style={styles.counterRow}>
          <Text style={[styles.counter, { color: theme.textPrimary }]}>
            {count} of {MAX_ENTITIES}
          </Text>
          <Text style={[styles.caption, { color: theme.textMuted }]}>
            Add at least {MIN_ACTIVE} to turn on matching
          </Text>
        </View>

        {statusNote}

        {saved === null && !loadError ? (
          <View style={styles.chipWrap}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.skeletonChip, { backgroundColor: theme.surfaceVariant }]} />
            ))}
          </View>
        ) : loadError ? (
          <View style={styles.center}>
            <Text style={[styles.body2, { color: theme.textSecondary }]}>Couldn&apos;t load your taste profile.</Text>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.borderDefault }]}
              onPress={load}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : count === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.body2, { color: theme.textSecondary }]}>Nothing here yet.</Text>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.type} style={styles.group}>
              <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>
                {TASTE_TYPE_LABELS[g.type]}
              </Text>
              <View style={styles.chipWrap}>
                {g.items.map((e) => (
                  <View
                    key={e.qloo_entity_id}
                    style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
                  >
                    {e.image_url ? <Image source={{ uri: e.image_url }} style={styles.chipImage} /> : null}
                    <Text numberOfLines={1} style={[styles.chipText, { color: theme.textPrimary }]}>
                      {e.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => remove(e.qloo_entity_id)}
                      hitSlop={8}
                      accessibilityLabel={`Remove ${e.name}`}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        <TouchableOpacity
          style={[
            styles.secondaryBtn,
            styles.addBtn,
            { borderColor: theme.borderDefault, opacity: atMax || saved === null ? 0.5 : 1 },
          ]}
          onPress={openAdd}
          disabled={atMax || saved === null}
        >
          <Ionicons name="add" size={18} color={theme.textPrimary} />
          <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>Add interests</Text>
        </TouchableOpacity>
        {atMax && (
          <Text style={[styles.caption, styles.centerText, { color: theme.textMuted }]}>
            You have reached {MAX_ENTITIES}.
          </Text>
        )}

        <Text style={[styles.privacy, { color: theme.textMuted }]}>
          <Ionicons name="lock-closed-outline" size={12} color={theme.textMuted} /> Other people only see
          the interests you have in common with them.
        </Text>

        {count > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
            <Text style={[styles.clearText, { color: theme.error }]}>Clear all</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing[3], backgroundColor: theme.bg, borderTopColor: theme.borderSubtle },
        ]}
      >
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: dirty && !saving ? theme.btnPrimary : theme.btnDisabled }]}
          onPress={save}
          disabled={!dirty || saving}
        >
          {saving ? (
            <ActivityIndicator color={theme.btnPrimaryText} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: dirty ? theme.btnPrimaryText : theme.btnDisabledText }]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
  },
  headerSide: { width: 32 },
  headerTitle: { ...Typography.sectionTitle, flex: 1, textAlign: "center" },
  body: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing[4], gap: Spacing[3] },
  introRow: { flexDirection: "row" },
  intro: { ...Typography.body },
  counterRow: { gap: 2 },
  counter: { ...Typography.cardTitle },
  caption: { ...Typography.caption },
  centerText: { textAlign: "center" },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
  },
  noteText: { ...Typography.caption, flex: 1 },
  group: { gap: Spacing[2] },
  groupTitle: { ...Typography.captionMedium, textTransform: "uppercase", letterSpacing: 0.5 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing[2] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[1.5],
    borderWidth: Layout.borderWidth,
    borderRadius: 20,
    paddingLeft: Spacing[2],
    paddingRight: Spacing[1],
    paddingVertical: 4,
    maxWidth: "100%",
  },
  chipImage: { width: 22, height: 22, borderRadius: 11 },
  chipText: { ...Typography.captionMedium, flexShrink: 1 },
  skeletonChip: { width: 96, height: 32, borderRadius: 16 },
  center: { alignItems: "center", gap: Spacing[3], paddingVertical: Spacing[6] },
  body2: { ...Typography.body },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[1.5],
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  addBtn: { alignSelf: "stretch", marginTop: Spacing[2] },
  secondaryBtnText: { ...Typography.buttonSm },
  privacy: { ...Typography.caption, textAlign: "center", marginTop: Spacing[2] },
  clearBtn: { alignSelf: "center", paddingVertical: Spacing[2] },
  clearText: { ...Typography.captionMedium },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
  },
  primaryBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { ...Typography.button },
});
