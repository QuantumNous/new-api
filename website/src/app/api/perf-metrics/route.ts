import { NextResponse, type NextRequest } from "next/server";

const ROUTER_BASE_URL = process.env.FLATKEY_API_BASE_URL ?? "https://router.flatkey.ai";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams;
  const target = new URL("/api/perf-metrics", ROUTER_BASE_URL);
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
