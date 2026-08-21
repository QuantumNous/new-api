"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HomeModelLogo } from "@/components/home-model-logo";
import { DailyHealthBars } from "@/components/home-health-bars";
import { formatHealthSuccessRate, getJitteredSuccessRate } from "@/lib/health-display";
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
import { formatContextTokens } from "@/lib/model-directory-meta";
import { modelPublicPath } from "@/lib/model-public";

// Column labels. The directory supplies the full set; the pricing explorer
// supplies only the original five, and the extra columns are skipped rather
// than rendered blank.
export type ModelsDirectoryTableCopy = {
  colModel: string;
  colOfficial: string;
  colLatency: string;
  colHealth: string;
  /** The discounted-price column; named colFlatkey by the pricing explorer. */
  colFlatkey?: string;
  colOurPrice?: string;
  /** Supplying these opts the row into the extra directory columns. */
  colDiscount?: string;
  colContext?: string;
};

type Props = {
  copy: ModelsDirectoryTableCopy;
  rows: HomePricedModel[];
  locale?: Locale;
};

const DEFAULT_TTFT_MS = 600;
const DEFAULT_HEALTH_SUCCESS_RATE = 100;
const HEALTH_BAR_COUNT = 15;
const DAY_SECONDS = 24 * 60 * 60;
/**
 * `getVendorName`'s fallback for models the pricing payload leaves without a
 * vendor. It is a placeholder, not a real author, so neither the table label
 * nor the model-authors filter should present it as one.
 */
export const PLACEHOLDER_VENDOR = "AI";

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
    <div className="overflow-hidden rounded-2xl border border-[#E7E4EC] bg-white shadow-[0_1px_2px_rgba(24,14,38,0.04),0_12px_32px_-24px_rgba(24,14,38,0.18)] dark:border-white/10 dark:bg-white/[0.03]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#EFECF3] bg-[#FBFAFC] text-left text-[11px] font-bold tracking-[0.08em] text-[#6B7280] uppercase dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400">
            <th className="px-5 py-3.5 font-bold">{props.copy.colModel}</th>
            <th className="px-3 py-3.5 text-right font-bold">{props.copy.colOfficial}</th>
            <th className="px-3 py-3.5 text-right font-bold text-[#4C1D95] dark:text-violet-300">
              {props.copy.colOurPrice ?? props.copy.colFlatkey}
            </th>
            {props.copy.colDiscount ? <th className="px-3 py-3.5 text-right font-bold">{props.copy.colDiscount}</th> : null}
            {props.copy.colContext ? <th className="px-3 py-3.5 text-right font-bold">{props.copy.colContext}</th> : null}
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
              showDiscount={props.copy.colDiscount != null}
              showContext={props.copy.colContext != null}
              locale={props.locale}
              onVisible={() => loadTrend(row.name)}
            />
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}

