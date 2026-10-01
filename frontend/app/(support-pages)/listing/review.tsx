import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
  retryItemValuation,
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
  const [declaredValue, setDeclaredValue] = useState("");
  const [retrying, setRetrying] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contentAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const CONFIDENCE_LEVELS: Record<
    string,
    { label: string; bars: number; color: string }
  > = {
    high: { label: "High Confidence", bars: 3, color: Colors.success },
    medium: { label: "Medium Confidence", bars: 2, color: Colors.ai },
    low: { label: "Low Confidence", bars: 1, color: Colors.danger },
  };

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

    if (declaredValue) {
      const val = parseFloat(declaredValue);
      if (isNaN(val) || val <= 0) {
        Alert.alert("Invalid Value", "Please enter a valid declared value.");
        return;
      }
    }

    setPublishing(true);
    try {
      if (declaredValue) {
        const { warnings } = await updateItem(item.id, {
          user_declared_value: parseFloat(declaredValue),
        });
        if (warnings?.user_declared_value) {
          Alert.alert("Heads up", warnings.user_declared_value);
        }
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
  }, [item, declaredValue]);

  const handleEditDetails = useCallback(() => {
    router.replace({
      pathname: "/(support-pages)/listing/create",
    });
  }, []);

  const handleRetryValuation = useCallback(async () => {
    if (!item) return;
    setRetrying(true);
    try {
      await retryItemValuation(item.id);
      setValuation((prev) => (prev ? { ...prev, status: "pending" } : prev));
      startPolling(item.id);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.message ?? "Could not retry valuation.",
      );
    } finally {
      setRetrying(false);
    }
  }, [item, startPolling]);

  // ── Valuation section ────────────────────────────────────────────────────────

  const ValuationSection = () => {
    const level =
      valuation?.status === "completed" && valuation.confidence
        ? CONFIDENCE_LEVELS[valuation.confidence]
        : null;
    const aiRange =
      valuation?.status === "completed" &&
      valuation.value_min &&
      valuation.value_max
        ? `$${Number(valuation.value_min).toLocaleString()} – $${Number(valuation.value_max).toLocaleString()}`
        : null;

    return (
      <View
        style={[styles.valuationCard, { backgroundColor: Colors.aiSurface }]}
      >
        <View style={styles.valuationHeader}>
          <Ionicons name="sparkles" size={16} color={Colors.ai} />
          <Text style={styles.valuationTitle}>Automated Valuation Result</Text>
        </View>

        {valuation?.status === "pending" && (
          <View style={styles.pendingRow}>
            <ActivityIndicator size="small" color={Colors.ai} />
            <Text style={[styles.pendingText, { color: theme.textMuted }]}>
              AI is calculating your item{"'"}s value...
            </Text>
          </View>
        )}

        {valuation?.status === "completed" && aiRange && level && (
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
              <View style={styles.confidenceBars}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.confidenceBar,
                      {
                        backgroundColor:
                          i < level.bars ? level.color : Colors.aiLight,
                      },
                    ]}
                  />
                ))}
              </View>
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
                {level.label}
                {level.bars === 1 ? " — estimate may vary" : ""}
              </Text>
            </View>
          </>
        )}

        {valuation?.status === "failed" && (
          <View>
            <Text style={[styles.failedText, { color: theme.textMuted }]}>
              Value estimate unavailable. You can publish without one, or try
              again.
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, { borderColor: theme.borderDefault }]}
              onPress={handleRetryValuation}
              disabled={retrying}
              activeOpacity={0.85}
            >
              {retrying ? (
                <ActivityIndicator size="small" color={Colors.ai} />
              ) : (
                <>
                  <Ionicons name="refresh" size={14} color={Colors.ai} />
                  <Text style={[styles.retryBtnText, { color: Colors.ai }]}>
                    Retry valuation
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View
          style={[
            styles.overrideDivider,
            { borderTopColor: theme.borderSubtle },
          ]}
        />
        <Text style={[styles.overrideLabelText, { color: Colors.ai }]}>
          Please declare a Value for your good below
        </Text>
        <Text
          style={[
            styles.overrideLabelSub,
            { color: theme.textMuted, marginBottom: Spacing[2] },
          ]}
        >
          Compulsory — what you think it's worth
        </Text>
        <TextInput
          style={[
            styles.overrideInput,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.borderDefault,
              color: theme.textPrimary,
            },
          ]}
          placeholder="Enter your value ($)"
          placeholderTextColor={theme.textPlaceholder}
          value={declaredValue}
          onChangeText={setDeclaredValue}
          keyboardType="numeric"
        />
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
  confidenceBars: { flexDirection: "row", gap: 4 },
  confidenceBar: { width: 24, height: 6, borderRadius: Radius.full },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.lg,
    paddingVertical: Spacing[2],
    marginTop: Spacing[3],
  },
  retryBtnText: { ...Typography.captionMedium },
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
  overrideLabel: { flex: 1 },
  overrideLabelText: { ...Typography.bodyMedium },
  overrideLabelSub: { ...Typography.caption, marginTop: 2 },
  overrideInput: {
    flex: 1,
    height: Layout.inputHeight,
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    ...Typography.input,
  },

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
    borderWidth: 0.5,
    borderColor: Colors.white,
  },
  publishBtnText: { ...Typography.button, color: Colors.white },
});
