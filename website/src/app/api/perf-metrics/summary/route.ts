import { NextResponse, type NextRequest } from "next/server";
import { APP_CONSOLE_ORIGIN } from "@/lib/origins";
import { WEBSITE_PUBLIC_PRICING_GROUP } from "@/lib/pricing";

export async function GET(request: NextRequest) {
  const target = new URL("/api/perf-metrics/summary", APP_CONSOLE_ORIGIN);
  const source = request.nextUrl.searchParams;
  const group = source.get("group")?.trim();

  if (group && group !== WEBSITE_PUBLIC_PRICING_GROUP) {
    return NextResponse.json({ success: false, message: "unsupported performance metrics group" }, { status: 400 });
  }

  target.searchParams.set("hours", source.get("hours") ?? "24");
  target.searchParams.set("group", WEBSITE_PUBLIC_PRICING_GROUP);

  try {
    const response = await fetch(target, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to fetch performance summary" }, { status: 502 });
  }
}
