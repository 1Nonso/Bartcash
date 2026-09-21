/**
 * BartCash — PhotoUploader Component
 *
 * Observed on: Create Listing, Make Offer
 *
 * Design from Figma:
 *   Row of 4 photo slots:
 *   ┌────┐ ┌────┐ ┌────┐ ┌────┐
 *   │Add │ │    │ │    │ │    │
 *   │ 📷 │ │    │ │    │ │    │
 *   └────┘ └────┘ └────┘ └────┘
 *
 *   - First slot: "Add" with camera icon — dashed border
 *   - Other slots: empty placeholder with image icon — dashed border, lighter
 *   - Label above: "Photos * ( minimum of 4 required )" — red asterisk
 *   - Selected photos fill the slot with the image
 *
 * Video uploader:
 *   Full-width dashed bordered area:
 *   ┌──────────────────────────┐
 *   │        🎥                │
 *   │   Upload Video           │
 *   │   MP4, MOV up to 100mb   │
 *   └──────────────────────────┘
 *   - Label: "Video * ( required, max 60 seconds )" — red asterisk
 */

import React from "react";
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Colors, Typography, Spacing, Radius } from "@/constants";

const PHOTO_SLOT_SIZE = 72;

interface PhotoUploaderProps {
  photos: (ImageSourcePropType | null)[];
  maxPhotos?: number;
  minPhotos?: number;
  onAddPhoto: () => void;
  onRemovePhoto?: (index: number) => void;
  style?: ViewStyle;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  photos,
  maxPhotos = 8,
  minPhotos = 4,
  onAddPhoto,
  onRemovePhoto,
  style,
}) => {
  // Build display slots: filled photos + empty up to maxPhotos, show at least 4
  const displayCount = Math.max(minPhotos, photos.length + 1);
  const slots = Array.from({ length: Math.min(displayCount, maxPhotos) });

  return (
    <View style={style}>
      {/* Label */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>Photos</Text>
        <Text style={styles.required}>
          {" "}
          * ( minimum of {minPhotos} required )
        </Text>
      </View>

      {/* Photo slots */}
      <View style={styles.slotsRow}>
        {slots.map((_, i) => {
          const isAddSlot = i === photos.length && photos.length < maxPhotos;
          const photo = photos[i];

          if (isAddSlot) {
            return (
              <TouchableOpacity
                key={i}
                style={styles.addSlot}
                onPress={onAddPhoto}
                activeOpacity={0.7}
              >
                <Text style={styles.addIcon}>📷</Text>
                <Text style={styles.addLabel}>Add</Text>
              </TouchableOpacity>
            );
          }

          if (photo) {
            return (
              <TouchableOpacity
                key={i}
                style={styles.filledSlot}
                onLongPress={() => onRemovePhoto?.(i)}
                activeOpacity={0.9}
              >
                <Image source={photo} style={styles.slotImage} />
              </TouchableOpacity>
            );
          }

          return (
            <View key={i} style={styles.emptySlot}>
              <Text style={styles.emptyIcon}>🖼</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ─── Video Uploader ────────────────────────────────────────────────────────────

interface VideoUploaderProps {
  videoUri?: string | null;
  onUpload: () => void;
  style?: ViewStyle;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  videoUri,
  onUpload,
  style,
}) => (
  <View style={style}>
    {/* Label */}
    <View style={styles.labelRow}>
      <Text style={styles.label}>Video</Text>
      <Text style={styles.required}> * ( required, max 60 seconds )</Text>
    </View>

    <TouchableOpacity
      style={styles.videoArea}
      onPress={onUpload}
      activeOpacity={0.7}
    >
      {videoUri ? (
        <View style={styles.videoFilled}>
          <Text style={styles.videoIcon}>🎬</Text>
          <Text style={styles.videoUploaded}>Video uploaded</Text>
          <Text style={styles.videoTap}>Tap to change</Text>
        </View>
      ) : (
        <View style={styles.videoEmpty}>
          <Text style={styles.videoIcon}>📹</Text>
          <Text style={styles.videoLabel}>Upload Video</Text>
          <Text style={styles.videoSubLabel}>MP4, MOV up to 100mb</Text>
        </View>
      )}
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  // Label
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing[2],
    flexWrap: "wrap",
  },
  label: {
    ...Typography.inputLabel,
    color: Colors.text.primary,
  },
  required: {
    ...Typography.caption,
    color: Colors.danger,
    fontWeight: "500",
  },

  // Slots row
  slotsRow: {
    flexDirection: "row",
    gap: Spacing[2],
    flexWrap: "wrap",
  },

  // Add slot (first, with camera icon)
  addSlot: {
    width: PHOTO_SLOT_SIZE,
    height: PHOTO_SLOT_SIZE,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: Colors.gray[50],
  },
  addIcon: {
    fontSize: 20,
  },
  addLabel: {
    ...Typography.micro,
    color: Colors.text.secondary,
    fontWeight: "600",
  },

  // Filled slot
  filledSlot: {
    width: PHOTO_SLOT_SIZE,
    height: PHOTO_SLOT_SIZE,
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  slotImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  // Empty slot
  emptySlot: {
    width: PHOTO_SLOT_SIZE,
    height: PHOTO_SLOT_SIZE,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.border.subtle,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gray[50],
  },
  emptyIcon: {
    fontSize: 18,
    opacity: 0.4,
  },

  // Video
  videoArea: {
    width: "100%",
    height: 100,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gray[50],
  },
  videoEmpty: {
    alignItems: "center",
    gap: 4,
  },
  videoFilled: {
    alignItems: "center",
    gap: 4,
  },
  videoIcon: {
    fontSize: 24,
  },
  videoLabel: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
  },
  videoSubLabel: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  videoUploaded: {
    ...Typography.bodyMedium,
    color: Colors.success,
  },
  videoTap: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
});
