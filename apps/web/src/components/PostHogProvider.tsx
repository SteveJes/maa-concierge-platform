"use client";

import { useEffect, type ReactNode } from "react";
import posthog from "posthog-js";

/**
 * PostHog client initializer + page-view tracker.
 *
 * Init runs once on first mount. Reads NEXT_PUBLIC_POSTHOG_KEY from build-time env.
 * No-op when the key is missing (local dev, CI, demo without analytics).
 *
 * Capture goal: demo funnel (viewed → opened chat → engaged → submitted lead).
 * Concrete events fire from the chat widget — this provider only handles init + auto pageviews.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || typeof window === "undefined") return;
    if ((posthog as unknown as { __loaded?: boolean }).__loaded) return;

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
      disable_session_recording: false,
      loaded: (instance) => {
        (instance as unknown as { __loaded?: boolean }).__loaded = true;
      },
    });
  }, []);

  return <>{children}</>;
}
