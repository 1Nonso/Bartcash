/**
 * "What you have in common" strip on View User Profile (UI spec §13.12):
 * CompatibilityPill and up to six shared interests. Hidden when the flag is
 * off, the other profile is inactive or nothing is shared; when the
 * viewer's own profile is inactive, a link to set it up.
 *
 * API: GET /users/{id}/taste-compatibility (only what the two share).
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { useFeatures } from "@/hooks/useFeatures";
import { getTasteCompatibility, type TasteCompatibilityData } from "@/config/taste";
import { CompatibilityPill, TagChip } from "@/components/scout";

export function CommonTaste({ userId }: { userId: string }) {
  const theme = useAuthTheme();
  const { qloo } = useFeatures();
  const [data, setData] = useState<TasteCompatibilityData | null>(null);

  useEffect(() => {
    if (!qloo || !userId) return;
    let live = true;
    getTasteCompatibility(userId)
      .then((d) => live && setData(d))
      // Optional strip: on any error it simply stays hidden.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [qloo, userId]);

  if (!qloo || !data) return null;

  if (data.reason === "profile_inactive_self") {
    return (
      <TouchableOpacity
        onPress={() => router.push("/(support-pages)/taste")}
        activeOpacity={0.85}
        style={[styles.card, styles.row, { backgroundColor: theme.aiSurface }]}
      >
        <Ionicons name="sparkles" size={16} color={theme.ai} />
        <Text style={[styles.body, { color: theme.textSecondary, flex: 1 }]}>
          Add your taste profile to see what you have in common.
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </TouchableOpacity>
    );
  }

  const c = data.compatibility;
  if (!c || !c.score_label || (c.shared_entities.length === 0 && (c.shared_tags?.length ?? 0) === 0)) {
    return null;
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.aiSurface }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>What you have in common</Text>
      <CompatibilityPill label={c.score_label} />
      <View style={styles.chips}>
        {(c.shared_entities.length > 0 ? c.shared_entities : (c.shared_tags ?? [])).slice(0, 6).map((e) => (
          <TagChip key={"qloo_entity_id" in e ? e.qloo_entity_id : e.tag_id} name={e.name} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    borderRadius: Radius.lg,
    padding: Spacing[3],
    gap: Spacing[2],
    marginTop: Spacing[3],
  },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },
  title: { ...Typography.bodyMedium },
  body: { ...Typography.caption },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing[2] },
});
