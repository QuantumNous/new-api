import { NextResponse } from "next/server";
import { consoleUrl } from "@/lib/origins";

export function GET(request: Request) {
  return NextResponse.redirect(consoleUrl("/sign-in", new URL(request.url).search), 301);
}
