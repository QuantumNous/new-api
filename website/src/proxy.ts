import { type NextRequest, NextResponse } from "next/server";
import {
  LANGUAGE_PREFERENCE_COOKIE,
  buildLanguagePreferenceCookieWrites,
  getLanguageRedirectPath,
} from "@/lib/language-routing";
import { isLocale } from "@/lib/locales";

export function proxy(request: NextRequest) {
  const cookieLocale = request.cookies.get(LANGUAGE_PREFERENCE_COOKIE)?.value;
  const redirectPath = getLanguageRedirectPath({
    pathname: request.nextUrl.pathname,
    method: request.method,
    acceptLanguage: request.headers.get("accept-language"),
    cookieLocale,
    userAgent: request.headers.get("user-agent"),
  });

  if (!redirectPath) return withLanguagePreferenceCookieMigration(NextResponse.next(), cookieLocale);

  const url = request.nextUrl.clone();
  url.pathname = redirectPath;
  return withLanguagePreferenceCookieMigration(NextResponse.redirect(url, 307), cookieLocale);
}

function withLanguagePreferenceCookieMigration(response: NextResponse, cookieLocale: string | undefined): NextResponse {
  const cookieDomain = process.env.COOKIE_SESSION_DOMAIN?.trim();
  if (!cookieDomain || !isLocale(cookieLocale)) return response;

  for (const cookie of buildLanguagePreferenceCookieWrites(cookieLocale, cookieDomain)) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}
