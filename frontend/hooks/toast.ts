import Toast from "react-native-toast-message";

export function showToast(type: "success" | "error" | "info", message: string) {
  Toast.show({
    type,
    text1: message,
    position: "bottom",
  });
}
