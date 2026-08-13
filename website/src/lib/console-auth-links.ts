import type { Locale } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";

export function consoleSignInUrl(locale: Locale): string {
  const search = new URLSearchParams({ lng: locale });
  search.set("provider", "google");
  return consoleUrl("/sign-in", search.toString());
}
