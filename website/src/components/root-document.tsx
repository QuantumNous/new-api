import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/locales";

const GTM_ID = "GTM-5T5LPLSZ";

// Solvea livechat 咨询挂件（公开站，访客售前咨询）。token 为客户端公开嵌入凭证，非密钥。
const LIVECHAT_EMBED_SRC =
  "https://app.solvea.cx/api_v2/gpt/bots/livechat/embed.js?pid=1773&token=9454e15203254694a03d75fadbf9a6d4";

export const rootMetadata: Metadata = {
  applicationName: "flatkey.ai",
  title: {
    default: "flatkey.ai",
    template: "%s | flatkey.ai",
  },
};

type RootDocumentProps = {
  children: ReactNode;
  lang: Locale;
};

export function RootDocument({ children, lang }: RootDocumentProps) {
  return (
    <html lang={lang} suppressHydrationWarning>
      <body>
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          `}
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
        <Script
          id="solvea-livechat"
          src={LIVECHAT_EMBED_SRC}
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
