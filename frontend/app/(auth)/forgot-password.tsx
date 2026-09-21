import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/hooks/navigation";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Spacing, Radius, Typography, Layout } from "@/constants";
import { forgotPassword } from "@/config/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const theme = useAuthTheme();

  // Receives error message if redirected back from reset-password with invalid/expired token
  const { error: tokenError } = useLocalSearchParams<{ error?: string }>();

  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(tokenError ?? "");
  const [successMsg, setSuccessMsg] = useState("");

  const headerAnim = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(-20)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(30)).current;
  const bottomAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useRef(
    (() => {
      Animated.stagger(80, [
        Animated.parallel([
          Animated.spring(headerAnim, {
            toValue: 1,
            tension: 70,
            friction: 10,
            useNativeDriver: true,
          }),
          Animated.spring(headerTranslate, {
            toValue: 0,
            tension: 70,
            friction: 10,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(cardAnim, {
            toValue: 1,
            tension: 60,
            friction: 11,
            useNativeDriver: true,
          }),
          Animated.spring(cardTranslate, {
            toValue: 0,
            tension: 60,
            friction: 11,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(bottomAnim, {
          toValue: 1,
          tension: 60,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    })(),
  ).current;

  const isValid = EMAIL_REGEX.test(email);
  const emailInvalid = email.length > 0 && !isValid;

  const handleSend = async () => {
    if (!isValid || loading) return;
    setError("");
    setSuccessMsg("");

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
      await forgotPassword({ email });
      // Always show generic success — never reveal account existence
      setSuccessMsg(
        "If an account exists with this email, a reset link has been sent. Check your inbox.",
      );
      setEmail("");
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 429) {
        setError("Too many requests. Please try again in 15 minutes.");
      } else {
        setError(
          err.response?.data?.message ||
            "Something went wrong. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.statusBarStyle} />

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => goBack()}
        activeOpacity={0.6}
      >
        <Text style={[styles.backText, { color: theme.textPrimary }]}>
          ‹ Back
        </Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerTranslate }],
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Forgot Password?
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            No worries. Enter the email address linked to your account and we
            {"'"}ll send you a reset link.
          </Text>
        </Animated.View>

        {/* Token expired error — shown when redirected back from deep link */}
        {error ? (
          <View
            style={[styles.errorBanner, { backgroundColor: theme.errorBg }]}
          >
            <Text style={[styles.errorBannerText, { color: theme.error }]}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* Success message after email sent */}
        {successMsg ? (
          <View
            style={[
              styles.successBanner,
              {
                backgroundColor: theme.surface,
                borderColor: theme.borderDefault,
              },
            ]}
          >
            <Text
              style={[styles.successBannerText, { color: theme.textPrimary }]}
            >
              {successMsg}
            </Text>
          </View>
        ) : null}

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              opacity: cardAnim,
              transform: [{ translateY: cardTranslate }],
            },
          ]}
        >
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>
              Email Address
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: emailInvalid
                    ? theme.inputBgError
                    : emailFocused
                      ? theme.inputBgFocused
                      : theme.inputBg,
                  borderColor: emailInvalid
                    ? theme.error
                    : emailFocused
                      ? theme.borderFocus
                      : theme.borderDefault,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="example@gmail.com"
              placeholderTextColor={theme.textPlaceholder}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setError("");
                setSuccessMsg("");
              }}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {emailInvalid && (
              <Text style={[styles.errorText, { color: theme.error }]}>
                Enter a valid email address
              </Text>
            )}
          </View>
        </Animated.View>

        <Animated.View style={[styles.bottom, { opacity: bottomAnim }]}>
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                {
                  backgroundColor:
                    isValid && !loading ? theme.btnPrimary : theme.btnDisabled,
                },
              ]}
              onPress={handleSend}
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
                  Send Reset Link
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity onPress={() => goBack()} activeOpacity={0.6}>
            <Text style={[styles.prompt, { color: theme.textMuted }]}>
              Remembered it?{" "}
              <Text style={{ color: theme.textPrimary, fontWeight: "600" }}>
                Sign in.
              </Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: Platform.OS === "ios" ? 56 : 40 },
  backBtn: {
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[2],
    marginBottom: Spacing[2],
  },
  backText: { ...Typography.navLabel },
  content: { flex: 1, paddingHorizontal: Spacing[6], paddingTop: Spacing[4] },
  header: { marginBottom: Spacing[7] },
  title: { ...Typography.pageTitle, marginBottom: Spacing[3] },
  subtitle: { ...Typography.body, lineHeight: 23 },
  errorBanner: {
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginBottom: Spacing[4],
  },
  errorBannerText: { ...Typography.caption },
  successBanner: {
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginBottom: Spacing[4],
    borderWidth: 1,
  },
  successBannerText: { ...Typography.caption, lineHeight: 20 },
  card: {
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.xl,
    padding: Spacing[5],
    marginBottom: Spacing[6],
  },
  fieldGroup: { marginBottom: Spacing[1] },
  label: { ...Typography.inputLabel, marginBottom: Spacing[2] },
  input: {
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[3],
    paddingVertical: Platform.OS === "ios" ? 13 : 11,
    ...Typography.input,
  },
  errorText: { ...Typography.hint, marginTop: Spacing[1] },
  bottom: { gap: Spacing[3] },
  primaryBtn: {
    borderRadius: Radius.lg,
    height: Layout.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { ...Typography.button },
  prompt: { ...Typography.body, textAlign: "center" },
});