function DirectoryRow(props: {
  row: HomePricedModel;
  perf: HomePerfSummary | undefined;
  trend: HomeTrendPoint[];
  healthLabel: string;
  showDiscount: boolean;
  showContext: boolean;
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
  const measuredSuccessRate = validSuccessRate(perf?.success_rate) ?? trendAvgSuccessRate(trend);
  const displaySuccessRate =
    measuredSuccessRate == null
      ? DEFAULT_HEALTH_SUCCESS_RATE
      : getJitteredSuccessRate(measuredSuccessRate, row.name) ?? measuredSuccessRate;
  const formattedSuccessRate = measuredSuccessRate == null ? "100%" : formatHealthSuccessRate(displaySuccessRate);
  const healthTrend = buildDirectoryHealthTrend(trend);
  const contextLabel = formatContextTokens(row.contextTokens);
  const discount = discountPercent(row.officialUsd, row.discountedUsd);
  const attribution = attributionLabel(row.vendor, row.series);

  return (
    <tr ref={ref} className="border-b border-[#F1EFF5] transition-colors last:border-b-0 hover:bg-[#FAF9FC] dark:border-white/[0.055] dark:hover:bg-white/[0.03]">
      <td className="max-w-[280px] px-5 py-3">
        {props.locale ? (
          <Link
            href={localizePath(modelPublicPath(row.name), props.locale)}
            className="flex items-center gap-2.5 hover:opacity-80"
          >
            <HomeModelLogo
              iconKey={row.iconKey}
              modelName={row.name}
              vendor={row.vendor}
              fallback={row.name.charAt(0).toUpperCase()}
              surfaceSize={30}
              imageSize={18}
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-mono text-[13px] font-semibold tracking-tight underline-offset-2 hover:underline">
                  {row.name}
                </span>
                {row.top10 ? <TopBadge rank={row.top10} /> : null}
              </span>
              <span className="text-muted-foreground/70 block truncate text-[11px]">
                {attribution}
              </span>
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-2.5">
            <HomeModelLogo
              iconKey={row.iconKey}
              modelName={row.name}
              vendor={row.vendor}
              fallback={row.name.charAt(0).toUpperCase()}
              surfaceSize={30}
              imageSize={18}
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-mono text-[13px] font-semibold tracking-tight">{row.name}</span>
                {row.top10 ? <TopBadge rank={row.top10} /> : null}
              </span>
              <span className="text-muted-foreground/70 block truncate text-[11px]">
                {attribution}
              </span>
            </span>
          </div>
        )}
      </td>
      <td className="text-muted-foreground px-3 py-3 text-right font-mono text-[13px]">
        <PriceCell price={row.official} unit={localizePriceUnit(row.priceUnit, props.locale)} prefix={row.pricePrefix} struck />
      </td>
      <td className="px-3 py-3 text-right font-mono text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
        <PriceCell price={row.discounted} unit={localizePriceUnit(row.priceUnit, props.locale)} prefix={row.pricePrefix} />
      </td>
      {props.showDiscount ? (
        <td className="px-3 py-3 text-right font-mono text-[13px]">
          {discount == null ? (
            <span className="text-muted-foreground/60">—</span>
          ) : (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">-{discount.toFixed(1)}% ↓</span>
          )}
        </td>
      ) : null}
      {props.showContext ? (
        <td className="px-3 py-3 text-right font-mono text-[13px]">
          {contextLabel ?? <span className="text-muted-foreground/60">—</span>}
        </td>
      ) : null}
      <td className="px-3 py-3 text-right font-mono text-[13px]">{formatLatencyMs(latencyMs)}</td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-7 w-[140px]">
            <DailyHealthBars points={healthTrend} label={props.healthLabel} heightPx={28} maxDays={HEALTH_BAR_COUNT} />
          </div>
          <span className="font-mono text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
            {formattedSuccessRate}
          </span>
        </div>
      </td>
    </tr>
  );
}

/**
 * Sub-label under the model name: "Vendor · Series".
 *
 * `getVendorName` falls back to the literal "AI" for models whose payload has
 * no vendor, which reads as a fake author in the table. Treat that placeholder
 * as absent: show the series alone, and the model name alone when neither is
 * known, rather than attributing the model to "AI".
 */
export function attributionLabel(vendor: string | undefined, series: string | undefined): string {
  const realVendor = vendor && vendor !== PLACEHOLDER_VENDOR ? vendor : undefined;
  if (realVendor && series) return `${realVendor} · ${series}`;
  return realVendor ?? series ?? "";
}

/** Popularity-board position, shown next to the model name. */
function TopBadge(props: { rank: number }) {  return (
    <span className="shrink-0 rounded bg-amber-400/20 px-1.5 py-0.5 font-sans text-[9px] font-black tracking-wide text-amber-700 uppercase dark:bg-amber-300/15 dark:text-amber-300">
      TOP {props.rank}
    </span>
  );
}

/**
 * Saving against the official rate. Returns null when there is nothing to
 * compare against, so an unpriced row shows "—" rather than a misleading 0%.
 */
export function discountPercent(officialUsd: number, discountedUsd: number): number | null {
  if (!Number.isFinite(officialUsd) || !Number.isFinite(discountedUsd)) return null;
  if (officialUsd <= 0 || discountedUsd < 0) return null;
  const percent = (1 - discountedUsd / officialUsd) * 100;
  return percent < 0 ? null : percent;
}

function PriceCell(props: { price: string; unit?: string; prefix?: string; struck?: boolean }) {
  const price = props.struck ? <span className="line-through">{props.price}</span> : props.price;
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span>
        {props.prefix ? <span className="mr-1 font-sans text-[11px] font-semibold">{props.prefix}</span> : null}
        {price}
      </span>
      {props.unit ? <span className="text-muted-foreground/50 font-sans text-[9px] font-medium normal-case">{props.unit}</span> : null}
    </span>
  );
}

function localizePriceUnit(unit: string | undefined, locale: Locale | undefined): string | undefined {
  if (!unit || locale !== "zh") return unit;
  if (unit === "per second") return "/ 秒";
  if (unit === "per request") return "/ 次";
  if (unit === "per 1M tokens") return "/ 1M tokens";
  return unit;
}

export function buildDirectoryHealthTrend(points: HomeTrendPoint[], fallbackEndTs = currentUtcDayStartSeconds()): HomeTrendPoint[] {
  const realDays = bucketDirectoryHealthDays(points).slice(-HEALTH_BAR_COUNT);
  if (realDays.length === 0) {
    const endTs = utcDayStartSeconds(fallbackEndTs);
    return Array.from({ length: HEALTH_BAR_COUNT }, (_, index) =>
      defaultHealthPoint(endTs - (HEALTH_BAR_COUNT - 1 - index) * DAY_SECONDS)
    );
  }
  if (realDays.length >= HEALTH_BAR_COUNT) return realDays;

  const missing = HEALTH_BAR_COUNT - realDays.length;
  const firstTs = realDays[0].ts;
  const padding = Array.from({ length: missing }, (_, index) =>
    defaultHealthPoint(firstTs - (missing - index) * DAY_SECONDS)
  );
  return [...padding, ...realDays];
}

function bucketDirectoryHealthDays(points: HomeTrendPoint[]): HomeTrendPoint[] {
  const byDay = new Map<number, { successRates: number[]; ttfts: number[] }>();
  for (const point of points) {
    if (!Number.isFinite(point.ts)) continue;
    const dayTs = utcDayStartSeconds(point.ts);
    const bucket = byDay.get(dayTs) ?? { successRates: [], ttfts: [] };
    if (validSuccessRate(point.success_rate) != null) bucket.successRates.push(point.success_rate);
    if (Number.isFinite(point.avg_ttft_ms) && point.avg_ttft_ms > 0) bucket.ttfts.push(point.avg_ttft_ms);
    byDay.set(dayTs, bucket);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, bucket]) => bucket.successRates.length > 0)
    .map(([ts, bucket]) => ({
      ts,
      success_rate: average(bucket.successRates),
      avg_ttft_ms: bucket.ttfts.length > 0 ? average(bucket.ttfts) : DEFAULT_TTFT_MS,
    }));
}

function defaultHealthPoint(ts: number): HomeTrendPoint {
  return { ts, success_rate: DEFAULT_HEALTH_SUCCESS_RATE, avg_ttft_ms: DEFAULT_TTFT_MS };
}

function currentUtcDayStartSeconds(): number {
  return utcDayStartSeconds(Date.now() / 1000);
}

function utcDayStartSeconds(ts: number): number {
  return Math.floor(ts / DAY_SECONDS) * DAY_SECONDS;
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
