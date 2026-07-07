import { NextResponse, type NextRequest } from "next/server";
import { APP_CONSOLE_ORIGIN } from "@/lib/origins";

export async function GET(request: NextRequest) {
  const target = new URL("/api/rankings", APP_CONSOLE_ORIGIN);
  target.searchParams.set("period", request.nextUrl.searchParams.get("period") ?? "month");

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
    return NextResponse.json({ success: false, message: "Failed to fetch rankings" }, { status: 502 });
  }
}
