import { NextResponse } from "next/server";
import { consoleUrl } from "@/lib/origins";

export function buildSignInRedirectLocation(request: Request): string {
  const search = new URL(request.url).searchParams;
  search.delete("provider");
  search.set("source", "website");
  return consoleUrl("/api/oauth/google/start", search.toString());
}

export function redirectToGoogleSignIn(request: Request): NextResponse {
  return NextResponse.redirect(buildSignInRedirectLocation(request), 301);
}
