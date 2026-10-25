/**
 * WantPicker — "What would you take in exchange?" (UI §13.8, §13.9)
 *
 * Shows Scout's five suggested categories (SuggestionCards), lets the owner
 * pick up to three in order of preference, and holds the optional
 * "Anything specific?" note. Used by Review and Publish and by Edit Listing.
 *
 * API:
 *   GET /items/{id}/want-suggestions  — polled every 2 s while pending, 20 s max
 *   GET /categories                   — names for "Show all categories"
 *
 * Nothing is preselected by Scout; the parent owns the picks and the note.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Category, getCategories } from "@/config/items";
import { ScoutBadge } from "@/components/scout";
import {
  WantSuggestion,
  WantSuggestionsData,
  getWantSuggestions,
} from "@/config/wants";

const MAX_PICKS = 3;
const NOTE_MAX = 500;
const POLL_DEFAULT_MS = 2000;
const POLL_TIMEOUT_MS = 20000;

/** Category icon names from the seed -> Ionicons. */
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  device: "phone-portrait-outline",
  shirt: "shirt-outline",
  sofa: "bed-outline",
  car: "car-outline",
  dumbbell: "barbell-outline",
  book: "book-outline",
  baby: "happy-outline",
  handshake: "hand-left-outline",
  grid: "grid-outline",
};

function iconFor(c: Category): keyof typeof Ionicons.glyphMap {
  return (c.icon && ICONS[c.icon]) || "pricetag-outline";
}

interface WantPickerProps {
  itemId: string;
  /** Picked category ids in rank order. */
  picked: string[];
  onChangePicked: (ids: string[]) => void;
  note: string;
  onChangeNote: (note: string) => void;
  /** Called once with the first response (Edit uses it to preselect). */
  onLoaded?: (data: WantSuggestionsData) => void;
  /** Shows "Pick at least one category." under the cards. */
  showPickError?: boolean;
  /** Read only (item in a trade). */
  disabled?: boolean;
}

type LoadState = "loading" | "ready" | "timeout" | "error";

