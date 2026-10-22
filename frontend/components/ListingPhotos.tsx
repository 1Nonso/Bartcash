/**
 * Photos section on Edit Listing: add (up to 6), remove (never the last),
 * set the cover. Each change is saved at once (not with the form's Save).
 * The valuation reads the cover photo, so adding photos or changing the
 * cover re-runs it; `onChange` reports that.
 *
 * API: POST /items/{id}/images, DELETE /items/{id}/images/{imageId},
 *      PATCH /items/{id}/images/{imageId}/primary
 */

import React, { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Alert } from "@/config/alert";
import { removeItemImage, setItemCover, uploadItemImages, type ItemImage } from "@/config/items";

const MAX_PHOTOS = 6;

function sorted(images: ItemImage[]): ItemImage[] {
  return [...images].sort((a, b) => a.display_order - b.display_order);
}

export function ListingPhotos({
  itemId,
  images,
  editable,
  onChange,
}: {
  itemId: string;
  images: ItemImage[];
  /** False while the listing is in a trade (photos are locked). */
  editable: boolean;
  onChange: (images: ItemImage[], valuationPending: boolean) => void;
}) {
  const theme = useAuthTheme();
  // The photo being changed, or "add"; one change at a time.
  const [busy, setBusy] = useState<string | null>(null);
  const list = sorted(images);

  const fail = (err: any, fallback: string) =>
    Alert.alert("Couldn't update photos", err?.response?.data?.message ?? fallback);

  const add = async () => {
    if (list.length >= MAX_PHOTOS) {
      Alert.alert("Limit reached", "A listing can have up to 6 photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: MAX_PHOTOS - list.length,
    });
    if (result.canceled || result.assets.length === 0) return;
    setBusy("add");
    try {
      const picked = result.assets.slice(0, MAX_PHOTOS - list.length).map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `image_${Date.now()}.jpg`,
        type: a.mimeType ?? "image/jpeg",
      }));
      const r = await uploadItemImages(itemId, picked);
      onChange([...list, ...r.images], true);
    } catch (err) {
      fail(err, "The photos couldn't be uploaded. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const remove = (img: ItemImage) => {
    if (list.length <= 1) {
      Alert.alert("Keep one photo", "A listing needs at least one photo. Add another before removing this one.");
      return;
    }
    Alert.alert(
      "Remove photo?",
      img.is_primary ? "The next photo becomes the cover and the valuation runs again." : undefined,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusy(img.id);
            try {
              const r = await removeItemImage(itemId, img.id);
              onChange(r.images, r.valuation_status === "pending");
            } catch (err) {
              fail(err, "The photo couldn't be removed. Try again.");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const makeCover = async (img: ItemImage) => {
    if (img.is_primary) return;
    setBusy(img.id);
    try {
      const r = await setItemCover(itemId, img.id);
      onChange(r.images, r.valuation_status === "pending");
    } catch (err) {
      fail(err, "The cover couldn't be changed. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
      <View style={styles.headRow}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Photos</Text>
        <Text style={[styles.count, { color: theme.textMuted }]}>
          {list.length}/{MAX_PHOTOS}
        </Text>
      </View>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        {editable
          ? "Changes save straight away. Tap ☆ to make a photo the cover; the valuation uses the cover photo."
          : "Photos can't be changed while the listing is in a trade."}
      </Text>

      <View style={styles.grid}>
        {list.map((img) => (
          <View key={img.id} style={styles.cell}>
            <Image source={{ uri: img.url }} style={[styles.photo, { backgroundColor: theme.surfaceVariant }]} />
            {img.is_primary && (
              <View style={[styles.coverTag, { backgroundColor: theme.btnPrimary }]}>
                <Text style={[styles.coverText, { color: theme.btnPrimaryText }]}>Cover</Text>
              </View>
            )}
            {busy === img.id ? (
              <View style={styles.overlay}>
                <ActivityIndicator color={Colors.white} />
              </View>
            ) : (
              editable && (
                <>
                  {!img.is_primary && (
                    <TouchableOpacity
                      onPress={() => makeCover(img)}
                      disabled={busy !== null}
                      hitSlop={6}
                      accessibilityLabel="Make this the cover photo"
                      style={[styles.iconBtn, styles.iconLeft]}
                    >
                      <Ionicons name="star-outline" size={14} color={Colors.white} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => remove(img)}
                    disabled={busy !== null}
                    hitSlop={6}
                    accessibilityLabel="Remove photo"
                    style={[styles.iconBtn, styles.iconRight]}
                  >
                    <Ionicons name="close" size={14} color={Colors.white} />
                  </TouchableOpacity>
                </>
              )
            )}
          </View>
        ))}

        {editable && list.length < MAX_PHOTOS && (
          <TouchableOpacity
            onPress={add}
            disabled={busy !== null}
            accessibilityLabel="Add photos"
            style={[styles.cell, styles.addCell, { borderColor: theme.borderDefault }]}
          >
            {busy === "add" ? (
              <ActivityIndicator color={theme.textSecondary} />
            ) : (
              <>
                <Ionicons name="add" size={22} color={theme.textSecondary} />
                <Text style={[styles.addText, { color: theme.textSecondary }]}>Add</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    gap: Spacing[2],
    marginBottom: Spacing[4],
  },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...Typography.sectionTitle },
  count: { ...Typography.caption },
  hint: { ...Typography.caption },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing[2], marginTop: Spacing[1] },
  cell: { width: "31%", aspectRatio: 1, borderRadius: Radius.md, overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  coverTag: {
    position: "absolute",
    left: 4,
    bottom: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  coverText: { ...Typography.micro, fontWeight: "700" },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    position: "absolute",
    top: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconLeft: { left: 4 },
  iconRight: { right: 4 },
  addCell: { borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 2 },
  addText: { ...Typography.caption },
});
