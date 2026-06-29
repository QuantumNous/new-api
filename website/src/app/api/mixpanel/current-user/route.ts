import { NextResponse, type NextRequest } from "next/server";
import { APP_CONSOLE_ORIGIN } from "@/lib/origins";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const target = new URL("/api/user/analytics-self", APP_CONSOLE_ORIGIN);
  try {
    const response = await fetch(target, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ??
          "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Failed to fetch current user" },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }
}
