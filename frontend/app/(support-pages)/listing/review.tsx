import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/hooks/navigation";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import {
  ItemDetail,
  ItemValuationDetail,
  getItemById,
  getItemValuation,
  updateItem,
  overrideItemValuation,
} from "@/config/items";

const POLL_INTERVAL = 5000;
const POLL_TIMEOUT_MS = 60000; // Stop polling after 60s

function formatCondition(c: string): string {
  const map: Record<string, string> = {
    new: "Brand New",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
  };
  return map[c] ?? c;
}

export default function ReviewListingScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [valuation, setValuation] = useState<ItemValuationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideMin, setOverrideMin] = useState("");
  const [overrideMax, setOverrideMax] = useState("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contentAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── Load item ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const data = await getItemById(id);
        setItem(data);
        setValuation(data.valuation);

        if (data.valuation?.status === "pending") {
          startPolling(id);
        } else if (data.valuation?.status === "completed") {
          animateProgress(parseFloat(data.valuation.confidence ?? "0"));
        }
      } catch {
        Alert.alert(
          "Error",
          "Failed to load listing. Please go back and try again.",
        );
      } finally {
        setLoading(false);
        Animated.spring(contentAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 55,
          friction: 11,
        }).start();
      }
    };
    load();
    return () => {
      stopPolling();
    };
  }, [id]);

  // ── Polling ──────────────────────────────────────────────────────────────────

  const startPolling = useCallback((itemId: string) => {
    stopPolling();

    pollRef.current = setInterval(async () => {
      try {
        const v = await getItemValuation(itemId);
        setValuation(v);
        if (v.status !== "pending") {
          stopPolling();
          if (v.status === "completed") {
            animateProgress(parseFloat(v.confidence ?? "0"));
          }
        }
      } catch {
        stopPolling();
      }
    }, POLL_INTERVAL);

    // Safety timeout — stop after 60s regardless
    pollTimeoutRef.current = setTimeout(() => {
      stopPolling();
      // If still pending after timeout, set to failed so the user isn't stuck
      setValuation((prev) =>
        prev?.status === "pending" ? { ...prev, status: "failed" } : prev,
      );
    }, POLL_TIMEOUT_MS);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const animateProgress = (confidence: number) => {
    Animated.timing(progressAnim, {
      toValue: Math.min(Math.max(confidence, 0), 100) / 100,
      duration: 900,
      useNativeDriver: false,
    }).start();
  };

  // ── Publish ──────────────────────────────────────────────────────────────────

  const handlePublish = useCallback(async () => {
    if (!item) return;

    if (overrideEnabled) {
      const min = parseFloat(overrideMin);
      const max = parseFloat(overrideMax);
      if (!overrideMin || !overrideMax || isNaN(min) || isNaN(max)) {
        Alert.alert(
          "Invalid Values",
          "Please enter valid min and max override values.",
        );
        return;
      }
      if (min >= max) {
        Alert.alert("Invalid Range", "Min value must be less than max value.");
        return;
      }
    }

    setPublishing(true);
    try {
      if (overrideEnabled && overrideMin && overrideMax) {
        await overrideItemValuation(item.id, {
          value_min: parseFloat(overrideMin),
          value_max: parseFloat(overrideMax),
        });
      }

      router.replace({
        pathname: "/(support-pages)/listing/[id]",
        params: { id: item.id },
      });
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.message ?? "Failed to publish. Please try again.",
      );
    } finally {
      setPublishing(false);
    }
  }, [item, overrideEnabled, overrideMin, overrideMax]);

  // const handleEditDetails = useCallback(() => {
  //   goBack();
  // }, []);
  const handleEditDetails = useCallback(() => {
    router.replace({
      pathname: "/(support-pages)/listing/create",
    });
  }, []);

  // ── Valuation section ────────────────────────────────────────────────────────

  const ValuationSection = () => {
    const confidence = parseFloat(valuation?.confidence ?? "0");
    const aiRange =
      valuation?.status === "completed" &&
      valuation.value_min &&
      valuation.value_max
        ? `$${Number(valuation.value_min).toLocaleString()} – ₦${Number(valuation.value_max).toLocaleString()}`
        : null;

    // Build override preview range (shown live as the user types)
    const overrideRange =
      overrideEnabled && overrideMin && overrideMax
        ? `$${Number(overrideMin).toLocaleString()} – ₦${Number(overrideMax).toLocaleString()}`
        : null;

    return (
      <View
        style={[styles.valuationCard, { backgroundColor: Colors.aiSurface }]}
      >
        <View style={styles.valuationHeader}>
          <Ionicons name="sparkles" size={16} color={Colors.ai} />
          <Text style={styles.valuationTitle}>AI Estimated Value</Text>
        </View>

        {valuation?.status === "pending" && (
          <View style={styles.pendingRow}>
            <ActivityIndicator size="small" color={Colors.ai} />
            <Text style={[styles.pendingText, { color: theme.textMuted }]}>
              AI is calculating your item{"'"}s value...
            </Text>
          </View>
        )}

        {valuation?.status === "completed" && aiRange && (
          <>
            <Text style={styles.valuationRange}>{aiRange}</Text>
            <Text style={[styles.valuationSub, { color: theme.textMuted }]}>
              Based on similar items and market data
            </Text>

            <View style={styles.confidenceRow}>
              <Text
                style={[styles.confidenceLabel, { color: theme.textMuted }]}
              >
                Confidence level
              </Text>
              <Text style={styles.confidenceValue}>
                {confidence.toFixed(0)}%
              </Text>
            </View>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: Colors.aiLight },
              ]}
            >
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: Colors.ai,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
            <View
              style={[
                styles.confidenceNote,
                { backgroundColor: Colors.aiLight },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={13}
                color={Colors.ai}
              />
              <Text style={[styles.confidenceNoteText, { color: Colors.ai }]}>
                {confidence >= 80
                  ? "High Confidence based on similar items"
                  : confidence >= 50
                    ? "Medium Confidence — estimate may vary"
                    : "Low Confidence — limited data available"}
              </Text>
            </View>
          </>
        )}

        {valuation?.status === "failed" && (
          <Text style={[styles.failedText, { color: theme.textMuted }]}>
            Value estimate unavailable. You can publish without a valuation.
          </Text>
        )}

        {/* Override toggle */}
        <View
          style={[
            styles.overrideDivider,
            { borderTopColor: theme.borderSubtle },
          ]}
        />
        <View style={styles.overrideRow}>
          <View style={styles.overrideLabel}>
            <Text
              style={[styles.overrideLabelText, { color: theme.textPrimary }]}
            >
              Override AI value
            </Text>
            <Text style={[styles.overrideLabelSub, { color: theme.textMuted }]}>
              Set your own value range
            </Text>
          </View>
          <Switch
            value={overrideEnabled}
            onValueChange={setOverrideEnabled}
            trackColor={{ false: Colors.gray[200], true: Colors.ai }}
            thumbColor={Colors.white}
          />
        </View>

        {overrideEnabled && (
          <>
            <View style={styles.overrideInputs}>
              <TextInput
                style={[
                  styles.overrideInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.borderDefault,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Min Value (₦)"
                placeholderTextColor={theme.textPlaceholder}
                value={overrideMin}
                onChangeText={setOverrideMin}
                keyboardType="numeric"
              />
              <TextInput
                style={[
                  styles.overrideInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.borderDefault,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Max Value (₦)"
                placeholderTextColor={theme.textPlaceholder}
                value={overrideMax}
                onChangeText={setOverrideMax}
                keyboardType="numeric"
              />
            </View>

            {/* Live preview of override range */}
            {overrideRange && (
              <View
                style={[
                  styles.overridePreview,
                  { backgroundColor: Colors.aiLight },
                ]}
              >
                <Ionicons name="pricetag-outline" size={13} color={Colors.ai} />
                <Text
                  style={[styles.overridePreviewText, { color: Colors.ai }]}
                >
                  Your value:{" "}
                  <Text style={styles.overridePreviewBold}>
                    {overrideRange}
                  </Text>{" "}
                  will appear on your listing
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.bg },
        ]}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>
          Loading your listing...
        </Text>
      </View>
    );
  }

  if (!item) return null;

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing[2],
            borderBottomColor: theme.borderSubtle,
            backgroundColor: theme.bg,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleEditDetails}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          <Text style={[styles.backText, { color: theme.textPrimary }]}>
            Back
          </Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            Review your listing
          </Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>
            Make sure everything looks perfect
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        style={{ opacity: contentAnim }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        <ValuationSection />

        {/* Images preview */}
        <View
          style={[
            styles.previewCard,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imageStrip}
          >
            {item.images.map((img) => (
              <Image
                key={img.id}
                source={{ uri: img.url }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ))}
            {item.images.length === 0 && (
              <View
                style={[
                  styles.previewImagePlaceholder,
                  { backgroundColor: Colors.gray[100] },
                ]}
              >
                <Ionicons
                  name="image-outline"
                  size={24}
                  color={Colors.gray[400]}
                />
              </View>
            )}
          </ScrollView>

          <View style={styles.previewDetails}>
            <Text style={[styles.previewTitle, { color: theme.textPrimary }]}>
              {item.title}
            </Text>
            <Text style={[styles.previewMeta, { color: theme.textMuted }]}>
              {formatCondition(item.condition)} · {item.category?.name}
            </Text>

            {item.description && (
              <>
                <View
                  style={[
                    styles.previewDivider,
                    { backgroundColor: theme.borderSubtle },
                  ]}
                />
                <Text
                  style={[styles.previewLabel, { color: theme.textPrimary }]}
                >
                  Description
                </Text>
                <Text
                  style={[styles.previewBody, { color: theme.textMuted }]}
                  numberOfLines={4}
                >
                  {item.description}
                </Text>
              </>
            )}

            {item.desired_trade && (
              <>
                <View
                  style={[
                    styles.previewDivider,
                    { backgroundColor: theme.borderSubtle },
                  ]}
                />
                <Text
                  style={[styles.previewLabel, { color: theme.textPrimary }]}
                >
                  Looking For
                </Text>
                <Text
                  style={[styles.previewBody, { color: theme.textMuted }]}
                  numberOfLines={3}
                >
                  {item.desired_trade}
                </Text>
              </>
            )}

            {item.location && (
              <>
                <View
                  style={[
                    styles.previewDivider,
                    { backgroundColor: theme.borderSubtle },
                  ]}
                />
                <View style={styles.locationRow}>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={theme.textMuted}
                  />
                  <Text
                    style={[styles.previewBody, { color: theme.textMuted }]}
                  >
                    {item.location}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* CTA bar */}
      <View
        style={[
          styles.ctaBar,
          {
            backgroundColor: theme.bg,
            borderTopColor: theme.borderSubtle,
            paddingBottom: insets.bottom + Spacing[3],
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.editBtn, { borderColor: theme.borderDefault }]}
          onPress={handleEditDetails}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={16} color={theme.textPrimary} />
          <Text style={[styles.editBtnText, { color: theme.textPrimary }]}>
            Edit Listing Details
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.publishBtn,
            {
              backgroundColor: publishing ? theme.btnDisabled : Colors.primary,
            },
          ]}
          onPress={handlePublish}
          disabled={publishing}
          activeOpacity={0.9}
        >
          {publishing ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={Colors.white} />
              <Text style={styles.publishBtnText}>Publish Listing</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", gap: Spacing[3] },
  loadingText: { ...Typography.body },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 60 },
  backText: { ...Typography.body },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { ...Typography.bodyMedium },
  headerSub: { ...Typography.micro, marginTop: 2 },
  headerRight: { minWidth: 60 },

  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
    gap: Spacing[4],
  },

  // Valuation
  valuationCard: { borderRadius: Radius.lg, padding: Spacing[4] },
  valuationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    marginBottom: Spacing[3],
  },
  valuationTitle: { ...Typography.bodyMedium, color: Colors.ai },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },
  pendingText: { ...Typography.body },
  valuationRange: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: Spacing[1],
  },
  valuationSub: { ...Typography.caption, marginBottom: Spacing[3] },
  confidenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing[2],
  },
  confidenceLabel: { ...Typography.caption },
  confidenceValue: { ...Typography.captionMedium, color: Colors.ai },
  progressTrack: {
    height: 6,
    borderRadius: Radius.full,
    overflow: "hidden",
    marginBottom: Spacing[3],
  },
  progressFill: { height: "100%", borderRadius: Radius.full },
  confidenceNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[2],
    borderRadius: Radius.sm,
  },
  confidenceNoteText: { ...Typography.micro, flex: 1 },
  failedText: { ...Typography.body },
  overrideDivider: { borderTopWidth: 1, marginVertical: Spacing[4] },
  overrideRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overrideLabel: { flex: 1 },
  overrideLabelText: { ...Typography.bodyMedium },
  overrideLabelSub: { ...Typography.caption, marginTop: 2 },
  overrideInputs: {
    flexDirection: "row",
    gap: Spacing[3],
    marginTop: Spacing[3],
  },
  overrideInput: {
    flex: 1,
    height: Layout.inputHeight,
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    ...Typography.input,
  },
  overridePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[2],
    borderRadius: Radius.sm,
    marginTop: Spacing[2],
  },
  overridePreviewText: { ...Typography.micro, flex: 1 },
  overridePreviewBold: { fontWeight: "700" },

  // Preview card
  previewCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    overflow: "hidden",
  },
  imageStrip: { padding: Spacing[3] },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: Radius.md,
    marginRight: Spacing[2],
  },
  previewImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  previewDetails: { padding: Spacing[4], paddingTop: 0 },
  previewTitle: { ...Typography.cardTitleLarge, marginBottom: 4 },
  previewMeta: { ...Typography.caption },
  previewDivider: { height: 1, marginVertical: Spacing[3] },
  previewLabel: { ...Typography.bodyMedium, marginBottom: Spacing[1] },
  previewBody: { ...Typography.body, lineHeight: 21 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },

  // CTA
  ctaBar: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
    gap: Spacing[3],
  },
  editBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
  },
  editBtnText: { ...Typography.button },
  publishBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
  },
  publishBtnText: { ...Typography.button, color: Colors.white },
});
