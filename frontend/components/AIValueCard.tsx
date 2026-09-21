/**
 * BartCash — AIValueCard Component
 *
 * The prominent AI Estimated Value display card, used on:
 *   - Listing Detail screen: single item value ($85 - $95)
 *   - Review Listing screen: same card + Override toggle
 *   - Make Offer screen: two-column comparison (Your item vs Their item)
 *   - Chat thread: inline trade offer card
 *
 * Anatomy from Figma:
 *   ┌──────────────────────────────────────┐
 *   │  ✦ AI Estimated Value (purple label) │
 *   │                                      │
 *   │         $85 - $95       (large bold) │
 *   │  Based on similar items and market data │
 *   │                                      │
 *   │  Confidence level        80%         │
 *   │  ████████████████████░░░░  (bar)     │
 *   │  ⓘ High Confidence based on 127...  │
 *   └──────────────────────────────────────┘
 *
 * The progress bar color is purple (#6750A4).
 *
 * Comparison variant (Make Offer):
 *   ┌────────────────────────────────────────┐
 *   │  ✦ AI Estimated Value                  │
 *   │  Your item value   |  Their item value  │
 *   │  $80-$120          |  $90-$130          │
 *   │  Trade match score              80%     │
 *   │  ████████████████████░░  (purple bar)  │
 *   │  ✓ This is a fair trade!               │
 *   └────────────────────────────────────────┘
 */

import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Colors, Typography, Spacing, Radius, Shadows } from "@/constants";

// ─── Single Item AI Value Card ─────────────────────────────────────────────

interface AIValueCardProps {
  value: string; // e.g. "$85 - $95" or "N330k"
  subtitle?: string; // e.g. "Based on similar items and market data"
  confidence: number; // 0–100
  confidenceLabel: string; // e.g. "High Confidence based on 127 similar items"
  style?: ViewStyle;
}

export const AIValueCard: React.FC<AIValueCardProps> = ({
  value,
  subtitle = "Based on similar items and market data",
  confidence,
  confidenceLabel,
  style,
}) => (
  <View style={[styles.card, style]}>
    <AIHeader />

    <Text style={styles.value}>{value}</Text>
    <Text style={styles.subtitle}>{subtitle}</Text>

    <ConfidenceBar confidence={confidence} label={confidenceLabel} />
  </View>
);

// ─── Comparison AI Value Card (Make Offer) ────────────────────────────────

interface AIComparisonCardProps {
  yourValue: string;
  theirValue: string;
  matchScore: number; // 0–100
  isFairTrade: boolean;
  fairTradeLabel?: string;
  style?: ViewStyle;
}

export const AIComparisonCard: React.FC<AIComparisonCardProps> = ({
  yourValue,
  theirValue,
  matchScore,
  isFairTrade,
  fairTradeLabel = "This is a fair trade!",
  style,
}) => (
  <View style={[styles.card, style]}>
    <AIHeader />

    <View style={styles.comparisonRow}>
      <View style={styles.comparisonCol}>
        <Text style={styles.comparisonLabel}>Your item value</Text>
        <Text style={styles.comparisonValue}>{yourValue}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.comparisonCol}>
        <Text style={styles.comparisonLabel}>Their item value</Text>
        <Text style={styles.comparisonValue}>{theirValue}</Text>
      </View>
    </View>

    <TradeMatchBar
      score={matchScore}
      isFair={isFairTrade}
      label={fairTradeLabel}
    />
  </View>
);

// ─── Chat Trade Offer Card ────────────────────────────────────────────────
// The embedded card within the chat thread showing the offer details

interface TradeOfferCardProps {
  theyOffer: {
    title: string;
    condition: string;
    category: string;
    postedAt: string;
    aiValue: string;
  };
  yourOffer: {
    title: string;
    condition: string;
    category: string;
    postedAt: string;
    aiValue: string;
  };
  matchScore: number;
  isFairTrade: boolean;
  expiresIn: string; // e.g. "23 hours 45 mins"
  onAccept?: () => void;
  onReject?: () => void;
  style?: ViewStyle;
}

