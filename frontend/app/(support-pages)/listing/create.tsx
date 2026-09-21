import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { goBack } from "@/hooks/navigation";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Colors,
  Layout,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import {
  Category,
  CreateItemPayload,
  createItem,
  getCategories,
  uploadItemImages,
} from "@/config/items";

// ─── Types ────────────────────────────────────────────────────────────────────

type Condition = "new" | "good" | "fair" | "poor";

interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionCardProps {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function SectionCard({ icon, title, subtitle, children }: SectionCardProps) {
  const theme = useAuthTheme();
  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: theme.surface, borderColor: theme.cardBorder },
      ]}
    >
      <View style={styles.sectionCardHeader}>
        <View
          style={[
            styles.sectionIconWrap,
            { backgroundColor: Colors.gray[100] },
          ]}
        >
          <Ionicons name={icon as any} size={18} color={Colors.text.primary} />
        </View>
        <View style={styles.sectionCardHeaderText}>
          <Text style={[styles.sectionCardTitle, { color: theme.textPrimary }]}>
            {title}
          </Text>
          <Text
            style={[styles.sectionCardSubtitle, { color: theme.textMuted }]}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      <View style={styles.sectionCardBody}>{children}</View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CreateListingScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();

  // Form state
  const [images, setImages] = useState<PickedImage[]>([]);
  const [title, setTitle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [description, setDescription] = useState("");
  const [desiredTrade, setDesiredTrade] = useState("");
  const [location, setLocation] = useState("");

  // UI state
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [tradeFocused, setTradeFocused] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Entrance animation
  const headerAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(headerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.spring(bodyAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
    ]).start();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch {}
  };

  // ── Image picking ────────────────────────────────────────────────────────────

  const handlePickImages = useCallback(async () => {
    if (images.length >= 6) {
      Alert.alert("Limit reached", "You can upload a maximum of 6 photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 6 - images.length,
    });
    if (!result.canceled && result.assets.length > 0) {
      const picked: PickedImage[] = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName ?? `image_${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      }));
      setImages((prev) => [...prev, ...picked].slice(0, 6));
      clearError("images");
    }
  }, [images]);

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Validation ───────────────────────────────────────────────────────────────

  const clearError = (field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (images.length < 1) newErrors.images = "Please add at least 1 photo.";
    if (!title.trim()) newErrors.title = "Title is required.";
    else if (title.trim().length > 255)
      newErrors.title = "Title must be under 255 characters.";
    if (!selectedCategory) newErrors.category = "Please select a category.";
    if (!condition) newErrors.condition = "Please select a condition.";
    if (!description.trim()) newErrors.description = "Description is required.";
    else if (description.trim().length < 20)
      newErrors.description = "Description must be at least 20 characters.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleContinue = useCallback(async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // Step 1: Create item
      const payload: CreateItemPayload = {
        title: title.trim(),
        description: description.trim(),
        category_id: selectedCategory!,
        condition: condition!,
        desired_trade: desiredTrade.trim() || undefined,
        location: location.trim() || undefined,
      };
      const created = await createItem(payload);

      // Step 2: Upload images
      await uploadItemImages(created.id, images);

      // Step 3: Navigate to Review screen with item ID
      router.replace({
        pathname: "/(support-pages)/listing/review",
        params: { id: created.id },
      });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 400) {
        const apiErrors = err.response?.data?.errors ?? {};
        const mapped: Record<string, string> = {};
        Object.entries(apiErrors).forEach(([field, messages]) => {
          mapped[field] = (messages as string[])[0];
        });
        setErrors(mapped);
      } else if (status === 404) {
        setErrors({ category: "Invalid category. Please try again." });
      } else {
        Alert.alert(
          "Something went wrong",
          err.response?.data?.message ??
            "Please check your connection and try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [
    title,
    description,
    selectedCategory,
    condition,
    desiredTrade,
    location,
    images,
  ]);

  // ── Back guard ───────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    const hasData =
      images.length > 0 ||
      title.trim() ||
      description.trim() ||
      selectedCategory ||
      condition;
    if (hasData) {
      Alert.alert("Discard listing?", "Your progress will be lost.", [
        { text: "Keep Editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => goBack() },
      ]);
    } else {
      goBack();
    }
  }, [images, title, description, selectedCategory, condition]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isValid =
    images.length >= 1 &&
    title.trim().length > 0 &&
    selectedCategory !== null &&
    condition !== null &&
    description.trim().length >= 20;

  const CONDITIONS: { label: string; value: Condition }[] = [
    { label: "Brand New", value: "new" },
    { label: "Good", value: "good" },
    { label: "Fair", value: "fair" },
    { label: "Poor", value: "poor" },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />

      {/* ── Header ── */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing[2],
            backgroundColor: theme.bg,
            borderBottomColor: theme.borderSubtle,
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          <Text style={[styles.backText, { color: theme.textPrimary }]}>
            Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Create Listing
        </Text>
        <View style={styles.headerRight} />
      </Animated.View>

      {/* ── Body ── */}
      <Animated.View
        style={[
          styles.bodyWrapper,
          {
            opacity: bodyAnim,
            transform: [
              {
                translateY: bodyAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ],
          },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.pageSubtitle, { color: theme.textMuted }]}>
            Fill in the details about your item below
          </Text>

          {/* ── Photos section ── */}
          <SectionCard
            icon="camera-outline"
            title="Photos"
            subtitle="Add up to 6 photos of your item"
          >
            <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
              Photos{" "}
              <Text style={{ color: Colors.danger }}>
                * (minimum 1 required)
              </Text>
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imagesRow}
            >
              {/* Add button */}
              {images.length < 6 && (
                <TouchableOpacity
                  style={[
                    styles.addImageBtn,
                    {
                      borderColor: errors.images
                        ? Colors.danger
                        : theme.borderDefault,
                      backgroundColor: theme.inputBg,
                    },
                  ]}
                  onPress={handlePickImages}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="add"
                    size={28}
                    color={theme.textPlaceholder}
                  />
                  <Text
                    style={[
                      styles.addImageLabel,
                      { color: theme.textPlaceholder },
                    ]}
                  >
                    Add
                  </Text>
                </TouchableOpacity>
              )}

              {/* Picked images */}
              {images.map((img, index) => (
                <View key={index} style={styles.imageThumbnailWrap}>
                  <Image
                    source={{ uri: img.uri }}
                    style={styles.imageThumbnail}
                    resizeMode="cover"
                  />
                  {index === 0 && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>Primary</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => handleRemoveImage(index)}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={Colors.danger}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {errors.images && (
              <Text style={styles.errorText}>{errors.images}</Text>
            )}

            {/* Tips */}
            <View
              style={[
                styles.tipsBox,
                {
                  backgroundColor: Colors.gray[50],
                  borderColor: theme.borderSubtle,
                },
              ]}
            >
              <View style={styles.tipsHeader}>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color={theme.textMuted}
                />
                <Text style={[styles.tipsTitle, { color: theme.textMuted }]}>
                  Tips for great photos
                </Text>
              </View>
              {[
                "Use natural lighting",
                "Show item from multiple angles",
                "Include any flaws or wear in photos",
              ].map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View
                    style={[
                      styles.tipDot,
                      { backgroundColor: theme.textMuted },
                    ]}
                  />
                  <Text style={[styles.tipText, { color: theme.textMuted }]}>
                    {tip}
                  </Text>
                </View>
              ))}
            </View>
          </SectionCard>

          {/* ── Basic Information ── */}
          <SectionCard
            icon="information-circle-outline"
            title="Basic Information"
            subtitle="Tell us about your item"
          >
            {/* Title */}
            <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
              Title <Text style={{ color: Colors.danger }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: titleFocused
                    ? theme.inputBgFocused
                    : theme.inputBg,
                  borderColor: errors.title
                    ? Colors.danger
                    : titleFocused
                      ? theme.borderFocus
                      : theme.borderDefault,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="e.g. Wireless Earphones — Brand New"
              placeholderTextColor={theme.textPlaceholder}
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                clearError("title");
              }}
              onFocus={() => setTitleFocused(true)}
              onBlur={() => setTitleFocused(false)}
              maxLength={255}
            />
            {errors.title && (
              <Text style={styles.errorText}>{errors.title}</Text>
            )}

            {/* Category */}
            <Text
              style={[
                styles.fieldLabel,
                { color: theme.textPrimary, marginTop: Spacing[4] },
              ]}
            >
              Category <Text style={{ color: Colors.danger }}>*</Text>
            </Text>
            <View style={styles.chipsGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.selectionChip,
                    {
                      backgroundColor:
                        selectedCategory === cat.id
                          ? Colors.primary
                          : theme.inputBg,
                      borderColor: errors.category
                        ? Colors.danger
                        : selectedCategory === cat.id
                          ? Colors.primary
                          : theme.borderDefault,
                    },
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat.id);
                    clearError("category");
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.selectionChipText,
                      {
                        color:
                          selectedCategory === cat.id
                            ? Colors.white
                            : theme.textPrimary,
                      },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.category && (
              <Text style={styles.errorText}>{errors.category}</Text>
            )}

            {/* Condition */}
            <Text
              style={[
                styles.fieldLabel,
                { color: theme.textPrimary, marginTop: Spacing[4] },
              ]}
            >
              Condition <Text style={{ color: Colors.danger }}>*</Text>
            </Text>
            <View style={styles.conditionRow}>
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[
                    styles.conditionChip,
                    {
                      backgroundColor:
                        condition === c.value ? Colors.primary : theme.inputBg,
                      borderColor: errors.condition
                        ? Colors.danger
                        : condition === c.value
                          ? Colors.primary
                          : theme.borderDefault,
                    },
                  ]}
                  onPress={() => {
                    setCondition(c.value);
                    clearError("condition");
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.conditionChipText,
                      {
                        color:
                          condition === c.value
                            ? Colors.white
                            : theme.textPrimary,
                      },
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.condition && (
              <Text style={styles.errorText}>{errors.condition}</Text>
            )}
          </SectionCard>

          {/* ── Description & Preferences ── */}
          <SectionCard
            icon="book-outline"
            title="Description & Preferences"
            subtitle="Provide details and what you want"
          >
            {/* Description */}
            <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
              Description <Text style={{ color: Colors.danger }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.textarea,
                {
                  backgroundColor: descFocused
                    ? theme.inputBgFocused
                    : theme.inputBg,
                  borderColor: errors.description
                    ? Colors.danger
                    : descFocused
                      ? theme.borderFocus
                      : theme.borderDefault,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="Describe your item's condition, features, and any important details..."
              placeholderTextColor={theme.textPlaceholder}
              value={description}
              onChangeText={(t) => {
                setDescription(t);
                clearError("description");
              }}
              onFocus={() => setDescFocused(true)}
              onBlur={() => setDescFocused(false)}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: theme.textMuted }]}>
              {description.length}/500 characters
            </Text>
            {errors.description && (
              <Text style={styles.errorText}>{errors.description}</Text>
            )}

            {/* What I'm looking for */}
            <Text
              style={[
                styles.fieldLabel,
                { color: theme.textPrimary, marginTop: Spacing[4] },
              ]}
            >
              What I{"'"}m looking for
            </Text>
            <TextInput
              style={[
                styles.textarea,
                {
                  backgroundColor: tradeFocused
                    ? theme.inputBgFocused
                    : theme.inputBg,
                  borderColor: tradeFocused
                    ? theme.borderFocus
                    : theme.borderDefault,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="What would you like to trade for? Be specific or keep it open..."
              placeholderTextColor={theme.textPlaceholder}
              value={desiredTrade}
              onChangeText={setDesiredTrade}
              onFocus={() => setTradeFocused(true)}
              onBlur={() => setTradeFocused(false)}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: theme.textMuted }]}>
              {desiredTrade.length}/500 characters
            </Text>

            {/* Pro tip */}
            <View
              style={[
                styles.proTip,
                {
                  backgroundColor: Colors.aiSurface,
                  borderColor: Colors.aiLight,
                },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={Colors.ai}
              />
              <Text style={[styles.proTipText, { color: Colors.ai }]}>
                Pro tip: Being specific about what you want increases your match
                quality
              </Text>
            </View>
          </SectionCard>

          {/* ── Location ── */}
          <SectionCard
            icon="location-outline"
            title="Location"
            subtitle="Where is the item located?"
          >
            <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
              Your Location
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: locationFocused
                    ? theme.inputBgFocused
                    : theme.inputBg,
                  borderColor: locationFocused
                    ? theme.borderFocus
                    : theme.borderDefault,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="Enter your city or state"
              placeholderTextColor={theme.textPlaceholder}
              value={location}
              onChangeText={setLocation}
              onFocus={() => setLocationFocused(true)}
              onBlur={() => setLocationFocused(false)}
              maxLength={100}
            />

            <View
              style={[
                styles.privacyNotice,
                {
                  backgroundColor: Colors.gray[50],
                  borderColor: theme.borderSubtle,
                },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={13}
                color={theme.textMuted}
              />
              <Text style={[styles.privacyText, { color: theme.textMuted }]}>
                Privacy Notice — Your exact address is never shared. We only
                show your general area to potential trade partners.
              </Text>
            </View>
          </SectionCard>
        </ScrollView>
      </Animated.View>

      {/* ── Bottom CTA ── */}
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
          style={[
            styles.ctaBtn,
            {
              backgroundColor:
                isValid && !loading ? Colors.primary : theme.btnDisabled,
            },
          ]}
          onPress={handleContinue}
          disabled={!isValid || loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Text style={styles.ctaBtnText}>Continue to AI Evaluation</Text>
              <Ionicons name="sparkles" size={16} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 60,
  },
  backText: { ...Typography.body },
  headerTitle: { ...Typography.sectionTitle },
  headerRight: { minWidth: 60 },

  // Body
  bodyWrapper: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
    gap: Spacing[4],
  },
  pageSubtitle: {
    ...Typography.body,
    marginBottom: Spacing[2],
  },

  // Section card
  sectionCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    overflow: "hidden",
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    padding: Spacing[4],
    paddingBottom: Spacing[3],
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCardHeaderText: { flex: 1 },
  sectionCardTitle: { ...Typography.bodyMedium },
  sectionCardSubtitle: { ...Typography.caption, marginTop: 2 },
  sectionCardBody: {
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[4],
  },

  // Field
  fieldLabel: { ...Typography.inputLabel, marginBottom: Spacing[2] },
  input: {
    height: Layout.inputHeight,
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    ...Typography.input,
  },
  textarea: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    ...Typography.input,
    minHeight: 100,
  },
  charCount: { ...Typography.micro, marginTop: 4, textAlign: "right" },
  errorText: { ...Typography.caption, color: Colors.danger, marginTop: 4 },

  // Images
  imagesRow: { marginBottom: Spacing[3] },
  addImageBtn: {
    width: 76,
    height: 76,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing[2],
  },
  addImageLabel: { ...Typography.micro, marginTop: 2 },
  imageThumbnailWrap: {
    position: "relative",
    marginRight: Spacing[2],
  },
  imageThumbnail: {
    width: 76,
    height: 76,
    borderRadius: Radius.lg,
  },
  primaryBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  primaryBadgeText: {
    ...Typography.micro,
    color: Colors.white,
    fontWeight: "600",
  },
  removeImageBtn: {
    position: "absolute",
    top: -6,
    right: -6,
  },

  // Tips
  tipsBox: {
    borderRadius: Radius.md,
    borderWidth: Layout.borderWidth,
    padding: Spacing[3],
    gap: Spacing[2],
  },
  tipsHeader: { flexDirection: "row", alignItems: "center", gap: Spacing[1] },
  tipsTitle: { ...Typography.caption },
  tipRow: { flexDirection: "row", alignItems: "center", gap: Spacing[2] },
  tipDot: { width: 4, height: 4, borderRadius: 2 },
  tipText: { ...Typography.micro },

  // Chips
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing[2],
  },
  selectionChip: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
  },
  selectionChipText: { ...Typography.captionMedium },

  conditionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing[2],
  },
  conditionChip: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    alignItems: "center",
  },
  conditionChipText: { ...Typography.captionMedium },

  // Pro tip
  proTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
    borderWidth: Layout.borderWidth,
    marginTop: Spacing[3],
  },
  proTipText: { ...Typography.micro, flex: 1, lineHeight: 18 },

  // Privacy notice
  privacyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
    borderWidth: Layout.borderWidth,
    marginTop: Spacing[3],
  },
  privacyText: { ...Typography.micro, flex: 1, lineHeight: 18 },

  // CTA
  ctaBar: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
  },
  ctaBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
  },
  ctaBtnText: { ...Typography.button, color: Colors.white },
});
