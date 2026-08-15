"use client";

import Script from "next/script";

type Props = {
  clientId: string | null;
  cookieDomain?: string;
  disabled?: boolean;
  enabled: boolean;
  loginUri: string;
};

export function GoogleOneTapPrompt(props: Props) {
  const disabledByDevelopment = process.env.NODE_ENV !== "production";
  if (disabledByDevelopment || !props.enabled || !props.clientId || props.disabled) return null;

  const cookieDomain = normalizeCookieDomain(props.cookieDomain);

  return (
    <>
      <div
        id="g_id_onload"
        data-auto_prompt="true"
        data-client_id={props.clientId}
        data-context="signin"
        data-itp_support="true"
        data-login_uri={props.loginUri}
        data-state_cookie_domain={cookieDomain}
        data-use_fedcm_for_prompt="true"
      />
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
      />
    </>
  );
}

function normalizeCookieDomain(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^\./, "");
}
