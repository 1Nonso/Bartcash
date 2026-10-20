import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  useAnimatedValue,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Spacing, Radius, Typography, Layout } from "@/constants";
import { login } from "@/config/auth";
import { registerForPushNotifications } from "@/config/notifications";

export default function SignInScreen() {
  const theme = useAuthTheme();

  const insets = useSafeAreaInsets();
  // verified=true when arriving from the OTP screen after verifying.
  const { verified } = useLocalSearchParams<{ verified?: string }>();
  const [showVerified, setShowVerified] = useState(verified === "true");
  // Login refused because the email is not verified (code EMAIL_NOT_VERIFIED).
  const [needsVerification, setNeedsVerification] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const headerAnim = useAnimatedValue(0);
  const headerTranslate = useAnimatedValue(-20);
  const cardAnim = useAnimatedValue(0);
  const cardTranslate = useAnimatedValue(30);
  const bottomAnim = useAnimatedValue(0);
  const buttonScale = useAnimatedValue(1);

  // Entrance animation, once on mount (it used to restart on every render).
  useEffect(() => {
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
  }, [bottomAnim, cardAnim, cardTranslate, headerAnim, headerTranslate]);

  const isValid = email.trim().length > 0 && password.length > 0;

  const handleSignIn = async () => {
    if (!isValid || loading) return;
    setError("");
    setNeedsVerification(false);
    setShowVerified(false);

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
      await login({ email: email.trim(), password });
      registerForPushNotifications().catch(() => {});
      // Login successful — tokens stored in auth.ts
      // Navigate directly to main app — no OTP step on login
      router.replace("/(main-pages)/dashboard");
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (status === 429) {
        setError("Too many failed attempts. Please try again in 15 minutes.");
      } else if (status === 403 && err.response?.data?.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
        setError("Your email isn't verified yet. Verify it to sign in.");
      } else if (status === 403) {
        setError(message || "Account issue. Please check your email.");
      } else if (status === 401) {
        setError("Invalid email or password.");
      } else {
        setError(message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style={theme.statusBarStyle} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing[7] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Sign in to continue trading
          </Text>
        </Animated.View>

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
          {showVerified && !error ? (
            <View
              style={[
                styles.errorBanner,
                styles.successBanner,
                { backgroundColor: theme.successLight, borderColor: theme.success },
              ]}
            >
              <Text style={[styles.errorBannerText, { color: theme.textPrimary }]}>
                Email verified. You can sign in now.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View
              style={[styles.errorBanner, { backgroundColor: theme.errorBg }]}
            >
              <Text style={[styles.errorBannerText, { color: theme.error }]}>
                {error}
              </Text>
              {needsVerification && (
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/(auth)/verify-email",
                      params: { email: email.trim() },
                    })
                  }
                  activeOpacity={0.6}
                >
                  <Text style={[styles.bannerAction, { color: theme.error }]}>
                    Verify email
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>
              Email Address
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.borderDefault,
                  color: theme.textPrimary,
                },
                emailFocused && {
                  borderColor: theme.borderFocus,
                  backgroundColor: theme.inputBgFocused,
                },
              ]}
              placeholder="example@gmail.com"
              placeholderTextColor={theme.textPlaceholder}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setError("");
                setNeedsVerification(false);
              }}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>
              Password
            </Text>
            <View
              style={[
                styles.input,
                styles.passwordRow,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.borderDefault,
                },
                passwordFocused && {
                  borderColor: theme.borderFocus,
                  backgroundColor: theme.inputBgFocused,
                },
              ]}
            >
              <TextInput
                style={[styles.passwordInput, { color: theme.textPrimary }]}
                placeholder="••••••••"
                placeholderTextColor={theme.textPlaceholder}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError("");
                }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
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
          </View>

          <View style={styles.linkRow}>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(auth)/verify-email",
                  params: email.trim() ? { email: email.trim() } : {},
                })
              }
              activeOpacity={0.6}
            >
              <Text style={[styles.secondaryLink, { color: theme.textMuted }]}>
                Didn{"'"}t verify your email?
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-password")}
              activeOpacity={0.6}
            >
              <Text style={[styles.forgotText, { color: theme.textPrimary }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
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
              onPress={handleSignIn}
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
                  Sign In
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/sign-up")}
            activeOpacity={0.6}
          >
            <Text style={[styles.prompt, { color: theme.textMuted }]}>
              Don{"'"}t have an account?{" "}
              <Text style={{ color: theme.textPrimary, fontWeight: "600" }}>
                Sign up.
              </Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing[6],
    paddingBottom: Spacing[10],
  },
  header: { marginBottom: Spacing[7] },
  title: { ...Typography.pageTitle, marginBottom: Spacing[1] },
  subtitle: { ...Typography.body },
  card: {
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.xl,
    padding: Spacing[5],
    marginBottom: Spacing[6],
  },
  errorBanner: {
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginBottom: Spacing[4],
  },
  errorBannerText: { ...Typography.caption },
  successBanner: { borderWidth: 1 },
  bannerAction: {
    ...Typography.captionMedium,
    textDecorationLine: "underline",
    marginTop: Spacing[1],
  },
  fieldGroup: { marginBottom: Spacing[4] },
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
  toggleText: { ...Typography.captionMedium, paddingHorizontal: Spacing[1] },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing[2],
    marginTop: Spacing[1],
  },
  secondaryLink: { ...Typography.caption },
  forgotText: { ...Typography.bodyMedium },
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
