"use client";

import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import type { HomeCopy } from "@/lib/home-copy";
import { fetchTokenUsage, formatCallCount, TOKEN_USAGE_OTHER, type TokenUsage } from "@/lib/home-live";

// Validated categorical palette (dataviz skill reference, light mode), fixed
// slot order; "Other" always renders in neutral gray.
const SERIES_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948"];
const OTHER_COLOR = "#9ca3af";

type Props = {
  copy: HomeCopy["usage"];
};

// "Top Models" stacked daily token usage across the past month, from the
// rankings API. Hidden entirely when the endpoint is disabled or empty.
export function HomeTokenUsage(props: Props) {
  const [usage, setUsage] = useState<TokenUsage | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTokenUsage().then((data) => {
      if (!cancelled) setUsage(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!usage) return null;
  const maxDay = Math.max(...usage.days.map((day) => day.total), 1);
  const labelEvery = Math.max(1, Math.ceil(usage.days.length / 8));

  return (
    <div className="mb-6 rounded-2xl border border-violet-500/16 bg-white/72 p-6 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm dark:bg-white/[0.04]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <BarChart3 className="size-4 text-violet-600 dark:text-violet-300" />
            {props.copy.title}
          </h3>
          <p className="text-muted-foreground mt-1 text-xs leading-5">{props.copy.subtitle}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tracking-tight">{formatCallCount(usage.total)}</div>
          <div className="text-muted-foreground/70 text-[10px] font-bold tracking-[0.14em] uppercase">{props.copy.tokensLabel}</div>
        </div>
      </div>

      <div className="mt-5 flex h-40 items-end gap-[3px]">
        {usage.days.map((day) => (
          <div key={day.label} className="flex h-full flex-1 flex-col justify-end gap-[1px]">
            {day.values.map((value, index) =>
              value > 0 ? (
                <div
                  key={usage.series[index]}
                  className="w-full rounded-[2px] first:rounded-t-[3px]"
                  style={{
                    height: `${Math.max((value / maxDay) * 100, 0.8)}%`,
                    backgroundColor: usage.series[index] === TOKEN_USAGE_OTHER ? OTHER_COLOR : SERIES_COLORS[index % SERIES_COLORS.length],
                  }}
                  title={`${day.label} · ${usage.series[index]} · ${formatCallCount(value)}`}
                />
              ) : null
            )}
          </div>
        ))}
      </div>
      <div className="text-muted-foreground/60 mt-2 flex justify-between text-[10px]">
        {usage.days.map((day, index) => (
          <span key={day.label} className="flex-1 truncate text-center">
            {index % labelEvery === 0 ? day.label : ""}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-violet-500/10 pt-3">
        {usage.series.map((name, index) => (
          <span key={name} className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <span
              className="size-2.5 rounded-[3px]"
              style={{ backgroundColor: name === TOKEN_USAGE_OTHER ? OTHER_COLOR : SERIES_COLORS[index % SERIES_COLORS.length] }}
            />
            <span className="font-mono">{name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
