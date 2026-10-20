/**
 * InfoSheet / InfoButton — a bottom sheet explaining one feature (topics.ts),
 * opened by an ⓘ button (or the Scout badge).
 */

import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { TOPICS, type TopicId } from "./topics";

export function InfoSheet({
  topic,
  visible,
  onClose,
}: {
  topic: TopicId;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const t = TOPICS[topic];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.bg, paddingBottom: insets.bottom + Spacing[4], borderColor: theme.borderSubtle },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.borderDefault }]} />
        <View style={styles.titleRow}>
          <View style={[styles.iconWrap, { backgroundColor: theme.aiLight }]}>
            <Ionicons name={t.icon} size={18} color={theme.ai} />
          </View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{t.title}</Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.points}>
          {t.points.map((p, i) => (
            <View key={i} style={styles.point}>
              <View style={[styles.dot, { backgroundColor: theme.ai }]} />
              <View style={{ flex: 1 }}>
                {p.heading ? (
                  <Text style={[styles.heading, { color: theme.textPrimary }]}>{p.heading}</Text>
                ) : null}
                <Text style={[styles.text, { color: theme.textSecondary }]}>{p.text}</Text>
              </View>
            </View>
          ))}
          {t.footer ? (
            <Text style={[styles.footer, { color: theme.textMuted, borderTopColor: theme.borderSubtle }]}>
              {t.footer}
            </Text>
          ) : null}
        </ScrollView>
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.btnPrimary }]} onPress={onClose}>
          <Text style={[styles.btnText, { color: theme.btnPrimaryText }]}>Got it</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/** A small ⓘ that opens a topic. */
export function InfoButton({
  topic,
  style,
  color,
}: {
  topic: TopicId;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const theme = useAuthTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={10}
        style={style}
        accessibilityRole="button"
        accessibilityLabel="More info"
      >
        <Ionicons name="information-circle-outline" size={20} color={color ?? theme.textMuted} />
      </TouchableOpacity>
      <InfoSheet topic={topic} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "80%",
    borderTopLeftRadius: Radius["3xl"],
    borderTopRightRadius: Radius["3xl"],
    borderTopWidth: 1,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[2],
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: Spacing[3] },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing[3], marginBottom: Spacing[3] },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  title: { ...Typography.sectionTitle, flex: 1 },
  scroll: { flexGrow: 0 },
  points: { gap: Spacing[3], paddingBottom: Spacing[3] },
  point: { flexDirection: "row", gap: Spacing[3] },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  heading: { ...Typography.bodyMedium, marginBottom: 2 },
  text: { ...Typography.body, lineHeight: 22 },
  footer: { ...Typography.caption, lineHeight: 19, borderTopWidth: 1, paddingTop: Spacing[3] },
  btn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing[2],
  },
  btnText: { ...Typography.button },
});
