/**
 * The one-time welcome card (first open of Home / Browse). Returns the node
 * to render and whether it has been seen (tours on that screen wait for it).
 * Must be used in a screen (it re-checks on focus).
 */

import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { hasSeen, markSeen } from "./storage";
import { WELCOME } from "./topics";

const KEY = "welcome";

export function useWelcome(): { node: React.ReactNode; seen: boolean } {
  const theme = useAuthTheme();
  // null until storage has been read.
  const [seen, setSeen] = useState<boolean | null>(null);

  // Re-read on every focus: Home / Browse stay mounted as tabs, and
  // "Replay tips" must show the card again without a restart.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      hasSeen(KEY).then((v) => live && setSeen(v));
      return () => {
        live = false;
      };
    }, []),
  );

  const close = () => {
    setSeen(true);
    markSeen(KEY);
  };

  const node =
    seen === false ? (
      <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.borderSubtle }]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.aiLight }]}>
              <Ionicons name="swap-horizontal" size={26} color={theme.ai} />
            </View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{WELCOME.title}</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>{WELCOME.text}</Text>
            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.btnPrimary }]} onPress={close}>
              <Text style={[styles.btnText, { color: theme.btnPrimaryText }]}>{WELCOME.button}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    ) : null;

  return { node, seen: seen === true };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: Layout.screenPadding * 1.5,
  },
  card: { borderRadius: Radius["2xl"], borderWidth: 1, padding: Spacing[6], alignItems: "center", gap: Spacing[3] },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  title: { ...Typography.sectionTitle, textAlign: "center" },
  text: { ...Typography.body, lineHeight: 22, textAlign: "center" },
  btn: {
    alignSelf: "stretch",
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing[2],
  },
  btnText: { ...Typography.button },
});
