/**
 * Bartcash — Edit Profile Screen
 * Route: app/(support-pages)/profile/edit.tsx
 *
 * Allows the authenticated user to update their profile information
 * and upload a new avatar photo.
 *
 * API:
 *   PUT  /user/profile  — update first_name, last_name, bio, location
 *   POST /user/avatar   — upload new profile photo (multipart/form-data)
 */

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
import api from "@/config/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_photo: string | null;
  bio: string | null;
  location: string | null;
  average_rating: string;
  total_trades: number;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();

  // Profile data
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarChanged, setAvatarChanged] = useState(false);

  // Focus state
  const [firstNameFocused, setFirstNameFocused] = useState(false);
  const [lastNameFocused, setLastNameFocused] = useState(false);
  const [bioFocused, setBioFocused] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Entrance animations
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

    fetchProfile();
  }, []);

  // ── Fetch current profile ────────────────────────────────────────────────────

  const fetchProfile = async () => {
    try {
      const response = await api.get("/user/profile");
      const user: UserProfile = response.data.data.user;
      setProfile(user);
      setFirstName(user.first_name);
      setLastName(user.last_name);
      setBio(user.bio ?? "");
      setLocation(user.location ?? "");
      setAvatarUri(user.profile_photo);
    } catch (err: any) {
      Alert.alert("Error", "Failed to load profile. Please try again.");
    } finally {
      setLoadingProfile(false);
    }
  };

  // ── Avatar picker ────────────────────────────────────────────────────────────

  const handlePickAvatar = useCallback(async () => {
    Alert.alert("Change Photo", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!result.canceled && result.assets[0]) {
            setAvatarUri(result.assets[0].uri);
            setAvatarChanged(true);
          }
        },
      },
      {
        text: "Choose from Gallery",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!result.canceled && result.assets[0]) {
            setAvatarUri(result.assets[0].uri);
            setAvatarChanged(true);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
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
    if (!firstName.trim()) newErrors.first_name = "First name is required.";
    if (!lastName.trim()) newErrors.last_name = "Last name is required.";
    if (bio.length > 200) newErrors.bio = "Bio must be under 200 characters.";
    if (location.length > 100)
      newErrors.location = "Location must be under 100 characters.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Save changes ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      // Upload avatar first if changed
      if (avatarChanged && avatarUri) {
        setUploadingAvatar(true);
        const formData = new FormData();
        formData.append("avatar", {
          uri: avatarUri,
          name: "avatar.jpg",
          type: "image/jpeg",
        } as any);
        await api.post("/user/avatar", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setUploadingAvatar(false);
      }

      // Update profile fields
      await api.put("/user/profile", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
      });

      goBack();
    } catch (err: any) {
      setUploadingAvatar(false);
      const status = err.response?.status;
      if (status === 400) {
        const apiErrors = err.response?.data?.errors ?? {};
        const mapped: Record<string, string> = {};
        Object.entries(apiErrors).forEach(([field, messages]) => {
          mapped[field] = (messages as string[])[0];
        });
        setErrors(mapped);
      } else {
        Alert.alert(
          "Error",
          err.response?.data?.message ??
            "Something went wrong. Please try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  }, [firstName, lastName, bio, location, avatarUri, avatarChanged]);

  // ── Back guard ───────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    const hasChanges =
      avatarChanged ||
      firstName !== (profile?.first_name ?? "") ||
      lastName !== (profile?.last_name ?? "") ||
      bio !== (profile?.bio ?? "") ||
      location !== (profile?.location ?? "");

    if (hasChanges) {
      Alert.alert("Discard Changes?", "Your unsaved changes will be lost.", [
        { text: "Keep Editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => goBack() },
      ]);
    } else {
      goBack();
    }
  }, [avatarChanged, firstName, lastName, bio, location, profile]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const initials = profile
    ? `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase()
    : "?";

  const isValid = firstName.trim().length > 0 && lastName.trim().length > 0;

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (loadingProfile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar
          barStyle={theme.isDark ? "light-content" : "dark-content"}
          backgroundColor={theme.bg}
        />
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
          <TouchableOpacity onPress={() => goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
            <Text style={[styles.backText, { color: theme.textPrimary }]}>
              Back
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            Edit Profile
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────

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
          Edit Profile
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
          {/* ── Avatar section ── */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={handlePickAvatar}
              activeOpacity={0.85}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    styles.avatarFallback,
                    { backgroundColor: Colors.primary },
                  ]}
                >
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}

              {/* Edit overlay */}
              <View style={styles.avatarEditOverlay}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Ionicons name="camera" size={16} color={Colors.white} />
                )}
              </View>
            </TouchableOpacity>

            <Text style={[styles.avatarHint, { color: theme.textMuted }]}>
              Tap to change photo
            </Text>
          </View>

          {/* ── Name fields ── */}
          <View
            style={[
              styles.formCard,
              { backgroundColor: theme.surface, borderColor: theme.cardBorder },
            ]}
          >
            <View style={styles.formCardHeader}>
              <View
                style={[
                  styles.formIconWrap,
                  { backgroundColor: Colors.gray[100] },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={Colors.text.primary}
                />
              </View>
              <View>
                <Text
                  style={[styles.formCardTitle, { color: theme.textPrimary }]}
                >
                  Personal Info
                </Text>
                <Text
                  style={[styles.formCardSubtitle, { color: theme.textMuted }]}
                >
                  Your name as shown to other users
                </Text>
              </View>
            </View>

            <View style={styles.formCardBody}>
              {/* First Name */}
              <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
                First Name <Text style={{ color: Colors.danger }}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: firstNameFocused
                      ? theme.inputBgFocused
                      : theme.inputBg,
                    borderColor: errors.first_name
                      ? Colors.danger
                      : firstNameFocused
                        ? theme.borderFocus
                        : theme.borderDefault,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Enter your first name"
                placeholderTextColor={theme.textPlaceholder}
                value={firstName}
                onChangeText={(t) => {
                  setFirstName(t);
                  clearError("first_name");
                }}
                onFocus={() => setFirstNameFocused(true)}
                onBlur={() => setFirstNameFocused(false)}
                maxLength={100}
              />
              {errors.first_name && (
                <Text style={styles.errorText}>{errors.first_name}</Text>
              )}

              {/* Last Name */}
              <Text
                style={[
                  styles.fieldLabel,
                  { color: theme.textPrimary, marginTop: Spacing[4] },
                ]}
              >
                Last Name <Text style={{ color: Colors.danger }}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: lastNameFocused
                      ? theme.inputBgFocused
                      : theme.inputBg,
                    borderColor: errors.last_name
                      ? Colors.danger
                      : lastNameFocused
                        ? theme.borderFocus
                        : theme.borderDefault,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Enter your last name"
                placeholderTextColor={theme.textPlaceholder}
                value={lastName}
                onChangeText={(t) => {
                  setLastName(t);
                  clearError("last_name");
                }}
                onFocus={() => setLastNameFocused(true)}
                onBlur={() => setLastNameFocused(false)}
                maxLength={100}
              />
              {errors.last_name && (
                <Text style={styles.errorText}>{errors.last_name}</Text>
              )}
            </View>
          </View>

          {/* ── Bio & Location ── */}
          <View
            style={[
              styles.formCard,
              { backgroundColor: theme.surface, borderColor: theme.cardBorder },
            ]}
          >
            <View style={styles.formCardHeader}>
              <View
                style={[
                  styles.formIconWrap,
                  { backgroundColor: Colors.gray[100] },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={Colors.text.primary}
                />
              </View>
              <View>
                <Text
                  style={[styles.formCardTitle, { color: theme.textPrimary }]}
                >
                  About You
                </Text>
                <Text
                  style={[styles.formCardSubtitle, { color: theme.textMuted }]}
                >
                  Help others know who they{"'"}re trading with
                </Text>
              </View>
            </View>

            <View style={styles.formCardBody}>
              {/* Bio */}
              <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
                Bio
              </Text>
              <TextInput
                style={[
                  styles.textarea,
                  {
                    backgroundColor: bioFocused
                      ? theme.inputBgFocused
                      : theme.inputBg,
                    borderColor: errors.bio
                      ? Colors.danger
                      : bioFocused
                        ? theme.borderFocus
                        : theme.borderDefault,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Tell others a bit about yourself..."
                placeholderTextColor={theme.textPlaceholder}
                value={bio}
                onChangeText={(t) => {
                  setBio(t);
                  clearError("bio");
                }}
                onFocus={() => setBioFocused(true)}
                onBlur={() => setBioFocused(false)}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, { color: theme.textMuted }]}>
                {bio.length}/200 characters
              </Text>
              {errors.bio && <Text style={styles.errorText}>{errors.bio}</Text>}

              {/* Location */}
              <Text
                style={[
                  styles.fieldLabel,
                  { color: theme.textPrimary, marginTop: Spacing[4] },
                ]}
              >
                Location
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: locationFocused
                      ? theme.inputBgFocused
                      : theme.inputBg,
                    borderColor: errors.location
                      ? Colors.danger
                      : locationFocused
                        ? theme.borderFocus
                        : theme.borderDefault,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Your city or state"
                placeholderTextColor={theme.textPlaceholder}
                value={location}
                onChangeText={(t) => {
                  setLocation(t);
                  clearError("location");
                }}
                onFocus={() => setLocationFocused(true)}
                onBlur={() => setLocationFocused(false)}
                maxLength={100}
              />
              {errors.location && (
                <Text style={styles.errorText}>{errors.location}</Text>
              )}
            </View>
          </View>

          {/* ── Email (read-only) ── */}
          <View
            style={[
              styles.formCard,
              { backgroundColor: theme.surface, borderColor: theme.cardBorder },
            ]}
          >
            <View style={styles.formCardHeader}>
              <View
                style={[
                  styles.formIconWrap,
                  { backgroundColor: Colors.gray[100] },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={Colors.text.primary}
                />
              </View>
              <View>
                <Text
                  style={[styles.formCardTitle, { color: theme.textPrimary }]}
                >
                  Email Address
                </Text>
                <Text
                  style={[styles.formCardSubtitle, { color: theme.textMuted }]}
                >
                  Cannot be changed
                </Text>
              </View>
            </View>

            <View style={styles.formCardBody}>
              <View
                style={[
                  styles.readOnlyField,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.borderSubtle,
                  },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={14}
                  color={theme.textMuted}
                />
                <Text style={[styles.readOnlyText, { color: theme.textMuted }]}>
                  {profile?.email}
                </Text>
              </View>
            </View>
          </View>
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
                isValid && !saving ? Colors.primary : theme.btnDisabled,
            },
          ]}
          onPress={handleSave}
          disabled={!isValid || saving}
          activeOpacity={0.9}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.ctaBtnText}>Save Changes</Text>
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

  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Body
  bodyWrapper: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[6],
    gap: Spacing[4],
  },

  // Avatar
  avatarSection: {
    alignItems: "center",
    marginBottom: Spacing[2],
  },
  avatarWrap: {
    position: "relative",
    marginBottom: Spacing[2],
  },
  avatar: {
    width: Layout.avatarXl,
    height: Layout.avatarXl,
    borderRadius: Layout.avatarXl / 2,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    ...Typography.pageTitle,
    color: Colors.white,
    fontWeight: "700",
  },
  avatarEditOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.white,
  },
  avatarHint: {
    ...Typography.caption,
  },

  // Form card
  formCard: {
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    overflow: "hidden",
  },
  formCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    padding: Spacing[4],
    paddingBottom: Spacing[3],
  },
  formIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  formCardTitle: { ...Typography.bodyMedium },
  formCardSubtitle: { ...Typography.caption, marginTop: 2 },
  formCardBody: {
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[4],
  },

  // Fields
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
    minHeight: 90,
  },
  charCount: {
    ...Typography.micro,
    marginTop: 4,
    textAlign: "right",
  },
  errorText: {
    ...Typography.caption,
    color: Colors.danger,
    marginTop: 4,
  },
  readOnlyField: {
    height: Layout.inputHeight,
    borderRadius: Radius.lg,
    borderWidth: Layout.borderWidth,
    paddingHorizontal: Spacing[4],
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
  },
  readOnlyText: {
    ...Typography.input,
  },

  // CTA
  ctaBar: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
  },
  ctaBtn: {
    height: Layout.buttonHeight,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnText: {
    ...Typography.button,
    color: Colors.white,
  },
});
