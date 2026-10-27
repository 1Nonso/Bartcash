/**
 * Onboarding: four slides on what Bartcash and Scout do. Each visual is a
 * small mockup built from the app's own components (match labels, taste
 * pills, chips), so it matches the app in light and dark mode without image
 * assets.
 *
 * Skip → Sign In; Get Started → Sign Up; "I already have an account" on the
 * last slide → Sign In. All mark onboarding as seen.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { markOnboardingSeen } from "@/config/onboarding";
import { FontSize, Layout, Radius, Spacing, Typography } from "@/constants";
import { CompatibilityPill, ScoreLabel, TagChip } from "@/components/scout";

const { width: SW, height: SH } = Dimensions.get("window");

type Theme = ReturnType<typeof useAuthTheme>;
type IconName = keyof typeof Ionicons.glyphMap;

interface SlideData {
  id: string;
  title: string;
  body: string;
  Visual: (props: { theme: Theme }) => React.ReactElement;
}

// ─── Visual building blocks ──────────────────────────────────────────────────

function IconTile({ icon, theme, size = 44 }: { icon: IconName; theme: Theme; size?: number }) {
  return (
    <View style={[styles.iconTile, { width: size, height: size, backgroundColor: theme.surfaceVariant }]}>
      <Ionicons name={icon} size={size * 0.5} color={theme.textPrimary} />
    </View>
  );
}

function MockCard({ theme, children, style }: { theme: Theme; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.mockCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }, style]}>
      {children}
    </View>
  );
}

function ScoutTag({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.scoutTag, { backgroundColor: theme.aiLight }]}>
      <Ionicons name="sparkles" size={12} color={theme.ai} />
      <Text style={[styles.scoutTagText, { color: theme.ai }]}>Scout</Text>
    </View>
  );
}

// ─── Slide visuals ───────────────────────────────────────────────────────────

function SwapVisual({ theme }: { theme: Theme }) {
  const side = (label: string, title: string, icon: IconName) => (
    <MockCard theme={theme} style={styles.swapCard}>
      <Text style={[styles.mockCaption, { color: theme.textMuted }]}>{label}</Text>
      <IconTile icon={icon} theme={theme} size={56} />
      <Text numberOfLines={2} style={[styles.mockTitle, { color: theme.textPrimary, textAlign: "center" }]}>
        {title}
      </Text>
    </MockCard>
  );
  return (
    <View style={styles.visualCenter}>
      <View style={styles.swapRow}>
        {side("You give", "PlayStation 5", "game-controller-outline")}
        <View style={[styles.swapIcon, { backgroundColor: theme.btnPrimary }]}>
          <Ionicons name="swap-horizontal" size={20} color={theme.btnPrimaryText} />
        </View>
        {side("You get", "iPhone 12", "phone-portrait-outline")}
      </View>
      <View style={[styles.topUpChip, { backgroundColor: theme.aiLight }]}>
        <Ionicons name="add-circle-outline" size={14} color={theme.ai} />
        <Text style={[styles.topUpText, { color: theme.ai }]}>$20 top-up to balance it</Text>
      </View>
    </View>
  );
}

function MatchesVisual({ theme }: { theme: Theme }) {
  const row = (title: string, owner: string, icon: IconName, label: "strong" | "good", reason: string) => (
    <MockCard theme={theme} style={styles.matchRow}>
      <IconTile icon={icon} theme={theme} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={[styles.mockTitle, { color: theme.textPrimary }]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.mockCaption, { color: theme.textMuted }]}>{owner}</Text>
        <ScoreLabel label={label} />
        <Text numberOfLines={1} style={[styles.mockCaption, { color: theme.textSecondary }]}>{reason}</Text>
      </View>
    </MockCard>
  );
  return (
    <View style={[styles.visualCenter, { gap: Spacing[2] }]}>
      <View style={styles.visualHeader}>
        <Text style={[styles.mockTitle, { color: theme.textPrimary }]}>Matches for your PS5</Text>
        <ScoutTag theme={theme} />
      </View>
      {row("Apple Watch Series 6", "Zainab · wants electronics", "watch-outline", "strong", "Matches your top want")}
      {row("Sony WH-1000XM4", "Tunde · would take yours", "headset-outline", "good", "Popular with PlayStation fans")}
    </View>
  );
}

function TasteVisual({ theme }: { theme: Theme }) {
  const avatar = (letter: string) => (
    <View style={[styles.avatar, { backgroundColor: theme.surfaceVariant, borderColor: theme.bg }]}>
      <Text style={[styles.avatarText, { color: theme.textPrimary }]}>{letter}</Text>
    </View>
  );
  return (
    <View style={styles.visualCenter}>
      <MockCard theme={theme} style={{ alignItems: "center", gap: Spacing[3], width: "100%" }}>
        <View style={styles.avatarPair}>
          {avatar("You")}
          <View style={{ marginLeft: -14 }}>{avatar("A")}</View>
        </View>
        <CompatibilityPill label="high" />
        <View style={styles.chips}>
          {["Nike", "Burna Boy", "PlayStation", "Apple", "Black Panther"].map((n) => (
            <TagChip key={n} name={n} />
          ))}
        </View>
        <Text style={[styles.mockCaption, { color: theme.textMuted }]}>Taste intelligence by Qloo</Text>
      </MockCard>
    </View>
  );
}

function OfferVisual({ theme }: { theme: Theme }) {
  return (
    <View style={styles.visualCenter}>
      <MockCard theme={theme} style={{ width: "100%", gap: Spacing[3] }}>
        <View style={[styles.banner, { backgroundColor: theme.aiLight }]}>
          <Ionicons name="sparkles" size={13} color={theme.ai} />
          <Text style={[styles.bannerText, { color: theme.ai }]}>Drafted by Scout · review before sending</Text>
        </View>
        <Text style={[styles.mockBody, { color: theme.textPrimary }]}>
          “Hi Ada! Would you swap your Galaxy Buds for my JBL speaker? We both like Burna Boy.”
        </Text>
        <View style={[styles.valuation, { backgroundColor: theme.surfaceVariant }]}>
          <Text style={[styles.mockCaption, { color: theme.textMuted }]}>Automated Valuation Result</Text>
          <Text style={[styles.valuationValue, { color: theme.textPrimary }]}>$110 – $140</Text>
        </View>
        <View style={[styles.sendBtn, { backgroundColor: theme.btnPrimary }]}>
          <Text style={[styles.sendText, { color: theme.btnPrimaryText }]}>You send it</Text>
        </View>
      </MockCard>
    </View>
  );
}

const SLIDES: SlideData[] = [
  {
    id: "swap",
    title: "Swap what you have\nfor what you want",
    body: "Trade things you no longer use for things you need. Add a little cash only when values don't line up.",
    Visual: SwapVisual,
  },
  {
    id: "scout",
    title: "Scout finds\nyour matches",
    body: "Tell Scout what you'd take. It ranks people who have it and who'd want what you have.",
    Visual: MatchesVisual,
  },
  {
    id: "taste",
    title: "Matched on taste",
    body: "Scout uses Qloo's taste intelligence to find people who like what you like.",
    Visual: TasteVisual,
  },
  {
    id: "control",
    title: "You stay in control",
    body: "Scout drafts a fair offer. You review it, chat and send. Ratings keep every trade honest.",
    Visual: OfferVisual,
  },
];

// ─── Single slide ────────────────────────────────────────────────────────────

function Slide({
  item,
  index,
  activeIndex,
  theme,
  topPad,
}: {
  item: SlideData;
  index: number;
  activeIndex: number;
  theme: Theme;
  topPad: number;
}) {
  const visualAnim = useAnimatedValue(0);
  const textAnim = useAnimatedValue(0);
  const visualTranslate = useAnimatedValue(30);
  const textTranslate = useAnimatedValue(24);

  const triggerIn = useCallback(() => {
    visualAnim.setValue(0);
    visualTranslate.setValue(30);
    textAnim.setValue(0);
    textTranslate.setValue(24);
    Animated.stagger(80, [
      Animated.parallel([
        Animated.spring(visualAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
        Animated.spring(visualTranslate, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(textAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
        Animated.spring(textTranslate, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      ]),
    ]).start();
  }, [textAnim, textTranslate, visualAnim, visualTranslate]);

  // Replay the first slide when the screen regains focus.
  useFocusEffect(
    useCallback(() => {
      if (index === 0) triggerIn();
    }, [index, triggerIn]),
  );

  // Play the entrance each time this slide becomes the active one.
  useEffect(() => {
    if (index === activeIndex) triggerIn();
  }, [index, activeIndex, triggerIn]);

  const { Visual } = item;
  return (
    <View style={[styles.slide, { paddingTop: topPad }]}>
      <Animated.View
        style={[styles.visualArea, { opacity: visualAnim, transform: [{ translateY: visualTranslate }] }]}
      >
        <View style={[styles.glow, { backgroundColor: theme.aiSurface }]} />
        <Visual theme={theme} />
      </Animated.View>

      <Animated.View style={[styles.textBlock, { opacity: textAnim, transform: [{ translateY: textTranslate }] }]}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{item.title}</Text>
        <Text style={[styles.body, { color: theme.textMuted }]}>{item.body}</Text>
      </Animated.View>
    </View>
  );
}

// ─── Dot indicator ───────────────────────────────────────────────────────────

function DotIndicator({ active, theme }: { active: boolean; theme: Theme }) {
  const widthAnim = useAnimatedValue(active ? 20 : 8);
  const opacityAnim = useAnimatedValue(active ? 1 : 0.3);

  // Animate on change only (was started on every render).
  useEffect(() => {
    Animated.parallel([
      Animated.spring(widthAnim, { toValue: active ? 20 : 8, tension: 80, friction: 10, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: active ? 1 : 0.3, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [active, opacityAnim, widthAnim]);

  return (
    <Animated.View
      style={[styles.dot, { width: widthAnim, opacity: opacityAnim, backgroundColor: theme.textPrimary }]}
    />
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideData> | null>(null);
  const buttonScale = useAnimatedValue(1);

  const goTo = (index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  };

  const finish = (to: "/(auth)/sign-in" | "/(auth)/sign-up") => {
    markOnboardingSeen();
    router.replace(to);
  };

  const handleNext = () => {
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    if (activeIndex < SLIDES.length - 1) goTo(activeIndex + 1);
    else finish("/(auth)/sign-up");
  };

  const handleBack = () => {
    if (activeIndex > 0) goTo(activeIndex - 1);
  };

  const isLast = activeIndex === SLIDES.length - 1;
  const isFirst = activeIndex === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.statusBarStyle} />

      <TouchableOpacity
        style={[styles.skipBtn, { top: insets.top + Spacing[3] }]}
        onPress={() => finish("/(auth)/sign-in")}
        activeOpacity={0.6}
        accessibilityRole="button"
      >
        <Text style={[styles.skipText, { color: theme.textPrimary }]}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Slide
            item={item}
            index={index}
            activeIndex={activeIndex}
            theme={theme}
            topPad={insets.top + Spacing[12]}
          />
        )}
        style={styles.flatList}
      />

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <DotIndicator key={s.id} active={i === activeIndex} theme={theme} />
        ))}
      </View>

      <View style={[styles.navRow, { paddingBottom: insets.bottom + (isLast ? Spacing[2] : Spacing[6]) }]}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: isFirst ? theme.borderSubtle : theme.borderDefault }]}
          onPress={handleBack}
          disabled={isFirst}
          activeOpacity={0.6}
          accessibilityLabel="Previous"
        >
          <Ionicons name="arrow-back" size={20} color={isFirst ? theme.textDisabled : theme.textPrimary} />
        </TouchableOpacity>

        <Animated.View style={[styles.nextBtnWrapper, { transform: [{ scale: buttonScale }] }]}>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: theme.btnPrimary }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextText, { color: theme.btnPrimaryText }]}>
              {isLast ? "Get Started" : "Next"}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={theme.btnPrimaryText} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {isLast && (
        <TouchableOpacity
          onPress={() => finish("/(auth)/sign-in")}
          activeOpacity={0.6}
          style={[styles.haveAccount, { marginBottom: insets.bottom + Spacing[4] }]}
        >
          <Text style={[styles.haveAccountText, { color: theme.textSecondary }]}>
            I already have an account
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: {
    position: "absolute",
    right: Spacing[6],
    zIndex: 10,
    padding: Spacing[1],
  },
  skipText: { ...Typography.body, letterSpacing: 0.2 },
  flatList: { flex: 1 },
  slide: { width: SW, flex: 1, paddingHorizontal: Spacing[6] },

  visualArea: {
    height: SH * 0.4,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing[6],
  },
  glow: {
    position: "absolute",
    width: SW * 0.9,
    height: SW * 0.9,
    borderRadius: SW,
    opacity: 0.9,
  },
  visualCenter: { width: "100%", maxWidth: 360, alignItems: "center", gap: Spacing[3] },
  visualHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing[1],
  },

  mockCard: {
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.xl,
    padding: Spacing[3],
  },
  mockTitle: { ...Typography.bodyMedium },
  mockCaption: { ...Typography.caption },
  mockBody: { ...Typography.body, lineHeight: 21 },
  iconTile: { borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },

  swapRow: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },
  swapCard: { width: 128, alignItems: "center", gap: Spacing[2], paddingVertical: Spacing[4] },
  swapIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  topUpChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
  },
  topUpText: { ...Typography.captionMedium },

  matchRow: { width: "100%", flexDirection: "row", alignItems: "center", gap: Spacing[3] },
  scoutTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
  },
  scoutTagText: { fontSize: 12, fontWeight: "600" },

  avatarPair: { flexDirection: "row" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...Typography.captionMedium },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: Spacing[2] },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
  },
  bannerText: { ...Typography.captionMedium, flex: 1 },
  valuation: { borderRadius: Radius.md, padding: Spacing[3], gap: 2 },
  valuationValue: { ...Typography.sectionTitle },
  sendBtn: { borderRadius: Radius.full, paddingVertical: Spacing[2], alignItems: "center" },
  sendText: { ...Typography.buttonSm },

  textBlock: { alignItems: "center" },
  title: {
    ...Typography.pageTitle,
    textAlign: "center",
    lineHeight: 36,
    marginBottom: Spacing[3],
  },
  body: {
    fontSize: FontSize.lg,
    textAlign: "center",
    lineHeight: 23,
    letterSpacing: 0.1,
    maxWidth: 320,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing[1],
    marginBottom: Spacing[5],
  },
  dot: { height: 8, borderRadius: Radius.full },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing[6],
    gap: Spacing[3],
  },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidthThick,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnWrapper: { flex: 1 },
  nextBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
  },
  nextText: { ...Typography.button, letterSpacing: 0.2 },
  haveAccount: { alignSelf: "center", paddingVertical: Spacing[3] },
  haveAccountText: { ...Typography.bodyMedium },
});
