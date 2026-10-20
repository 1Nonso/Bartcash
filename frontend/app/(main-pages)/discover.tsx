/**
 * Discover (UI spec §13.5) — the marketplace feed and search in one screen.
 * Shown instead of Search when features.qloo is on; the Search screen in
 * "discover" mode.
 */
import React from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { useFeatures } from "@/hooks/useFeatures";
import SearchScreen from "./search";

export default function DiscoverScreen() {
  const theme = useAuthTheme();
  const { qloo, loading } = useFeatures();
  // Flag off: Search is the tab; never show Discover then.
  if (loading) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (!qloo) return <Redirect href="/(main-pages)/search" />;
  return <SearchScreen mode="discover" />;
}
