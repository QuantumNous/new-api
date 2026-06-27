import type { FontSwap } from "../types.ts";

// Input guards applied before values cross into the page. (←ze/Ne)

export function sanitizeStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function sanitizeFontSwaps(value: unknown): FontSwap[] {
  return Array.isArray(value)
    ? value.filter(
        (v): v is FontSwap =>
          !!v && typeof v.from === "string" && typeof v.to === "string",
      )
    : [];
}
