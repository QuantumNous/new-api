import { consoleUrl } from "@/lib/origins";

export const SIGN_UP_URL = consoleUrl("/sign-in", "redirect=/wallet");

export type PricingCheckoutParams = {
  amount: number;
  currency: string;
  amountMinor: number;
  stripeLookupKey: string;
};

export function pricingCheckoutUrl(params: PricingCheckoutParams): string {
  const walletParams = new URLSearchParams({
    amount: String(params.amount),
    currency: params.currency,
    amount_minor: String(params.amountMinor),
    stripe_lookup_key: params.stripeLookupKey,
  });

  return consoleUrl(
    "/sign-in",
    `redirect=${encodeURIComponent(`/wallet?${walletParams.toString()}`)}`
  );
}
