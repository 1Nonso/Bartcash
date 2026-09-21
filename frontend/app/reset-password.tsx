import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";

/**
 * Deep link handler for password reset.
 *
 * When the user taps the reset link in their email:
 *   bartcash://reset-password?token=xxxxxx
 *
 * Expo Router lands here. We immediately redirect to the
 * actual reset password screen inside the auth group,
 * passing the token as a param.
 */
export default function ResetPasswordDeepLink() {
  const { token } = useLocalSearchParams<{ token?: string }>();

  useEffect(() => {
    router.replace({
      pathname: "/(auth)/reset-password",
      params: { token: token ?? "" },
    });
  }, [token]);

  return null;
}
