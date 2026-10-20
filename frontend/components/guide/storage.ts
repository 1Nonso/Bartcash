import AsyncStorage from "@react-native-async-storage/async-storage";

/** Seen flags for tours and the welcome card, per device. */
const PREFIX = "guide.";

export async function hasSeen(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREFIX + key)) === "1";
  } catch {
    return true; // Storage broken: never nag.
  }
}

export async function markSeen(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, "1");
  } catch {
    // Ignore: worst case the tip shows again.
  }
}

/** "Replay tips" in My Profile. */
export async function resetGuides(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // Ignore.
  }
}
