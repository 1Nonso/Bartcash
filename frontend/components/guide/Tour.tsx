/**
 * First-visit tours (coach marks).
 *
 *   const tour = useTour(id, steps, ready, { scrollRef });
 *   <ScrollView ref={scrollRef} onScroll={tour.onScroll} scrollEventThrottle={16}>…
 *   {tour.node}   // last child of the screen's root view
 *
 * Runs once per device (re-checked whenever the screen gains focus, so
 * "Replay tips" works at once). The overlay is drawn inside the screen, not
 * in a Modal (a separate window on Android), so targets are measured in the
 * same coordinates as the overlay. Each step is resolved when shown: wait
 * for its target to stop moving, scroll it into view if needed, then
 * highlight it. Steps whose target isn't mounted are left out; a target
 * that can't be measured is skipped. Targets: Views with collapsable={false}.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { hasSeen, markSeen } from "./storage";

export interface TourStep {
  target: React.RefObject<View | null>;
  text: string;
}

/** A ScrollView (scrollTo) or FlatList (scrollToOffset). */
type Scrollable = {
  scrollTo?: (o: { y: number; animated?: boolean }) => void;
  scrollToOffset?: (o: { offset: number; animated?: boolean }) => void;
};

export interface TourOptions {
  scrollRef?: React.RefObject<Scrollable | null>;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 6;
const DIM = "rgba(0,0,0,0.6)";
const START_DELAY_MS = 600;
const SETTLE_TRIES = 12;
const SETTLE_MS = 120;
const SCROLL_WAIT_MS = 450;
/** Room kept for the bubble when deciding if a target is in view. */
const EDGE = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function measureOnce(node: View | null): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!node) return resolve(null);
    node.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null));
  });
}

/** Measure until two readings agree (animations, late images, keyboard). */
async function measureStable(ref: React.RefObject<View | null>): Promise<Rect | null> {
  let prev: Rect | null = null;
  for (let i = 0; i < SETTLE_TRIES; i++) {
    const r = await measureOnce(ref.current);
    if (
      r &&
      prev &&
      Math.abs(r.x - prev.x) < 1 &&
      Math.abs(r.y - prev.y) < 1 &&
      Math.abs(r.w - prev.w) < 1 &&
      Math.abs(r.h - prev.h) < 1
    ) {
      return r;
    }
    prev = r;
    await sleep(SETTLE_MS);
  }
  return prev;
}

export function useTour(
  id: string,
  steps: TourStep[],
  ready: boolean,
  options: TourOptions = {},
): { node: React.ReactNode; onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void } {
  const stepsRef = useRef(steps);
  const scrollHolder = useRef(options.scrollRef);
  useEffect(() => {
    stepsRef.current = steps;
    scrollHolder.current = options.scrollRef;
  }, [steps, options.scrollRef]);

  const offsetRef = useRef(0);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  // The steps whose target exists when the tour starts; null = not running.
  const [active, setActive] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const overlayRef = useRef<View>(null);
  const [focusTick, setFocusTick] = useState(0);

  // Re-check on focus so a reset ("Replay tips") applies without a remount.
  useFocusEffect(
    useCallback(() => {
      setFocusTick((n) => n + 1);
    }, []),
  );

  useEffect(() => {
    if (!ready || active) return;
    let live = true;
    const timer = setTimeout(async () => {
      if (await hasSeen(`tour.${id}`)) return;
      const present = stepsRef.current.filter((s) => s.target.current);
      if (live && present.length > 0) {
        setIndex(0);
        setRect(null);
        setActive(present);
      }
    }, START_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [id, ready, focusTick, active]);

  const finish = useCallback(() => {
    setActive(null);
    setRect(null);
    markSeen(`tour.${id}`);
  }, [id]);

  const next = useCallback(() => {
    if (active && index + 1 < active.length) {
      setRect(null);
      setIndex(index + 1);
    } else {
      finish();
    }
  }, [active, index, finish]);
  // The step effect skips through the latest `next` without re-running on it.
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  // Resolve the current step: settle, scroll into view, measure vs overlay.
  useEffect(() => {
    if (!active) return;
    const step = active[index];
    if (!step) return;
    let live = true;
    (async () => {
      await sleep(50); // let the overlay lay out
      const area = await measureStable(overlayRef);
      let target = await measureStable(step.target);
      if (!live) return;
      if (!area || !target) return nextRef.current();

      const inView = (t: Rect) => t.y >= area.y + Spacing[4] && t.y + t.h <= area.y + area.h - EDGE;
      const scroller = scrollHolder.current?.current;
      if (!inView(target) && scroller) {
        // Put the target about a third of the way down.
        const delta = target.y - (area.y + area.h / 3);
        const y = Math.max(0, offsetRef.current + delta);
        if (scroller.scrollToOffset) scroller.scrollToOffset({ offset: y, animated: true });
        else scroller.scrollTo?.({ y, animated: true });
        await sleep(SCROLL_WAIT_MS);
        target = await measureStable(step.target);
        if (!live) return;
        if (!target) return nextRef.current();
      }
      // Still mostly off screen (no scroller, or can't scroll that far): skip.
      if (target.y + target.h < area.y || target.y > area.y + area.h - Spacing[6]) return nextRef.current();
      setRect({ x: target.x - area.x, y: target.y - area.y, w: target.w, h: target.h });
    })();
    return () => {
      live = false;
    };
  }, [active, index]);

  // Android back skips the tour.
  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      finish();
      return true;
    });
    return () => sub.remove();
  }, [active, finish]);

  const node = active ? (
    <View ref={overlayRef} collapsable={false} style={styles.overlay} pointerEvents="box-none">
      {rect ? (
        <TourLayer
          rect={rect}
          text={active[index]?.text ?? ""}
          position={index + 1}
          total={active.length}
          onNext={next}
          onSkip={finish}
        />
      ) : (
        // Swallow touches while a step is being resolved.
        <View style={StyleSheet.absoluteFill} />
      )}
    </View>
  ) : null;

  return { node, onScroll };
}

function TourLayer({
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
  const [size, setSize] = useState({ w: 0, h: 0 });
  const hole = {
    x: Math.max(0, rect.x - PAD),
    y: Math.max(0, rect.y - PAD),
    w: rect.w + PAD * 2,
    h: rect.h + PAD * 2,
  };
  const below = hole.y + hole.h / 2 < size.h / 2;
  const last = position === total;

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <View style={[styles.dim, { top: 0, left: 0, right: 0, height: hole.y }]} />
      <View style={[styles.dim, { top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
      <View style={[styles.dim, { top: hole.y, left: 0, width: hole.x, height: hole.h }]} />
      <View style={[styles.dim, { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]} />
      <View
        pointerEvents="none"
        style={[styles.ring, { top: hole.y, left: hole.x, width: hole.w, height: hole.h }]}
      />
      {size.h > 0 && (
        <View
          style={[
            styles.bubble,
            { backgroundColor: theme.bg, borderColor: theme.borderSubtle },
            below ? { top: hole.y + hole.h + Spacing[3] } : { bottom: size.h - hole.y + Spacing[3] },
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 },
  dim: { position: "absolute", backgroundColor: DIM },
  ring: { position: "absolute", borderWidth: 2, borderRadius: Radius.lg, borderColor: "#FFFFFF" },
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
