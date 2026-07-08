"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DailyHealthBars } from "@/components/home-health-bars";
import { ModelLogo } from "@/components/pricing-model-browser";
import type { HomeCopy } from "@/lib/home-copy";
import {
  fetchHealthSummary,
  fetchModelTrend,
  formatLatencyMs,
  formatSuccessRate,
  trendAvgTtftMs,
  type HomePerfSummary,
  type HomeTrendPoint,
} from "@/lib/home-live";
import type { HomePricedModel } from "@/lib/home-models";
import type { Locale } from "@/lib/locales";
import { localizePath } from "@/lib/locales";

export type HomeModelRow = HomePricedModel;

type Props = {
  locale: Locale;
  copy: HomeCopy["table"];
  rows: HomeModelRow[];
};

// Only the busiest models make the homepage cut; the full directory lives on /models.
const TOP_ROWS = 10;

// Screen 4: top models as one efficient list — official price struck through
// vs the after-bonus price, TTFT latency, and a 30-day health bar wall.
export function HomeModelsTable(props: Props) {
  const [summary, setSummary] = useState<Record<string, HomePerfSummary>>({});
  const [trends, setTrends] = useState<Record<string, HomeTrendPoint[]>>({});

  useEffect(() => {
    let cancelled = false;
    fetchHealthSummary().then((data) => {
      if (!cancelled) setSummary(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    // Models with real 30-day traffic float to the top; pricing order breaks ties.
    return [...props.rows]
      .sort((a, b) => (summary[b.name]?.request_count ?? 0) - (summary[a.name]?.request_count ?? 0))
      .slice(0, TOP_ROWS);
  }, [props.rows, summary]);

  // One trend fetch per visible row, only once the summary settled the top 10.
  useEffect(() => {
    if (Object.keys(summary).length === 0) return;
    let cancelled = false;
    for (const row of rows) {
      if (trends[row.name]) continue;
      fetchModelTrend(row.name).then((points) => {
        if (!cancelled && points.length > 0) setTrends((current) => ({ ...current, [row.name]: points }));
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, summary]);

  if (props.rows.length === 0) return null;

  return (
    <section className="relative z-10 px-6 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 max-w-2xl">
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">{props.copy.eyebrow}</p>
          <h2 className="text-2xl leading-tight font-bold tracking-tight md:text-3xl">{props.copy.title}</h2>
          <p className="text-muted-foreground mt-3 text-sm leading-7 md:text-base">{props.copy.description}</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-violet-500/16 bg-white/72 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm dark:bg-white/[0.04]">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="text-muted-foreground/80 border-b border-violet-500/12 text-left text-[11px] font-bold tracking-[0.1em] uppercase">
                <th className="px-5 py-3.5 font-bold">{props.copy.colModel}</th>
                <th className="px-3 py-3.5 text-right font-bold">
                  {props.copy.colOfficial}
                  <span className="text-muted-foreground/50 block text-[9px] font-medium normal-case">{props.copy.perMillion}</span>
                </th>
                <th className="px-3 py-3.5 text-right font-bold text-violet-700 dark:text-violet-300">
                  {props.copy.colFlatkey}
                  <span className="text-muted-foreground/50 block text-[9px] font-medium normal-case">{props.copy.perMillion}</span>
                </th>
                <th className="px-3 py-3.5 text-right font-bold">{props.copy.colLatency}</th>
                <th className="w-[220px] px-5 py-3.5 text-left font-bold">{props.copy.colHealth}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const perf = summary[row.name];
                const trend = trends[row.name] ?? [];
                return (
                  <tr key={row.name} className="border-b border-violet-500/8 transition-colors last:border-b-0 hover:bg-violet-500/4">
                    <td className="max-w-[280px] px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-violet-500/15 bg-violet-500/6">
                          <ModelLogo iconKey={row.iconKey} fallback={row.name.charAt(0).toUpperCase()} size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-[13px] font-semibold tracking-tight">{row.name}</span>
                          <span className="text-muted-foreground/70 block text-[11px]">{row.vendor}</span>
                        </span>
                      </div>
                    </td>
                    <td className="text-muted-foreground px-3 py-3 text-right font-mono text-[13px] line-through">{row.official}</td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{row.discounted}</td>
                    <td className="px-3 py-3 text-right font-mono text-[13px]">{formatLatencyMs(perf?.avg_ttft_ms || trendAvgTtftMs(trend))}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-[140px]">
                          {trend.length > 1 ? <DailyHealthBars points={trend} label={props.copy.colHealth} heightPx={28} /> : null}
                        </div>
                        <span className="font-mono text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatSuccessRate(perf?.success_rate)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <Link
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-800 dark:text-violet-300"
            href={localizePath("/models", props.locale)}
          >
            {props.copy.viewAll}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
