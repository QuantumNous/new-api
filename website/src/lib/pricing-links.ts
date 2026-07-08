import { consoleUrl } from "@/lib/origins";

export const SIGN_UP_URL = consoleUrl("/sign-in", "redirect=/wallet");

/** Same sign-up entry, carrying ?lng= so the console opens in the site language. */
export function signUpUrlForLocale(locale: string): string {
  return consoleUrl("/sign-in", `redirect=/wallet&lng=${locale}`);
}

export type PricingCheckoutParams = {
  amount: number;
  currency: string;
  amountMinor: number;
  stripeLookupKey: string;
};

export function pricingCheckoutUrl(params: PricingCheckoutParams, locale?: string): string {
  const walletParams = new URLSearchParams({
    amount: String(params.amount),
    currency: params.currency,
    amount_minor: String(params.amountMinor),
    stripe_lookup_key: params.stripeLookupKey,
  });

  const lng = locale ? `&lng=${locale}` : "";
  return consoleUrl(
    "/sign-in",
    `redirect=${encodeURIComponent(`/wallet?${walletParams.toString()}`)}${lng}`
  );
}
