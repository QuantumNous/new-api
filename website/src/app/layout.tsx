import type { Metadata } from "next";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/locales";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "flatkey.ai",
  title: {
    default: "flatkey.ai",
    template: "%s | flatkey.ai",
  },
};

export function resolveHtmlLangFromPathname(pathname: string | null | undefined): Locale {
  const firstSegment = pathname?.split("/").filter(Boolean)[0];
  return isLocale(firstSegment) ? firstSegment : DEFAULT_LOCALE;
}

export default async function RootLayout(
  props: Readonly<{
    children: React.ReactNode;
  }>
) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-flatkey-pathname");

  return (
    <html lang={resolveHtmlLangFromPathname(pathname)}>
      <body>{props.children}</body>
    </html>
  );
}
