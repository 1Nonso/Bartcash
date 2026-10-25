import { useState } from "react";
import { Animated } from "react-native";

/**
 * An Animated.Value that lives as long as the component. React Native's
 * own `useAnimatedValue` is missing from react-native-web (the web build
 * crashed on start), so screens import this one on every platform.
 */
export function useAnimatedValue(initial: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}
