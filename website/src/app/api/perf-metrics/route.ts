import { NextResponse, type NextRequest } from "next/server";
import { APP_CONSOLE_ORIGIN } from "@/lib/origins";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams;
  const target = new URL("/api/perf-metrics", APP_CONSOLE_ORIGIN);
  const model = source.get("model");
  const hours = source.get("hours") ?? "24";

  if (model) target.searchParams.set("model", model);
  target.searchParams.set("hours", hours);

  return proxyJson(target);
}

async function proxyJson(target: URL) {
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
    return NextResponse.json({ success: false, message: "Failed to fetch performance metrics" }, { status: 502 });
  }
}
