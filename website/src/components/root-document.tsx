import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { MIXPANEL_BROWSER_SCRIPT } from "@/lib/mixpanel";
import type { Locale } from "@/lib/locales";

const GTM_ID = "GTM-5T5LPLSZ";

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

export const ATTRIBUTION_COOKIE_SCRIPT = `(function(){try{var keep={aff:1,fbclid:1,gad_campaignid:1,gad_source:1,gbraid:1,gclid:1,lng:1,msclkid:1,ttclid:1,wbraid:1};var params=new URLSearchParams(window.location.search||"");var values={};params.forEach(function(value,key){if(!value)return;if(keep[key]||key.indexOf("utm_")===0||key.indexOf("hsa_")===0){values[key]=value;}});if(!Object.keys(values).length)return;values.landing_path=window.location.pathname||"/";values.captured_at=new Date().toISOString();var host=window.location.hostname;var attrs=["path=/","max-age=7776000","SameSite=Lax"];if(host==="flatkey.ai"||host.endsWith(".flatkey.ai"))attrs.push("domain=.flatkey.ai");if(window.location.protocol==="https:")attrs.push("Secure");document.cookie="flatkey_ads_attribution="+encodeURIComponent(JSON.stringify(values))+"; "+attrs.join("; ");}catch(e){}})();`;

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
  lang: Locale;
};

export function RootDocument({ bodyStart, children, lang }: RootDocumentProps) {
  return (
    <html lang={lang} suppressHydrationWarning>
      <body>
        {bodyStart}
        <Script id="google-tag-manager" strategy={ROOT_DOCUMENT_PERFORMANCE_POLICY.gtmStrategy}>
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          `}
        </Script>
        <Script id="mixpanel-consent-gated" strategy={ROOT_DOCUMENT_PERFORMANCE_POLICY.mixpanelStrategy}>
          {MIXPANEL_BROWSER_SCRIPT}
        </Script>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {children}
        <Script id="solvea-livechat-bootstrap" strategy={ROOT_DOCUMENT_PERFORMANCE_POLICY.livechatStrategy}>
          {LIVECHAT_BOOTSTRAP_SCRIPT}
        </Script>
      </body>
    </html>
  );
}
