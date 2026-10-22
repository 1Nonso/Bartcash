/**
 * Scout UI building blocks (UI spec §13.2): ScoutBadge, ScoreLabel,
 * InlineRefreshNote, LensCard, MatchCard, CheckRow, WantChip, TagChip and
 * CompatibilityPill.
 * Copy rules: never show numeric scores; with a fallback source, avoid
 * "taste" wording (callers pass the text).
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import type { CheckResult, ScoreLabelValue } from "@/config/items";
import type { MatchEntry } from "@/config/matches";
import type { CompatLabel } from "@/config/taste";
import { InfoSheet } from "@/components/guide/InfoSheet";

type Theme = ReturnType<typeof useAuthTheme>;

// ─── Thumb: image with a placeholder when missing or failing to load ──────────

function Thumb({ uri, style, iconSize }: { uri: string | null; style: object; iconSize: number }) {
  const theme = useAuthTheme();
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[style, styles.center, { backgroundColor: theme.surfaceVariant }]}>
        <Ionicons name="image-outline" size={iconSize} color={theme.textMuted} />
      </View>
    );
  }
  return (
    <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setFailed(true)} />
  );
}

// ─── ScoutBadge ───────────────────────────────────────────────────────────────

/** Tapping the badge opens "How Scout works" (components/guide). */
export function ScoutBadge({ style }: { style?: object }) {
  const theme = useAuthTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="How Scout works"
        style={[styles.scoutBadge, { backgroundColor: theme.aiLight }, style]}
      >
        <Ionicons name="sparkles" size={12} color={theme.ai} />
        <Text style={[styles.scoutBadgeText, { color: theme.ai }]}>Scout</Text>
        <Ionicons name="information-circle-outline" size={12} color={theme.ai} />
      </TouchableOpacity>
      <InfoSheet topic="scout" visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

// ─── ScoreLabel ───────────────────────────────────────────────────────────────

const LABEL_TEXT: Record<ScoreLabelValue, string> = {
  strong: "Strong match",
  good: "Good match",
  possible: "Possible match",
};

function labelColors(label: ScoreLabelValue, theme: Theme) {
  if (label === "strong") return { fg: theme.success, bg: theme.successLight };
  if (label === "good") return { fg: theme.info, bg: theme.infoLight };
  return { fg: theme.textSecondary, bg: theme.surfaceVariant };
}

/** Always shows text; colour never carries the meaning alone. */
export function ScoreLabel({ label }: { label: ScoreLabelValue }) {
  const theme = useAuthTheme();
  const c = labelColors(label, theme);
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{LABEL_TEXT[label]}</Text>
    </View>
  );
}

// ─── InlineRefreshNote ────────────────────────────────────────────────────────

export function InlineRefreshNote({ text }: { text: string }) {
  const theme = useAuthTheme();
  return (
    <View style={styles.refreshNote}>
      <ActivityIndicator size={14} color={theme.ai} />
      <Text style={[styles.refreshNoteText, { color: theme.textSecondary }]}>
        {text}
      </Text>
    </View>
  );
}

// ─── LensCard ─────────────────────────────────────────────────────────────────

interface LensCardProps {
  title: string;
  image: string | null;
  selected: boolean;
  onPress: () => void;
  /** Match count; null hides the pill. */
  count?: number | null;
  refreshing?: boolean;
  /** The listing has no wants: show "Add wants" instead of a count. */
  needsWants?: boolean;
}

