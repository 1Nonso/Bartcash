import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";

export default function SellTab() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/(support-pages)/listing/create");
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return <View />;
}
