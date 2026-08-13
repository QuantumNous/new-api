"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ModelLogo } from "@/components/pricing-model-browser";
import { DailyHealthBars } from "@/components/home-health-bars";
import { formatHealthSuccessRate, getJitteredSuccessRate } from "@/lib/health-display";
import type { HomeCopy } from "@/lib/home-copy";
import {
  fetchHealthSummary,
  fetchModelTrend,
  formatLatencyMs,
  trendAvgTtftMs,
  type HomePerfSummary,
  type HomeTrendPoint,
} from "@/lib/home-live";
import type { HomePricedModel } from "@/lib/home-models";
import { localizePath, type Locale } from "@/lib/locales";
import { modelPublicPath } from "@/lib/model-public";

type Props = {
  copy: HomeCopy["table"];
  rows: HomePricedModel[];
  locale?: Locale;
};

const DEFAULT_TTFT_MS = 600;

// /models directory: every priced model as one row — official price struck
// through vs the group-ratio price (the hero number), TTFT latency, and a
// 30-day health bar wall. Health series load lazily as rows scroll into view
// so 40+ rows do not fan out 40+ upfront requests.
export function ModelsDirectoryTable(props: Props) {
  const [summary, setSummary] = useState<Record<string, HomePerfSummary>>({});
  const [trends, setTrends] = useState<Record<string, HomeTrendPoint[]>>({});
  const requested = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    fetchHealthSummary().then((data) => {
      if (!cancelled) setSummary(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTrend = (model: string) => {
    if (requested.current.has(model)) return;
    requested.current.add(model);
    fetchModelTrend(model).then((points) => {
      if (points.length > 0) setTrends((current) => ({ ...current, [model]: points }));
    });
  };

  if (props.rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-violet-500/16 bg-white/72 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm dark:bg-white/[0.04]">
      <table className="w-full min-w-[760px] border-collapse text-sm">
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
          {props.rows.map((row) => (
            <DirectoryRow
              key={row.name}
              row={row}
              perf={summary[row.name]}
              trend={trends[row.name] ?? []}
              healthLabel={props.copy.colHealth}
              locale={props.locale}
              onVisible={() => loadTrend(row.name)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DirectoryRow(props: {
  row: HomePricedModel;
  perf: HomePerfSummary | undefined;
  trend: HomeTrendPoint[];
  healthLabel: string;
  locale?: Locale;
  onVisible: () => void;
}) {
  const ref = useRef<HTMLTableRowElement>(null);
  const { onVisible } = props;

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      onVisible();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisible();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible]);

  const { row, perf, trend } = props;
  const latencyMs = perf?.avg_ttft_ms && perf.avg_ttft_ms > 0 ? perf.avg_ttft_ms : trendAvgTtftMs(trend) || DEFAULT_TTFT_MS;
  const successRate = validSuccessRate(perf?.success_rate) ?? trendAvgSuccessRate(trend);
  const displaySuccessRate = getJitteredSuccessRate(successRate, row.name);

  return (
    <tr ref={ref} className="border-b border-violet-500/8 transition-colors last:border-b-0 hover:bg-violet-500/4">
      <td className="max-w-[280px] px-5 py-3">
        {props.locale ? (
          <Link
            href={localizePath(modelPublicPath(row.name), props.locale)}
            className="flex items-center gap-2.5 hover:opacity-80"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-violet-500/15 bg-violet-500/6">
              <ModelLogo iconKey={row.iconKey} fallback={row.name.charAt(0).toUpperCase()} size={18} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-mono text-[13px] font-semibold tracking-tight underline-offset-2 hover:underline">
                {row.name}
              </span>
              <span className="text-muted-foreground/70 block text-[11px]">{row.vendor}</span>
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-violet-500/15 bg-violet-500/6">
              <ModelLogo iconKey={row.iconKey} fallback={row.name.charAt(0).toUpperCase()} size={18} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-mono text-[13px] font-semibold tracking-tight">{row.name}</span>
              <span className="text-muted-foreground/70 block text-[11px]">{row.vendor}</span>
            </span>
          </div>
        )}
      </td>
      <td className="text-muted-foreground px-3 py-3 text-right font-mono text-[13px] line-through">{row.official}</td>
      <td className="px-3 py-3 text-right font-mono text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{row.discounted}</td>
      <td className="px-3 py-3 text-right font-mono text-[13px]">{formatLatencyMs(latencyMs)}</td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-7 w-[140px]">
            {trend.length > 1 ? (
              <DailyHealthBars points={trend} label={props.healthLabel} heightPx={28} maxDays={15} />
            ) : null}
          </div>
          <span className="font-mono text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
            {formatHealthSuccessRate(displaySuccessRate)}
          </span>
        </div>
      </td>
    </tr>
  );
}


function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function trendAvgSuccessRate(points: HomeTrendPoint[]): number | undefined {
  const values = points.map((point) => point.success_rate).filter((value) => validSuccessRate(value) != null);
  return values.length > 0 ? average(values) : undefined;
}

function validSuccessRate(value: number | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value >= 0 ? value : undefined;
}