export function LensCard({ title, image, selected, onPress, count, refreshing, needsWants }: LensCardProps) {
  const theme = useAuthTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Matches for ${title}`}
      style={[
        styles.lens,
        {
          backgroundColor: theme.surface,
          borderColor: selected ? theme.btnPrimary : theme.cardBorder,
          borderWidth: selected ? 2 : Layout.borderWidth,
        },
      ]}
    >
      <Thumb key={image ?? "none"} uri={image} style={styles.lensImage} iconSize={22} />
      <Text numberOfLines={1} style={[styles.lensTitle, { color: theme.textPrimary }]}>
        {title}
      </Text>
      {needsWants ? (
        <View style={[styles.countPill, { backgroundColor: theme.surfaceVariant }]}>
          <Text style={[styles.countPillText, { color: theme.textSecondary }]}>Add wants</Text>
        </View>
      ) : refreshing ? (
        <ActivityIndicator size={12} color={theme.ai} style={styles.lensSpinner} />
      ) : count != null ? (
        <View style={[styles.countPill, { backgroundColor: theme.aiLight }]}>
          <Text style={[styles.countPillText, { color: theme.ai }]}>
            {count} {count === 1 ? "match" : "matches"}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function AddListingLensCard({ onPress }: { onPress: () => void }) {
  const theme = useAuthTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Add listing"
      style={[styles.lens, styles.center, styles.addLens, { borderColor: theme.borderDefault }]}
    >
      <Ionicons name="add-circle-outline" size={28} color={theme.textSecondary} />
      <Text style={[styles.lensTitle, { color: theme.textSecondary, textAlign: "center" }]}>
        Add listing
      </Text>
    </TouchableOpacity>
  );
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

export function MatchCard({ match, onPress }: { match: MatchEntry; onPress: () => void }) {
  const theme = useAuthTheme();
  const { item, owner } = match;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.match, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
    >
      <Thumb key={item.primary_image ?? "none"} uri={item.primary_image} style={styles.matchImage} iconSize={24} />
      <View style={styles.matchBody}>
        <Text numberOfLines={2} style={[styles.matchTitle, { color: theme.textPrimary }]}>
          {item.title}
        </Text>
        <View style={styles.ownerRow}>
          {owner.profile_photo ? (
            <Image source={{ uri: owner.profile_photo }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.center, { backgroundColor: theme.surfaceVariant }]}>
              <Text style={[styles.avatarText, { color: theme.textSecondary }]}>
                {owner.first_name?.[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <Text numberOfLines={1} style={[styles.ownerName, { color: theme.textSecondary }]}>
            {owner.first_name} {owner.last_name}
          </Text>
        </View>
        {match.score_label && (
          <View style={styles.matchLabel}>
            <ScoreLabel label={match.score_label} />
          </View>
        )}
        {match.reason && (
          <Text numberOfLines={1} style={[styles.matchReason, { color: theme.textSecondary }]}>
            {match.reason}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── CheckRow ─────────────────────────────────────────────────────────────────

const RESULT_TEXT: Record<CheckResult, string> = {
  strong: "Strong",
  partial: "Partial",
  none: "None",
  unknown: "Unknown",
};

const RESULT_ICON: Record<CheckResult, keyof typeof Ionicons.glyphMap> = {
  strong: "checkmark-circle",
  partial: "ellipse-outline",
  none: "remove-circle-outline",
  unknown: "help-circle-outline",
};

export function CheckRow({ label, result }: { label: string; result: CheckResult }) {
  const theme = useAuthTheme();
  const color =
    result === "strong" ? theme.success : result === "partial" ? theme.info : theme.textSecondary;
  return (
    <View style={styles.checkRow}>
      <Ionicons name={RESULT_ICON[result]} size={16} color={color} />
      <Text style={[styles.checkLabel, { color: theme.textPrimary }]}>{label}</Text>
      <Text style={[styles.checkResult, { color }]}>{RESULT_TEXT[result]}</Text>
    </View>
  );
}

// ─── WantChip (read-only) ─────────────────────────────────────────────────────

export function WantChip({ name, rank }: { name: string; rank: number }) {
  const theme = useAuthTheme();
  return (
    <View style={[styles.wantChip, { backgroundColor: theme.btnPrimary }]}>
      <View style={[styles.rankBadge, { backgroundColor: theme.btnPrimaryText }]}>
        <Text style={[styles.rankText, { color: theme.btnPrimary }]}>{rank}</Text>
      </View>
      <Text style={[styles.wantChipText, { color: theme.btnPrimaryText }]}>{name}</Text>
    </View>
  );
}

/** A plain chip, e.g. a shared Qloo tag. */
export function TagChip({ name }: { name: string }) {
  const theme = useAuthTheme();
  return (
    <View style={[styles.tagChip, { backgroundColor: theme.aiLight }]}>
      <Text style={[styles.tagChipText, { color: theme.ai }]}>{name}</Text>
    </View>
  );
}

// ─── CompatibilityPill ────────────────────────────────────────────────────────

const COMPAT_TEXT: Record<CompatLabel, string> = {
  high: "High taste in common",
  medium: "Good taste in common",
  low: "Some taste in common",
};

/** Taste compatibility between two people; words only, never a score. */
export function CompatibilityPill({ label }: { label: CompatLabel }) {
  const theme = useAuthTheme();
  const c =
    label === "high"
      ? { fg: theme.success, bg: theme.successLight }
      : label === "medium"
        ? { fg: theme.info, bg: theme.infoLight }
        : { fg: theme.textSecondary, bg: theme.surfaceVariant };
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{COMPAT_TEXT[label]}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },

  scoutBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
  },
  scoutBadgeText: { fontSize: 12, fontWeight: "600" },

  pill: {
    alignSelf: "flex-start",
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
  },
  pillText: { ...Typography.captionMedium },

  refreshNote: { flexDirection: "row", alignItems: "center", gap: Spacing[1.5] },
  refreshNoteText: { ...Typography.caption },

  lens: {
    width: 96,
    height: 120,
    borderRadius: Radius.lg,
    padding: Spacing[1.5],
    gap: 4,
  },
  addLens: { borderStyle: "dashed", borderWidth: 1.5 },
  lensImage: { width: "100%", height: 56, borderRadius: Radius.md },
  lensTitle: { ...Typography.captionMedium },
  lensSpinner: { alignSelf: "flex-start" },
  countPill: {
    alignSelf: "flex-start",
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[1.5],
    paddingVertical: 1,
  },
  countPillText: { fontSize: 10, fontWeight: "600" },

  match: {
    flexDirection: "row",
    gap: Spacing[3],
    padding: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
  },
  matchImage: { width: 72, height: 72, borderRadius: Radius.md },
  matchBody: { flex: 1, gap: 4 },
  matchTitle: { ...Typography.cardTitle },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: Spacing[1.5] },
  avatar: { width: 18, height: 18, borderRadius: 9 },
  avatarText: { fontSize: 10, fontWeight: "600" },
  ownerName: { ...Typography.caption, flex: 1 },
  matchLabel: { marginTop: 2 },
  matchReason: { ...Typography.caption },

  checkRow: { flexDirection: "row", alignItems: "center", gap: Spacing[2], paddingVertical: 4 },
  checkLabel: { ...Typography.body, flex: 1 },
  checkResult: { ...Typography.captionMedium },

  wantChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[1.5],
    borderRadius: 20,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1.5],
  },
  rankBadge: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 11, fontWeight: "700" },
  wantChipText: { ...Typography.captionMedium },

  tagChip: { borderRadius: 20, paddingHorizontal: Spacing[2.5], paddingVertical: 4 },
  tagChipText: { ...Typography.caption },
});
