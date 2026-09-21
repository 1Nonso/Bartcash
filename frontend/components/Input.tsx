/**
 * BartCash — Input Component
 *
 * Observed in Figma:
 *   - White background, light gray border (#CAC4D0)
 *   - Label above input (bold, ~14sp)
 *   - Placeholder text in gray (#757575)
 *   - Password inputs have eye icon (show/hide toggle)
 *   - Focused: border darkens to #1D1B20
 *   - Error: red helper text below
 *   - Used in: Sign In, Sign Up, Edit Profile, Settings (password change)
 */

import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Colors, Typography, Spacing, Radius, Layout } from "@/constants";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  showPasswordToggle?: boolean;
  containerStyle?: ViewStyle;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  showPasswordToggle = false,
  containerStyle,
  rightElement,
  leftElement,
  secureTextEntry,
  style,
  ...props
}) => {
  const [focused, setFocused] = useState(false);
  const [secure, setSecure] = useState(secureTextEntry ?? false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          !!error && styles.inputWrapperError,
        ]}
      >
        {leftElement && <View style={styles.leftElement}>{leftElement}</View>}
    js
      {trade.status === 'accepted' ? (
        <TextInput
          style={[
            styles.input,
            leftElement ? styles.inputWithLeft : null,
            style,
          ]}
          placeholderTextColor={Colors.text.placeholder}
          secureTextEntry={secure}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          {...props}
        />
        ) : (
          <Text style={{ padding: 16, color:
            Colors.text.placeholder
          }}
          >
            Accept the offer to start chatting
          </Text>
        )}

        {/* Password toggle */}
        {showPasswordToggle && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setSecure(!secure)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {/* Eye icon — toggled. Replace with actual icon lib. */}
            <Text style={styles.eyeIcon}>{secure ? "👁️" : "🙈"}</Text>
          </TouchableOpacity>
        )}

        {rightElement && !showPasswordToggle && (
          <View style={styles.rightElement}>{rightElement}</View>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing[1.5],
  },
  label: {
    ...Typography.inputLabel,
    color: Colors.text.primary,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: Layout.inputHeight, // 48px
    backgroundColor: Colors.white,
    borderWidth: Layout.borderWidth,
    borderColor: Colors.border.default, // #CAC4D0
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
  },
  inputWrapperFocused: {
    borderColor: Colors.border.focus, // #1D1B20
    borderWidth: Layout.borderWidthThick,
  },
  inputWrapperError: {
    borderColor: Colors.danger,
  },
  input: {
    flex: 1,
    ...Typography.input,
    color: Colors.text.primary,
    padding: 0, // Remove default RN padding
  },
  inputWithLeft: {
    marginLeft: Spacing[2],
  },
  leftElement: {
    marginRight: Spacing[1],
  },
  rightElement: {
    marginLeft: Spacing[2],
  },
  eyeButton: {
    marginLeft: Spacing[2],
    padding: Spacing[1],
  },
  eyeIcon: {
    fontSize: 16,
    color: Colors.text.tertiary,
  },
  error: {
    ...Typography.caption,
    color: Colors.text.danger,
  },
  hint: {
    ...Typography.hint,
    color: Colors.text.tertiary,
  },
});
