import { type NextRequest, NextResponse } from "next/server";
import { LANGUAGE_PREFERENCE_COOKIE, getLanguageRedirectPath } from "@/lib/language-routing";

export function proxy(request: NextRequest) {
  const redirectPath = getLanguageRedirectPath({
    pathname: request.nextUrl.pathname,
    method: request.method,
    acceptLanguage: request.headers.get("accept-language"),
    cookieLocale: request.cookies.get(LANGUAGE_PREFERENCE_COOKIE)?.value,
    userAgent: request.headers.get("user-agent"),
  });

  if (!redirectPath) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = redirectPath;
  return NextResponse.redirect(url, 307);
}
