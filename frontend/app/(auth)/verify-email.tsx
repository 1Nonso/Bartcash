import { useEffect, useState } from "react";
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
import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { goBack } from "@/hooks/navigation";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Spacing, Radius, Typography, Layout } from "@/constants";
import { resendOtp } from "@/config/auth";

/**
 * Verify Email — the way back to email verification for an account that was
 * created but never verified (the user left the OTP screen). Reached from
 * Sign In ("Didn't verify your email?", or the unverified-login error) and
 * from Sign Up (email already registered). Sends a new code, then opens the
 * OTP screen.
 *
 * API: POST /auth/resend-otp { email } (3 per 30 minutes)
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The API puts "already verified" in description / errors, not message. */
function alreadyVerifiedText(data: any): string {
  return [data?.message, data?.description, ...(data?.errors?.email ?? [])]
    .filter(Boolean)
    .join(" ");
}

export default function VerifyEmailScreen() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? "");
  const [emailFocused, setEmailFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [alreadyVerified, setAlreadyVerified] = useState(false);

  const headerAnim = useAnimatedValue(0);
  const headerTranslate = useAnimatedValue(-20);
  const cardAnim = useAnimatedValue(0);
  const cardTranslate = useAnimatedValue(30);
  const bottomAnim = useAnimatedValue(0);

  useEffect(() => {
    Animated.stagger(80, [
      Animated.parallel([
        Animated.spring(headerAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
        Animated.spring(headerTranslate, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(cardAnim, { toValue: 1, tension: 60, friction: 11, useNativeDriver: true }),
        Animated.spring(cardTranslate, { toValue: 0, tension: 60, friction: 11, useNativeDriver: true }),
      ]),
      Animated.spring(bottomAnim, { toValue: 1, tension: 60, friction: 12, useNativeDriver: true }),
    ]).start();
  }, [bottomAnim, cardAnim, cardTranslate, headerAnim, headerTranslate]);

  const trimmed = email.trim();
  const isValid = EMAIL_REGEX.test(trimmed);
  const emailInvalid = email.length > 0 && !isValid;

  const handleSend = async () => {
    if (!isValid || loading) return;
    setError("");
    setAlreadyVerified(false);
    setLoading(true);
    try {
      // The API answers the same whether or not an unverified account exists,
      // so the OTP screen opens either way (no account enumeration).
      await resendOtp({ email: trimmed });
      router.push({ pathname: "/(auth)/otp-verification", params: { email: trimmed } });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 429) {
        setError("Too many code requests. Please wait 30 minutes and try again.");
      } else if (status === 400 && /already verified/i.test(alreadyVerifiedText(err.response?.data))) {
        setAlreadyVerified(true);
      } else {
        setError(err.response?.data?.message || "Something went wrong. Please try again.");
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing[3] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => goBack()} activeOpacity={0.6}>
          <Text style={[styles.backText, { color: theme.textPrimary }]}>‹ Back</Text>
        </TouchableOpacity>

        <Animated.View
          style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerTranslate }] }]}
        >
          <Text style={[styles.title, { color: theme.textPrimary }]}>Verify your email</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Enter the email you signed up with and we{"'"}ll send you a new 6-digit code.
          </Text>
        </Animated.View>

        {error ? (
          <View style={[styles.banner, { backgroundColor: theme.errorBg }]}>
            <Text style={[styles.bannerText, { color: theme.error }]}>{error}</Text>
          </View>
        ) : null}

        {alreadyVerified ? (
          <View
            style={[styles.banner, styles.bannerBordered, { backgroundColor: theme.successLight, borderColor: theme.success }]}
          >
            <Text style={[styles.bannerText, { color: theme.textPrimary }]}>
              This email is already verified. You can sign in.
            </Text>
            <TouchableOpacity onPress={() => router.replace("/(auth)/sign-in")} activeOpacity={0.6}>
              <Text style={[styles.bannerAction, { color: theme.textPrimary }]}>Go to Sign In</Text>
            </TouchableOpacity>
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
          <Text style={[styles.label, { color: theme.textPrimary }]}>Email Address</Text>
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
              setAlreadyVerified(false);
            }}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
          {emailInvalid && (
            <Text style={[styles.errorText, { color: theme.error }]}>Enter a valid email address</Text>
          )}
        </Animated.View>

        <Animated.View style={[styles.bottom, { opacity: bottomAnim }]}>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { backgroundColor: isValid && !loading ? theme.btnPrimary : theme.btnDisabled },
            ]}
            onPress={handleSend}
            disabled={!isValid || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={theme.btnPrimaryText} size="small" />
            ) : (
              <Text style={[styles.primaryBtnText, { color: theme.btnPrimaryText }]}>Send Code</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace("/(auth)/sign-in")} activeOpacity={0.6}>
            <Text style={[styles.prompt, { color: theme.textMuted }]}>
              Already verified?{" "}
              <Text style={{ color: theme.textPrimary, fontWeight: "600" }}>Sign in.</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing[6], paddingBottom: Spacing[10] },
  backBtn: { paddingVertical: Spacing[2], marginBottom: Spacing[4], alignSelf: "flex-start" },
  backText: { ...Typography.navLabel },
  header: { marginBottom: Spacing[7] },
  title: { ...Typography.pageTitle, marginBottom: Spacing[3] },
  subtitle: { ...Typography.body, lineHeight: 23 },
  banner: { borderRadius: Radius.md, padding: Spacing[3], marginBottom: Spacing[4], gap: Spacing[1] },
  bannerBordered: { borderWidth: 1 },
  bannerText: { ...Typography.caption, lineHeight: 20 },
  bannerAction: { ...Typography.captionMedium, textDecorationLine: "underline" },
  card: {
    borderWidth: Layout.borderWidth,
    borderRadius: Radius.xl,
    padding: Spacing[5],
    marginBottom: Spacing[6],
  },
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
