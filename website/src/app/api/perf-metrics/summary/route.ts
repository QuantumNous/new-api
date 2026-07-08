import { NextResponse, type NextRequest } from "next/server";
import { normalizeModelKey } from "@/lib/model-public";
import { APP_CONSOLE_ORIGIN } from "@/lib/origins";
import { PERF_METRICS_ALL_GROUPS, WEBSITE_PUBLIC_PRICING_GROUP } from "@/lib/pricing";

type SummaryRow = { model_name?: string };

// The upstream summary is the same whole-platform payload for every model page,
// so cache it briefly (instead of no-store) to avoid re-hitting the backend on
// each visit, and — when a single model is requested — filter to that model's
// row server-side so a model page never ships the full catalog to the client.
const REVALIDATE_SECONDS = 60;

export async function GET(request: NextRequest) {
  const target = new URL("/api/perf-metrics/summary", APP_CONSOLE_ORIGIN);
  const source = request.nextUrl.searchParams;
  const group = source.get("group")?.trim();
  const model = source.get("model")?.trim();

  if (group && group !== PERF_METRICS_ALL_GROUPS && group !== WEBSITE_PUBLIC_PRICING_GROUP) {
    return NextResponse.json({ success: false, message: "unsupported performance metrics group" }, { status: 400 });
  }

  target.searchParams.set("hours", source.get("hours") ?? "24");
  // Whole-platform health by default; "plg" stays allowed for the public-tier
  // view. The backend has no literal "all" group — whole-platform is expressed
  // by omitting the group param, so only forward a concrete group like "plg".
  if (group && group !== PERF_METRICS_ALL_GROUPS) {
    target.searchParams.set("group", group);
  }

  const cacheControl = `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS}`;

  try {
    const response = await fetch(target, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { accept: "application/json" },
    });
    const body = await response.text();

    if (model && response.ok) {
      try {
        const payload = JSON.parse(body) as { data?: { models?: SummaryRow[] } };
        const wanted = normalizeModelKey(model);
        const models = (payload.data?.models ?? []).filter(
          (row) => row.model_name === model || (row.model_name != null && normalizeModelKey(row.model_name) === wanted)
        );
        return NextResponse.json(
          { ...payload, data: { ...payload.data, models } },
          { headers: { "cache-control": cacheControl } }
        );
      } catch {
        // Fall through to the raw body if the payload is not JSON as expected.
      }
    }

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
        "cache-control": cacheControl,
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to fetch performance summary" }, { status: 502 });
  }
}
