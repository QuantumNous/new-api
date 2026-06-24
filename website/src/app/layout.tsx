import type { Metadata } from "next";
import Script from "next/script";
import { HtmlLangSync } from "@/components/html-lang-sync";
import { DEFAULT_LOCALE, LOCALES, isLocale, resolveLocaleFromPathname, type Locale } from "@/lib/locales";
import "./globals.css";

const GTM_ID = "GTM-5T5LPLSZ";

// Solvea livechat 咨询挂件（公开站，访客售前咨询）。token 为客户端公开嵌入凭证，非密钥。
const LIVECHAT_EMBED_SRC =
  "https://app.solvea.cx/api_v2/gpt/bots/livechat/embed.js?pid=1773&token=9454e15203254694a03d75fadbf9a6d4";
const LOCALIZED_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);
const HTML_LANG_SYNC_SCRIPT = `(function(){var locales=${JSON.stringify(LOCALIZED_LOCALES)};var path=window.location.pathname||"/";var seg=path.split("/")[1];document.documentElement.lang=locales.indexOf(seg)>=0?seg:"${DEFAULT_LOCALE}";})();`;

export const metadata: Metadata = {
  applicationName: "flatkey.ai",
  title: {
    default: "flatkey.ai",
    template: "%s | flatkey.ai",
  },
};

export function resolveHtmlLang(locale: string | null | undefined, pathname?: string | null | undefined): Locale {
  const normalizedLocale = locale ?? undefined;
  if (isLocale(normalizedLocale)) return normalizedLocale;
  return resolveLocaleFromPathname(pathname ?? normalizedLocale);
}

export default async function RootLayout(
  props: Readonly<{
    children: React.ReactNode;
    params?: Promise<{ locale?: string }>;
  }>
) {
  const params = await props.params;
  const htmlLang = resolveHtmlLang(params?.locale);

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <body>
        <Script id="html-lang-sync" strategy="beforeInteractive">
          {HTML_LANG_SYNC_SCRIPT}
        </Script>
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
        <HtmlLangSync />
        {props.children}
        <Script
          id="solvea-livechat"
          src={LIVECHAT_EMBED_SRC}
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
