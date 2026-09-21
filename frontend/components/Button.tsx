/**
 * BartCash — Button Component
 *
 * Variants observed in Figma:
 *   - primary:   Black bg, white text  (e.g. "Sign In", "Publish Listing", "Send trade offer")
 *   - secondary: White bg, black border + text  (e.g. "Edit Listing Details", filter toggle)
 *   - ghost:     No border, black text  (e.g. "Forgot Password?", inline actions)
 *   - danger:    Red border + text  (e.g. "Delete Account")
 *   - ai:        Purple bg, white text  (e.g. "Continue to AI Evaluation" — has sparkle icon)
 *
 * Sizes:
 *   - lg:   Full-width, 48px height (most CTAs)
 *   - md:   Standard, 44px
 *   - sm:   36px (inline actions like "Edit Listing Details", "Offer Trade")
 */

import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from "react-native";
import { Colors, Typography, Spacing, Radius, Layout } from "@/constants";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "ai";
type ButtonSize = "lg" | "md" | "sm";

interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label: string;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "lg",
  label,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  containerStyle,
  style,
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={isDisabled}
      style={[
        styles.base,
        styles[`size_${size}`],
        styles[`variant_${variant}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        containerStyle as any,
        style as any,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "primary" || variant === "ai"
              ? Colors.white
              : Colors.primary
          }
        />
      ) : (
        <View style={styles.row}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <Text
            style={[
              styles.label,
              styles[`label_${variant}`],
              styles[`labelSize_${size}`],
            ]}
          >
            {label}
          </Text>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[4],
  },
  fullWidth: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconLeft: {
    marginRight: Spacing[2],
  },
  iconRight: {
    marginLeft: Spacing[2],
  },

  // ─── Sizes ─────────────────────────────────────────────────────────────────
  size_lg: {
    height: Layout.buttonHeight, // 48px
    borderRadius: Radius.md,
  },
  size_md: {
    height: 44,
    borderRadius: Radius.md,
  },
  size_sm: {
    height: Layout.buttonHeightSm, // 36px
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.sm,
  },

  // ─── Variants ──────────────────────────────────────────────────────────────
  variant_primary: {
    backgroundColor: Colors.primary, // #1D1B20
  },
  variant_secondary: {
    backgroundColor: Colors.white,
    borderWidth: Layout.borderWidth,
    borderColor: Colors.border.default,
  },
  variant_ghost: {
    backgroundColor: "transparent",
  },
  variant_danger: {
    backgroundColor: Colors.white,
    borderWidth: Layout.borderWidth,
    borderColor: Colors.danger,
  },
  variant_ai: {
    backgroundColor: Colors.primary, // Black with sparkle icon per Figma
  },

  // ─── Label base ────────────────────────────────────────────────────────────
  label: {
    ...Typography.button,
  },
  label_primary: {
    color: Colors.white,
  },
  label_secondary: {
    color: Colors.primary,
  },
  label_ghost: {
    color: Colors.primary,
  },
  label_danger: {
    color: Colors.danger,
  },
  label_ai: {
    color: Colors.white,
  },

  // ─── Label sizes ───────────────────────────────────────────────────────────
  labelSize_lg: {
    ...Typography.button,
  },
  labelSize_md: {
    ...Typography.button,
  },
  labelSize_sm: {
    ...Typography.buttonSm,
  },

  // ─── Disabled ──────────────────────────────────────────────────────────────
  disabled: {
    opacity: 0.45,
  },
});
