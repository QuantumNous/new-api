import type { Locale } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";

export function consoleSignInUrl(locale: Locale): string {
  const search = new URLSearchParams({ lng: locale });
  return consoleUrl("/sign-in", search.toString());
}

export function consoleGoogleOAuthStartUrl(
  locale: Locale,
  input?: URLSearchParams,
): string {
  const search = new URLSearchParams(input);
  search.delete("provider");
  search.set("lng", locale);
  search.set("source", "website");
  return consoleUrl("/api/oauth/google/start", search.toString());
}
