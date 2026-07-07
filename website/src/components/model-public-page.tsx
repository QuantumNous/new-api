"use client";

import { ArrowLeft, BadgePercent, Code2, HeartPulse, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DailyHealthBars } from "@/components/home-health-bars";
import { ModelLogo } from "@/components/pricing-model-browser";
import {
  fetchModelTrend,
  formatLatencyMs,
  formatSuccessRate,
  trendAvgTtftMs,
  type HomeTrendPoint,
} from "@/lib/home-live";
import type { Locale } from "@/lib/locales";
import { localizePath } from "@/lib/locales";
import {
  MODEL_PUBLIC_COPY,
  buildModelExampleCurl,
  type ModelPublicKind,
} from "@/lib/model-public";

export type ModelPublicPageProps = {
  locale: Locale;
  modelName: string;
  vendorName: string;
  iconKey?: string;
  endpointTypes: string[];
  kind: ModelPublicKind;
  // Pre-formatted on the server from the pricing payload.
  inputListPrice: string;
  inputDiscounted: string;
  outputListPrice: string;
  outputDiscounted: string;
  apiBaseUrl: string;
  consoleTopUpUrl: string;
};

export function ModelPublicPage(props: ModelPublicPageProps) {
  const copy = MODEL_PUBLIC_COPY[props.locale] ?? MODEL_PUBLIC_COPY.en;
  const [trend, setTrend] = useState<HomeTrendPoint[]>([]);
  const [trendLoaded, setTrendLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchModelTrend(props.modelName).then((points) => {
      if (cancelled) return;
      setTrend(points);
      setTrendLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [props.modelName]);

  const rates = trend.map((point) => point.success_rate).filter((value) => Number.isFinite(value));
  const successRate = rates.length > 0 ? rates.reduce((sum, value) => sum + value, 0) / rates.length : undefined;
  const avgTtft = trendAvgTtftMs(trend);

  const priceRows = [
    { label: copy.input, list: props.inputListPrice, discounted: props.inputDiscounted },
    { label: copy.output, list: props.outputListPrice, discounted: props.outputDiscounted },
  ];

  const curl = buildModelExampleCurl({
    apiBaseUrl: props.apiBaseUrl,
    modelName: props.modelName,
    kind: props.kind,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 pt-28 pb-16 sm:px-6">
      <Link
        href={localizePath("/models", props.locale)}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-xs"
      >
        <ArrowLeft className="size-3.5" />
        {copy.backToModels}
      </Link>

      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/15 bg-violet-500/6">
          <ModelLogo iconKey={props.iconKey} fallback={props.modelName.charAt(0).toUpperCase()} size={26} />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-mono text-2xl font-bold tracking-tight">{props.modelName}</h1>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span>{props.vendorName}</span>
            {props.endpointTypes.map((endpoint) => (
              <span
                key={endpoint}
                className="rounded-full border border-violet-500/20 bg-violet-500/5 px-2 py-0.5 font-mono text-[10px]"
              >
                {endpoint}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Summary band: health + discount */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
            <HeartPulse className="size-3.5" />
            {copy.successRate}
          </div>
          <div className="mt-1 font-mono text-3xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
            {trendLoaded ? formatSuccessRate(successRate) : "…"}
          </div>
          <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
            <Timer className="size-3" />
            {trendLoaded ? formatLatencyMs(avgTtft) : "…"}
          </div>
        </div>
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
            <BadgePercent className="size-3.5" />
            {copy.stackedDiscount}
          </div>
          <div className="mt-1 text-3xl font-bold text-violet-700 dark:text-violet-300">{copy.upToOff}</div>
          <a
            href={props.consoleTopUpUrl}
            className="text-muted-foreground hover:text-foreground mt-1 block text-xs underline decoration-dotted underline-offset-2"
          >
            {copy.discountNote} →
          </a>
        </div>
      </div>

      {/* Pricing */}
      <section className="mt-4 rounded-xl border bg-white/60 p-4 dark:bg-white/[0.03]">
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">{copy.pricing}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {priceRows.map((row) => (
            <div key={row.label} className="rounded-lg border bg-violet-500/[0.03] p-4">
              <div className="text-muted-foreground text-xs">{row.label}</div>
              <div className="text-muted-foreground/70 mt-1 font-mono text-sm tabular-nums">
                {copy.listPrice} <span className="line-through">{row.list}</span>
              </div>
              <div className="mt-0.5 font-mono text-3xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                {row.discounted}
                <span className="text-muted-foreground/50 ml-1 text-sm font-normal">{copy.perMTokens}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 30-day availability trend */}
      <section className="mt-4 rounded-xl border bg-white/60 p-4 dark:bg-white/[0.03]">
        <h2 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          <HeartPulse className="size-3.5" />
          {copy.availability}
        </h2>
        <div className="h-16">
          {trend.length > 1 ? (
            <DailyHealthBars points={trend} label={copy.availability} heightPx={64} />
          ) : (
            <div className="text-muted-foreground/60 flex h-full items-center text-xs">
              {trendLoaded ? copy.noData : "…"}
            </div>
          )}
        </div>
      </section>

      {/* API example */}
      <section className="mt-4 rounded-xl border bg-white/60 p-4 dark:bg-white/[0.03]">
        <h2 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          <Code2 className="size-3.5" />
          {copy.apiTitle}
        </h2>
        <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100">
          {curl}
        </pre>
      </section>
    </div>
  );
}