export default function WantPicker({
  itemId,
  picked,
  onChangePicked,
  note,
  onChangeNote,
  onLoaded,
  showPickError = false,
  disabled = false,
}: WantPickerProps) {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<WantSuggestionsData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [categories, setCategories] = useState<Category[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  // ── Polling ────────────────────────────────────────────────────────────────

  const load = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const d = await getWantSuggestions(itemId);
        if (!loadedRef.current) {
          loadedRef.current = true;
          onLoadedRef.current?.(d);
        }
        if (d.status !== "pending") {
          setData(d);
          setState("ready");
          return;
        }
        // Past 20 s the server answers with its fallback; one last try,
        // then offer Retry instead of an endless spinner.
        const elapsed = Date.now() - startedAt;
        if (elapsed > POLL_TIMEOUT_MS + POLL_DEFAULT_MS) {
          setState("timeout");
          return;
        }
        timerRef.current = setTimeout(
          tick,
          d.retry_after_ms ?? POLL_DEFAULT_MS,
        );
      } catch {
        setState("error");
      }
    };
    tick();
  }, [itemId]);

  const retry = useCallback(() => {
    setState("loading");
    load();
  }, [load]);

  useEffect(() => {
    load();
    getCategories()
      .then(setCategories)
      .catch(() => {});
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [load]);

  // ── Picking ────────────────────────────────────────────────────────────────

  const toggle = useCallback(
    (id: string) => {
      if (disabled) return;
      if (picked.includes(id)) onChangePicked(picked.filter((p) => p !== id));
      else if (picked.length < MAX_PICKS) onChangePicked([...picked, id]);
    },
    [disabled, picked, onChangePicked],
  );

  const suggestions: WantSuggestion[] = useMemo(
    () => data?.suggestions ?? [],
    [data],
  );

  // Picks outside the five (from "Show all" or an earlier edit).
  const extraPicks: Category[] = useMemo(() => {
    const shown = new Set(suggestions.map((s) => s.category.id));
    return picked
      .filter((id) => !shown.has(id))
      .map((id) => categories.find((c) => c.id === id))
      .filter((c): c is Category => !!c);
  }, [picked, suggestions, categories]);

  const isScout = data?.source === "qloo";
  // Reason text on a selected (inverted) card.
  const selectedReason = theme.isDark ? Colors.ai : Colors.aiLight;

  // ── Cards ──────────────────────────────────────────────────────────────────

  const renderCard = (category: Category, reason: string | null) => {
    const rank = picked.indexOf(category.id) + 1;
    const selected = rank > 0;
    const blocked = !selected && picked.length >= MAX_PICKS;
    return (
      <TouchableOpacity
        key={category.id}
        style={[
          styles.card,
          {
            backgroundColor: selected ? theme.btnPrimary : theme.surface,
            borderColor: selected ? theme.btnPrimary : theme.cardBorder,
            opacity: blocked || disabled ? 0.45 : 1,
          },
        ]}
        onPress={() => toggle(category.id)}
        disabled={blocked || disabled}
        activeOpacity={0.85}
      >
        <View style={styles.cardRow}>
          <Ionicons
            name={iconFor(category)}
            size={18}
            color={selected ? theme.btnPrimaryText : theme.textPrimary}
          />
          <Text
            style={[
              styles.cardName,
              { color: selected ? theme.btnPrimaryText : theme.textPrimary },
            ]}
            numberOfLines={1}
          >
            {category.name}
          </Text>
          {selected && (
            <View
              style={[styles.rankBadge, { backgroundColor: theme.btnPrimaryText }]}
            >
              <Text style={[styles.rankText, { color: theme.btnPrimary }]}>
                {rank}
              </Text>
            </View>
          )}
        </View>
        {reason && (
          <Text
            style={[
              styles.cardReason,
              { color: selected ? selectedReason : theme.ai },
            ]}
            numberOfLines={2}
          >
            {reason}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderSuggestions = () => {
    if (state === "loading") {
      return (
        <>
          <View style={styles.pendingRow}>
            <ActivityIndicator size="small" color={theme.ai} />
            <Text style={[styles.pendingText, { color: theme.textMuted }]}>
              Scout is thinking...
            </Text>
          </View>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[styles.skeleton, { backgroundColor: theme.aiLight }]}
            />
          ))}
        </>
      );
    }
    if (state === "timeout" || state === "error") {
      return (
        <View>
          <Text style={[styles.pendingText, { color: theme.textMuted }]}>
            {state === "timeout"
              ? "Suggestions are taking longer than usual."
              : "Could not load suggestions."}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { borderColor: theme.borderDefault }]}
            onPress={retry}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={14} color={theme.ai} />
            <Text style={[styles.retryText, { color: theme.ai }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <>
        {suggestions.map((s) => renderCard(s.category, isScout ? s.reason : null))}
        {extraPicks.map((c) => renderCard(c, null))}
      </>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.aiSurface }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          What would you take in exchange?
        </Text>
      </View>
      <Text style={[styles.why, { color: theme.textSecondary }]}>
        Scout uses these to find people who have what you want.
      </Text>
      <View style={styles.subRow}>
        <Text style={[styles.sub, { color: theme.textMuted }]}>
          Pick up to 3, most wanted first.
        </Text>
        <Text style={[styles.count, { color: theme.ai }]}>
          {picked.length} of {MAX_PICKS}
        </Text>
      </View>

      {state === "ready" &&
        (isScout ? (
          <ScoutBadge style={styles.scoutBadge} />
        ) : (
          <Text style={[styles.popular, { color: theme.textMuted }]}>
            Popular choices
          </Text>
        ))}

      <View style={styles.cards}>{renderSuggestions()}</View>

      {showPickError && picked.length === 0 && (
        <Text style={styles.errorText}>Pick at least one category.</Text>
      )}

      {!disabled && categories.length > 0 && (
        <TouchableOpacity
          onPress={() => setSheetOpen(true)}
          activeOpacity={0.7}
          style={styles.showAll}
        >
          <Text style={[styles.showAllText, { color: theme.ai }]}>
            Show all categories
          </Text>
        </TouchableOpacity>
      )}

      {/* Note */}
      <Text style={[styles.noteLabel, { color: theme.textPrimary }]}>
        Anything specific?{" "}
        <Text style={{ color: theme.textMuted }}>(optional)</Text>
      </Text>
      <TextInput
        style={[
          styles.note,
          {
            backgroundColor: noteFocused ? theme.inputBgFocused : theme.inputBg,
            borderColor: noteFocused ? theme.borderFocus : theme.borderDefault,
            color: theme.textPrimary,
          },
        ]}
        placeholder="For example: an iPhone 12 or newer"
        placeholderTextColor={theme.textPlaceholder}
        value={note}
        onChangeText={onChangeNote}
        onFocus={() => setNoteFocused(true)}
        onBlur={() => setNoteFocused(false)}
        editable={!disabled}
        multiline
        maxLength={NOTE_MAX}
        textAlignVertical="top"
      />
      <Text style={[styles.charCount, { color: theme.textMuted }]}>
        {note.length}/{NOTE_MAX} characters
      </Text>

      {/* All categories sheet */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setSheetOpen(false)}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.bg,
              paddingBottom: insets.bottom + Spacing[4],
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              All categories
            </Text>
            <Text style={[styles.count, { color: theme.ai }]}>
              {picked.length} of {MAX_PICKS}
            </Text>
          </View>
          <ScrollView contentContainerStyle={styles.cards}>
            {categories.map((c) => renderCard(c, null))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: theme.btnPrimary }]}
            onPress={() => setSheetOpen(false)}
            activeOpacity={0.9}
          >
            <Text style={[styles.doneText, { color: theme.btnPrimaryText }]}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { borderRadius: Radius.lg, padding: Spacing[4] },
  headerRow: { flexDirection: "row", alignItems: "center" },
  title: { ...Typography.bodyMedium, flex: 1 },
  why: { ...Typography.caption, marginTop: 2 },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: Spacing[3],
  },
  sub: { ...Typography.caption, flex: 1 },
  count: { ...Typography.captionMedium },

  scoutBadge: { marginBottom: Spacing[2] },
  popular: { ...Typography.captionMedium, marginBottom: Spacing[2] },

  cards: { gap: Spacing[2] },
  card: {
    borderRadius: 20,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },
  cardName: { ...Typography.bodyMedium, flex: 1 },
  cardReason: { ...Typography.caption, marginTop: Spacing[1], marginLeft: 26 },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 12, fontWeight: "700" },

  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    marginBottom: Spacing[1],
  },
  pendingText: { ...Typography.body },
  skeleton: { height: 46, borderRadius: 20, opacity: 0.6 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.lg,
    paddingVertical: Spacing[2],
    marginTop: Spacing[3],
  },
  retryText: { ...Typography.captionMedium },
  errorText: { ...Typography.caption, color: Colors.danger, marginTop: Spacing[2] },

  showAll: { alignSelf: "flex-start", paddingVertical: Spacing[2], marginTop: Spacing[1] },
  showAllText: { ...Typography.captionMedium },

  noteLabel: { ...Typography.bodyMedium, marginTop: Spacing[3], marginBottom: Spacing[2] },
  note: {
    minHeight: 80,
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    ...Typography.input,
  },
  charCount: { ...Typography.micro, marginTop: Spacing[1], alignSelf: "flex-end" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    maxHeight: "75%",
    borderTopLeftRadius: Radius["2xl"],
    borderTopRightRadius: Radius["2xl"],
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
    gap: Spacing[3],
  },
  sheetHeader: { flexDirection: "row", alignItems: "center" },
  doneBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { ...Typography.button },
});
