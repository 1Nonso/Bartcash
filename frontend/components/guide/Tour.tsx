/**
 * First-visit tours (coach marks). A screen calls useTour(id, steps, ready)
 * and renders the returned node; the tour runs once per device, after
 * `ready`, dimming the screen around each measured target with a bubble.
 * Steps whose target can't be measured or is off screen are skipped.
 * Targets must be Views with collapsable={false}.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { hasSeen, markSeen } from "./storage";

export interface TourStep {
  target: React.RefObject<View | null>;
  text: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 6;
const DIM = "rgba(0,0,0,0.6)";
const START_DELAY_MS = 700;

function measure(ref: React.RefObject<View | null>): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) return resolve(null);
    node.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null));
  });
}

export function useTour(id: string, steps: TourStep[], ready: boolean): React.ReactNode {
  const stepsRef = useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  const [shown, setShown] = useState<{ rect: Rect; text: string }[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    const timer = setTimeout(async () => {
      if (await hasSeen(`tour.${id}`)) return;
      const { height } = Dimensions.get("window");
      const out: { rect: Rect; text: string }[] = [];
      for (const s of stepsRef.current) {
        const r = await measure(s.target);
        // Only targets fully on screen (no scrolling inside a tour).
        if (r && r.y >= 0 && r.y + r.h <= height - 24) out.push({ rect: r, text: s.text });
      }
      if (live && out.length > 0) {
        setIndex(0);
        setShown(out);
      }
    }, START_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [id, ready]);

  const finish = useCallback(() => {
    setShown(null);
    markSeen(`tour.${id}`);
  }, [id]);

  if (!shown) return null;
  const step = shown[index]!;
  return (
    <TourOverlay
      rect={step.rect}
      text={step.text}
      position={index + 1}
      total={shown.length}
      onNext={() => (index + 1 < shown.length ? setIndex(index + 1) : finish())}
      onSkip={finish}
    />
  );
}

function TourOverlay({
  rect,
  text,
  position,
  total,
  onNext,
  onSkip,
}: {
  rect: Rect;
  text: string;
  position: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const theme = useAuthTheme();
  const { width, height } = Dimensions.get("window");
  const hole = {
    x: Math.max(0, rect.x - PAD),
    y: Math.max(0, rect.y - PAD),
    w: Math.min(width, rect.w + PAD * 2),
    h: rect.h + PAD * 2,
  };
  // Bubble below the target when it sits in the top half, else above.
  const below = hole.y + hole.h / 2 < height / 2;
  const last = position === total;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onSkip}>
      <View style={StyleSheet.absoluteFill}>
        {/* Dim everything except the hole. */}
        <View style={[styles.dim, { top: 0, left: 0, right: 0, height: hole.y }]} />
        <View style={[styles.dim, { top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
        <View style={[styles.dim, { top: hole.y, left: 0, width: hole.x, height: hole.h }]} />
        <View
          style={[styles.dim, { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            { top: hole.y, left: hole.x, width: hole.w, height: hole.h, borderColor: "#FFFFFF" },
          ]}
        />

        <View
          style={[
            styles.bubble,
            { backgroundColor: theme.bg, borderColor: theme.borderSubtle },
            below ? { top: hole.y + hole.h + Spacing[3] } : { bottom: height - hole.y + Spacing[3] },
          ]}
        >
          <Text style={[styles.text, { color: theme.textPrimary }]}>{text}</Text>
          <View style={styles.row}>
            <Text style={[styles.count, { color: theme.textMuted }]}>
              {position} of {total}
            </Text>
            <View style={styles.actions}>
              {!last && (
                <TouchableOpacity onPress={onSkip} hitSlop={8}>
                  <Text style={[styles.skip, { color: theme.textSecondary }]}>Skip</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.next, { backgroundColor: theme.btnPrimary }]} onPress={onNext}>
                <Text style={[styles.nextText, { color: theme.btnPrimaryText }]}>{last ? "Done" : "Next"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: "absolute", backgroundColor: DIM },
  ring: { position: "absolute", borderWidth: 2, borderRadius: Radius.lg },
  bubble: {
    position: "absolute",
    left: Layout.screenPadding,
    right: Layout.screenPadding,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  text: { ...Typography.body, lineHeight: 22 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { ...Typography.caption },
  actions: { flexDirection: "row", alignItems: "center", gap: Spacing[4] },
  skip: { ...Typography.bodyMedium },
  next: { borderRadius: Radius.full, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2] },
  nextText: { ...Typography.buttonSm },
});
