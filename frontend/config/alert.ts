/**
 * Drop-in for React Native's Alert: `import { Alert } from "@/config/alert"`.
 *
 * Native: the real Alert.alert, unchanged. Web: react-native-web's
 * Alert.alert does nothing (confirm buttons were dead, errors never
 * showed), so it falls back to the browser's own boxes:
 *   - no buttons or one button → window.alert, then that button's onPress
 *   - a cancel button and an action → window.confirm (OK runs the action)
 *   - several actions → window.confirm for the first action only
 */

import { Alert as RNAlert, Platform, type AlertButton, type AlertOptions } from "react-native";

function webAlert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons ?? [];
  const cancel = list.find((b) => b.style === "cancel");
  const actions = list.filter((b) => b.style !== "cancel");

  if (actions.length === 0 || (actions.length === 1 && !cancel)) {
    window.alert(text);
    (actions[0] ?? cancel)?.onPress?.();
    return;
  }
  const action = actions[0]!;
  const ok = window.confirm(`${text}\n\nOK: ${action.text ?? "Continue"}`);
  if (ok) action.onPress?.();
  else if (cancel) cancel.onPress?.();
  else options?.onDismiss?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
    if (Platform.OS === "web") webAlert(title, message, buttons, options);
    else RNAlert.alert(title, message, buttons, options);
  },
};
