/**
 * BartCash — ListingCard Component
 *
 * Used on: Home (Discover), Search results, Favourite, My Listings
 *
 * Grid card anatomy from Figma:
 *   ┌──────────────────────┐
 *   │  [Photo]             │  ← Square image, fills card width
 *   │  [New badge]  [♡]    │  ← Overlays on photo
 *   ├──────────────────────┤
 *   │  iPhone 11 - 64GB    │  ← cardTitle (semibold 14sp)
 *   │  ↗ N330k • AI Value  │  ← AIValueTag (12sp, purple arrow)
 *   │  📍 1.1 mi away      │  ← caption, gray
 *   │  [Offer Trade →]     │  ← sm ghost/secondary button
 *   └──────────────────────┘
 *
 * My Listings variant adds:
 *   │  48 views  12 saves  5 offers
 *   │  [✏️ Edit Listing Details]  [🗑]
 *
 * Favourite variant: heart is filled red (already saved)
 */

import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  ImageSourcePropType,
} from "react-native";
import {
  Colors,
  Typography,
  Spacing,
  Radius,
  Shadows,
  Layout,
} from "@/constants";
import { ConditionBadge, AIValueTag } from "./Badge";

export interface ListingCardData {
  id: string;
  title: string;
  condition: "new" | "used" | "fair";
  aiValue: string; // e.g. "N330k"
  distance?: string; // e.g. "1.1 mi away"
  image: ImageSourcePropType;
  isFavourited?: boolean;
  // My Listings extras
  views?: number;
  saves?: number;
  offers?: number;
}

interface ListingCardProps {
  data: ListingCardData;
  variant?: "marketplace" | "mylistings" | "favourite";
  onPress?: () => void;
  onFavouritePress?: () => void;
  onOfferTradePress?: () => void;
  onEditPress?: () => void;
  onDeletePress?: () => void;
  style?: ViewStyle;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  data,
  variant = "marketplace",
  onPress,
  onFavouritePress,
  onOfferTradePress,
  onEditPress,
  onDeletePress,
  style,
}) => {
  const isMyListings = variant === "mylistings";

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPress}
      style={[styles.card, style]}
    >
      {/* ── Photo ──────────────────────────────────────────────── */}
      <View style={styles.imageWrapper}>
        <Image source={data.image} style={styles.image} resizeMode="cover" />

        {/* Condition badge — top left */}
        <ConditionBadge
          condition={data.condition}
          style={styles.conditionOverlay}
        />

        {/* Favourite heart — top right */}
        <TouchableOpacity
          style={styles.heartButton}
          onPress={onFavouritePress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.heartCircle}>
            <Text style={styles.heartIcon}>
              {data.isFavourited ? "❤️" : "🤍"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Info ────────────────────────────────────────────────── */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {data.title}
        </Text>

        <AIValueTag value={data.aiValue} style={styles.aiTag} />

        {data.distance && (
          <View style={styles.locationRow}>
            <Text style={styles.locationPin}>📍</Text>
            <Text style={styles.locationText}>{data.distance}</Text>
          </View>
        )}

        {/* My Listings stats row */}
        {isMyListings && (
          <View style={styles.statsRow}>
            <StatItem value={data.views ?? 0} label="views" />
            <StatItem value={data.saves ?? 0} label="saves" />
            <StatItem value={data.offers ?? 0} label="offers" />
          </View>
        )}

        {/* CTA row */}
        <View style={styles.ctaRow}>
          {isMyListings ? (
            <>
              <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
                <Text style={styles.editButtonText}>
                  ✏️ Edit Listing Details
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={onDeletePress}
              >
                <Text style={styles.deleteIcon}>🗑️</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.offerTradeButton}
              onPress={onOfferTradePress}
            >
              <Text style={styles.offerTradeText}>Offer Trade</Text>
              <Text style={styles.offerTradeArrow}> ⇄</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Sub-component: Stats Item (My Listings) ─────────────────────────────────
const StatItem: React.FC<{ value: number; label: string }> = ({
  value,
  label,
}) => (
  <View style={statStyles.item}>
    <Text style={statStyles.value}>{value}</Text>
    <Text style={statStyles.label}>{label}</Text>
  </View>
);

const statStyles = StyleSheet.create({
  item: { alignItems: "center", flex: 1 },
  value: {
    ...Typography.captionMedium,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  label: { ...Typography.micro, color: Colors.text.tertiary },
});

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: "hidden",
    ...Shadows.sm,
  },

  // Photo
  imageWrapper: {
    width: "100%",
    aspectRatio: Layout.listingCardAspect,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  conditionOverlay: {
    position: "absolute",
    top: Spacing[2],
    left: Spacing[2],
  },
  heartButton: {
    position: "absolute",
    top: Spacing[2],
    right: Spacing[2],
  },
  heartCircle: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.sm,
  },
  heartIcon: {
    fontSize: 14,
  },

  // Info section
  info: {
    padding: Spacing[2],
    gap: Spacing[1],
  },
  title: {
    ...Typography.cardTitle,
    color: Colors.text.primary,
  },
  aiTag: {
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  locationPin: {
    fontSize: 11,
  },
  locationText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },

  // Stats (My Listings)
  statsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    paddingTop: Spacing[1.5],
    marginTop: Spacing[1],
  },

  // CTA row
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    marginTop: Spacing[1],
  },

  // Offer Trade button (marketplace variant)
  offerTradeButton: {
    flexDirection: "row",
    alignItems: "center",
    height: 30,
    paddingHorizontal: Spacing[2],
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.sm,
    flex: 1,
    justifyContent: "center",
  },
  offerTradeText: {
    ...Typography.buttonSm,
    color: Colors.text.primary,
  },
  offerTradeArrow: {
    ...Typography.buttonSm,
    color: Colors.text.primary,
  },

  // Edit / Delete (My Listings variant)
  editButton: {
    flex: 1,
    height: 32,
    paddingHorizontal: Spacing[2],
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing[1],
  },
  editButtonText: {
    ...Typography.micro,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteIcon: {
    fontSize: 14,
  },
});
