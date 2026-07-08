import { APP_CONSOLE_ORIGIN } from "@/lib/origins";
import { buildTokenUsage, TOKEN_DISPLAY_SCALE, type TokenUsage } from "@/lib/home-live";

// Server-side data for the public /rankings page. Same pipeline as the
// console rankings page and the homepage usage chart: real model ordering and
// relative shares from /api/rankings, tokens displayed at ×100 scale, and a
// date-seeded synthetic daily curve (see buildTokenUsage) — so the page
// changes every day without exposing raw platform volume.

export type RankedModel = {
  rank: number;
  model_name: string;
  vendor?: string;
  vendor_icon?: string;
  total_tokens: number;
  share?: number;
};

export type RankingsData = {
  usage: TokenUsage | null;
  models: RankedModel[];
};

type RankingsPayload = {
  success?: boolean;
  data?: {
    models?: RankedModel[];
    models_history?: {
      models?: { name: string; total: number }[];
    };
  };
};

/** Display value for leaderboard token counts — same ×100 scale as the chart. */
export function displayTokens(rawTokens: number): number {
  return rawTokens * TOKEN_DISPLAY_SCALE;
}

export async function fetchRankingsData(): Promise<RankingsData | null> {
  try {
    const target = new URL("/api/rankings", APP_CONSOLE_ORIGIN);
    target.searchParams.set("period", "month");
    const response = await fetch(target, {
      headers: { accept: "application/json" },
      // Hourly revalidate is enough: the daily shape only changes with the
      // calendar date (date-seeded), not per request.
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as RankingsPayload;
    if (!payload.success) return null;

    const models = (payload.data?.models ?? []).filter((row) => row.total_tokens > 0);
    const usage = buildTokenUsage(
      payload.data?.models_history?.models ?? [],
      models.map((row) => ({ model_name: row.model_name, total_tokens: row.total_tokens }))
    );
    if (!usage && models.length === 0) return null;

    return {
      usage,
      models: models.slice(0, 18),
    };
  } catch {
    return null;
  }
}
