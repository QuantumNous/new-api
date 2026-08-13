import { NextResponse } from "next/server";
import { consoleUrl } from "@/lib/origins";

const GOOGLE_PROVIDER_PARAM = "provider";
const GOOGLE_PROVIDER_VALUE = "google";

export function buildSignInRedirectLocation(request: Request): string {
  const search = new URL(request.url).searchParams;
  search.set(GOOGLE_PROVIDER_PARAM, GOOGLE_PROVIDER_VALUE);
  return consoleUrl("/sign-in", search.toString());
}

export function redirectToGoogleSignIn(request: Request): NextResponse {
  return NextResponse.redirect(buildSignInRedirectLocation(request), 301);
}
