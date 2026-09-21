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
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/hooks/navigation";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Layout, Radius, Spacing, Typography } from "@/constants";
import { useAuthTheme } from "@/constants/useAuthTheme";
import {
  Category,
  ItemDetail,
  UpdateItemPayload,
  deactivateItem,
  deleteItem,
  getCategories,
  getItemById,
  updateItem,
} from "@/config/items";

type Condition = "new" | "good" | "fair" | "poor";

const CONDITIONS: { label: string; value: Condition }[] = [
  { label: "Brand New", value: "new" },
  { label: "Good", value: "good" },
  { label: "Fair", value: "fair" },
  { label: "Poor", value: "poor" },
];

export default function EditListingScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Data
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [description, setDescription] = useState("");
  const [desiredTrade, setDesiredTrade] = useState("");
  const [location, setLocation] = useState("");

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [tradeFocused, setTradeFocused] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Entrance animation
  const contentAnim = useRef(new Animated.Value(0)).current;

  // ── Load ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [itemData, cats] = await Promise.all([
          getItemById(id),
          getCategories(),
        ]);
        setItem(itemData);
        setCategories(cats);

        // Pre-populate form
        setTitle(itemData.title);
        setSelectedCategory(itemData.category?.id ?? null);
        setCondition(itemData.condition as Condition);
        setDescription(itemData.description ?? "");
        setDesiredTrade(itemData.desired_trade ?? "");
        setLocation(itemData.location ?? "");
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
  }, [id]);

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

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!validate() || !id) return;
    setSaving(true);
    try {
      const payload: UpdateItemPayload = {
        title: title.trim(),
        description: description.trim(),
        category_id: selectedCategory!,
        condition: condition!,
        desired_trade: desiredTrade.trim() || undefined,
        location: location.trim() || undefined,
      };
      await updateItem(id, payload);
      goBack();
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 400) {
        const apiErrors = err.response?.data?.errors ?? {};
        const mapped: Record<string, string> = {};
        Object.entries(apiErrors).forEach(([field, messages]) => {
          mapped[field] = (messages as string[])[0];
        });
        setErrors(mapped);
      } else if (status === 422) {
        Alert.alert(
          "Cannot Edit",
          "This listing is currently in a trade and cannot be edited.",
        );
      } else {
        Alert.alert(
          "Error",
          err.response?.data?.message ?? "Failed to save changes.",
        );
      }
    } finally {
      setSaving(false);
    }
  }, [
    id,
    title,
    description,
    selectedCategory,
    condition,
    desiredTrade,
    location,
  ]);

  // ── Deactivate ───────────────────────────────────────────────────────────────

  const handleDeactivate = useCallback(() => {
    Alert.alert(
      "Deactivate Listing",
      "This will remove your listing from the marketplace. You can reactivate it later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            if (!id) return;
            setDeactivating(true);
            try {
              await deactivateItem(id);
              router.replace("/(support-pages)/listing/my-listings");
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.response?.data?.message ?? "Failed to deactivate listing.",
              );
            } finally {
              setDeactivating(false);
            }
          },
        },
      ],
    );
  }, [id]);

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete Listing",
      "This will permanently delete your listing. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!id) return;
            setDeleting(true);
            try {
              await deleteItem(id);
              router.replace("/(support-pages)/listing/my-listings");
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.response?.data?.message ?? "Failed to delete listing.",
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [id]);

  // ── Back guard ───────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (!item) {
      goBack();
      return;
    }
    const hasChanges =
      title.trim() !== item.title ||
      selectedCategory !== (item.category?.id ?? null) ||
      condition !== item.condition ||
      description.trim() !== (item.description ?? "") ||
      desiredTrade.trim() !== (item.desired_trade ?? "") ||
      location.trim() !== (item.location ?? "");

    if (hasChanges) {
      Alert.alert("Discard changes?", "Your unsaved changes will be lost.", [
        { text: "Keep Editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => goBack() },
      ]);
    } else {
      goBack();
    }
  }, [
    item,
    title,
    selectedCategory,
    condition,
    description,
    desiredTrade,
    location,
  ]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isValid =
    title.trim().length > 0 &&
    selectedCategory !== null &&
    condition !== null &&
    description.trim().length >= 20;

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
      </View>
    );
  }

  if (!item) return null;

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

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing[2],
            backgroundColor: theme.bg,
            borderBottomColor: theme.borderSubtle,
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
          Edit Listing
        </Text>
        <TouchableOpacity
          style={[
            styles.saveBtn,
            {
              backgroundColor:
                isValid && !saving ? Colors.primary : theme.btnDisabled,
            },
          ]}
          onPress={handleSave}
          disabled={!isValid || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ opacity: contentAnim }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing[8] },
        ]}
      >
        {/* In-trade warning */}
        {item.status === "in_trade" && (
          <View
            style={[
              styles.warningBanner,
              { backgroundColor: Colors.warning + "20" },
            ]}
          >
            <Ionicons name="warning-outline" size={16} color={Colors.warning} />
            <Text style={[styles.warningText, { color: Colors.warning }]}>
              This listing is currently in a trade. Editing is restricted.
            </Text>
          </View>
        )}

        {/* ── Basic Information ── */}
        <View
          style={[
            styles.section,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Basic Information
          </Text>

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
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              clearError("title");
            }}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
            placeholder="Item title"
            placeholderTextColor={theme.textPlaceholder}
            maxLength={255}
            editable={item.status !== "in_trade"}
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

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
                    opacity: item.status === "in_trade" ? 0.5 : 1,
                  },
                ]}
                onPress={() => {
                  if (item.status === "in_trade") return;
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
                    opacity: item.status === "in_trade" ? 0.5 : 1,
                  },
                ]}
                onPress={() => {
                  if (item.status === "in_trade") return;
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
        </View>

        {/* ── Description & Preferences ── */}
        <View
          style={[
            styles.section,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Description & Preferences
          </Text>

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
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              clearError("description");
            }}
            onFocus={() => setDescFocused(true)}
            onBlur={() => setDescFocused(false)}
            placeholder="Describe your item..."
            placeholderTextColor={theme.textPlaceholder}
            multiline
            maxLength={500}
            textAlignVertical="top"
            editable={item.status !== "in_trade"}
          />
          <Text style={[styles.charCount, { color: theme.textMuted }]}>
            {description.length}/500 characters
          </Text>
          {errors.description && (
            <Text style={styles.errorText}>{errors.description}</Text>
          )}

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
            value={desiredTrade}
            onChangeText={setDesiredTrade}
            onFocus={() => setTradeFocused(true)}
            onBlur={() => setTradeFocused(false)}
            placeholder="What would you like in exchange?"
            placeholderTextColor={theme.textPlaceholder}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: theme.textMuted }]}>
            {desiredTrade.length}/500 characters
          </Text>
        </View>

        {/* ── Location ── */}
        <View
          style={[
            styles.section,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Location
          </Text>
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
            value={location}
            onChangeText={setLocation}
            onFocus={() => setLocationFocused(true)}
            onBlur={() => setLocationFocused(false)}
            placeholder="City or state"
            placeholderTextColor={theme.textPlaceholder}
            maxLength={100}
          />
        </View>

        {/* ── Danger Zone ── */}
        <View
          style={[
            styles.section,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Manage Listing
          </Text>

          {/* Deactivate */}
          <TouchableOpacity
            style={[
              styles.dangerBtn,
              {
                borderColor: Colors.warning,
                opacity: item.status === "in_trade" ? 0.4 : 1,
              },
            ]}
            onPress={handleDeactivate}
            disabled={item.status === "in_trade" || deactivating}
            activeOpacity={0.85}
          >
            {deactivating ? (
              <ActivityIndicator size="small" color={Colors.warning} />
            ) : (
              <>
                <Ionicons
                  name="eye-off-outline"
                  size={18}
                  color={Colors.warning}
                />
                <View style={styles.dangerBtnText}>
                  <Text
                    style={[styles.dangerBtnLabel, { color: Colors.warning }]}
                  >
                    Deactivate Listing
                  </Text>
                  <Text
                    style={[styles.dangerBtnSub, { color: theme.textMuted }]}
                  >
                    Remove from marketplace temporarily
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Delete */}
          <TouchableOpacity
            style={[
              styles.dangerBtn,
              {
                borderColor: Colors.danger,
                marginTop: Spacing[3],
                opacity: item.status === "in_trade" ? 0.4 : 1,
              },
            ]}
            onPress={handleDelete}
            disabled={item.status === "in_trade" || deleting}
            activeOpacity={0.85}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={Colors.danger} />
            ) : (
              <>
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={Colors.danger}
                />
                <View style={styles.dangerBtnText}>
                  <Text
                    style={[styles.dangerBtnLabel, { color: Colors.danger }]}
                  >
                    Delete Listing
                  </Text>
                  <Text
                    style={[styles.dangerBtnSub, { color: theme.textMuted }]}
                  >
                    Permanently remove this listing
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 60 },
  backText: { ...Typography.body },
  headerTitle: { ...Typography.sectionTitle },
  saveBtn: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.lg,
    minWidth: 60,
    alignItems: "center",
  },
  saveBtnText: { ...Typography.button, color: Colors.white },

  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
    gap: Spacing[4],
  },

  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
  },
  warningText: { ...Typography.bodyMedium, flex: 1 },

  section: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    padding: Spacing[4],
    gap: Spacing[2],
  },
  sectionTitle: { ...Typography.sectionTitle, marginBottom: Spacing[2] },

  fieldLabel: { ...Typography.inputLabel },
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
  charCount: { ...Typography.micro, textAlign: "right" },
  errorText: { ...Typography.caption, color: Colors.danger },

  chipsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing[2] },
  selectionChip: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
  },
  selectionChipText: { ...Typography.captionMedium },

  conditionRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing[2] },
  conditionChip: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    alignItems: "center",
  },
  conditionChipText: { ...Typography.captionMedium },

  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    padding: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
  },
  dangerBtnText: { flex: 1 },
  dangerBtnLabel: { ...Typography.bodyMedium },
  dangerBtnSub: { ...Typography.caption, marginTop: 2 },
});
