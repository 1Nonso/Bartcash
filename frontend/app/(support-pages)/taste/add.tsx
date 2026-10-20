/**
 * Add Interests (UI spec §13.7) — search brands, artists, films, shows,
 * games, books and podcasts. Never saves: Done (or Back) merges the picks
 * into the shared draft and returns to Taste Profile.
 *
 * API: GET /taste/search?q=&type= (30 per minute; 503 when Qloo is down)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { goBack } from "@/hooks/navigation";
import { showToast } from "@/hooks/toast";
import { Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import {
  searchTaste,
  tasteDraft,
  TASTE_TYPE_LABELS,
  TASTE_TYPE_NAME,
  TASTE_TYPES,
  type TasteEntity,
  type TasteEntityType,
  type TasteSearchResult,
} from "@/config/taste";

const MAX_ENTITIES = 25;
const DEBOUNCE_MS = 400;

type SearchState = "idle" | "loading" | "done" | "unavailable" | "error";

export default function AddInterestsScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // The profile list as it stood when this screen opened, plus picks here.
  const [list, setList] = useState<TasteEntity[]>(() => tasteDraft.get() ?? []);
  const [startCount] = useState(() => (tasteDraft.get() ?? []).length);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TasteEntityType | null>(null);
  const [results, setResults] = useState<TasteSearchResult[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const requestId = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onList = new Set(list.map((e) => e.qloo_entity_id));
  const selectedCount = list.length - startCount;

  const run = useCallback(async (q: string, t: TasteEntityType | null) => {
    const myId = ++requestId.current;
    if (q.trim().length < 2) {
      setResults([]);
      setState("idle");
      return;
    }
    setState("loading");
    try {
      const data = await searchTaste(q.trim(), t ?? undefined);
      if (myId !== requestId.current) return;
      setResults(data);
      setState("done");
    } catch (err: any) {
      if (myId !== requestId.current) return;
      const status = err?.response?.status;
      if (status === 429) {
        showToast("info", "Slow down a moment.");
        setState("done");
      } else if (status === 503) {
        setState("unavailable");
      } else {
        setState("error");
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => run(query, type), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, type, run]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  const toggle = (r: TasteSearchResult) => {
    if (onList.has(r.qloo_entity_id)) {
      setList((prev) => prev.filter((e) => e.qloo_entity_id !== r.qloo_entity_id));
      return;
    }
    if (list.length >= MAX_ENTITIES) {
      showToast("info", `You can add up to ${MAX_ENTITIES} interests.`);
      return;
    }
    setList((prev) => [
      ...prev,
      {
        qloo_entity_id: r.qloo_entity_id,
        name: r.name,
        entity_type: r.entity_type,
        image_url: r.image_url,
        tags: r.tags,
      },
    ]);
  };

  // Back keeps the picks too (UI §13.7: "Back: Taste Profile with changes kept").
  const finish = () => {
    tasteDraft.set(list);
    goBack();
  };

  const renderRow = ({ item }: { item: TasteSearchResult }) => {
    const added = onList.has(item.qloo_entity_id);
    const full = !added && list.length >= MAX_ENTITIES;
    return (
      <View style={[styles.row, { borderBottomColor: theme.borderSubtle }]}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.rowImage} />
        ) : (
          <View style={[styles.rowImage, styles.center, { backgroundColor: theme.surfaceVariant }]}>
            <Ionicons name="sparkles-outline" size={18} color={theme.textMuted} />
          </View>
        )}
        <View style={styles.rowBody}>
          <Text numberOfLines={1} style={[styles.rowName, { color: theme.textPrimary }]}>
            {item.name}
          </Text>
          <Text style={[styles.rowType, { color: theme.textMuted }]}>{TASTE_TYPE_NAME[item.entity_type]}</Text>
        </View>
        <TouchableOpacity
          onPress={() => toggle(item)}
          style={[
            styles.addBtn,
            added
              ? { backgroundColor: theme.successLight, borderColor: theme.success }
              : { borderColor: theme.borderDefault, opacity: full ? 0.4 : 1 },
          ]}
          accessibilityLabel={added ? `Remove ${item.name}` : `Add ${item.name}`}
        >
          {added ? (
            <Text style={[styles.addedText, { color: theme.success }]}>Added</Text>
          ) : (
            <Ionicons name="add" size={18} color={theme.textPrimary} />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const emptyState = (() => {
    if (state === "loading") {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={theme.ai} />
        </View>
      );
    }
    if (state === "idle") {
      return (
        <View style={styles.center}>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>Search for something you love.</Text>
        </View>
      );
    }
    if (state === "unavailable" || state === "error") {
      return (
        <View style={styles.center}>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            {state === "unavailable" ? "Search is not available right now." : "Something went wrong."}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { borderColor: theme.borderDefault }]}
            onPress={() => run(query, type)}
          >
            <Text style={[styles.retryText, { color: theme.textPrimary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>Nothing found. Try another name.</Text>
      </View>
    );
  })();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
        translucent={false}
      />
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={finish} style={styles.headerSide} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Add interests</Text>
          <View style={styles.headerSide} />
        </View>
        <View
          style={[styles.searchBox, { backgroundColor: theme.inputBg, borderColor: theme.borderDefault }]}
        >
          <Ionicons name="search-outline" size={18} color={theme.textPlaceholder} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Search a brand, artist, film..."
            placeholderTextColor={theme.textPlaceholder}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[null, ...TASTE_TYPES].map((t) => {
            const active = type === t;
            return (
              <TouchableOpacity
                key={t ?? "all"}
                onPress={() => setType(t)}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: theme.btnPrimary, borderColor: theme.btnPrimary }
                    : { borderColor: theme.borderDefault },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? theme.btnPrimaryText : theme.textPrimary }]}>
                  {t ? TASTE_TYPE_LABELS[t] : "All"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={state === "done" ? results : []}
        keyExtractor={(r) => r.qloo_entity_id}
        renderItem={renderRow}
        ListEmptyComponent={emptyState}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      />

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing[3], backgroundColor: theme.bg, borderTopColor: theme.borderSubtle },
        ]}
      >
        <Text style={[styles.selected, { color: theme.textSecondary }]}>
          {selectedCount > 0 ? `${selectedCount} selected` : `${list.length} of ${MAX_ENTITIES}`}
        </Text>
        <TouchableOpacity style={[styles.doneBtn, { backgroundColor: theme.btnPrimary }]} onPress={finish}>
          <Text style={[styles.doneText, { color: theme.btnPrimaryText }]}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Layout.screenPadding, gap: Spacing[3], paddingBottom: Spacing[2] },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerSide: { width: 32 },
  headerTitle: { ...Typography.sectionTitle, flex: 1, textAlign: "center" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    height: Layout.inputHeight,
    borderRadius: Radius.full,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
  },
  input: { ...Typography.input, flex: 1 },
  chips: { gap: Spacing[2] },
  chip: {
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1.5],
  },
  chipText: { ...Typography.captionMedium },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing[2.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowImage: { width: 44, height: 44, borderRadius: Radius.md },
  rowBody: { flex: 1, gap: 2 },
  rowName: { ...Typography.bodyMedium },
  rowType: { ...Typography.caption },
  addBtn: {
    minWidth: 64,
    height: 32,
    borderRadius: 16,
    borderWidth: Layout.borderWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing[2],
  },
  addedText: { ...Typography.captionMedium },
  center: { alignItems: "center", justifyContent: "center", gap: Spacing[3], paddingVertical: Spacing[8] },
  hint: { ...Typography.body, textAlign: "center" },
  retryBtn: {
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  retryText: { ...Typography.buttonSm },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
  },
  selected: { ...Typography.bodyMedium },
  doneBtn: {
    height: 44,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[6],
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { ...Typography.button },
});
