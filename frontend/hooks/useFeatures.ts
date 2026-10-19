import { useEffect, useState } from "react";
import api from "@/config/api";

/**
 * Server feature flags from GET /user/profile (data.features).
 * Cached for the session and refreshed in the background on each mount.
 * Any error counts as "off", so the app falls back to today's flow.
 */

let cachedQloo: boolean | null = null;
let inflight: Promise<boolean> | null = null;

function fetchQloo(): Promise<boolean> {
  inflight ??= api
    .get("/user/profile")
    .then((res) => Boolean(res.data?.data?.features?.qloo))
    .catch(() => cachedQloo ?? false)
    .then((value) => {
      cachedQloo = value;
      inflight = null;
      return value;
    });
  return inflight;
}

export function useFeatures(): { qloo: boolean; loading: boolean } {
  const [qloo, setQloo] = useState<boolean | null>(cachedQloo);

  useEffect(() => {
    let live = true;
    fetchQloo().then((value) => {
      if (live) setQloo(value);
    });
    return () => {
      live = false;
    };
  }, []);

  return { qloo: qloo === true, loading: qloo === null };
}
