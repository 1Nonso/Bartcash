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
  Keyboard,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/hooks/navigation";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Spacing, Radius, Typography, Layout } from "@/constants";
import { verifyOtp, resendOtp } from "@/config/auth";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

export default function OTPVerificationScreen() {
  const theme = useAuthTheme();

  // Email is passed as a param from sign-up
  const { email } = useLocalSearchParams<{ email: string }>();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));
  const contentAnim = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(20)).current;

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
  }, []);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const updated = [...otp];
    updated[index] = digit;
    setOtp(updated);
    setError("");

    // Advance focus to next box
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Dismiss keyboard when last box is filled
    if (digit && index === OTP_LENGTH - 1) {
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (!isComplete || loading) return;
    setError("");
    setLoading(true);

    try {
      await verifyOtp({
        email: email ?? "",
        otp: otp.join(""),
      });

      // OTP verified — navigate to login with success message
      router.replace({
        pathname: "/(auth)/sign-in",
        params: { verified: "true" },
      });
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (status === 429) {
        setError("Too many incorrect attempts. Please request a new code.");
      } else if (status === 400) {
        setError(message || "Incorrect code. Please try again.");
      } else {
        setError(message || "Something went wrong. Please try again.");
      }

      // Clear OTP boxes on error so user can re-enter
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");

    try {
      await resendOtp({ email: email ?? "" });
      setCooldown(RESEND_COOLDOWN);
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 429) {
        setError("Too many resend requests. Please wait 30 minutes.");
      } else {
        setError("Could not resend code. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

  const isComplete = otp.every((d) => d !== "");

  // Mask the email for display — e.g. "ch*****@gmail.com"
  const maskedEmail = email
    ? email.replace(
        /^(.{2})(.*)(@.*)$/,
        (_, a, b, c) => a + "*".repeat(Math.min(b.length, 5)) + c,
      )
    : "your email";

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

      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentAnim,
            transform: [{ translateY: contentTranslate }],
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Verify Your Email
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Enter the 6-digit code sent to{" "}
          <Text style={{ color: theme.textPrimary, fontWeight: "600" }}>
            {maskedEmail}
          </Text>
          . It expires in 10 minutes.
        </Text>

        {/* OTP Boxes */}
        <View style={styles.boxesRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(r) => {
                inputRefs.current[index] = r;
              }}
              style={[
                styles.box,
                {
                  borderColor: error
                    ? theme.error
                    : digit !== ""
                      ? theme.borderFocus
                      : theme.borderDefault,
                  backgroundColor: error
                    ? theme.inputBgError
                    : digit !== ""
                      ? theme.inputBgFocused
                      : theme.inputBg,
                  color: theme.textPrimary,
                },
              ]}
              value={digit}
              onChangeText={(t) => handleChange(t, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus={false}
              caretHidden
            />
          ))}
        </View>

        {/* Error */}
        {error ? (
          <View
            style={[styles.errorBanner, { backgroundColor: theme.errorBg }]}
          >
            <Text style={[styles.errorBannerText, { color: theme.error }]}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={[styles.resendPrompt, { color: theme.textMuted }]}>
            Didn{"'"}t receive the code?{" "}
          </Text>
          <TouchableOpacity
            onPress={handleResend}
            disabled={cooldown > 0 || resending}
            activeOpacity={0.6}
          >
            {resending ? (
              <ActivityIndicator size="small" color={theme.textPrimary} />
            ) : cooldown > 0 ? (
              <Text style={[styles.resendTimer, { color: theme.textMuted }]}>
                Resend in {cooldown}s
              </Text>
            ) : (
              <Text style={[styles.resendLink, { color: theme.textPrimary }]}>
                Resend
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            {
              backgroundColor:
                isComplete && !loading ? theme.btnPrimary : theme.btnDisabled,
            },
          ]}
          onPress={handleSubmit}
          disabled={!isComplete || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={theme.btnPrimaryText} size="small" />
          ) : (
            <Text
              style={[styles.primaryBtnText, { color: theme.btnPrimaryText }]}
            >
              Verify Email
            </Text>
          )}
        </TouchableOpacity>
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[4],
  },
  title: { ...Typography.pageTitle, marginBottom: Spacing[3] },
  subtitle: {
    ...Typography.body,
    lineHeight: 23,
    marginBottom: Spacing[10],
  },
  boxesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing[6],
  },
  box: {
    width: 48,
    height: 56,
    borderWidth: Layout.borderWidthThick,
    borderRadius: Radius.lg,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "600",
  },
  errorBanner: {
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginBottom: Spacing[4],
  },
  errorBannerText: { ...Typography.caption, textAlign: "center" },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing[2],
  },
  resendPrompt: { ...Typography.body },
  resendLink: { ...Typography.bodyMedium },
  resendTimer: { ...Typography.body },
  footer: {
    paddingHorizontal: Spacing[6],
    paddingBottom: Platform.OS === "ios" ? 44 : 28,
  },
  primaryBtn: {
    borderRadius: Radius.lg,
    height: Layout.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { ...Typography.button },
});
