import { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/hooks/navigation";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Spacing, Radius, Typography, Layout } from "@/constants";
import { resetPassword } from "@/config/auth";

const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*[0-9]).{8,}$/;

export default function ResetPasswordScreen() {
  const theme = useAuthTheme();

  // Token is extracted from the deep link
  // bartcash://reset-password?token=xxxxxx
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const contentAnim = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(20)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(contentAnim, {
        toValue: 1,
        tension: 70,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(contentTranslate, {
        toValue: 0,
        tension: 70,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    // If no token in the URL — show error immediately
    if (!token) {
      setError(
        "This reset link is invalid or has expired. Please request a new one.",
      );
    }
  }, []);

  // Auto-navigate to login after successful reset
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      router.replace("/(auth)/sign-in");
    }, 2000);
    return () => clearTimeout(timer);
  }, [success]);

  const passwordsMatch = password === confirmPassword;
  const passwordValid = PASSWORD_REGEX.test(password);
  const isValid =
    token &&
    passwordValid &&
    passwordsMatch &&
    password.length > 0 &&
    confirmPassword.length > 0;

  const handleReset = async () => {
    if (!isValid || loading) return;
    setError("");

    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.97,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();

    setLoading(true);
    try {
      await resetPassword({
        token: token!,
        password,
        password_confirmation: confirmPassword,
      });

      setSuccess(true);
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (status === 400) {
        // Token invalid, already used, or expired
        setError(
          message ||
            "This reset link is invalid or has expired. Please request a new one.",
        );
      } else {
        setError(message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string) => [
    styles.input,
    {
      backgroundColor: focused === field ? theme.inputBgFocused : theme.inputBg,
      borderColor: focused === field ? theme.borderFocus : theme.borderDefault,
      color: theme.textPrimary,
    },
  ];

  // ── No token state ────────────────────────────────────────────────────────
  if (!token) {
    return (
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <StatusBar style={theme.statusBarStyle} />
        <View style={styles.centeredState}>
          <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
            Invalid Reset Link
          </Text>
          <Text style={[styles.errorBody, { color: theme.textMuted }]}>
            This reset link is invalid or has expired. Please request a new one.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.btnPrimary }]}
            onPress={() =>
              router.replace({
                pathname: "/(auth)/forgot-password",
                params: {
                  error:
                    "Your reset link was invalid or expired. Please request a new one.",
                },
              })
            }
            activeOpacity={0.85}
          >
            <Text
              style={[styles.primaryBtnText, { color: theme.btnPrimaryText }]}
            >
              Request New Link
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <StatusBar style={theme.statusBarStyle} />
        <View style={styles.centeredState}>
          <Text style={[styles.successTitle, { color: theme.textPrimary }]}>
            Password Reset!
          </Text>
          <Text style={[styles.errorBody, { color: theme.textMuted }]}>
            Your password has been updated successfully. Taking you to sign
            in...
          </Text>
        </View>
      </View>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style={theme.statusBarStyle} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: contentAnim,
              transform: [{ translateY: contentTranslate }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => goBack()}
            activeOpacity={0.6}
          >
            <Text style={[styles.backText, { color: theme.textPrimary }]}>
              ‹ Back
            </Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Reset Password
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Choose a new password for your account. It must be at least 8
            characters and contain a letter and a number.
          </Text>

          {error ? (
            <View
              style={[styles.errorBanner, { backgroundColor: theme.errorBg }]}
            >
              <Text style={[styles.errorBannerText, { color: theme.error }]}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* New Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>
              New Password
            </Text>
            <View
              style={[
                styles.input,
                styles.passwordRow,
                {
                  backgroundColor:
                    focused === "password"
                      ? theme.inputBgFocused
                      : theme.inputBg,
                  borderColor:
                    focused === "password"
                      ? theme.borderFocus
                      : theme.borderDefault,
                },
              ]}
            >
              <TextInput
                style={[styles.passwordInput, { color: theme.textPrimary }]}
                placeholder="Min 8 chars, letter + number"
                placeholderTextColor={theme.textPlaceholder}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError("");
                }}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.6}
              >
                <Text style={[styles.toggleText, { color: theme.textMuted }]}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>
            {password.length > 0 && !passwordValid && (
              <Text style={[styles.fieldError, { color: theme.error }]}>
                Must be at least 8 characters with a letter and a number.
              </Text>
            )}
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>
              Confirm Password
            </Text>
            <View
              style={[
                styles.input,
                styles.passwordRow,
                {
                  backgroundColor:
                    focused === "confirm"
                      ? theme.inputBgFocused
                      : theme.inputBg,
                  borderColor:
                    focused === "confirm"
                      ? theme.borderFocus
                      : theme.borderDefault,
                },
              ]}
            >
              <TextInput
                style={[styles.passwordInput, { color: theme.textPrimary }]}
                placeholder="Re-enter your password"
                placeholderTextColor={theme.textPlaceholder}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  setError("");
                }}
                onFocus={() => setFocused("confirm")}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(!showConfirm)}
                activeOpacity={0.6}
              >
                <Text style={[styles.toggleText, { color: theme.textMuted }]}>
                  {showConfirm ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <Text style={[styles.fieldError, { color: theme.error }]}>
                Passwords do not match.
              </Text>
            )}
          </View>

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                {
                  backgroundColor:
                    isValid && !loading ? theme.btnPrimary : theme.btnDisabled,
                },
              ]}
              onPress={handleReset}
              disabled={!isValid || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={theme.btnPrimaryText} size="small" />
              ) : (
                <Text
                  style={[
                    styles.primaryBtnText,
                    { color: theme.btnPrimaryText },
                  ]}
                >
                  Reset Password
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingBottom: Spacing[10],
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing[6],
    paddingTop: Platform.OS === "ios" ? 56 : 40,
  },
  backBtn: {
    paddingVertical: Spacing[2],
    marginBottom: Spacing[4],
  },
  backText: { ...Typography.navLabel },
  title: { ...Typography.pageTitle, marginBottom: Spacing[3] },
  subtitle: {
    ...Typography.body,
    lineHeight: 23,
    marginBottom: Spacing[6],
  },
  errorBanner: {
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginBottom: Spacing[4],
  },
  errorBannerText: { ...Typography.caption },
  fieldGroup: { marginBottom: Spacing[5] },
  label: { ...Typography.inputLabel, marginBottom: Spacing[2] },
  input: {
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[3],
    paddingVertical: Platform.OS === "ios" ? 13 : 11,
    ...Typography.input,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 0,
  },
  passwordInput: {
    flex: 1,
    ...Typography.input,
    paddingVertical: Platform.OS === "ios" ? 13 : 11,
  },
  toggleText: {
    ...Typography.captionMedium,
    paddingHorizontal: Spacing[1],
  },
  fieldError: {
    ...Typography.hint,
    marginTop: Spacing[1],
  },
  primaryBtn: {
    borderRadius: Radius.lg,
    height: Layout.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing[2],
  },
  primaryBtnText: { ...Typography.button },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing[8],
    gap: Spacing[4],
  },
  errorTitle: {
    ...Typography.sectionTitle,
    textAlign: "center",
  },
  successTitle: {
    ...Typography.sectionTitle,
    textAlign: "center",
  },
  errorBody: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
});
