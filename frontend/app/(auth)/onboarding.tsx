import { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  FlatList,
  Image,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect } from "expo-router";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Spacing, Radius, Typography, Layout, FontSize } from "@/constants";

const { width: SW, height: SH } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    image: require("../../assets/images/onboarding/carousel-1.png"),
    title: "Trade Smarter,\nNot Harder",
    body: "Discover items around you and exchange what you have for what you truly need—no cash required.",
  },
  {
    id: "2",
    image: require("../../assets/images/onboarding/carousel-2.png"),
    title: "Negotiate With\nConfidence",
    body: "Chat, make offers, and compare item values before you agree—everything stays transparent and fair.",
  },
  {
    id: "3",
    image: require("../../assets/images/onboarding/carousel-3.png"),
    title: "Trade With\nTrusted People",
    body: "Verified users, ratings, and smart moderation help keep every exchange safe and reliable.",
  },
];

// ─── Single Slide ────────────────────────────────────────────────────────────
function Slide({
  item,
  index,
  activeIndex,
  theme,
}: {
  item: (typeof SLIDES)[0];
  index: number;
  activeIndex: number;
  theme: ReturnType<typeof useAuthTheme>;
}) {
  const imageAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;
  const imageTranslate = useRef(new Animated.Value(30)).current;
  const textTranslate = useRef(new Animated.Value(24)).current;

  useFocusEffect(
    useCallback(() => {
      if (index === 0) triggerIn();
    }, []),
  );

  const triggered = useRef(false);
  if (index === activeIndex && !triggered.current) {
    triggered.current = true;
    triggerIn();
  }
  if (index !== activeIndex) {
    triggered.current = false;
  }

  function triggerIn() {
    imageAnim.setValue(0);
    imageTranslate.setValue(30);
    textAnim.setValue(0);
    textTranslate.setValue(24);

    Animated.stagger(80, [
      Animated.parallel([
        Animated.spring(imageAnim, {
          toValue: 1,
          tension: 60,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.spring(imageTranslate, {
          toValue: 0,
          tension: 60,
          friction: 9,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(textAnim, {
          toValue: 1,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(textTranslate, {
          toValue: 0,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }

  return (
    <View style={styles.slide}>
      <Animated.View
        style={[
          styles.imageContainer,
          { opacity: imageAnim, transform: [{ translateY: imageTranslate }] },
        ]}
      >
        <Image source={item.image} style={styles.image} resizeMode="contain" />
      </Animated.View>

      <Animated.View
        style={[
          styles.textBlock,
          { opacity: textAnim, transform: [{ translateY: textTranslate }] },
        ]}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          {item.title}
        </Text>
        <Text style={[styles.body, { color: theme.textMuted }]}>
          {item.body}
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── Dot Indicator ───────────────────────────────────────────────────────────
function DotIndicator({
  active,
  theme,
}: {
  active: boolean;
  theme: ReturnType<typeof useAuthTheme>;
}) {
  const widthAnim = useRef(new Animated.Value(active ? 20 : 8)).current;
  const opacityAnim = useRef(new Animated.Value(active ? 1 : 0.3)).current;

  Animated.parallel([
    Animated.spring(widthAnim, {
      toValue: active ? 20 : 8,
      tension: 80,
      friction: 10,
      useNativeDriver: false,
    }),
    Animated.timing(opacityAnim, {
      toValue: active ? 1 : 0.3,
      duration: 200,
      useNativeDriver: false,
    }),
  ]).start();

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: widthAnim,
          opacity: opacityAnim,
          backgroundColor: theme.textPrimary,
        },
      ]}
    />
  );
}

// ─── Main Onboarding Screen ──────────────────────────────────────────────────
export default function OnboardingScreen() {
  const theme = useAuthTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<(typeof SLIDES)[0]> | null>(null);
  const buttonScale = useRef(new Animated.Value(1)).current;

  const goTo = (index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  };

  const handleNext = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.96,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();

    if (activeIndex < SLIDES.length - 1) {
      goTo(activeIndex + 1);
    } else {
      router.replace("/(auth)/sign-up");
    }
  };

  const handleBack = () => {
    if (activeIndex > 0) goTo(activeIndex - 1);
  };

  const handleSkip = () => {
    router.replace("/(auth)/sign-in");
  };

  const isLast = activeIndex === SLIDES.length - 1;
  const isFirst = activeIndex === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.statusBarStyle} />

      {/* Skip */}
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={handleSkip}
        activeOpacity={0.6}
      >
        <Text style={[styles.skipText, { color: theme.textPrimary }]}>
          Skip
        </Text>
      </TouchableOpacity>

      {/* Slides */}
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
          />
        )}
        style={styles.flatList}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <DotIndicator key={i} active={i === activeIndex} theme={theme} />
        ))}
      </View>

      {/* Navigation */}
      <View style={styles.navRow}>
        {/* Back button */}
        <TouchableOpacity
          style={[
            styles.backBtn,
            { borderColor: isFirst ? theme.borderSubtle : theme.borderDefault },
          ]}
          onPress={handleBack}
          disabled={isFirst}
          activeOpacity={0.6}
        >
          <Text
            style={{
              fontSize: 20,
              color: isFirst ? theme.textDisabled : theme.textPrimary,
            }}
          >
            ←
          </Text>
        </TouchableOpacity>

        {/* Next / Get Started */}
        <Animated.View
          style={[
            styles.nextBtnWrapper,
            { transform: [{ scale: buttonScale }] },
          ]}
        >
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: theme.btnPrimary }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextText, { color: theme.btnPrimaryText }]}>
              {isLast ? "Get Started" : "Next"}&nbsp;&nbsp;→
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 40,
    right: Spacing[6],
    zIndex: 10,
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[1],
  },
  skipText: { ...Typography.body, letterSpacing: 0.2 },
  flatList: { flex: 1 },
  slide: {
    width: SW,
    flex: 1,
    paddingHorizontal: Spacing[8],
    paddingTop: Platform.OS === "ios" ? 180 : 80,
  },
  imageContainer: {
    width: "100%",
    height: SH * 0.36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing[1],
  },
  image: { width: "90%", height: "100%" },
  textBlock: { alignItems: "center" },
  title: {
    ...Typography.pageTitle,
    textAlign: "center",
    lineHeight: 36,
    marginBottom: Spacing[4],
  },
  body: {
    fontSize: FontSize.lg,
    textAlign: "center",
    lineHeight: 23,
    letterSpacing: 0.1,
    maxWidth: 300,
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
    paddingBottom: Platform.OS === "ios" ? 44 : 28,
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
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: { ...Typography.button, letterSpacing: 0.2 },
});