export const TradeOfferCard: React.FC<TradeOfferCardProps> = ({
  theyOffer,
  yourOffer,
  matchScore,
  isFairTrade,
  expiresIn,
  onAccept,
  onReject,
  style,
}) => {
  const { TouchableOpacity } = require("react-native");
  return (
    <View style={[styles.offerCard, style]}>
      {/* Header */}
      <View style={styles.offerHeader}>
        <Text style={styles.offerHeaderTitle}>Trade Offer</Text>
        <Text style={styles.offerExpiry}>Expires in {expiresIn}</Text>
      </View>

      {/* They offer */}
      <View style={styles.offerItem}>
        <Text style={styles.offerItemLabel}>They offer</Text>
        <Text style={styles.offerItemTitle}>{theyOffer.title}</Text>
        <Text style={styles.offerItemMeta}>
          {theyOffer.condition} • 📦 {theyOffer.category} • ⏱{" "}
          {theyOffer.postedAt}
        </Text>
        <Text style={styles.offerItemValue}>
          ↗ {theyOffer.aiValue} • AI Value
        </Text>
      </View>

      {/* Swap icon */}
      <View style={styles.swapIconRow}>
        <Text style={styles.swapIcon}>⇅</Text>
      </View>

      {/* Your offer */}
      <View style={styles.offerItem}>
        <Text style={styles.offerItemLabel}>Your Offer</Text>
        <Text style={styles.offerItemTitle}>{yourOffer.title}</Text>
        <Text style={styles.offerItemMeta}>
          {yourOffer.condition} • 📦 {yourOffer.category} • ⏱{" "}
          {yourOffer.postedAt}
        </Text>
        <Text style={styles.offerItemValue}>
          ↗ {yourOffer.aiValue} • AI Value
        </Text>
      </View>

      {/* Match score */}
      <TradeMatchBar
        score={matchScore}
        isFair={isFairTrade}
        label="This is a fair trade!"
      />

      {/* Actions */}
      <View style={styles.offerActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={onAccept}
          activeOpacity={0.8}
        >
          <Text style={styles.acceptText}>Accept Offer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={onReject}
          activeOpacity={0.8}
        >
          <Text style={styles.rejectText}>Reject Offer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Shared Sub-components ────────────────────────────────────────────────────

const AIHeader = () => (
  <View style={styles.aiHeader}>
    <Text style={styles.aiSparkle}>✦</Text>
    <Text style={styles.aiHeaderText}>AI Estimated Value</Text>
  </View>
);

const ConfidenceBar: React.FC<{ confidence: number; label: string }> = ({
  confidence,
  label,
}) => (
  <View style={styles.confidenceContainer}>
    <View style={styles.confidenceRow}>
      <Text style={styles.confidenceKey}>Confidence level</Text>
      <Text style={styles.confidenceValue}>{confidence}%</Text>
    </View>
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${confidence}%` }]} />
    </View>
    <View style={styles.confidenceNote}>
      <Text style={styles.infoIcon}>ⓘ</Text>
      <Text style={styles.confidenceNoteText}>{label}</Text>
    </View>
  </View>
);

const TradeMatchBar: React.FC<{
  score: number;
  isFair: boolean;
  label: string;
}> = ({ score, isFair, label }) => (
  <View style={styles.matchContainer}>
    <View style={styles.confidenceRow}>
      <Text style={styles.confidenceKey}>Trade match score</Text>
      <Text style={[styles.confidenceValue, { color: Colors.success }]}>
        {score}%
      </Text>
    </View>
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${score}%` }]} />
    </View>
    {isFair && (
      <View style={styles.fairTradeRow}>
        <Text style={styles.fairTradeCheck}>✓</Text>
        <Text style={styles.fairTradeText}>{label}</Text>
      </View>
    )}
  </View>
);

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: Spacing[2],
    ...Shadows.xs,
  },

  // AI Header
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[1],
  },
  aiSparkle: {
    fontSize: 14,
    color: Colors.ai,
  },
  aiHeaderText: {
    ...Typography.captionMedium,
    color: Colors.ai,
  },

  // Value
  value: {
    ...Typography.aiValue,
    color: Colors.text.primary,
    textAlign: "center",
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: "center",
  },

  // Confidence bar
  confidenceContainer: {
    gap: Spacing[1],
  },
  confidenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confidenceKey: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  confidenceValue: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  barTrack: {
    height: 8,
    backgroundColor: Colors.gray[200],
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: Colors.ai,
    borderRadius: Radius.full,
  },
  confidenceNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  infoIcon: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  confidenceNoteText: {
    ...Typography.micro,
    color: Colors.text.tertiary,
    flex: 1,
  },

  // Comparison
  comparisonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[4],
  },
  comparisonCol: {
    flex: 1,
    gap: 2,
  },
  comparisonLabel: {
    ...Typography.micro,
    color: Colors.text.tertiary,
  },
  comparisonValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  divider: {
    width: 1,
    backgroundColor: Colors.border.subtle,
    alignSelf: "stretch",
  },

  // Match bar
  matchContainer: {
    gap: Spacing[1],
  },
  fairTradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[1],
    borderWidth: 1,
    borderColor: Colors.success,
  },
  fairTradeCheck: {
    fontSize: 13,
    color: Colors.success,
  },
  fairTradeText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: "600",
  },

  // Offer card (chat)
  offerCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: "hidden",
    ...Shadows.sm,
  },
  offerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2.5],
  },
  offerHeaderTitle: {
    ...Typography.bodyMedium,
    color: Colors.white,
    fontWeight: "700",
  },
  offerExpiry: {
    ...Typography.micro,
    color: Colors.white,
    opacity: 0.85,
  },
  offerItem: {
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    margin: Spacing[3],
    borderRadius: Radius.md,
    gap: 4,
  },
  offerItemLabel: {
    ...Typography.micro,
    color: Colors.text.tertiary,
  },
  offerItemTitle: {
    ...Typography.offerTitle,
    color: Colors.text.primary,
  },
  offerItemMeta: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  offerItemValue: {
    ...Typography.captionMedium,
    color: Colors.ai,
  },
  swapIconRow: {
    alignItems: "center",
    marginVertical: -Spacing[1],
  },
  swapIcon: {
    fontSize: 20,
    color: Colors.text.secondary,
  },
  offerActions: {
    flexDirection: "row",
    padding: Spacing[3],
    gap: Spacing[2],
  },
  acceptButton: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: {
    ...Typography.button,
    color: Colors.text.primary,
  },
  rejectButton: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectText: {
    ...Typography.button,
    color: Colors.white,
  },
});
