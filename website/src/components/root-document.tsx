import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { GoogleOneTapPrompt } from "@/components/google-one-tap-prompt";
import { SiteConfigProvider } from "@/components/site-config-provider";
import { buildLanguagePreferenceCookieWrites } from "@/lib/language-routing";
import { MIXPANEL_BROWSER_SCRIPT } from "@/lib/mixpanel";
import { localeLanguageTag, type Locale } from "@/lib/locales";
import { SITE_ORIGIN, consoleUrl } from "@/lib/origins";
import type { PublicSiteSettings } from "@/lib/public-site-settings";

const GTM_IDS = ["GTM-NKH9LPX9", "GTM-5T5LPLSZ"] as const;

// Solvea livechat 咨询挂件（公开站，访客售前咨询）。token 为客户端公开嵌入凭证，非密钥。
const LIVECHAT_EMBED_SRC =
  "https://app.solvea.cx/api_v2/gpt/bots/livechat/embed.js?pid=1773&token=9454e15203254694a03d75fadbf9a6d4";

export const ROOT_DOCUMENT_PERFORMANCE_POLICY = {
  gtmStrategy: "afterInteractive",
  mixpanelStrategy: "lazyOnload",
  livechatStrategy: "lazyOnload",
} as const;

export const LIVECHAT_BOOTSTRAP_SCRIPT = `(function(){
  var loaded=false;
  function load(){
    if(loaded)return;
    loaded=true;
    var script=document.createElement("script");
    script.id="solvea-livechat-embed";
    script.src=${JSON.stringify(LIVECHAT_EMBED_SRC)};
    script.async=true;
    document.body.appendChild(script);
  }
  function idle(){if("requestIdleCallback" in window){window.requestIdleCallback(load,{timeout:8000});return;}setTimeout(load,4000)}
  window.addEventListener("pointerdown",load,{once:true,passive:true});
  window.addEventListener("keydown",load,{once:true,passive:true});
  idle();
})();`;

export function buildLanguagePreferenceSyncScript(
  locale: Locale,
  cookieDomain?: string,
): string {
  const cookieWrites = buildLanguagePreferenceCookieWrites(locale, cookieDomain);
  return `(function(){try{var cookies=${JSON.stringify(cookieWrites)};for(var i=0;i<cookies.length;i++){document.cookie=cookies[i];}}catch(_){}})();`;
}

export const ATTRIBUTION_COOKIE_SCRIPT = `(function(){
  try {
    var keep = {
      aff:1, fbclid:1, gad_campaignid:1, gad_source:1, gbraid:1, gclid:1,
      lng:1, msclkid:1, ttclid:1, wbraid:1, yclid:1, account:1,
      campaign_id:1, ad_group:1, ad_group_id:1, creative:1, creative_id:1,
      placement:1, network:1, device:1, keyword:1, market:1, country:1, match_type:1,
      target_id:1, location_id:1, loc_physical_ms:1, language:1,
      experiment:1, experiment_id:1
    };
    var params = new URLSearchParams(window.location.search || "");
    var values = {};
    params.forEach(function(value, key) {
      if (value && (keep[key] || key.indexOf("utm_") === 0 || key.indexOf("hsa_") === 0)) {
        values[key] = value;
      }
    });
    if (!Object.keys(values).length) return;

    var existing = {};
    var prefix = "flatkey_ads_attribution=";
    var part = (document.cookie || "").split(";").map(function(value) {
      return value.trim();
    }).find(function(value) {
      return value.indexOf(prefix) === 0;
    });
    if (part) {
      try { existing = JSON.parse(decodeURIComponent(part.slice(prefix.length))) || {}; }
      catch (_) { existing = {}; }
    }
    try {
      var stored = JSON.parse(localStorage.getItem("ads:attribution") || "{}");
      existing = Object.assign({}, stored, existing);
    } catch (_) {}

    var nowDate = new Date();
    if (existing.expires_at && Date.parse(existing.expires_at) <= nowDate.getTime()) {
      existing = {};
    }
    if (existing.gclid || existing.gbraid || existing.wbraid) {
      values = Object.assign({}, values, existing);
    }

    var path = window.location.pathname || "/";
    var acquisition = path.indexOf("/oauth/") !== 0 &&
      path !== "/sign-in" && path.indexOf("/sign-in/") !== 0 &&
      path !== "/sign-up" && path.indexOf("/sign-up/") !== 0;
    var previous = existing.first_landing_path || existing.landing_path || "";
    var previousValid = previous && previous.indexOf("/oauth/") !== 0 &&
      previous !== "/sign-in" && previous.indexOf("/sign-in/") !== 0 &&
      previous !== "/sign-up" && previous.indexOf("/sign-up/") !== 0;
    var first = previousValid ? previous : (acquisition ? path : "");
    var now = nowDate.toISOString();
    values.landing_path = acquisition ? path : (existing.landing_path || "");
    values.captured_at = now;
    values.expires_at = existing.expires_at ||
      new Date(nowDate.getTime() + 7776000000).toISOString();
    if (first) {
      values.first_landing_path = first;
      values.first_captured_at = existing.first_captured_at || existing.captured_at || now;
    }

    try { localStorage.setItem("ads:attribution", JSON.stringify(values)); } catch (_) {}
    var maxAge = Math.max(0,
      Math.floor((Date.parse(values.expires_at) - nowDate.getTime()) / 1000));
    var host = window.location.hostname;
    var attrs = ["path=/", "max-age=" + maxAge, "SameSite=Lax"];
    if (host === "flatkey.ai" || host.endsWith(".flatkey.ai")) attrs.push("domain=.flatkey.ai");
    if (window.location.protocol === "https:") attrs.push("Secure");
    document.cookie = "flatkey_ads_attribution=" +
      encodeURIComponent(JSON.stringify(values)) + "; " + attrs.join("; ");
  } catch (_) {}
})();`;

