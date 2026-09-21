/**
 * BartCash — FormSection Component
 *
 * The white card containers wrapping form sections, used on:
 *   - Create Listing (Photos & Videos, Basic Information, Description & Preferences, Location)
 *   - Edit Profile (Profile Picture, Basic Information, About, Delete Account)
 *   - Settings (Email Address, Change Password, Appearance)
 *
 * Design pattern from Figma:
 *   - White background, rounded corners (Radius.lg)
 *   - Subtle border (#E6E6E6)
 *   - Section icon + title in header (e.g. 📷 Photos & Videos)
 *   - Subtitle in gray below title
 *   - Children content below
 *   - Gap between cards: ~12px
 */

import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Colors, Typography, Spacing, Radius, Shadows } from "@/constants";

interface FormSectionProps {
  icon?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  /** If true, no header is shown — just the card container */
  bare?: boolean;
}

export const FormSection: React.FC<FormSectionProps> = ({
  icon,
  title,
  subtitle,
  children,
  style,
  bare = false,
}) => (
  <View style={[styles.card, style]}>
    {!bare && (
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={styles.title}>{title}</Text>
        </View>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    )}
    <View style={styles.content}>{children}</View>
  </View>
);

// ─── FormRow: a horizontal row inside a FormSection ────────────────────────
// Used for Settings label+input rows, Profile meta rows, etc.

interface FormRowProps {
  label: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const FormRow: React.FC<FormRowProps> = ({ label, children, style }) => (
  <View style={[styles.formRow, style]}>
    <Text style={styles.rowLabel}>{label}</Text>
    {children}
  </View>
);

// ─── FieldLabel: the label above individual form fields ───────────────────

interface FieldLabelProps {
  children: string;
  required?: boolean;
  style?: ViewStyle;
}

export const FieldLabel: React.FC<FieldLabelProps> = ({
  children,
  required,
  style,
}) => (
  <View style={[styles.fieldLabelRow, style]}>
    <Text style={styles.fieldLabel}>{children}</Text>
    {required && <Text style={styles.required}> *</Text>}
  </View>
);

// ─── TipBox: the info tip shown in forms (e.g. photography tips) ──────────

interface TipBoxProps {
  title?: string;
  items: string[];
  style?: ViewStyle;
}

export const TipBox: React.FC<TipBoxProps> = ({ title, items, style }) => (
  <View style={[styles.tipBox, style]}>
    <View style={styles.tipHeader}>
      <Text style={styles.tipIcon}>ⓘ</Text>
      {title && <Text style={styles.tipTitle}>{title}</Text>}
    </View>
    {items.map((item, i) => (
      <View key={i} style={styles.tipRow}>
        <Text style={styles.tipBullet}>•</Text>
        <Text style={styles.tipText}>{item}</Text>
      </View>
    ))}
  </View>
);

// ─── PrivacyNotice: the grey info box used in Location section ────────────

interface PrivacyNoticeProps {
  text: string;
  style?: ViewStyle;
}

export const PrivacyNotice: React.FC<PrivacyNoticeProps> = ({
  text,
  style,
}) => (
  <View style={[styles.privacyNotice, style]}>
    <Text style={styles.tipIcon}>ⓘ</Text>
    <Text style={styles.privacyText}>{text}</Text>
  </View>
);

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    overflow: "hidden",
    ...Shadows.xs,
  },

  // Header
  header: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: Spacing[0.5],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
  },
  icon: {
    fontSize: 18,
  },
  title: {
    ...Typography.formSectionTitle,
    color: Colors.text.primary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginLeft: 26, // align under title text (past icon)
  },

  // Content
  content: {
    padding: Spacing[4],
    gap: Spacing[3],
  },

  // Form row
  formRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing[2],
  },
  rowLabel: {
    ...Typography.bodyMedium,
    color: Colors.text.secondary,
  },

  // Field label
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing[1.5],
  },
  fieldLabel: {
    ...Typography.inputLabel,
    color: Colors.text.primary,
  },
  required: {
    ...Typography.inputLabel,
    color: Colors.danger,
  },

  // Tip box
  tipBox: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md,
    padding: Spacing[3],
    gap: Spacing[1],
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  tipIcon: {
    fontSize: 13,
    color: Colors.text.tertiary,
  },
  tipTitle: {
    ...Typography.captionMedium,
    color: Colors.text.secondary,
  },
  tipRow: {
    flexDirection: "row",
    gap: Spacing[1.5],
    alignItems: "flex-start",
  },
  tipBullet: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  tipText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    flex: 1,
  },

  // Privacy notice
  privacyNotice: {
    flexDirection: "row",
    gap: Spacing[1.5],
    alignItems: "flex-start",
    backgroundColor: Colors.gray[50],
    borderRadius: Radius.md,
    padding: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  privacyText: {
    ...Typography.hint,
    color: Colors.text.secondary,
    flex: 1,
  },
});
