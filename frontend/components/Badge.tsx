/**
 * BartCash — Badge Component
 *
 * Observed in Figma:
 *
 * CONDITION BADGE (on listing card photo — top-left corner):
 *   - "New" — green bg (#518740), white text, rounded pill
 *   - Positioned as an absolute overlay on listing images
 *
 * OFFER STATUS BADGE (on Offers tab):
 *   - "Pending"   — yellow text
 *   - "Rejected"  — red text
 *   - "Accepted"  — green text
 *   - "Countered" — blue text
 *   These appear as inline colored text labels next to the user name.
 *
 * LISTING STATUS (My Listings tabs):
 *   - "Available (18)" / "Sold (6)" — outlined pill toggle buttons
 *
 * AVAILABILITY TOGGLE (filter chips, category pills):
 *   - Selected: black bg, white text
 *   - Unselected: white bg, black/gray border
 */

import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Colors, Typography, Spacing, Radius } from "@/constants";

// ─── Condition Badge ──────────────────────────────────────────────────────────
// The green "New" badge overlay on listing card images

interface ConditionBadgeProps {
  condition: "new" | "used" | "fair";
  style?: ViewStyle;
}

export const ConditionBadge: React.FC<ConditionBadgeProps> = ({
  condition,
  style,
}) => {
  const config = {
    new: { label: "New", bg: Colors.success, text: Colors.white },
    used: { label: "Used", bg: Colors.gray[700], text: Colors.white },
    fair: { label: "Fair", bg: Colors.warning, text: Colors.primary },
  }[condition];

  return (
    <View
      style={[styles.conditionBadge, { backgroundColor: config.bg }, style]}
    >
      <Text style={[styles.conditionText, { color: config.text }]}>
        {config.label}
      </Text>
    </View>
  );
};

// ─── Offer Status Badge ────────────────────────────────────────────────────────
// Inline text badge shown on offers list (Pending / Rejected / Accepted / Countered)

type OfferStatus = "pending" | "rejected" | "accepted" | "countered";

interface OfferStatusBadgeProps {
  status: OfferStatus;
  style?: ViewStyle;
}

export const OfferStatusBadge: React.FC<OfferStatusBadgeProps> = ({
  status,
  style,
}) => {
  const config: Record<OfferStatus, { label: string; color: string }> = {
    pending: { label: "Pending", color: "#92400E" },
    rejected: { label: "Rejected", color: Colors.danger },
    accepted: { label: "Accepted", color: Colors.success },
    countered: { label: "Countered", color: Colors.info },
  };

  return (
    <View style={[style]}>
      <Text style={[styles.offerStatusText, { color: config[status].color }]}>
        {config[status].label}
      </Text>
    </View>
  );
};

// ─── Category / Filter Chip ────────────────────────────────────────────────────
// The pill-shaped category chips on Home, Search, Favourite screens

interface ChipProps {
  label: string;
  selected?: boolean;
  style?: ViewStyle;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  style,
}) => (
  <View
    style={[
      styles.chip,
      selected ? styles.chipSelected : styles.chipUnselected,
      style,
    ]}
  >
    <Text
      style={[
        styles.chipText,
        selected ? styles.chipTextSelected : styles.chipTextUnselected,
      ]}
    >
      {label}
    </Text>
  </View>
);

// ─── AI Value Tag ─────────────────────────────────────────────────────────────
// The "↗ N330k • AI Value" line shown on listing cards

interface AIValueTagProps {
  value: string;
  style?: ViewStyle;
}

export const AIValueTag: React.FC<AIValueTagProps> = ({ value, style }) => (
  <View style={[styles.aiTag, style]}>
    {/* Trend up arrow icon — replace with actual icon */}
    <Text style={styles.aiArrow}>↗</Text>
    <Text style={styles.aiValue}>{value}</Text>
    <Text style={styles.aiLabel}> • AI Value</Text>
  </View>
);

// ─── Unread Count Badge ───────────────────────────────────────────────────────
// Small red dot / number badge for notification counts

interface UnreadBadgeProps {
  count?: number;
}

export const UnreadBadge: React.FC<UnreadBadgeProps> = ({ count }) => {
  if (!count) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <View style={styles.unreadBadge}>
      <Text style={styles.unreadText}>{label}</Text>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Condition
  conditionBadge: {
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[0.5] + 1,
    borderRadius: Radius.xs,
    alignSelf: "flex-start",
  },
  conditionText: {
    ...Typography.badge,
  },

  // Offer status
  offerStatusText: {
    ...Typography.badge,
    fontSize: 13,
  },

  // Chip
  chip: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2] - 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipUnselected: {
    backgroundColor: Colors.white,
    borderColor: Colors.border.default,
  },
  chipText: {
    ...Typography.captionMedium,
  },
  chipTextSelected: {
    color: Colors.white,
  },
  chipTextUnselected: {
    color: Colors.text.secondary,
  },

  // AI Value Tag
  aiTag: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiArrow: {
    fontSize: 12,
    color: Colors.ai,
    marginRight: 2,
  },
  aiValue: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  aiLabel: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },

  // Unread badge
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: Radius.full,
    backgroundColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadText: {
    ...Typography.micro,
    color: Colors.white,
    fontWeight: "700",
  },
});
