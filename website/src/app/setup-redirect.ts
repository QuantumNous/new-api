import { NextResponse } from "next/server";
import { consoleUrl } from "@/lib/origins";

export function buildSetupRedirectLocation(requestUrl: string): string {
  const url = new URL(requestUrl);
  const params = new URLSearchParams(url.search);
  if (!params.has("redirect")) {
    params.set("redirect", "/keys");
  }

  const search = params.toString();
  return consoleUrl("/sign-up", search ? `?${search}` : "");
}

export function redirectToConsoleSetup(request: Request): NextResponse {
  return NextResponse.redirect(buildSetupRedirectLocation(request.url), 301);
}
