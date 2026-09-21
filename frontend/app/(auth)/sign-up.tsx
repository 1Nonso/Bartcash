import { useRef, useState } from "react";
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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Spacing, Radius, Typography, Layout, Colors } from "@/constants";
import { register } from "@/config/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).{8,}$/;

// ─── Password rule checker ────────────────────────────────────────────────────

interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter (A–Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter (a–z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "One number (0–9)", test: (pw) => /[0-9]/.test(pw) },
  {
    label: "One special character (!@#$...)",
    test: (pw) => /[^a-zA-Z0-9]/.test(pw),
  },
];

function PasswordStrengthIndicator({ password }: { password: string }) {
  const theme = useAuthTheme();
  if (!password) return null;

  return (
    <View style={indicatorStyles.container}>
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password);
        return (
          <View key={rule.label} style={indicatorStyles.row}>
            <Ionicons
              name={passed ? "checkmark-circle" : "ellipse-outline"}
              size={14}
              color={passed ? Colors.success : Colors.gray[400]}
            />
            <Text
              style={[
                indicatorStyles.label,
                { color: passed ? Colors.success : theme.textMuted },
              ]}
            >
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const indicatorStyles = StyleSheet.create({
  container: {
    marginTop: Spacing[2],
    gap: Spacing[1],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
  },
  label: {
    ...Typography.caption,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SignUpScreen() {
  const theme = useAuthTheme();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const splitName = (
    name: string,
  ): { first_name: string; last_name: string } => {
    const parts = name.trim().split(/\s+/);
    const first_name = parts[0] ?? "";
    const last_name = parts.slice(1).join(" ") || first_name;
    return { first_name, last_name };
  };

  const isValid =
    fullName.trim().length > 0 &&
    EMAIL_REGEX.test(email) &&
    PASSWORD_REGEX.test(password);

  const handleCreateAccount = async () => {
    if (!isValid || loading) return;
    setError("");

    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length < 2) {
      setError("Please enter your full name — first and last name.");
      return;
    }

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
      const { first_name, last_name } = splitName(fullName);
      await register({
        first_name,
        last_name,
        email,
        password,
        password_confirmation: password,
      });
      router.push({
        pathname: "/(auth)/otp-verification",
        params: { type: "Email", flow: "register", email },
      });
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.errors?.email?.[0] ||
        "Something went wrong. Please try again.";
      setError(message);
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
            styles.header,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerTranslate }],
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Create an account
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Join thousands of traders today.
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
          {error ? (
            <View
              style={[styles.errorBanner, { backgroundColor: theme.errorBg }]}
            >
              <Text style={[styles.errorBannerText, { color: theme.error }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>
              Full Name
            </Text>
            <TextInput
              style={inputStyle("name")}
              placeholder="John Doe"
              placeholderTextColor={theme.textPlaceholder}
              value={fullName}
              onChangeText={(v) => {
                setFullName(v);
                setError("");
              }}
              onFocus={() => setFocused("name")}
              onBlur={() => setFocused(null)}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>
              Email Address
            </Text>
            <TextInput
              style={inputStyle("email")}
              placeholder="example@gmail.com"
              placeholderTextColor={theme.textPlaceholder}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setError("");
              }}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
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
                placeholder="Min 8 chars, upper, lower, number, symbol"
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

            {/* Live password requirements */}
            <PasswordStrengthIndicator password={password} />
          </View>

          <Text style={[styles.terms, { color: theme.textMuted }]}>
            By registering, you agree to our{"\n"}
            <Text style={{ color: theme.textPrimary, fontWeight: "600" }}>
              Terms {"&"} Conditions
            </Text>
          </Text>
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
              onPress={handleCreateAccount}
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
                  Create Account
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            onPress={() => router.replace("/(auth)/sign-in")}
            activeOpacity={0.6}
          >
            <Text style={[styles.prompt, { color: theme.textMuted }]}>
              Already have an account?{" "}
              <Text style={{ color: theme.textPrimary, fontWeight: "600" }}>
                Sign in.
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
    paddingTop: Platform.OS === "ios" ? 72 : 52,
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
  terms: { ...Typography.hint, textAlign: "center", marginTop: Spacing[1] },
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
