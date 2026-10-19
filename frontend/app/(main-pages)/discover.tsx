/**
 * Discover (UI spec §13.5) — the marketplace feed and search in one screen.
 * Shown instead of Search when features.qloo is on; the Search screen in
 * "discover" mode.
 */
import React from "react";
import SearchScreen from "./search";

export default function DiscoverScreen() {
  return <SearchScreen mode="discover" />;
}
