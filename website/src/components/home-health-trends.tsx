"use client";

import { ArrowRight, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { HomeCopy } from "@/lib/home-copy";
import {
  fetchHealthSummary,
  fetchModelTrend,
  formatCallCount,
  formatLatencyMs,
  formatSuccessRate,
  type HomePerfSummary,
  type HomeTrendPoint,
} from "@/lib/home-live";
import type { Locale } from "@/lib/locales";
import { localizePath } from "@/lib/locales";

type Props = {
  locale: Locale;
  copy: HomeCopy["health"];
  // Flagship model names picked server-side from live pricing data.
  models: string[];
};

// Screen 2: 30-day health per flagship model, from real routed traffic.
export function HomeHealthTrends(props: Props) {
  const [summary, setSummary] = useState<Record<string, HomePerfSummary>>({});
  const [trends, setTrends] = useState<Record<string, HomeTrendPoint[]>>({});

  useEffect(() => {
    let cancelled = false;
    fetchHealthSummary().then((data) => {
      if (!cancelled) setSummary(data);
    });
    for (const model of props.models) {
      fetchModelTrend(model).then((points) => {
        if (!cancelled && points.length > 0) setTrends((current) => ({ ...current, [model]: points }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [props.models]);

  return (
    <section className="relative z-10 px-6 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">{props.copy.eyebrow}</p>
            <h2 className="text-2xl leading-tight font-bold tracking-tight md:text-3xl">{props.copy.title}</h2>
            <p className="text-muted-foreground mt-3 text-sm leading-7 md:text-base">{props.copy.description}</p>
          </div>
          <Link
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-800 dark:text-violet-300"
            href={localizePath("/models", props.locale)}
          >
            {props.copy.viewAll}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {props.models.map((model) => {
            const perf = summary[model];
            const trend = trends[model] ?? [];
            return (
              <article
                key={model}
                className="rounded-2xl border border-violet-500/16 bg-white/72 p-6 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm dark:bg-white/[0.04]"
              >
                <h3 className="truncate font-mono text-sm font-semibold tracking-tight">{model}</h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {formatSuccessRate(perf?.success_rate)}
                  </span>
                  <span className="text-muted-foreground text-xs">{props.copy.uptimeLabel}</span>
                </div>
                <div className="mt-4 h-14">
                  {trend.length > 1 ? (
                    <TrendSparkline points={trend} label={props.copy.trendLabel} />
                  ) : (
                    <div className="text-muted-foreground/60 flex h-full items-center text-xs">{props.copy.empty}</div>
                  )}
                </div>
                <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-violet-500/10 pt-3 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Timer className="size-3.5" />
                    {props.copy.latencyLabel}: <span className="text-foreground font-mono font-semibold">{formatLatencyMs(perf?.avg_latency_ms)}</span>
                  </span>
                  <span>
                    {props.copy.callsLabel}: <span className="text-foreground font-mono font-semibold">{formatCallCount(perf?.request_count)}</span>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TrendSparkline(props: { points: HomeTrendPoint[]; label: string }) {
  const width = 240;
  const height = 56;
  const values = props.points.map((point) => point.success_rate);
  const min = Math.min(95, Math.floor(Math.min(...values)));
  const max = 100;
  const range = Math.max(max - min, 0.1);
  const coords = props.points.map((point, index) => {
    const x = (index / (props.points.length - 1)) * width;
    const y = height - ((point.success_rate - min) / range) * (height - 6) - 3;
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label={props.label} preserveAspectRatio="none">
      <polygon points={area} className="fill-emerald-500/12" />
      <polyline points={line} className="stroke-emerald-500" fill="none" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
