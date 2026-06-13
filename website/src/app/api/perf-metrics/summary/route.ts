import { NextResponse, type NextRequest } from "next/server";

const ROUTER_BASE_URL = process.env.FLATKEY_API_BASE_URL ?? "https://router.flatkey.ai";

export async function GET(request: NextRequest) {
  const target = new URL("/api/perf-metrics/summary", ROUTER_BASE_URL);
  target.searchParams.set("hours", request.nextUrl.searchParams.get("hours") ?? "24");

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
