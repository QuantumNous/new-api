import { NextResponse } from "next/server";
import { consoleUrl } from "@/lib/origins";

export function GET() {
  return NextResponse.redirect(consoleUrl("/sign-up"), 301);
}
