"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { HomeCopy } from "@/lib/home-copy";
import {
  fetchHealthSummary,
  formatCallCount,
  formatLatencyMs,
  formatSuccessRate,
  type HomePerfSummary,
} from "@/lib/home-live";
import type { Locale } from "@/lib/locales";
import { localizePath } from "@/lib/locales";
import { cn } from "@/lib/utils";

export type HomeModelRow = {
  name: string;
  vendor: string;
  official: string;
  discounted: string;
};

type Props = {
  locale: Locale;
  copy: HomeCopy["table"];
  rows: HomeModelRow[];
};

// Screen 4: every model as one efficient list — discount vs official price,
// latency, 30-day health, and real 30-day call volume.
export function HomeModelsTable(props: Props) {
  const [summary, setSummary] = useState<Record<string, HomePerfSummary>>({});

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
    return [...props.rows].sort((a, b) => (summary[b.name]?.request_count ?? 0) - (summary[a.name]?.request_count ?? 0));
  }, [props.rows, summary]);

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
                <th className="px-3 py-3.5 text-right font-bold">{props.copy.colHealth}</th>
                <th className="px-5 py-3.5 text-right font-bold">{props.copy.colCalls}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const perf = summary[row.name];
                return (
                  <tr key={row.name} className="border-b border-violet-500/8 transition-colors last:border-b-0 hover:bg-violet-500/4">
                    <td className="max-w-[260px] px-5 py-3">
                      <div className="truncate font-mono text-[13px] font-semibold tracking-tight">{row.name}</div>
                      <div className="text-muted-foreground/70 text-[11px]">{row.vendor}</div>
                    </td>
                    <td className="text-muted-foreground px-3 py-3 text-right font-mono text-[13px] line-through">{row.official}</td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{row.discounted}</td>
                    <td className="px-3 py-3 text-right font-mono text-[13px]">{formatLatencyMs(perf?.avg_latency_ms)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex items-center justify-end gap-1.5 font-mono text-[13px]">
                        <HealthDot rate={perf?.success_rate} />
                        {formatSuccessRate(perf?.success_rate)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-[13px]">{formatCallCount(perf?.request_count)}</td>
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

function HealthDot(props: { rate: number | undefined }) {
  const rate = props.rate ?? 0;
  return (
    <span
      className={cn(
        "size-2 rounded-full",
        rate >= 99.5 ? "bg-emerald-500" : rate >= 97 ? "bg-amber-500" : rate > 0 ? "bg-red-500" : "bg-slate-300 dark:bg-slate-600"
      )}
      aria-hidden
    />
  );
}
