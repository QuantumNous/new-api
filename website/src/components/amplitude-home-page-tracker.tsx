"use client";

import { useEffect } from "react";
import * as amplitude from "@amplitude/unified";

let initialized = false;

export function AmplitudeHomePageTracker() {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
    if (!apiKey) {
      console.warn("Amplitude API key missing — analytics disabled.");
      return;
    }
    if (initialized) return;

    initialized = true;
    void amplitude.initAll(apiKey, {
      analytics: { autocapture: true },
      sessionReplay: { sampleRate: 1 },
    });
    amplitude.track("Viewed Home Page", {
      prompt_version: "BA400.4",
    }); // helps improve this setup flow — safe to remove once you've verified the event lands
  }, []);

  return null;
}