export const rootMetadata: Metadata = {
  applicationName: "flatkey.ai",
  title: {
    default: "flatkey.ai",
    template: "%s | flatkey.ai",
  },
};

type RootDocumentProps = {
  bodyStart?: ReactNode;
  children: ReactNode;
  docsUrl: string | null;
  hasConsoleSessionHint: boolean;
  googleOneTap: PublicSiteSettings["googleOneTap"];
  lang: Locale;
};

export function RootDocument({
  bodyStart,
  children,
  docsUrl,
  hasConsoleSessionHint,
  googleOneTap,
  lang,
}: RootDocumentProps) {
  const googleOneTapSearch = new URLSearchParams({
    lng: lang,
    return_to: "/",
  });
  const googleOneTapCookieDomain = googleOneTapStateCookieDomain();
  const languageCookieDomain = process.env.COOKIE_SESSION_DOMAIN?.trim() || undefined;

  return (
    <html lang={localeLanguageTag(lang)} suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: buildLanguagePreferenceSyncScript(lang, languageCookieDomain),
          }}
        />
        {bodyStart}
        <Script id="google-tag-manager" strategy={ROOT_DOCUMENT_PERFORMANCE_POLICY.gtmStrategy}>
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer',${JSON.stringify(GTM_IDS[0])});
            ${GTM_IDS.slice(1)
              .map(
                (id) => `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer',${JSON.stringify(id)});`,
              )
              .join("\n            ")}
          `}
        </Script>
        <Script id="mixpanel-consent-gated" strategy={ROOT_DOCUMENT_PERFORMANCE_POLICY.mixpanelStrategy}>
          {MIXPANEL_BROWSER_SCRIPT}
        </Script>
        <noscript>
          {GTM_IDS.map((id) => (
            <iframe
              key={id}
              src={`https://www.googletagmanager.com/ns.html?id=${id}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          ))}
        </noscript>
        <GoogleOneTapPrompt
          clientId={googleOneTap.clientId}
          cookieDomain={googleOneTapCookieDomain}
          disabled={hasConsoleSessionHint}
          enabled={googleOneTap.enabled}
          loginUri={consoleUrl(
            "/api/oauth/google/one-tap",
            googleOneTapSearch.toString(),
          )}
        />
        <SiteConfigProvider docsUrl={docsUrl}>{children}</SiteConfigProvider>
        <Script id="solvea-livechat-bootstrap" strategy={ROOT_DOCUMENT_PERFORMANCE_POLICY.livechatStrategy}>
          {LIVECHAT_BOOTSTRAP_SCRIPT}
        </Script>
      </body>
    </html>
  );
}

function googleOneTapStateCookieDomain(): string | undefined {
  const configured = process.env.COOKIE_SESSION_DOMAIN?.trim();
  if (configured) return configured;

  try {
    const hostname = new URL(SITE_ORIGIN).hostname;
    if (hostname === "localhost" || !hostname.includes(".")) return undefined;
    const labels = hostname.split(".").filter(Boolean);
    if (labels.length < 2) return undefined;
    return labels.slice(-2).join(".");
  } catch {
    return undefined;
  }
}
