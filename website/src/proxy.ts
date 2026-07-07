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

  const cookieHeader = request.headers.get("cookie");

  if (!redirectPath) return withLanguagePreferenceCookieMigration(NextResponse.next(), cookieLocale, cookieHeader);

  const url = request.nextUrl.clone();
  url.pathname = redirectPath;
  return withLanguagePreferenceCookieMigration(NextResponse.redirect(url, 307), cookieLocale, cookieHeader);
}

function withLanguagePreferenceCookieMigration(
  response: NextResponse,
  cookieLocale: string | undefined,
  cookieHeader?: string | null
): NextResponse {
  const cookieDomain = process.env.COOKIE_SESSION_DOMAIN?.trim();
  if (!cookieDomain) return response;

  const languageCookieCount = (cookieHeader ?? "")
    .split(";")
    .filter((part) => part.trim().startsWith(`${LANGUAGE_PREFERENCE_COOKIE}=`)).length;
  let cookieWrites: string[] = [];
  if (languageCookieCount > 1) {
    cookieWrites = [`${LANGUAGE_PREFERENCE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`];
  } else if (isLocale(cookieLocale)) {
    cookieWrites = buildLanguagePreferenceCookieWrites(cookieLocale, cookieDomain);
  }

  for (const cookie of cookieWrites) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}
